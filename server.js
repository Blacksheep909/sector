/* SECTOR — LAN game server. Zero dependencies: `node server.js`, then open the printed URL. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const zlib = require('zlib');
const E = require('./shared/engine');
const SCN = require('./shared/scenarios');
const { botStep, battlePick, draftStep, spawnStep, tradeReply, allyReply, BOT_NAMES } = require('./shared/bot');
const C = require('./shared/cosmetics');
const PZ = require('./shared/personas');
const { createProfiles } = require('./profiles');
const F = require('./filter');

// ── self-update, step 2: the freshly downloaded exe is started with this flag. It waits for the old
//    server to exit, copies itself over the old exe, starts it, and quits. No scripts involved. ──
{
  const i = process.argv.indexOf('--sector-finish-update');
  if (i >= 0) {
    const target = process.argv[i + 1], oldPid = +process.argv[i + 2];
    const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
    let tries = 0;
    const step = () => {
      if (alive(oldPid) && tries++ < 60) return setTimeout(step, 500);
      try { fs.copyFileSync(process.execPath, target); }
      catch (e) { if (tries++ < 80) return setTimeout(step, 500); }
      require('child_process').spawn(target, [], { detached: true, stdio: 'ignore', cwd: path.dirname(target) }).unref();
      setTimeout(() => process.exit(0), 300);
    };
    step();
    return;
  }
  // step 3: the relaunched exe tidies up the downloaded copy
  try { const left = path.join(path.dirname(process.execPath), 'Sector.update.exe'); if (path.basename(process.execPath).toLowerCase() !== 'sector.update.exe' && fs.existsSync(left)) setTimeout(() => { try { fs.unlinkSync(left); } catch (e) {} }, 3000); } catch (e) {}
}

if (process.argv.includes('--public')) Object.assign(process.env, { SECTOR_PUBLIC: '1', SECTOR_NO_OPEN: '1', SECTOR_PLAIN: '1' });
let PORT = +process.env.PORT || 3000;
const BASE_PORT = PORT;
// build-exe injects __SECTOR_VERSION; from source we read package.json
const VERSION = typeof __SECTOR_VERSION !== 'undefined' ? __SECTOR_VERSION : (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version; } catch (e) { return 'dev'; } })();
const REPO = 'Blacksheep909/sector';
const STARTED = Date.now();
const PUBLIC = path.join(__dirname, 'public');
const SERVER_ID = crypto.randomBytes(6).toString('hex'); // lets LAN scanners spot one server reachable on several addresses
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

function lanAddresses() {
  if (process.env.SECTOR_PUBLIC) return [];   // an internet-facing server never advertises its private network addresses
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  return out;
}

// packaged as a single executable? then client files are embedded assets
let sea = null;
try { sea = require('node:sea'); if (!sea.isSea()) sea = null; } catch (e) { sea = null; }
// in a real terminal the server draws a live dashboard; log lines go to its activity feed and a log file
const TUI = (!!process.stdout.isTTY || process.env.SECTOR_TUI === '1') && !process.env.SECTOR_PLAIN;   // SECTOR_TUI=1 forces the dashboard (tests)
const LOG_FILE = path.join(os.tmpdir(), 'sector-server.log');
const activity = [];
function note(text) {
  const line = String(text).trim(); if (!line) return;
  try { fs.appendFileSync(LOG_FILE, new Date().toISOString() + ' ' + line + '\n'); } catch (e) {}
  if (!TUI) return void process.stdout.write('  ' + line + '\n');
  activity.push([new Date().toTimeString().slice(0, 5), line]); if (activity.length > 60) activity.shift();
  if (typeof tuiDraw === 'function') setImmediate(tuiDraw);
}
if (TUI) {
  try { fs.writeFileSync(LOG_FILE, 'SECTOR v' + VERSION + ' ' + new Date().toISOString() + '\n'); } catch (e) {}
  const w = (...a) => { for (const l of a.map(x => x instanceof Error ? x.stack : String(x)).join(' ').split('\n')) note(l.replace(/^\s*\[(game|server)\]\s*/, '')); };
  console.log = console.info = console.warn = console.error = w;
  process.on('uncaughtException', e => w('[crash] ' + (e && e.stack || e)));
}
// online (no dashboard): an unexpected error is logged, never the end of every war on the server
else { process.on('uncaughtException', e => console.error('[crash] ' + (e && e.stack || e))); process.on('unhandledRejection', e => console.error('[crash] ' + (e && e.stack || e))); }
// the host panel only answers the host's own computer. Requests relayed by a tunnel or reverse proxy (Cloudflare Tunnel,
// ngrok, a cloud load balancer) also arrive from 127.0.0.1, so anything carrying forwarding headers is treated as remote,
// and SECTOR_PUBLIC=1 switches the panel off entirely for internet-facing servers
const FWD = ['x-forwarded-for', 'x-real-ip', 'forwarded', 'cf-connecting-ip', 'true-client-ip', 'x-forwarded-host', 'fly-client-ip'];
// a name a player typed: cleaned up, or null (and they're told) when it isn't allowed
function cleanName(raw, c) { const n = F.name(raw); if (!n && raw && String(raw).trim() && c) send(c, { t: 'err', msg: 'That callsign isn’t allowed. Pick another.' }); return n; }
// lobby settings: only the values the menus offer
const SETTING_OK = { mode: ['domination', 'conquest', 'koth', 'worldwar'], mapType: ['random', 'continent', 'pangaea', 'twin', 'archipelago', 'inland', 'crescent', 'ocean'], mapSize: ['small', 'medium', 'large', 'huge'], spawns: ['pick', 'random'], fog: ['on', 'off'], events: ['on', 'off'], timer: ['0', '45', '60', '90', '150'], maxRounds: ['0', '15', '25', '40'], teams: ['off', 'on'], speed: ['normal', 'fast', 'super', 'max'], bank: ['off', '3', '6'], personas: ['on', 'off'] };
function cleanSettings(s) {
  const out = {}; if (!s || typeof s !== 'object') return out;
  for (const k in SETTING_OK) if (k in s && SETTING_OK[k].includes(String(s[k]))) out[k] = ['timer', 'maxRounds'].includes(k) ? +s[k] : String(s[k]);
  if ('conquestPct' in s && Number.isFinite(+s.conquestPct)) out.conquestPct = Math.max(30, Math.min(100, Math.round(+s.conquestPct)));
  if ('seed' in s) out.seed = F.tidy(s.seed, 20).replace(/[^\p{L}\p{N} _-]/gu, '');
  return out;
}
// where a connection comes from, as the console shows it
const addrOf = c => { const a = (c.socket.remoteAddress || '').replace('::ffff:', ''); return a === '127.0.0.1' || a === '::1' ? 'this PC' : a; };
const isLoopback = req => !process.env.SECTOR_PUBLIC && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && !FWD.some(h => req.headers[h]);

// ───────────────────────── http ─────────────────────────
// the browser is told to run scripts only from this server (so text a player typed can never run as code), not to guess
// file types, and not to let other sites frame the game. Styles may be inline (the UI sets them), fonts come from Google;
// a LAN server also lets the page look for other SECTOR servers on the network
const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self' ws: wss:" + (process.env.SECTOR_PUBLIC ? '' : ' http:') + "; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'";
const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (url === '/') url = '/index.html';
  if (url === '/info') {
    // discovery: other SECTOR clients on the LAN scan for this
    const f = focusRoom(), lobby = f ? f.lobby : { players: [] }, game = f && f.game, host = lobby.players.find(p => p.id === lobby.hostId), st = menuStats();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify({ game: 'sector', version: VERSION, id: SERVER_ID, host: host ? host.name : null, players: allSeats().length, humans: allSeats().filter(x => !x.p.bot).length, online: st.online, rooms: st.rooms, wars: st.wars, inGame: !!game, round: game ? game.turn.round : 0, bots: game ? game.players.filter(p => p.alive && p.bot).length : lobby.players.filter(p => p.bot).length, port: PORT, lan: lanAddresses(),
      // the lobbies people are in, so a LAN finder (or a code typed on another server) can go straight to one
      lobbies: process.env.SECTOR_PUBLIC ? [] : [...rooms.values()].filter(r => r.humans() > 0 && r.kind !== 'public').map(r => ({ code: r.code, host: (r.lobby.players.find(p => p.id === r.lobby.hostId) || {}).name || null, humans: r.humans(), inGame: !!r.game, main: r.code === MAIN })) }));
  }
  if (url === '/news') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' });
    return res.end(JSON.stringify(news()));
  }
  if (url.startsWith('/auth/')) return authCallback(req, res, url);
  if (url === '/host' || url.startsWith('/host/')) return hostApi(req, res, url);
  if (url === '/dev' && DEV_KEY) url = '/dev.html';
  if (url.startsWith('/dev/api/')) return devApi(req, res, url);
  const name = url.replace(/^\/+/, '');
  if (!name || name.includes('..') || name.includes('\\') || /[\x00-\x1f]/.test(name)) { res.writeHead(403); return res.end(); }
  if (name === 'dev.html' && !DEV_KEY) { res.writeHead(404); return res.end('not found'); }   // no key, no panel
  const rel = name === 'engine.js' ? (sea ? 'engine.js' : 'shared/engine.js') : name === 'cosmetics.js' ? (sea ? 'cosmetics.js' : 'shared/cosmetics.js') : name === 'scenarios.js' ? (sea ? 'scenarios.js' : 'shared/scenarios.js') : 'public/' + name;
  const done = (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(name)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ...SECURITY_HEADERS, ...(name.endsWith('.html') && name !== 'dev.html' ? { 'Content-Security-Policy': CSP } : {}) });
    res.end(data);
  };
  if (sea) { try { done(null, Buffer.from(sea.getAsset(rel))); } catch (e) { done(e); } }
  else fs.readFile(path.join(__dirname, rel), done);
});

// ───────────────────────── minimal websocket ─────────────────────────
const sockets = new Set();   // every open connection, in a room or on the front menu
// limits on what one connection (or one address) can throw at the server
const MAX_MSG = 128 * 1024, MSG_PER_SEC = 40, MAX_PER_IP = +process.env.SECTOR_MAX_PER_IP || 16;
// the player's address: behind Cloudflare (or another proxy) every connection comes from the proxy, so SECTOR_TRUST_PROXY=1
// reads the address the proxy passes on. Only set it behind a proxy, or anyone could claim any address
function clientIp(req) {
  if (process.env.SECTOR_TRUST_PROXY) { const h = req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim(); if (h) return h; }
  return String(req.socket.remoteAddress || '').replace('::ffff:', '');
}
server.on('upgrade', (req, socket) => {
  if (req.headers['upgrade'] !== 'websocket' || !req.headers['sec-websocket-key']) return socket.destroy();
  const ip = clientIp(req);
  if ([...sockets].filter(x => x.ip === ip).length >= MAX_PER_IP) { socket.end('HTTP/1.1 429 Too Many Requests\r\n\r\n'); return; }
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  const client = { socket, ip, buf: Buffer.alloc(0), pid: null, frags: [], seen: Date.now(), cid: crypto.randomBytes(6).toString('hex'), room: null, party: null, name: null, profileId: null, origin: originOf(req), rateAt: 0, rateN: 0, dropped: 0, chats: [], roomAt: 0, roomTokens: 5 };
  // chat: one message per 0.6s and six per ten seconds
  client.chatOk = () => { const now = Date.now(); client.chats = client.chats.filter(t => now - t < 10000); if (client.chats.length >= 6 || now - (client.chats[client.chats.length - 1] || 0) < 600) return false; client.chats.push(now); return true; };
  sockets.add(client);
  socket.on('data', d => { client.buf = Buffer.concat([client.buf, d]); readFrames(client); });
  const close = () => { if (!sockets.has(client)) return; sockets.delete(client); onSocketClose(client); };
  socket.on('close', close); socket.on('error', close); socket.on('end', close);
});

function readFrames(c) {
  c.seen = Date.now();
  while (c.buf.length >= 2) {
    const b0 = c.buf[0], b1 = c.buf[1];
    const fin = b0 & 0x80, op = b0 & 0x0f, masked = b1 & 0x80;
    let len = b1 & 0x7f, off = 2;
    if (len === 126) { if (c.buf.length < 4) return; len = c.buf.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (c.buf.length < 10) return; len = Number(c.buf.readBigUInt64BE(2)); off = 10; }
    const maskOff = off; if (masked) off += 4;
    if (len > MAX_MSG || c.frags.reduce((a, f) => a + f.length, 0) + len > MAX_MSG) { try { c.socket.destroy(); } catch (e) {} return; }   // far bigger than any real message
    if (c.buf.length < off + len) return;
    const payload = Buffer.from(c.buf.subarray(off, off + len));
    if (masked) for (let i = 0; i < len; i++) payload[i] ^= c.buf[maskOff + (i & 3)];
    c.buf = c.buf.subarray(off + len);
    if (op === 8) { try { c.socket.end(); } catch (e) {} return; }
    if (op === 9) { sendFrame(c, payload, 10); continue; }
    if (op === 1 || op === 0) {
      c.frags.push(payload);
      if (!fin) continue;
      const text = Buffer.concat(c.frags).toString('utf8'); c.frags = []; let msg; try { msg = JSON.parse(text); } catch (e) { continue; }
      // a flood is dropped, and a connection that keeps flooding is closed
      const now = Date.now(); if (now - c.rateAt >= 1000) { c.rateAt = now; c.rateN = 0; }
      if (++c.rateN > MSG_PER_SEC) { if (++c.dropped > 200) { try { c.socket.destroy(); } catch (e) {} return; } continue; }
      // one bad message never takes the server down: it's logged and the server carries on
      try { route(c, msg); } catch (e) { console.error('[msg] ' + String(msg && msg.t).slice(0, 20) + ' failed: ' + (e && e.stack || e)); }
    }
  }
}
function sendFrame(c, data, op = 1) {
  const body = Buffer.isBuffer(data) ? data : Buffer.from(data);
  let head;
  if (body.length < 126) head = Buffer.from([0x80 | op, body.length]);
  else if (body.length < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(body.length, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(body.length), 2); }
  try { c.socket.write(Buffer.concat([head, body])); } catch (e) {}
}
const send = (c, obj) => sendFrame(c, JSON.stringify(obj));

// heartbeat: ping everyone; sockets silent for 20s are treated as gone
setInterval(() => {
  for (const c of [...sockets]) {
    if (Date.now() - c.seen > 20000) { try { c.socket.destroy(); } catch (e) {} sockets.delete(c); onSocketClose(c); }
    else sendFrame(c, Buffer.alloc(0), 9);
  }
}, 6000);

// ───────────────────────── a room: one lobby and its war ─────────────────────────
// Everything from here to the end of createRoom belongs to a single room. Rooms share nothing but profiles,
// so online each one can live in its own isolated worker (one Cloudflare Durable Object per room, say).
const PUBLIC_SEATS = 6, PUBLIC_MIN = 4;
// quick-play rooms: a standard war with a turn clock, so strangers can't stall it
const PUBLIC_SETTINGS = { mode: 'domination', mapSize: 'small', mapType: 'random', spawns: 'random', fog: 'on', events: 'on', timer: 60, maxRounds: 0, conquestPct: 60, seed: '', teams: 'off', speed: 'fast', bank: 'off', personas: 'on' };
function createRoom(code, kind) {
const clients = new Set();   // the connections in this room
const lobby = { players: [], hostId: null, kind, code, settings: kind === 'public' ? { ...PUBLIC_SETTINGS } : { mode: 'domination', mapSize: 'medium', mapType: 'random', spawns: 'pick', fog: 'on', events: 'on', timer: 0, maxRounds: 0, conquestPct: 60, seed: '', teams: 'off', speed: 'fast', bank: 'off', personas: 'on' } };
const isPublic = kind === 'public';
// the factions a connection may play: what its profile has unlocked (no profile, as with tools and tests: all of them)
const factionsFor = c => { const pr = c && c.profileId && profiles.get(c.profileId); return pr ? C.factionsOf(pr) : Object.keys(E.FACTIONS); };
const pickFaction = c => { const f = factionsFor(c); return f[Math.floor(Math.random() * f.length)]; };
let game = null;           // engine state
let botMem = {}, botTimer = null, turnTimer = null, idleTimer = null;
let nextPid = 1;
const autoPids = new Set(); // dev: humans driven by the bot AI (SECTOR_DEV=1)

function lobbyView() {
  return {
    code, kind, cap: isPublic ? PUBLIC_SEATS : 8,
    players: lobby.players.map(p => ({ id: p.id, name: p.name, handle: p.handle || null, color: p.color, faction: p.faction, bot: p.bot, diff: p.diff, local: !!p.local, controller: p.controller || null, spectator: !!p.spectator, team: p.team || 0, cos: p.cos || null, ready: isReady(p), away: !!p.away, afk: !!p.afk, connected: p.bot || isConnected(p.id) })),
    hostId: lobby.hostId, solo: !!lobby.solo, saveCap: profiles.SAVE_CAP, settings: lobby.settings, inGame: !!game, saves: game || isPublic ? [] : savesFor((lobby.players.find(p => p.id === lobby.hostId) || {}).profileId), version: VERSION, lan: lanAddresses().map(a => 'http://' + a + ':' + PORT), port: PORT,
  };
}
// ready-up: every human commander (not bots, spectators or pass-and-play seats, whose device owner readies for them) must be ready
const isReady = p => !!(p.bot || p.spectator || p.local || p.ready);
const notReady = () => lobby.players.filter(p => !isReady(p));
const isConnected = pid => {
  const lp = lobby.players.find(p => p.id === pid);
  if (lp && lp.local) return [...clients].some(c => c.pid === lp.controller);
  return [...clients].some(c => c.pid === pid);
};
// pass & play: a client controls its own seat plus any local seats it added
const seatsOf = c => c.pid ? [c.pid, ...lobby.players.filter(p => p.local && p.controller === c.pid).map(p => p.id)] : [];
const controls = (c, pid) => seatsOf(c).includes(pid);
// which seat a client is looking through right now
// whether a client is on pid's side (they hold pid's seat, a teammate's or an ally's); spectators watch everything
function onSide(cl, pid, strict) {
  const seats = seatsOf(cl); if (!seats.length) return !strict;
  return seats.some(x => x === pid || (game && E.isAlly(game, x, pid)));
}
function seatFor(c) {
  const seats = seatsOf(c);
  if (!game || seats.length < 2) return c.pid;
  if (game.phase === 'spawn' && game.spawn) { const cur = game.spawn.order[game.spawn.i]; return seats.includes(cur) ? cur : c.pid; }
  if (game.phase === 'draft' && game.draft) { const open = seats.find(id => { const pl = game.players.find(p => p.id === id); return pl && pl.alive && !game.draft.picked[id]; }); return open || c.pid; }
  if (game.phase === 'play') {
    const cur = game.players[game.turn.idx];
    if (cur && seats.includes(cur.id)) return cur.id;
    if (game.trade && seats.includes(game.trade.to)) return game.trade.to;
  }
  return c.pid;
}
// teams mode: everyone playing is on a team. Newcomers (and everyone, when teams are switched on) join the smaller side
function fillTeams() {
  if (lobby.settings.teams !== 'on' || game) return;
  for (const p of lobby.players) {
    if (p.spectator || p.team) continue;
    const n = t => lobby.players.filter(q => !q.spectator && q.team === t).length;
    p.team = n(2) < n(1) ? 2 : 1;
  }
}
function broadcastLobby() { fillTeams(); const v = lobbyView(); for (const c of clients) send(c, { t: 'lobby', lobby: v }); }
const undoStack = []; undoStack.owner = null;
let fogMem = {};   // fog of war: what each commander has explored and last seen
const fogFor = seat => seat ? (fogMem[seat] = fogMem[seat] || { explored: new Set(), seen: {} }) : null;
function broadcastState(events, by, seq) {
  // analytics: what gets deployed (every action, bots included, passes through here)
  if (game && events) for (const e of events) if (e.e === 'deploy' && e.unit) { const t = game.tally = game.tally || { deploys: {} }; t.deploys[e.unit.type] = (t.deploys[e.unit.type] || 0) + 1; }
  if (game && game.players[game.turn.idx] && game.players[game.turn.idx].id !== undoStack.owner) undoStack.length = 0;
  setTimeout(sendNotes, 0);   // alliances may have changed who sees whose war-room marks
  banter(events);
  for (const c of clients) { if (c.left) continue; const seat = seatFor(c); send(c, { t: 'state', state: E.view(game, seat, fogFor(seat)), events: filterEvents(events, seat), by, seq, seat, mine: controls(c, by), undo: undoStack.owner === seat ? undoStack.length : 0, timeLeft: game && game.turn.deadline ? Math.max(0, game.turn.deadline - (game.turn.pausedAt || Date.now())) : 0, paused: !!(game && game.turn.pausedAt) }); }
}
// ally war room: arrows and circles each commander draws on the map, shown only to them and their allies
const warNotes = {};
function sendNotes() {
  if (!game) return;
  for (const c of clients) {
    if (c.left) continue; const seat = seatFor(c); if (!seat) { if (c.notesSig !== '[]') { c.notesSig = '[]'; send(c, { t: 'notes', notes: [] }); } continue; }
    const notes = Object.keys(warNotes).filter(pid => pid === seat || E.isAlly(game, seat, pid)).map(pid => ({ pid, shapes: warNotes[pid] }));
    const sig = JSON.stringify(notes); if (sig === c.notesSig) continue; c.notesSig = sig;   // unchanged marks aren't re-sent
    send(c, { t: 'notes', notes });
  }
}
function filterEvents(events, pid) {
  let out = events.map(e => (e.e === 'card' && e.pid !== pid && e.kind === 'tactic' && e.rarity !== 'legendary') ? { ...e, id: null } : (e.e === 'airbase' && e.pid !== pid) ? { ...e, card: null } : e);   // which card someone drew stays theirs
  const pl = game && pid && game.players.find(p => p.id === pid);
  // fog of war: where a rival set up their HQ stays secret
  if (game && game.settings.fog === 'on') out = out.filter(e => e.e !== 'spawnPicked' || e.pid === pid || (pid && E.isAlly(game, pid, e.pid)));
  if (game && game.settings.fog === 'on' && pl && pl.alive && game.phase === 'play') {
    const vis = E.visionOf(game, pid), mine = e => e.pid === pid || (e.pid && E.teammate(game, pid, e.pid));   // an ally's moves and fights out of your sight stay out of sight (a teammate's don't)
    const myLand = new Set(Object.keys(game.map.tiles).filter(k => game.map.tiles[k].owner === pid));
    const nearMe = k => k && E.area(k, 2).some(a => myLand.has(a));
    const radar = [];
    out = out.filter(e => {
      if (mine(e)) return true;
      if (e.e === 'move') { const seen = (e.path || []).some(k => vis.has(k)); if (!seen && e.path && nearMe(e.path[e.path.length - 1])) radar.push({ e: 'radar', hex: e.path[e.path.length - 1] }); return seen; }
      if (e.e === 'combat') return vis.has(e.to) || (e.def && e.def.pid === pid);
      if (e.e === 'deploy' || e.e === 'build' || e.e === 'loot') return vis.has(e.hex);
      if (e.e === 'advance') return vis.has(e.to);
      if (e.e === 'income' || e.e === 'scrap') return !e.hq || vis.has(e.hq);   // a rival's income pops over their HQ: don't give it away
      if (e.e === 'shell' || e.e === 'intercept') return vis.has(e.to) || vis.has(e.from);
      if (e.e === 'overwatch') return vis.has(e.hex);
      return true;
    });
    out = out.concat(radar);
  }
  return out;
}
function freeColor() { return E.COLORS.find(c => !lobby.players.some(p => p.color === c)) || E.COLORS[0]; }

function onMessage(c, m) {
  switch (m.t) {
    case 'hello': {
      c.left = false;
      // a watch link (the dev panel's SPECTATE): see the game without taking a seat
      if (m.watch) { send(c, { t: 'welcome', you: null, spectator: true }); send(c, { t: 'lobby', lobby: lobbyView() }); if (game) send(c, { t: 'state', state: E.view(game, null), events: [] }); return; }
      let p = m.token && lobby.players.find(x => x.token === m.token);
      if (!p && game) { send(c, { t: 'welcome', you: null, spectator: true }); send(c, { t: 'lobby', lobby: lobbyView() }); send(c, { t: 'state', state: E.view(game, null), events: [] }); return; }
      if (!p) {
        if (lobby.players.filter(x => !x.bot || !isPublic).length >= (isPublic ? PUBLIC_SEATS : 8)) return send(c, { t: 'err', msg: 'That room is full' });
        if (isPublic) { const bot = lobby.players.find(x => x.bot); if (bot && lobby.players.length >= PUBLIC_SEATS) lobby.players = lobby.players.filter(x => x !== bot); }
        p = { id: 'p' + nextPid++, token: crypto.randomBytes(12).toString('hex'), name: cleanName(m.name, c) || 'Commander', color: freeColor(), faction: pickFaction(c), bot: false };
        lobby.players.push(p);
        note(p.name + ' joined from ' + addrOf(c));
      } else if (!isConnected(p.id)) note(p.name + ' reconnected');
      if (p.away && game) { c.pid = p.id; returnSeats(p); }
      c.pid = p.id;
      // the player's profile (coins, skins): their loadout shows on their seat for everyone
      { const pr = c.profileId && profiles.get(c.profileId); if (pr) { p.profileId = pr.id; p.handle = pr.refCode; p.cos = C.cleanLoadout(pr.equipped, pr.owned, pr.cards); } }
      // the first commander in hosts it (public wars too: whoever opened it picks the settings and presses DEPLOY)
      if (!lobby.hostId || !lobby.players.some(x => x.id === lobby.hostId && !x.bot)) lobby.hostId = p.id;
      send(c, { t: 'welcome', you: p.id, token: p.token });
      broadcastLobby();
      if (game) { const seat = seatFor(c); send(c, { t: 'state', state: E.view(game, seat, fogFor(seat)), events: [], seat }); afterChange(); }
      return;
    }
    case 'skipFx': {
      // relay a fight skip: only someone fighting in it may skip, unless nobody in it is human
      if (!game) return;
      const side = id => id && game.players.find(p => p.id === id);
      const human = [m.att, m.def].map(side).filter(p => p && !p.bot);
      const mine = seatsOf(c);
      if (human.length && !human.some(p => mine.includes(p.id))) return;
      // human against human: it only skips once both have asked (each sees that the other has)
      const live = human.filter(p => humanAt(p.id));
      if (live.length >= 2) {
        const key = m.att + '>' + m.def + '@' + m.to;
        if (!skipVotes.key || skipVotes.key !== key || Date.now() - skipVotes.at > 30000) Object.assign(skipVotes, { key, at: Date.now(), pids: new Set() });
        for (const p of live) if (mine.includes(p.id)) skipVotes.pids.add(p.id);
        const all = live.every(p => skipVotes.pids.has(p.id));
        for (const cl of clients) send(cl, all ? { t: 'skipFx', att: m.att, def: m.def, to: m.to } : { t: 'skipVote', att: m.att, def: m.def, to: m.to, pids: [...skipVotes.pids] });
        if (all) skipVotes.key = null;
        return;
      }
      for (const cl of clients) if (cl !== c) send(cl, { t: 'skipFx', att: m.att, def: m.def, to: m.to });
      return;
    }
    case 'takeover': {
      // a spectator steps into a bot's boots mid-game: same seat, colour, army and cards
      if (!game) return;
      if (c.pid) {
        // lobby spectators (who sat this game out) may take over too; their spectator entry is replaced by the seat
        const sp = lobby.players.find(p => p.id === c.pid);
        if (!sp || !sp.spectator || game.players.some(g => g.id === c.pid)) return;
        lobby.players = lobby.players.filter(p => p !== sp);
      }
      const lp = lobby.players.find(p => p.id === m.id && p.bot), gp = game.players.find(p => p.id === m.id);
      if (!lp || !gp || !gp.alive || !gp.bot) return send(c, { t: 'err', msg: 'That seat is not a bot any more' });
      const name = cleanName(m.name, c) || 'Commander', was = gp.name.replace(/ \(bot\)$/, '');
      lp.bot = false; lp.diff = null; lp.spectator = false; lp.token = crypto.randomBytes(12).toString('hex'); lp.name = name;
      gp.bot = false; gp.diff = null; gp.name = name;
      lp.since = Date.now(); lp.base = { kills: gp.stats.kills, captured: gp.stats.captured, crates: gp.stats.crates };   // rewards count from here
      c.pid = lp.id; botMem = {};
      if (!lobby.hostId || !lobby.players.some(x => x.id === lobby.hostId && !x.bot)) lobby.hostId = lp.id;
      game.log.push('🎮 ' + name + ' took over from ' + was + '.');
      note(name + ' took over ' + was + ' from ' + addrOf(c));
      send(c, { t: 'welcome', you: lp.id, token: lp.token });
      game.v++; broadcastLobby(); broadcastState([], null);
      return afterChange();
    }
    case 'me': {
      const p = lobby.players.find(x => x.id === c.pid); if (!p || game) return;
      if (m.name) p.name = cleanName(m.name, c) || p.name;
      if (m.faction && E.FACTIONS[m.faction] && factionsFor(c).includes(m.faction)) p.faction = m.faction;
      if (m.color && E.COLORS.includes(m.color) && m.color !== p.color) {
        // a human-held colour stays locked; a bot holding it swaps to your old colour so nobody clashes
        const holder = lobby.players.find(x => x.color === m.color && x !== p);
        if (!holder) p.color = m.color;
        else if (holder.bot || (holder.local && holder.controller === c.pid)) { holder.color = p.color; p.color = m.color; }
      }
      return broadcastLobby();
    }
    case 'settings': if (c.pid !== lobby.hostId || game) return; Object.assign(lobby.settings, cleanSettings(m.settings)); for (const p of lobby.players) if (p.id !== lobby.hostId) p.ready = false; return broadcastLobby();
    case 'addLocal': {
      if (game || !c.pid || isPublic || lobby.players.length >= 8) return;   // shared-screen players are for rooms of your own
      const n = lobby.players.filter(p => p.local).length + 2;
      lobby.players.push({ id: 'p' + nextPid++, token: null, name: 'Player ' + n, color: freeColor(), faction: pickFaction(c), bot: false, local: true, controller: c.pid });
      return broadcastLobby();
    }
    case 'seatCfg': {
      const sp = lobby.players.find(p => p.id === m.id && p.local && p.controller === c.pid);
      if (!sp || game) return;
      if (m.name) sp.name = cleanName(m.name, c) || sp.name;
      if (m.faction && E.FACTIONS[m.faction] && factionsFor(c).includes(m.faction)) sp.faction = m.faction;   // pass & play seats use the device owner's factions
      if (m.color && E.COLORS.includes(m.color) && !lobby.players.some(x => x.color === m.color && x !== sp)) sp.color = m.color;
      return broadcastLobby();
    }
    case 'addBot': {
      if (c.pid !== lobby.hostId || game || lobby.players.length >= (isPublic ? PUBLIC_SEATS : 8)) return;
      const used = new Set(lobby.players.map(p => p.name));
      const name = BOT_NAMES.find(n => !used.has(n)) || 'Bot';
      // a new bot takes the difficulty of the bot above it (so filling a lobby with Hard bots is one setting, not five)
      const prev = [...lobby.players].reverse().find(p => p.bot);
      const diff = E.DIFFICULTY[m.diff] || m.diff === 'random' ? m.diff : prev ? prev.diff : 'medium';
      lobby.players.push({ id: 'p' + nextPid++, token: null, name, color: freeColor(), faction: Object.keys(E.FACTIONS)[Math.floor(Math.random() * 5)], bot: true, diff, cos: C.botLoadout() });
      return broadcastLobby();
    }
    case 'ready': {
      const rp = lobby.players.find(p => p.id === c.pid); if (!rp || game) return;
      rp.ready = !!m.on;
      return broadcastLobby();
    }
    case 'team': {
      // teams mode: the host can move anyone; players can move themselves (and their local seats)
      const tp = lobby.players.find(p => p.id === m.id); if (!tp || game) return;
      if (!(c.pid === lobby.hostId || tp.id === c.pid || (tp.local && tp.controller === c.pid))) return;
      tp.team = Math.max(1, Math.min(4, +m.team || 1));
      return broadcastLobby();
    }
    case 'botCfg': {
      if (c.pid !== lobby.hostId || game) return;
      const b = lobby.players.find(p => p.id === m.id && p.bot); if (!b) return;
      if (m.diff && (E.DIFFICULTY[m.diff] || m.diff === 'random')) b.diff = m.diff;
      if (m.faction && E.FACTIONS[m.faction]) b.faction = m.faction;
      return broadcastLobby();
    }
    case 'spectate': {
      // before a game: sit yourself (or, as host, any human) out to watch instead of play
      const target = lobby.players.find(p => p.id === m.id);
      if (!target || game || target.bot) return;
      if (!(target.id === c.pid || c.pid === lobby.hostId || (target.local && target.controller === c.pid))) return;
      target.spectator = !!m.on;
      note(target.name + (target.spectator ? ' will spectate' : ' will play'));
      return broadcastLobby();
    }
    case 'kick': {
      if (m.id === c.pid) return;
      const target = lobby.players.find(p => p.id === m.id);
      if (!target || !(c.pid === lobby.hostId || (target.local && target.controller === c.pid))) return;
      if (game) {
        if (target.bot) return;
        const seats = [target.id, ...lobby.players.filter(p => p.local && p.controller === target.id).map(p => p.id)];
        game.log.push('👢 ' + target.name + ' was removed by the host — a bot took over.');
        botifySeats(seats, true);
        for (const cl of clients) if (seats.includes(cl.pid)) { send(cl, { t: 'kicked' }); cl.pid = null; cl.left = true; clients.delete(cl); }
        note(target.name.replace(/ \(bot\)$/, '') + ' was kicked by the host');
        game.v++; broadcastLobby(); broadcastState([], null); return afterChange();
      }
      lobby.players = lobby.players.filter(p => p.id !== m.id && p.controller !== m.id);
      for (const cl of clients) if (cl.pid === m.id) { send(cl, { t: 'kicked' }); cl.pid = null; cl.left = true; clients.delete(cl); }
      return broadcastLobby();
    }
    case 'start': if (c.pid !== lobby.hostId || game) return; return startGame(c);
    case 'soloSetup': {
      if (c.pid !== lobby.hostId || game || isPublic || lobby.players.length !== 1) return;
      lobby.solo = true; lobby.settings.spawns = 'random';
      for (let i = 0; i < 3; i++) onMessage(c, { t: 'addBot' });
      return broadcastLobby();
    }
    case 'scenario': {
      // a solo mission: the host plays it, anyone else in the lobby watches
      if (game) return send(c, { t: 'err', msg: 'Finish or leave the current game first' });
      if (c.pid !== lobby.hostId) return send(c, { t: 'err', msg: 'Only the host can start a mission' });
      if (isPublic) return send(c, { t: 'err', msg: 'Missions are played in a room of your own' });
      const lp = lobby.players.find(p => p.id === c.pid), sc = SCN.get(m.id); if (!lp || !sc) return;
      resetWar();
      game = SCN.build(sc.id, lp.id, lp.name, lp.color); game.v = 1; game.saveId = null;
      game.players[0].cos = lp.cos || null;
      console.log('[game] mission ' + sc.n + ': ' + sc.name);
      broadcastLobby();
      broadcastState([{ e: 'scenarioStart', id: sc.id }], null);
      return afterChange();
    }
    case 'clockResume': {
      if (!game || !game.turn.pausedAt) return;
      const cur = game.players[game.turn.idx]; if (!cur || !controls(c, cur.id)) return;
      resumeClock(); broadcastState([], null); return afterChange();
    }
    case 'undo': {
      if (!game || game.phase !== 'play') return;
      const cur = game.players[game.turn.idx];
      if (!cur || !controls(c, cur.id)) return;
      if (!undoStack.length || undoStack.owner !== cur.id) return send(c, { t: 'err', msg: 'Nothing to undo: fights, loot, cards and newly scouted fog can\'t be taken back', seq: m.seq });
      game = JSON.parse(undoStack.pop()); game.v++;
      broadcastState([{ e: 'undo', pid: cur.id }], cur.id, m.seq);
      return afterChange();
    }
    case 'draw': {
      // war-room marks: add an arrow/circle, remove marks touching a hex, or clear all of yours
      if (!game || !c.pid) return;
      const pid = m.as && controls(c, m.as) ? m.as : c.pid; const list = warNotes[pid] = warNotes[pid] || [];
      if (m.op === 'add' && m.shape && ['arrow', 'circle'].includes(m.shape.type) && game.map.tiles[m.shape.a] && (m.shape.type === 'circle' || game.map.tiles[m.shape.b])) {
        list.push({ type: m.shape.type, a: m.shape.a, b: m.shape.type === 'arrow' ? m.shape.b : null }); if (list.length > 40) list.shift();
      } else if (m.op === 'remove') warNotes[pid] = list.filter(sh => sh.a !== m.hex && sh.b !== m.hex);
      else if (m.op === 'clear') warNotes[pid] = [];
      return sendNotes();
    }
    case 'ow': {
      if (!pendingOw || !controls(c, pendingOw.owner)) return;
      return answerOw(!!m.fire);
    }
    case 'battleCard': case 'battleReady': {
      if (!pendingBattle || !game || !game.battle) return;
      const side = [game.battle.att, game.battle.def].find(pid => pendingBattle.humans.includes(pid) && controls(c, pid)); if (!side) return;
      if (m.t === 'battleReady') { pendingBattle.ready.add(side); return battleTick(); }
      const r = E.battleCard(game, side, m.uid);
      if (!r.ok) return send(c, { t: 'err', msg: r.err });
      game.v++; broadcastState(r.events, side);
      // the other side gets a moment to answer: bots straight away, a human who'd said ready is asked again
      for (const pid of pendingBattle.humans) if (pid !== side) pendingBattle.ready.delete(pid);
      pendingBattle.until = Math.min(pendingBattle.cap, Math.max(pendingBattle.until, Date.now() + 4000));
      botBattleCards();
      return battleTick();
    }
    case 'ping': case 'emote': {
      // map pings and taunts (rate-limited), relayed to everyone
      if (!game || !c.pid || Date.now() - (c.lastPing || 0) < 700) return; c.lastPing = Date.now();
      const p = lobby.players.find(x => x.id === (m.as && controls(c, m.as) ? m.as : c.pid)); if (!p) return;
      const EMOTES = ['👊', '😂', '😱', '🏳️', '💀', '🔥', '🤝', '😈'], PINGS = ['attack', 'help', 'look'];
      // map pings are for your own side (teammates and allies): the enemy doesn't get to read your plans
      if (m.t === 'ping') { if (!game.map.tiles[m.hex] || !PINGS.includes(m.kind)) return; for (const cl of clients) if (onSide(cl, p.id)) send(cl, { t: 'ping', pid: p.id, hex: m.hex, kind: m.kind }); }
      else { if (!EMOTES.includes(m.emote)) return; for (const cl of clients) send(cl, { t: 'emote', pid: p.id, emote: m.emote }); }
      return;
    }
    case 'act': {
      if (!game) return;
      const actor = m.as && controls(c, m.as) ? m.as : c.pid;
      if (pendingBattle) return send(c, { t: 'err', msg: 'A battle is being decided…', seq: m.seq });
      if (pendingOw) return send(c, { t: 'err', msg: 'Waiting for an overwatch decision…', seq: m.seq });
      if (game.paused && game.phase === 'play') return send(c, { t: 'err', msg: 'The game is paused', seq: m.seq });
      if (!m[BATTLED] && startBattle(actor, m.action, () => onMessage(c, { ...m, [BATTLED]: true }))) return;
      const isCur = game.players[game.turn.idx] && game.players[game.turn.idx].id === actor;
      const snap = isCur && ['move', 'deploy', 'build'].includes((m.action || {}).a) ? JSON.stringify(game) : null;
      const r = E.applyAction(game, actor, m.action || {});
      if (m[BATTLED]) E.closeBattle(game, true);
      if (!r.ok) return send(c, { t: 'err', msg: r.err, seq: m.seq });
      { const lp = lobby.players.find(x => x.id === actor); if (lp) { lp.seenAt = Date.now(); lp.idle = 0; } if (isCur) actedKey = turnKey; }
      if (game.turn.deadline && !game.turn.pausedAt && r.events.some(e => e.e === 'combat' || e.e === 'crate')) game.turn.pausedAt = Date.now();
      // undo: only for moves/deploys/builds that revealed nothing random (no fights, loot or cards)
      // fog of war: a move that showed you anything new can't be taken back (no free scouting)
      // (uncovering terrain and neutral sites is fine: only spotting enemy troops, land or buildings locks the move in)
      const scouted = snap && game.settings.fog === 'on' && (() => {
        const sees = E.visionOf(game, actor), mem = fogFor(actor), idx = E.buildIndex(game), mine = id => !id || id === actor || E.isAlly(game, actor, id);
        for (const k of sees) {
          if (mem.explored.has(k)) continue;
          const t = game.map.tiles[k]; if (!t) continue;
          if (!mine(t.owner) || E.structsOf(t).some(x => !mine(x.owner)) || (idx[k] || []).some(u => !mine(u.owner))) return true;
        }
        return false; })();
      if (snap && !scouted && r.events.every(e => ['move', 'deploy', 'build', 'annex', 'bridgeRot'].includes(e.e))) {
        if (undoStack.owner !== actor) { undoStack.length = 0; undoStack.owner = actor; }
        undoStack.push(snap); if (undoStack.length > 30) undoStack.shift();
      } else if (isCur || (m.action || {}).a === 'end') undoStack.length = 0;
      game.v++;
      broadcastState(r.events, actor, m.seq);
      return overwatchAfter(r.events, actor, () => afterChange(r.events));
    }
    case 'chat': {
      const p = lobby.players.find(x => x.id === c.pid);
      if (!c.chatOk()) return send(c, { t: 'err', msg: 'Slow down: one message at a time' });
      const text = F.chat(m.text); if (!text) return;
      // team chat: only your teammates (and allies) hear it
      const team = !!(m.team && p && game && game.phase === 'play');
      for (const cl of clients) if (!team || onSide(cl, p.id, true)) send(cl, { t: 'chat', from: p ? p.name : 'Spectator', color: p ? p.color : '#888', text, team });
      if (p && !p.bot && !team) banterReply(text);
      return;
    }
    case 'leave': {
      // leaving: in a running game your seats become bots so the match carries on
      const seats = seatsOf(c);
      if (game) { for (const id of seats) { const lp = lobby.players.find(p => p.id === id); if (lp) payLeaver(lp); } pushLeave(seats); botifySeats(seats, true); } else lobby.players = lobby.players.filter(p => !seats.includes(p.id));
      if (seats.includes(lobby.hostId)) { const h = lobby.players.find(p => !p.bot && !p.local && isConnected(p.id) && !seats.includes(p.id)); lobby.hostId = h ? h.id : null; }
      { const p = lobby.players.find(x => x.id === seats[0]); if (p) note(p.name.replace(/ \(bot\)$/, '') + (game ? ' left — a bot took over' : ' left the lobby')); }
      c.pid = null; c.left = true;
      send(c, { t: 'left' }); clients.delete(c);   // out of the room before it hears the new lobby
      broadcastLobby();
      if (game) { game.v++; broadcastState([], null); afterChange(); }
      return;
    }
    case 'saveGame': {
      if (!game || game.phase !== 'play' || c.pid !== lobby.hostId) return;
      const d = writeSave();
      send(c, d ? { t: 'saved', title: d.title } : { t: 'err', msg: 'Could not save the game' });
      return;
    }
    case 'loadSave': if (c.pid !== lobby.hostId || game) return; return loadSave(c, m.id);
    case 'dropSave': { if (c.pid !== lobby.hostId || game) return; const h = lobby.players.find(p => p.id === lobby.hostId); if (h && h.profileId && savesFor(h.profileId).some(s => s.id === m.id)) dropSave(m.id, h.profileId); return broadcastLobby(); }
    case 'toLobby': if (c.pid !== lobby.hostId || !game) return; console.log('[game] host ' + c.pid + ' ended the game'); endGame(); return;
    case 'ping': return send(c, { t: 'pong' });
    case 'alive': {
      // any input from the player: they're at the keyboard. If a bot was covering an AFK seat, hand it back
      if (!c.pid) return;
      const p = lobby.players.find(x => x.id === c.pid); if (!p) return;
      p.seenAt = Date.now();
      if (game && p.away && p.afk && isConnected(p.id)) returnSeats(p);
      return;
    }
    case 'speed': {
      // the host sets the pace; when only bots are left playing, anyone watching may speed it up
      const botsOnly = game && game.players.filter(p => p.alive).every(p => p.bot);
      if ((c.pid !== lobby.hostId && !botsOnly) || !['normal', 'fast', 'super', 'max'].includes(m.v) || (m.v === 'max' && !botsOnly)) return;
      if (botsOnly) game.settings.botSpeed = m.v;
      else { lobby.settings.speed = m.v; if (game) game.settings.speed = m.v; }
      if (game) { game.v++; broadcastState([], null); }
      broadcastLobby(); return afterChange();
    }
    case 'pause': {
      // pause / resume: same people who may set the speed. Bots stop, the turn clock freezes, nobody can act
      const botsOnly = game && game.players.filter(p => p.alive).every(p => p.bot);
      if (!game || game.phase !== 'play' || (c.pid !== lobby.hostId && !botsOnly)) return;
      const on = !!m.on; if (!!game.paused === on) return;
      game.paused = on;
      if (on) { clearTimeout(botTimer); clearTimeout(turnTimer); clearTimeout(idleTimer); if (game.turn.deadline && !game.turn.pausedAt) game.turn.pausedAt = Date.now(); }
      else resumeClock();
      game.log.push(on ? '⏸ The game is paused.' : '▶ The game resumed.');
      game.v++; broadcastState([], null); return afterChange();
    }
    case 'autoplay': if (!process.env.SECTOR_DEV || !c.pid) return; m.on ? autoPids.add(c.pid) : autoPids.delete(c.pid); return afterChange();
  }
}
function startGame(c) {
  if (game) return;
  if (isPublic) fillSeats();
  const diffs = Object.keys(E.DIFFICULTY);
  const roster = lobby.players.filter(p => !p.spectator).map(p => p.bot ? { ...p, diff: p.diff === 'random' ? diffs[Math.floor(Math.random() * diffs.length)] : p.diff, persona: lobby.settings.personas === 'off' ? null : PZ.pick() } : p);   // each bot gets a hidden personality
  if (roster.length < 2) return c && send(c, { t: 'err', msg: lobby.players.length < 2 ? 'Need at least 2 commanders (add a bot)' : 'Need at least 2 commanders who are playing, not spectating' });
  const host = c && lobby.players.find(p => p.id === c.pid); if (host) host.ready = true;   // pressing DEPLOY readies the host
  const waiting = isPublic ? [] : notReady();
  if (waiting.length) return c && send(c, { t: 'err', msg: 'Waiting for ' + waiting.map(p => p.name).join(', ') + ' to ready up' });
  const s = { ...lobby.settings, timer: +lobby.settings.timer || 0, maxRounds: +lobby.settings.maxRounds || 0, conquestPct: +lobby.settings.conquestPct || 60 };
  if (s.bank && s.bank !== 'off') s.timer = 0;   // the time bank replaces the per-turn timer
  for (const k in bankLeft) delete bankLeft[k]; bankKey = ''; bankPid = null;
  const r = E.createGame(s, roster);
  resetWar();
  game = r.state; game.t0 = Date.now(); for (const lp of lobby.players) { delete lp.since; delete lp.base; }
  // a private war is saved for the commander who started it (public wars aren't saved)
  const owner = !isPublic && (lobby.players.find(p => p.id === lobby.hostId) || {}).profileId;
  game.saveId = owner ? 'g' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex') : null; game.saveOwner = owner || null;
  console.log('[game] ' + code + ' started: ' + lobby.players.length + ' players, ' + s.mode + ', map ' + s.mapSize);
  broadcastLobby();
  broadcastState(r.events, null);
  return afterChange();
}
function pushLeave(seats) {
  for (const id of seats) { const gp = game.players.find(p => p.id === id); if (gp) game.log.push('🚪 ' + gp.name.replace(' (bot)', '') + ' left — a bot took over.'); }
  while (game.log.length > 40) game.log.shift();
}

// everything one war leaves behind that must not leak into the next: an open battle window or overwatch prompt
// would make the next war's bots wait for it forever (the enemy turn never comes)
function resetWar() {
  if (pendingBattle) clearTimeout(pendingBattle.timer); pendingBattle = null;
  if (pendingOw) clearTimeout(pendingOw.timer); pendingOw = null;
  for (const t of [botTimer, turnTimer, idleTimer, tradeTimer, draftTimer, allyTimer]) clearTimeout(t);
  undoStack.length = 0; undoStack.owner = null;
  turnKey = ''; actedKey = ''; bankKey = ''; bankPid = null; skipVotes.key = null;
  botMem = {}; fogMem = {}; banterReset();
}
function endGame() {
  console.log('[game] ' + code + ' returned to lobby');
  resetWar();
  // ending a war early keeps it saved, so it can be resumed from the lobby
  if (game && game.phase === 'play' && !game.scenario) writeSave(); else clearTimeout(saveTimer);
  for (const k in warNotes) delete warNotes[k]; for (const c of clients) c.notesSig = null;
  game = null; clearTimeout(botTimer); clearTimeout(turnTimer); clearTimeout(idleTimer);
  for (const p of lobby.players) p.ready = false;   // everyone readies up again for the next war
  for (const c of clients) send(c, { t: 'state', state: null, events: [] });
  broadcastLobby();
}

let saveTimer = null;
function writeSave() {
  clearTimeout(saveTimer); saveTimer = null;
  if (!game || game.phase !== 'play' || !game.saveId) return null;
  const fog = {}; for (const k in fogMem) fog[k] = { explored: [...fogMem[k].explored], seen: fogMem[k].seen };
  const seats = lobby.players.filter(p => game.players.some(g => g.id === p.id)).map(p => pick(p, ['id', 'name', 'color', 'faction', 'bot', 'diff', 'persona', 'local', 'controller', 'team', 'profileId']));
  const owner = profiles.get(game.saveOwner); if (!owner) return null;
  const data = { v: 1, version: VERSION, id: game.saveId, savedAt: Date.now(), title: saveTitle(game), round: game.turn.round, mode: game.settings.mode, game, fog, seats, bank: bankLeft };
  try {
    fs.mkdirSync(SAVE_DIR, { recursive: true });
    const f = saveFile(game.saveId); fs.writeFileSync(f + '.tmp', zlib.gzipSync(JSON.stringify(data))); fs.renameSync(f + '.tmp', f);
    // on the owner's list; a war past their save slots pushes out their oldest
    const dropped = profiles.recordSave(owner, { id: data.id, title: data.title, round: data.round, mode: data.mode, savedAt: data.savedAt, humans: seats.filter(p => !p.bot).map(p => p.name) });
    for (const id of dropped) dropSave(id);
    return data;
  } catch (e) { console.log('[save] failed: ' + e.message); return null; }
}
function scheduleSave() { if (!saveTimer && game && game.phase === 'play' && game.saveId) saveTimer = setTimeout(writeSave, 3000); }
function loadSave(c, id) {
  const host = lobby.players.find(p => p.id === lobby.hostId), pr = host && host.profileId && profiles.get(host.profileId);
  if (!pr || !profiles.savesOf(pr).some(s => s.id === id)) return send(c, { t: 'err', msg: 'That save isn’t yours' });
  const d = readSave(id); if (!d) return send(c, { t: 'err', msg: 'That save could not be read' });
  if (!d || !d.game || !d.game.players) return send(c, { t: 'err', msg: 'That save is damaged' });
  const g = d.game, seats = d.seats || [];
  const num = id => +(String(id).match(/\d+/) || [0])[0];
  nextPid = Math.max(nextPid, ...g.players.map(p => num(p.id) + 1), ...lobby.players.map(p => num(p.id) + 1));
  // people in the lobby take back the seat with their name; everyone else watches and can take over a bot
  const base = n => String(n || '').replace(/ \(bot\)$/, '').trim().toLowerCase();
  const humans = lobby.players.filter(p => !p.bot && !p.local), taken = new Set(), remap = new Map();
  const players = [];
  for (const gp of g.players) {
    const sv = seats.find(x => x.id === gp.id) || { id: gp.id, name: gp.name, bot: gp.bot };
    const h = !sv.bot && !sv.local && gp.alive && humans.find(x => !taken.has(x) && base(x.name) === base(sv.name));
    if (h) {
      taken.add(h); remap.set(h.id, gp.id);
      players.push({ ...h, id: gp.id, name: gp.name, color: gp.color, faction: gp.faction, team: gp.team || 0, spectator: false, ready: true, away: false, afk: false });
      gp.bot = false; gp.away = false; gp.afk = false;
      continue;
    }
    players.push({ id: gp.id, name: gp.name, color: gp.color, faction: gp.faction, team: gp.team || 0, bot: true, diff: gp.diff || sv.diff || 'medium', persona: gp.persona || null, local: false, controller: null, token: null, _local: sv.local ? sv.controller : null });
  }
  // pass & play seats come back if the person who held the device is here
  for (const p of players) {
    if (p._local && players.some(x => x.id === p._local && !x.bot)) { p.bot = false; p.local = true; p.controller = p._local; p.diff = null; const gp = g.players.find(x => x.id === p.id); if (gp) { gp.bot = false; gp.away = false; } }
    delete p._local;
  }
  for (const p of players) { const gp = g.players.find(x => x.id === p.id); if (p.bot && gp && !gp.bot) { gp.bot = true; gp.diff = gp.diff || 'medium'; gp.away = false; } }
  for (const h of humans) if (!taken.has(h)) { const nid = 'p' + nextPid++; remap.set(h.id, nid); players.push({ ...h, id: nid, spectator: true, ready: true }); }
  for (const cl of clients) if (cl.pid && remap.has(cl.pid)) cl.pid = remap.get(cl.pid);
  lobby.hostId = remap.get(lobby.hostId) || lobby.hostId;
  lobby.players = players;
  Object.assign(lobby.settings, pick(g.settings, ['mode', 'mapSize', 'mapType', 'spawns', 'fog', 'events', 'timer', 'maxRounds', 'conquestPct', 'teams', 'speed', 'bank', 'personas']));
  // clocks were wall-clock times when saved: restart this turn's
  g.turn.pausedAt = 0; g.paused = false;
  g.turn.deadline = g.settings.timer ? Date.now() + g.settings.timer * 1000 : 0; g.turn.prevDeadline = 0;
  game = g; game.v = (game.v || 0) + 1; game.t0 = Date.now(); for (const lp of lobby.players) { delete lp.since; delete lp.base; } botMem = {}; undoStack.length = 0; undoStack.owner = null;
  fogMem = {}; for (const k in d.fog || {}) fogMem[k] = { explored: new Set(d.fog[k].explored || []), seen: d.fog[k].seen || {} };
  for (const k in bankLeft) delete bankLeft[k]; Object.assign(bankLeft, d.bank || {}); bankKey = ''; bankPid = null; turnKey = '';
  for (const k in warNotes) delete warNotes[k];
  if (pendingBattle) clearTimeout(pendingBattle.timer); pendingBattle = null; pendingOw = null;
  game.log.push('💾 Resumed from a save (round ' + game.turn.round + ').');
  console.log('[game] resumed save ' + d.id + ' (round ' + game.turn.round + ')');
  note('Resumed a saved game: ' + d.title);
  for (const cl of clients) { const p = cl.pid && lobby.players.find(x => x.id === cl.pid); if (p) send(cl, { t: 'welcome', you: p.id, token: p.token, spectator: !!p.spectator }); }
  broadcastLobby(); broadcastState([], null);
  afterChange();
}

// a player who dropped out (or went AFK) takes their seats back from the covering bot
function returnSeats(p) {
  for (const lp of lobby.players.filter(x => x.id === p.id || (x.local && x.controller === p.id))) {
    lp.away = false; lp.afk = false; lp.idle = 0; lp.seenAt = Date.now();
    const gp = game.players.find(g => g.id === lp.id);
    if (gp && gp.away) { gp.bot = false; gp.away = false; gp.afk = false; }
  }
  game.log.push('📡 ' + p.name + ' is back in command.'); game.v++;
  broadcastLobby(); broadcastState([], null);   // everyone sees the seat handed back
  afterChange();
}
// could any human player (or someone watching) see these events? Watchers see everything; players see what their
// side's vision covers. Events with no place on the map (a turn starting, a card drawn) count as unseen
function seenByHumans(events) {
  if (lobby.players.some(p => p.spectator && isConnected(p.id))) return true;
  const humans = game.players.filter(gp => gp.alive && lobby.players.some(lp => lp.id === gp.id && !lp.bot) && !autoPids.has(gp.id));
  if (!humans.length) return true;   // only bots left: the normal pace rules apply
  const hexes = []; for (const e of events) for (const k of [e.hex, e.to, e.from, e.target, e.at, ...(e.path || []), ...(e.hexes || [])]) if (typeof k === 'string' && game.map.tiles[k]) hexes.push(k);
  if (!hexes.length) return false;
  if (events.some(e => humans.some(h => e.pid === h.id || e.to === h.id || e.victim === h.id || (e.def && e.def.pid === h.id)))) return true;
  for (const h of humans) { const vis = E.visionOf(game, h.id); if (hexes.some(k => vis.has(k))) return true; }
  return false;
}
// game speed: bots act faster on Fast, and much faster on Superspeed (always on once only bots are left)
function speedOf() {
  if (!game) return lobby.settings.speed || 'fast';
  if (game.players.filter(p => p.alive).every(p => p.bot)) return game.settings.botSpeed || 'super';
  return game.settings.speed || 'fast';
}
const BOT_PACE = { normal: 1, fast: 0.6, super: 0.12, max: 0.02 };
// ── battles: before an attack's dice roll, attacker and defender can each throw battle cards in ──
// bots decide on the spot; a connected human holding a playable card gets a window (READY ends it early)
const BATTLE_MS = 8000, BATTLE_CAP = 20000, BATTLED = Symbol('battled');
let pendingBattle = null;
const skipVotes = { key: null, at: 0, pids: new Set() };   // a human-vs-human fight skips only when both have asked
function humanAt(pid) { const lp = lobby.players.find(x => x.id === pid); return !!(lp && !autoPids.has(pid) && !lp.bot && !lp.away && isConnected(lp.local ? lp.controller : lp.id)); }
function botBattleCards() {
  for (let round = 0; round < 6 && game && game.battle; round++) {
    let played = false;
    for (const pid of [game.battle.att, game.battle.def]) {
      if (!pid || humanAt(pid)) continue;
      const uid = battlePick(game, pid); if (uid == null) continue;
      const r = E.battleCard(game, pid, uid); if (r.ok) { played = true; game.v++; broadcastState(r.events, pid); }
    }
    if (!played) break;
  }
}
// true if the order is now waiting on the battle (done() runs it later); false to carry on as normal
function startBattle(actor, action, done) {
  if (!game || game.phase !== 'play' || !action || (action.a !== 'move' && action.a !== 'assault')) return false;
  const b = E.openBattle(game, actor, action); if (!b) return false;
  if (!b.def || b.def === actor || !E.player(game, b.def)) { E.closeBattle(game); return false; }
  botBattleCards();
  const humans = [b.att, b.def].filter(pid => humanAt(pid) && E.battleHand(game, pid).length);
  if (!humans.length) { if (!b.cards.att.length && !b.cards.def.length) { E.closeBattle(game); return false; } done(); return true; }
  pendingBattle = { humans, ready: new Set(), done, until: Date.now() + BATTLE_MS, cap: Date.now() + BATTLE_CAP };
  battleTick();
  return true;
}
function battleTick() {
  const pb = pendingBattle; if (!pb) return; clearTimeout(pb.timer);
  if (!game || !game.battle || game.phase !== 'play') { pendingBattle = null; return; }
  for (const pid of pb.humans) if (!E.battleHand(game, pid).length) pb.ready.add(pid);   // nothing left to play
  if (pb.humans.every(pid => pb.ready.has(pid)) || Date.now() >= pb.until) return endBattle();
  const b = game.battle, calc = E.battleOdds(game);
  for (const cl of clients) {
    if (cl.left) continue;
    const side = [b.att, b.def].find(pid => controls(cl, pid));
    const watcher = !cl.pid || (lobby.players.find(x => x.id === cl.pid) || {}).spectator;
    if (!side && !watcher && game.settings.fog === 'on') continue;   // in the fog, only the two sides (and spectators) see it coming
    send(cl, { t: 'battle', hex: b.hex, att: b.att, def: b.def, ms: pb.until - Date.now(), cards: b.cards, winProb: calc ? calc.winProb : null,
      attBonuses: calc ? calc.att.bonuses : [], defBonuses: calc ? calc.def.bonuses : [], attChips: calc ? calc.att.chips : 0, defChips: calc ? calc.def.chips : 0, attMult: calc ? calc.att.mult : 0, defMult: calc ? calc.def.mult : 0,
      attUnits: b.units.map(id => game.units[id]).filter(Boolean).map(u => u.type), defUnits: calc ? calc.defenders.map(u => u.type) : [],
      humans: pb.humans, readyPids: [...pb.ready],
      you: side || null, hand: side && pb.humans.includes(side) ? E.battleHand(game, side).map(x => ({ uid: x.uid, id: x.id })) : [], ready: side ? pb.ready.has(side) : true });
  }
  pb.timer = setTimeout(battleTick, Math.min(1000, Math.max(50, pb.until - Date.now())));
}
function endBattle() {
  const pb = pendingBattle; if (!pb) return; pendingBattle = null; clearTimeout(pb.timer);
  for (const cl of clients) send(cl, { t: 'battleDone' });
  pb.done();
}
// overwatch: after a move, stacks on overwatch next to where the mover stopped may fire. Bots decide on the spot;
// a connected human gets a few seconds to say FIRE or HOLD while the game waits
const OW_MS = 6000;
let pendingOw = null;
function overwatchAfter(events, actor, done) {
  if (!game || game.phase !== 'play') return done();
  const hexes = [];
  for (const e of events || []) { if (e.pid !== actor) continue; if (e.e === 'move' && e.path && e.path.length) hexes.push(e.path[e.path.length - 1]); if (e.e === 'advance') hexes.push(e.to); }
  if (!hexes.length) return done();
  const trig = []; for (const h of [...new Set(hexes)]) trig.push(...E.overwatchTriggers(game, actor, h));
  const next = () => {
    const t = trig.shift(); if (!t || !game || game.phase !== 'play') return done();
    if (!Object.values(game.units).some(u => u.hex === t.target && u.owner === actor) || !t.units.some(id => game.units[id] && game.units[id].ow)) return next();
    const lp = lobby.players.find(p => p.id === t.owner);
    const human = lp && !lp.bot && !lp.away && isConnected(lp.local ? lp.controller : lp.id);
    if (!human) {
      const units = t.units.map(id => game.units[id]).filter(Boolean);
      if (units.length && E.combatCalc(game, t.owner, units, t.from, t.target, true).winProb >= 0.45) fireOw(t);
      return next();
    }
    pendingOw = { ...t, next, timer: setTimeout(() => answerOw(false), OW_MS + 300) };
    for (const cl of clients) { if (cl.left) continue; send(cl, { t: 'owPrompt', mine: controls(cl, t.owner), owner: t.owner, from: t.from, target: t.target, units: t.units, ms: OW_MS }); }
  };
  next();
}
function fireOw(t) { const r = E.overwatchFire(game, t.owner, t.from, t.target); if (r.ok) { undoStack.length = 0; game.v++; broadcastState(r.events, t.owner); } }   // shots fired: no taking the move back
function answerOw(fire) {
  const p = pendingOw; if (!p) return; pendingOw = null; clearTimeout(p.timer);
  for (const cl of clients) send(cl, { t: 'owDone' });
  if (fire && game && game.phase === 'play') fireOw(p);
  p.next();
}
// time bank: a chess clock. Each commander has minutes in the bank plus 20s added every turn
const BANK_INC = 20000, bankLeft = {};
let bankKey = '', bankPid = null;
const AFK_MS = +process.env.SECTOR_AFK_MS || 120000;   // no turn timer: a turn with no sign of life ends after this
let turnKey = '', turnStartAt = 0, actedKey = '';
const AWAY_GRACE = +process.env.SECTOR_AWAY_MS || 30000;
// seats of a commander who dropped out: a bot plays them until they reconnect (temporary) or for good (left / kicked)
function botifySeats(seats, forGood) {
  for (const id of seats) {
    const lp = lobby.players.find(p => p.id === id), gp = game && game.players.find(p => p.id === id);
    if (!lp || lp.bot) continue;
    if (forGood) { lp.bot = true; lp.diff = lp.diff || 'medium'; lp.local = false; lp.controller = null; lp.token = null; lp.away = false; lp.name = lp.name.replace(/ \(bot\)$/, '') + ' (bot)'; }
    else lp.away = true;
    if (gp && gp.alive) { gp.bot = true; gp.diff = gp.diff || 'medium'; gp.away = !forGood; if (forGood) gp.name = lp.name; }
    if (game && game.trade && game.trade.to === id) game.trade = null;
    if (game && game.allyOffer && game.allyOffer.to === id) game.allyOffer = null;
  }
  if (seats.includes(lobby.hostId)) { const h = lobby.players.find(p => !p.bot && !p.local && !p.away && isConnected(p.id) && !seats.includes(p.id)); lobby.hostId = h ? h.id : lobby.hostId; }
}
function onDisconnect(c) {
  { const p = c.pid && lobby.players.find(x => x.id === c.pid); if (p && !c.left) note(p.name + ' disconnected'); }
  if (game && c.pid && !c.left) {
    const seats = seatsOf(c), pid = c.pid;
    setTimeout(() => {
      if (!game || isConnected(pid)) return;
      botifySeats(seats, false);
      const p = lobby.players.find(x => x.id === pid);
      if (p) { game.log.push('📡 ' + p.name + ' lost connection — a bot is covering until they return.'); note(p.name + ' is away: a bot took over'); }
      game.v++; broadcastLobby(); broadcastState([], null); afterChange();
    }, AWAY_GRACE);
  }
  if (!game && c.pid) {
    // leaving the lobby before a game removes you
    setTimeout(() => {
      if (game || isConnected(c.pid)) return;
      lobby.players = lobby.players.filter(p => p.id !== c.pid && p.controller !== c.pid);
      if (lobby.hostId === c.pid || !isConnected(lobby.hostId)) { const h = lobby.players.find(p => !p.bot && !p.local && isConnected(p.id)); lobby.hostId = h ? h.id : null; }
      broadcastLobby();
    }, 4000);
  } else broadcastLobby();
  if (game) afterChange();
}

// after every change: schedule bots, timers, idle-skips
let tradeTimer = null, draftTimer = null, allyTimer = null;
// a finished game pays every human commander who played it (coins, objectives, a recruit's first game)
// what one commander did in this war, from when they took the seat (game start, or a takeover) to now
function playedBy(lp, gp) {
  const b = lp.base || {}, since = lp.since || game.t0 || Date.now();
  return { minutes: (Date.now() - since) / 60000, kills: gp.stats.kills - (b.kills || 0), captured: gp.stats.captured - (b.captured || 0), crates: gp.stats.crates - (b.crates || 0) };
}
// walking out of a war pays for what you did up to then (the bot that takes over earns you nothing more)
function payLeaver(lp) {
  const gp = game && game.players.find(p => p.id === lp.id), pr = lp.profileId && profiles.get(lp.profileId);
  if (!gp || !pr || game.scenario || game.phase !== 'play' || lp.bot) return;
  const humans = game.players.filter(p => !p.bot || (lobby.players.find(x => x.id === p.id) || {}).away);
  const out = profiles.finishGame(pr, { ...playedBy(lp, gp), left: true, won: false, place: game.players.length, players: game.players.length, rounds: game.turn.round, vsHumans: humans.length > 1 });
  if (!out.match && !out.objectives.length) return;   // nothing earned: no popup on the way out
  for (const cl of clients) if (cl.pid === lp.id) send(cl, { t: 'reward', reward: out, profile: profiles.view(pr) });
}
function payOut() {
  if (!game || game.phase !== 'over' || game.paid) return;
  game.paid = true;
  if (game.scenario) {
    // missions: first completion pays its Valor reward (no match coins)
    const sc = SCN.get(game.scenario.id), hero = game.scenario.hero, won = game.winner && game.winner.pid === hero && !game.winner.failed;
    const lp = lobby.players.find(x => x.id === hero), pr = lp && lp.profileId && profiles.get(lp.profileId);
    const out = won && pr ? profiles.scenarioDone(pr, sc.id, SCN.REWARD, SCN.SCENARIOS.map(x => x.id), SCN.ALL_BONUS) : { first: false, valor: 0 };
    for (const cl of clients) if (cl.pid === hero) send(cl, { t: 'scenarioResult', id: sc.id, won, failed: game.winner && game.winner.failed, ...out, profile: pr ? profiles.view(pr) : null });
    return;
  }
  logGame(game);
  const w = game.winner || {}, winners = w.pids || [w.pid];
  const land = id => E.ownedLand(game, id).length;
  const order = game.players.slice().sort((a, b) => (winners.includes(b.id) - winners.includes(a.id)) || (b.alive - a.alive) || land(b.id) - land(a.id));
  const humans = game.players.filter(p => !p.bot || (lobby.players.find(x => x.id === p.id) || {}).away);
  for (const gp of game.players) {
    const lp = lobby.players.find(x => x.id === gp.id), pr = lp && !lp.bot && lp.profileId && profiles.get(lp.profileId);
    if (!pr) continue;
    const r = { ...playedBy(lp, gp), won: winners.includes(gp.id), place: order.indexOf(gp) + 1, players: game.players.length, rounds: game.turn.round, vsHumans: humans.length > 1 };
    const out = profiles.finishGame(pr, r);
    for (const cl of clients) if (cl.pid === lp.id || (lp.local && cl.pid === lp.controller)) send(cl, { t: 'reward', reward: out, profile: profiles.view(pr) });
  }
}
function afterChange(events) {
  clearTimeout(botTimer); clearTimeout(turnTimer); clearTimeout(idleTimer);
  payOut();
  if (game && game.phase === 'play' && !game.scenario) scheduleSave();
  else if (game && game.phase === 'over' && game.saveId) { clearTimeout(saveTimer); saveTimer = null; dropSave(game.saveId, game.saveOwner); game.saveId = null; }   // a finished war can't be resumed
  if (game && game.phase === 'spawn') {
    // bots pick their HQ quickly; humans get 60 seconds before one is chosen for them
    clearTimeout(draftTimer);
    const cur = game.spawn.order[game.spawn.i], lp = lobby.players.find(x => x.id === cur);
    const auto = !lp || lp.bot || autoPids.has(cur);
    draftTimer = setTimeout(() => {
      if (!game || game.phase !== 'spawn' || game.spawn.order[game.spawn.i] !== cur) return;
      const a = (auto && spawnStep(game, cur)) || { a: 'spawnPick', auto: true };
      const r = E.applyAction(game, cur, a);
      if (r && r.ok) { game.v++; broadcastState(r.events, cur); }
      afterChange();
    }, auto ? 900 / (process.env.SECTOR_FAST ? 3 : 1) : 60000);
    return;
  }
  if (game && game.phase === 'draft') {
    // bots (and disconnected humans, after a grace period) make their draft picks
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      if (!game || game.phase !== 'draft') return;
      for (const pl of game.players) {
        const lp = lobby.players.find(x => x.id === pl.id);
        if (!lp || game.draft.picked[pl.id]) continue;
        if (!(lp.bot || autoPids.has(pl.id))) continue;
        const a = draftStep(game, pl.id);
        const r = a && E.applyAction(game, pl.id, a);
        if (r && r.ok) { game.v++; broadcastState(r.events, pl.id); if (!game || game.phase !== 'draft') break; }
      }
      afterChange();
    }, 900);
    return;
  }
  if (!game || game.phase !== 'play') return;
  if (game.paused) return;   // paused: no bots, no clocks, no idle checks
  if (game.allyOffer && !allyTimer) {
    const target = lobby.players.find(p => p.id === game.allyOffer.to);
    if (target && (target.bot || autoPids.has(target.id))) allyTimer = setTimeout(() => {
      allyTimer = null;
      if (!game || !game.allyOffer) return;
      const a = allyReply(game, game.allyOffer.to);
      const r = a && E.applyAction(game, game.allyOffer.to, a);
      if (r && r.ok) { game.v++; broadcastState(r.events, null); }
      afterChange();
    }, 1400);
  }
  if (game.trade && !tradeTimer) {
    const target = lobby.players.find(p => p.id === game.trade.to);
    if (target && (target.bot || autoPids.has(target.id))) tradeTimer = setTimeout(() => {
      tradeTimer = null;
      if (!game || !game.trade) return;
      const a = tradeReply(game, game.trade.to);
      const r = a && E.applyAction(game, game.trade.to, a);
      if (r && r.ok) { game.v++; broadcastState(r.events, game.trade ? null : a && target.id); afterChange(r.events); }
    }, 1400);
  }
  const cur = E.current(game);
  const lp = lobby.players.find(p => p.id === cur.id);
  { const k = game.turn.round + ':' + game.turn.idx; if (k !== turnKey) { turnKey = k; turnStartAt = Date.now(); } }
  if (game.settings.bank && game.settings.bank !== 'off' && bankKey !== turnKey) {
    // close the last player's clock, then open this one's with its bank plus the per-turn increment
    if (bankPid && game.turn.prevDeadline) bankLeft[bankPid] = Math.max(0, game.turn.prevDeadline - Date.now());
    bankKey = turnKey; bankPid = cur.id;
    const lpb = lobby.players.find(p => p.id === cur.id);
    if (lpb && !lpb.bot && !autoPids.has(cur.id)) {
      if (bankLeft[cur.id] == null) bankLeft[cur.id] = (+game.settings.bank || 3) * 60000;
      game.turn.deadline = Date.now() + bankLeft[cur.id] + BANK_INC; game.turn.prevDeadline = game.turn.deadline;
    } else { game.turn.deadline = 0; game.turn.prevDeadline = 0; bankPid = null; }
  }
  if (game.turn.deadline && game.settings.bank && game.settings.bank !== 'off') game.turn.prevDeadline = game.turn.pausedAt ? game.turn.deadline + (Date.now() - game.turn.pausedAt) : game.turn.deadline;
  if ((lp && lp.bot) || (!lp && cur.bot) || autoPids.has(cur.id)) {   // (a mission's enemies aren't in the lobby)
    let delay = 450;
    if (events) for (const e of events) {
      if (e.e === 'combat') delay = Math.max(delay, 5600);
      else if (e.e === 'crate') delay = Math.max(delay, 3200);
      else if (e.e === 'eliminate' || e.e === 'tactic') delay = Math.max(delay, 2600);
      else if (e.e === 'move') delay = Math.max(delay, 500 + e.path.length * 170);
      else if (e.e === 'turn') delay = Math.max(delay, 1500);
      else if (e.e === 'card') delay = Math.max(delay, 1200);
    }
    // fog of war: if no human can see anything this bot just did, nobody is waiting to watch it, so it carries straight on
    if (game.settings.fog === 'on' && events && !seenByHumans(events)) delay = 0;
    botTimer = setTimeout(runBot, Math.max(40, delay * (process.env.SECTOR_FAST ? 0.25 : 1) * BOT_PACE[speedOf()]));
    return;
  }
  if (game.turn.deadline && game.turn.pausedAt) {
    // paused for an animation: resume on the client's signal, or after 30s if it never comes
    turnTimer = setTimeout(() => { if (game && game.turn.pausedAt) { resumeClock(); broadcastState([], null); afterChange(); } }, 30000);
  } else if (game.turn.deadline) {
    turnTimer = setTimeout(() => forceEnd(cur.id), Math.max(0, game.turn.deadline - Date.now()) + 300);
  }
  if (!isConnected(cur.id)) idleTimer = setTimeout(() => { if (!isConnected(cur.id)) forceEnd(cur.id); }, 30000);
  else if (!game.turn.deadline && lp && !lp.local) {
    // no turn timer: a connected player who shows no sign of life for a couple of minutes has their turn ended
    const quiet = () => Date.now() - Math.max(turnStartAt, lp.seenAt || 0);
    const check = () => { if (!game || E.current(game).id !== cur.id) return; if (quiet() >= AFK_MS) forceEnd(cur.id); else idleTimer = setTimeout(check, AFK_MS - quiet() + 200); };
    idleTimer = setTimeout(check, Math.max(1000, AFK_MS - quiet() + 200));
  }
}
function resumeClock() { if (game && game.turn.pausedAt) { game.turn.deadline += Date.now() - game.turn.pausedAt; game.turn.pausedAt = 0; } }
function forceEnd(pid) {
  if (!game || game.phase !== 'play' || E.current(game).id !== pid) return;
  if (pendingBattle) return void (turnTimer = setTimeout(() => forceEnd(pid), 1000));   // let the fight finish first
  // a whole turn without acting counts as idle; two in a row and a bot covers until the player is back
  { const lp = lobby.players.find(p => p.id === pid);
    if (lp && !lp.bot && isConnected(lp.local ? lp.controller : lp.id)) {
      lp.idle = actedKey === turnKey ? 0 : (lp.idle || 0) + 1;
      if (lp.idle >= 2) {
        botifySeats([pid], false); lp.afk = true; const gp = game.players.find(g => g.id === pid); if (gp) gp.afk = true;
        game.log.push('💤 ' + lp.name + ' is AFK — a bot is covering until they are back.'); note(lp.name + ' is AFK: a bot took over');
        broadcastLobby();
      }
    } }
  // out of time mid-menu: take the income / scrap the crate, then end
  const ev = [];
  if (game.turn.stage === 'choose') { const r0 = E.applyAction(game, pid, { a: 'choose', pick: 'income' }); if (r0.ok) ev.push(...r0.events); }
  if (game.turn.stage === 'crate') { const r1 = E.applyAction(game, pid, { a: 'scrap' }); if (r1.ok) ev.push(...r1.events); }
  const r = E.applyAction(game, pid, { a: 'end' });
  if (r.ok || ev.length) { game.log.push('⏱ ' + (E.player(game, pid) || {}).name + ' ran out of time.'); game.v++; broadcastState(ev.concat(r.ok ? r.events : []), pid); afterChange(r.events); }
}
// ── bot banter: a bot with a personality comments on the war (Bot personalities setting; never more than a line every few seconds) ──
const BIG_TACTICS = ['nuke', 'tsar', 'orbital', 'carpet', 'emp', 'strategic', 'regime', 'buster'];
let banterAt = {}, banterLast = 0, greeted = new Set();
function banterReset() { banterAt = {}; banterLast = 0; greeted = new Set(); }
function botSay(pid, kind, vars = {}, o = {}) {
  if (!game || !pid || (game.settings && game.settings.personas === 'off') || game.scenario) return;
  const p = E.player(game, pid); if (!p || !p.bot || !p.persona) return;
  const now = Date.now();
  if (!o.force && (now - (banterAt[pid] || 0) < 25000 || now - banterLast < 5000)) return;
  if (Math.random() > (o.chance ?? 1)) return;
  const text = PZ.line(p.persona, kind, vars); if (!text) return;
  banterAt[pid] = now; banterLast = now;
  setTimeout(() => { if (game) for (const cl of clients) send(cl, { t: 'chat', from: p.name, color: p.color, text, pid, bot: true }); }, o.delay ?? 600 + Math.random() * 900);
}
function banter(events) {
  if (!game || !events || game.phase !== 'play' && !events.some(e => e.e === 'win')) return;
  const nm = id => (E.player(game, id) || {}).name || 'you', human = id => { const q = E.player(game, id); return !!q && !q.bot; };
  const toward = id => human(id) ? 1 : 0.15;   // bots mostly talk to people, not to each other
  for (const e of events) {
    if (e.e === 'combat' && !e.ranged && e.att && e.def && e.def.pid) {
      const a = e.att.pid, d = e.def.pid, big = (e.att.units || []).length + (e.def.units || []).length >= 6;
      if (e.attWin) { botSay(a, 'win', { name: nm(d) }, { chance: (e.winProb < 0.5 || big ? 0.7 : 0.25) * toward(d) }); botSay(d, 'loss', { name: nm(a) }, { chance: (big ? 0.5 : 0.2) * toward(a) }); }
      else { botSay(d, 'hold', { name: nm(a) }, { chance: (big ? 0.65 : 0.3) * toward(a) }); botSay(a, 'loss', { name: nm(d) }, { chance: 0.3 * toward(d) }); }
    } else if (e.e === 'siege') { botSay(e.pid, 'hq', { name: nm(e.victim) }, { force: true }); botSay(e.victim, 'hqLost', { name: nm(e.pid) }, { force: true, delay: 2200 }); }
    else if (e.e === 'eliminate') { botSay(e.by, 'kill', { name: nm(e.pid) }, { force: true }); botSay(e.pid, 'dead', {}, { force: true, delay: 2000 }); }
    else if (e.e === 'ally' && e.status === 'offer') botSay(e.from, 'offer', { name: nm(e.to) }, { force: human(e.to), chance: human(e.to) ? 1 : 0.35 });
    else if (e.e === 'ally' && e.status === 'breaking') { botSay(e.from, 'betray', { name: nm(e.to) }, { force: true }); botSay(e.to, 'betrayed', { name: nm(e.from) }, { force: true, delay: 2400 }); }
    else if (e.e === 'tactic' && BIG_TACTICS.includes(e.id)) botSay(e.pid, 'big', {}, { chance: 0.7 });
    else if (e.e === 'win') for (const id of e.pids || [e.pid]) botSay(id, 'victory', {}, { force: true, delay: 1500 });
  }
}
// someone typed in chat: a bot they named answers back (and now and then one butts in anyway)
function banterReply(text) {
  if (!game || game.phase !== 'play') return;
  const bots = game.players.filter(p => p.bot && p.alive && p.persona), low = text.toLowerCase();
  const named = bots.find(p => low.includes(p.name.replace(/ \(bot\)$/, '').toLowerCase()));
  const who = named || (Math.random() < 0.15 ? bots[Math.floor(Math.random() * bots.length)] : null);
  if (who) botSay(who.id, 'reply', {}, { force: !!named, chance: named ? 0.9 : 1, delay: 1400 + Math.random() * 1600 });
}
function runBot() {
  if (!game || game.phase !== 'play' || game.paused || pendingOw || pendingBattle) return;
  const cur = E.current(game);
  const mem = botMem[cur.id + ':' + game.turn.round] || (botMem = {}, botMem[cur.id + ':' + game.turn.round] = { n: 0 });
  if (mem.n === 0 && game.turn.round === 1 && !greeted.has(cur.id)) { greeted.add(cur.id); botSay(cur.id, 'start', {}, { chance: 0.55 }); }
  let a = mem.n++ > 60 || cur.scenarioAI === 'passive' ? { a: 'end' } : botStep(game, cur.id, mem);   // a mission's passive enemies just hold their ground
  // a bot's attack goes through the battle window too (instant unless a human holds a battle card)
  if (startBattle(cur.id, a, () => applyBot(cur, a))) return;
  applyBot(cur, a);
}
function applyBot(cur, a) {
  if (!game || game.phase !== 'play' || E.current(game).id !== cur.id) return afterChange();
  let r = E.applyAction(game, cur.id, a);
  E.closeBattle(game, true);
  if (!r.ok) { if (a.a === 'end') return; return void (botTimer = setTimeout(runBot, 10)); }
  game.v++;
  broadcastState(r.events, cur.id);
  overwatchAfter(r.events, cur.id, () => afterChange(r.events));
}


// ── a public war deploys with at least PUBLIC_MIN commanders: bots fill the empty seats ──
function fillSeats() {
  const humans = lobby.players.filter(p => !p.bot && !p.spectator).length, used = new Set(lobby.players.map(p => p.name));
  while (lobby.players.length < PUBLIC_SEATS && lobby.players.filter(p => !p.spectator).length < Math.max(PUBLIC_MIN, humans + 1)) {
    const name = BOT_NAMES.find(n => !used.has(n)) || 'Bot'; used.add(name);
    lobby.players.push({ id: 'p' + nextPid++, token: null, name, color: freeColor(), faction: Object.keys(E.FACTIONS)[Math.floor(Math.random() * 5)], bot: true, diff: 'medium', cos: C.botLoadout() });
  }
}
// equipping a skin in the menu shows on your seat straight away
function profileChanged(c, pr) {
  const lp = lobby.players.find(x => x.id === c.pid); if (!lp || game) return;
  lp.cos = C.cleanLoadout(pr.equipped, pr.owned, pr.cards); broadcastLobby();
}
// the room closes: a private war in progress is saved first, so its host can pick it up again
let dead = false;
function destroy() {
  if (dead) return; dead = true;
  if (game && game.phase === 'play' && game.saveId && !game.scenario) writeSave();
  for (const t of [botTimer, turnTimer, idleTimer, tradeTimer, draftTimer, allyTimer, saveTimer]) clearTimeout(t);
  if (pendingBattle) clearTimeout(pendingBattle.timer);
  game = null; lobby.players = [];
  console.log('[room] ' + code + ' closed');
}
// dev panel controls for this room's war
function admin(route, b) {
  if (!game) return { code: 409, err: 'no game running' };
  if (route === 'cash') { const gp = game.players.find(p => p.id === b.pid); if (!gp) return { code: 404, err: 'no such player' }; gp.cash = Math.max(0, gp.cash + (b.amount | 0)); game.log.push('🛠 The admin adjusted ' + gp.name + "'s treasury."); }
  else if (route === 'pause') { game.paused = !!b.on; if (b.on) { clearTimeout(botTimer); clearTimeout(turnTimer); clearTimeout(idleTimer); } else resumeClock(); }
  else if (route === 'end') { endGame(); return { ok: true }; }
  else return { code: 404, err: 'unknown route' };
  game.v++; broadcastState([], null); afterChange();
  return { ok: true };
}
const humans = () => lobby.players.filter(p => !p.bot && !p.spectator).length;
return {
  code, kind, clients, onMessage, onDisconnect, destroy, admin, profileChanged, isConnected, seatsOf, humans,
  get lobby() { return lobby; }, get game() { return game; },
  // room for n more people to join before it starts?
  open: n => isPublic && !game && !dead && humans() + n <= PUBLIC_SEATS,
};
}

// profiles live next to the saved games; SECTOR_OG_UNTIL=YYYY-MM-DD gives early accounts the Founder skins
const profiles = createProfiles(process.env.SECTOR_PROFILES || path.join(process.env.APPDATA || os.homedir(), 'Sector', 'profiles.json'), { ogUntil: process.env.SECTOR_OG_UNTIL, startValor: process.env.SECTOR_START_VALOR ?? 30000 });   // a starting grant while the store is being tested (SECTOR_START_VALOR=0 turns it off)
// ───────────── saved games: each commander's own wars, autosaved as they play (the newest SAVE_CAP are kept) ─────────────
// A save belongs to the commander who started the war, travels with their account, and only they can resume or delete
// it. The war itself is a gzipped file (a few KB); the list of a commander's saves lives on their profile.
const SAVE_DIR = process.env.SECTOR_SAVES || path.join(process.env.APPDATA || os.homedir(), 'Sector', 'saves');
const saveFile = id => path.join(SAVE_DIR, String(id).replace(/[^a-z0-9_-]/gi, '') + '.json.gz');
function saveTitle(g) {
  const mode = { domination: 'Domination', conquest: 'Conquest', koth: 'Beacon', worldwar: 'World War' }[g.settings.mode] || g.settings.mode;
  return mode + ' · round ' + g.turn.round + ' · ' + g.players.filter(p => p.alive).map(p => p.name.replace(/ \(bot\)$/, '')).join(', ');
}
function readSave(id) {
  try { return JSON.parse(zlib.gunzipSync(fs.readFileSync(saveFile(id))).toString('utf8')); }
  catch (e) { try { return JSON.parse(fs.readFileSync(saveFile(id).replace(/\.gz$/, ''), 'utf8')); } catch (e2) { return null; } }   // saves from before v0.10.3
}
function dropSave(id, ownerId) {
  for (const f of [saveFile(id), saveFile(id).replace(/\.gz$/, '')]) try { fs.unlinkSync(f); } catch (e) {}
  const pr = ownerId && profiles.get(ownerId); if (pr) profiles.forgetSave(pr, id);
}
// saves from before v0.10.3 (plain files, no owner) move onto the account of the first commander who played in them
(function migrateSaves() {
  let files = []; try { files = fs.readdirSync(SAVE_DIR).filter(f => /^[a-z0-9_-]+\.json$/i.test(f)); } catch (e) { return; }
  const all = files.map(f => { try { return { f, d: JSON.parse(fs.readFileSync(path.join(SAVE_DIR, f), 'utf8')) }; } catch (e) { return null; } }).filter(Boolean);
  for (const { f, d } of all.sort((x, y) => (x.d.savedAt || 0) - (y.d.savedAt || 0))) {   // oldest first, so the newest end up kept
    try {
      const seat = d && d.game && (d.seats || []).find(s => !s.bot && s.profileId && profiles.get(s.profileId));
      if (!seat || d.game.phase !== 'play') continue;
      d.game.saveOwner = seat.profileId;
      fs.writeFileSync(saveFile(d.id), zlib.gzipSync(JSON.stringify(d)));
      for (const id of profiles.recordSave(profiles.get(seat.profileId), { id: d.id, title: d.title, round: d.round, mode: d.mode, savedAt: d.savedAt, humans: (d.seats || []).filter(s => !s.bot).map(s => s.name) })) dropSave(id);
      fs.unlinkSync(path.join(SAVE_DIR, f));
    } catch (e) {}
  }
})();
// the saves a host may resume: their own
const savesFor = profileId => { const pr = profileId && profiles.get(profileId); return pr ? profiles.savesOf(pr) : []; };
function pick(o, keys) { const r = {}; for (const k of keys) if (o && k in o) r[k] = o[k]; return r; }

// ───────────────────────── rooms, the front menu and parties ─────────────────────────
// A connection starts on the front menu (profile, Locker, Store, leaderboard, party) and joins a room to play:
// PLAY puts it in a public room, CREATE ROOM opens a private one with a code to share, a code or link joins one.
// MAIN is the classic one-lobby server: a plain LAN link or an older client lands there.
const rooms = new Map(), parties = new Map();
const MAIN = 'MAIN', CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', PARTY_MAX = 6;
const newCode = () => { let k; do k = Array.from(crypto.randomBytes(5), b => CODE_CHARS[b % CODE_CHARS.length]).join(''); while (rooms.has(k) || parties.has(k)); return k; };
function openRoom(kind, code) { const r = createRoom(code || newCode(), kind); rooms.set(r.code, r); if (code !== MAIN) note((kind === 'public' ? 'Public' : 'Private') + ' room ' + r.code + ' opened'); return r; }
const mainRoom = () => rooms.get(MAIN) || openRoom('private', MAIN);
// a public room still filling up with space for n more, or a fresh one
function quickRoom(n) {
  let best = null;
  for (const r of rooms.values()) if (r.open(n) && (!best || r.humans() > best.humans())) best = r;
  return best || openRoom('public');
}
// step out of a room: the room hands your seat to a bot (or frees it), and you're back on the front menu
function settle(c) { if (c.room && c.left) { c.room.clients.delete(c); c.room = null; c.pid = null; c.left = false; partySync(c.party); } }
// kicked from a room: the room has already let go of them
setInterval(() => { for (const c of sockets) if (c.room && c.left) settle(c); }, 500).unref();
function leaveRoom(c) { if (!c.room) return; const r = c.room; if (!r.clients.has(c)) r.clients.add(c); r.onMessage(c, { t: 'leave' }); c.left = true; settle(c); closeIfDeserted(r); }
// the last person walked out on purpose: nobody is coming back to a room of bots, so close it now
function closeIfDeserted(r) {
  if (r.code === MAIN || r.clients.size || r.lobby.players.some(p => !p.bot && !p.spectator)) return;
  r.destroy(); rooms.delete(r.code);
}
function enterRoom(c, room, extra = {}) {
  if (c.room !== room) { leaveRoom(c); c.room = room; room.clients.add(c); }
  room.onMessage(c, { t: 'hello', name: c.name, ...extra });
  settle(c); partySync(c.party);
}
// the leader of a party takes everyone waiting on the front menu along
function bringParty(c, room) {
  const pt = c.party; if (!pt || pt.leader !== c) return;
  for (const m of pt.members) if (m !== c && !m.room) { enterRoom(m, room); send(m, { t: 'partyFollow', code: room.code }); }
}
function menuStats() {
  let wars = 0, waiting = 0; for (const r of rooms.values()) { if (r.game && r.game.phase !== 'over') { if (r.clients.size && !r.game.scenario) wars++; } else if (r.kind === 'public') waiting += r.humans(); }
  return { online: [...sockets].filter(c => c.name || c.room).length, wars, waiting, rooms: rooms.size };
}
// what a menu (or party) shows about a connection: its commander card
function card(c) {
  const pr = c.profileId && profiles.get(c.profileId);
  return { cid: c.cid, name: c.name || (pr && pr.name) || 'Commander', handle: pr ? pr.refCode : null, banner: pr ? pr.equipped.banner || null : null, territory: pr ? pr.equipped.territory || null : null, room: c.room ? c.room.code : null, playing: !!(c.room && c.room.game && c.room.game.phase !== 'over') };
}
// ── parties: friends who queue together (an invite link or code), with a leader who presses PLAY for everyone ──
function partyView(pt) { return { code: pt.code, leader: pt.leader.cid, max: PARTY_MAX, members: [...pt.members].map(card) }; }
function partySync(pt) { if (!pt) return; const v = partyView(pt); for (const m of pt.members) send(m, { t: 'party', party: v, you: m.cid }); }
function partyLeave(c) {
  const pt = c.party; if (!pt) return;
  pt.members.delete(c); c.party = null; send(c, { t: 'party', party: null });
  if (!pt.members.size) return void parties.delete(pt.code);
  if (pt.leader === c) pt.leader = pt.members.values().next().value;
  partySync(pt);
}
function onSocketClose(c) {
  partyLeave(c);
  if (c.room) { const r = c.room; r.clients.delete(c); r.onDisconnect(c); }
}
// a profile on this connection (the browser keeps its id and secret until accounts arrive)
function auth(c, m) {
  if (m.name) c.name = cleanName(m.name, c) || c.name;
  if (!m.profile) return null;
  const pr = profiles.open(m.profile.id, m.profile.secret, c.name, m.ref);
  if (pr) { c.profileId = pr.id; if (!c.name && pr.name) c.name = pr.name; send(c, { t: 'profile', profile: profiles.view(pr) }); }
  return pr;
}
const ROOM_OPS = new Set(['quick', 'create', 'solo', 'join', 'scenario', 'partyCreate', 'partyJoin', 'publicProfile', 'leaderboard', 'authStart']);
function route(c, m) {
  if (!m || typeof m.t !== 'string') return;
  // opening rooms and parties, sign-ins and lookups cost the server real work: bursts of 5, then 2 a second
  if (ROOM_OPS.has(m.t)) {
    const now = Date.now(); c.roomTokens = Math.min(5, c.roomTokens + (now - c.roomAt) / 500); c.roomAt = now;
    if (c.roomTokens < 1) return send(c, { t: 'err', msg: 'Slow down a moment' }); c.roomTokens--;
  }
  switch (m.t) {
    case 'auth': auth(c, m); send(c, { t: 'menu', ...menuStats(), mode: process.env.SECTOR_PUBLIC ? 'public' : 'lan', version: VERSION, you: c.cid, logins: providersOn() }); return partySync(c.party);
    case 'menu': return send(c, { t: 'menu', ...menuStats(), mode: process.env.SECTOR_PUBLIC ? 'public' : 'lan', version: VERSION, you: c.cid, logins: providersOn() });
    case 'hello': {
      // joining (or rejoining, with a seat token) a room by its code; no code means the classic lobby
      if (m.profile || m.name) auth(c, m);
      const room = m.room ? rooms.get(String(m.room).toUpperCase()) : m.watch ? focusRoom() || mainRoom() : mainRoom();
      if (!room) return send(c, { t: 'noRoom', code: m.room });
      if (c.room !== room) { leaveRoom(c); c.room = room; room.clients.add(c); }
      room.onMessage(c, m); settle(c); return partySync(c.party);
    }
    case 'quick': {
      // PLAY: a public war that's filling up (with room for the whole party), or a new one
      auth(c, m);
      const n = c.party && c.party.leader === c ? [...c.party.members].filter(x => x === c || !x.room).length : 1;
      const room = quickRoom(n); enterRoom(c, room); bringParty(c, room); return;
    }
    case 'create': { auth(c, m); const room = openRoom('private'); enterRoom(c, room); bringParty(c, room); return; }
    // SINGLEPLAYER: a private room of your own with three bots ready, your saved wars, and an invite link for a friend
    case 'solo': { auth(c, m); const room = openRoom('private'); enterRoom(c, room); room.onMessage(c, { t: 'soloSetup' }); return; }
    case 'join': {
      auth(c, m);
      const code = String(m.code || '').trim().toUpperCase();
      if (parties.has(code)) return route(c, { t: 'partyJoin', code });
      if (code === MAIN && !process.env.SECTOR_PUBLIC) return enterRoom(c, mainRoom());   // a LAN finder's link to the classic lobby
      const room = rooms.get(code); if (!room || code === MAIN) return send(c, { t: 'err', msg: 'No room with the code ' + code, noRoom: code });
      return enterRoom(c, room);
    }
    case 'leave': leaveRoom(c); return;
    // a mission gets a private room of its own, unless you're hosting a room's lobby (then everyone there watches).
    // From a public war or someone else's room you step out of it first.
    case 'scenario': {
      const r = c.room, hosting = r && r.kind !== 'public' && !r.game && r.lobby.hostId === c.pid;
      if (!hosting) { auth(c, m); enterRoom(c, openRoom('private')); }
      break;
    }
    // ── profile: works anywhere, in a room or on the menu ──
    case 'openBox': {
      const pr = c.profileId && profiles.get(c.profileId);
      if (!pr) return send(c, { t: 'err', msg: 'No profile loaded yet' });
      const r = profiles.openBox(pr, String(m.box || ''), !!m.free);
      if (r.err) return send(c, { t: 'err', msg: r.err });
      return send(c, { t: 'boxOpened', box: m.box, free: !!m.free, ...r, profile: profiles.view(pr) });
    }
    case 'buyFaction': {
      const pr = c.profileId && profiles.get(c.profileId);
      if (!pr) return send(c, { t: 'err', msg: 'No profile loaded yet' });
      const err = profiles.buyFaction(pr, String(m.id || ''));
      if (err) return send(c, { t: 'err', msg: err });
      return send(c, { t: 'profile', profile: profiles.view(pr), faction: m.id });
    }
    case 'buy': case 'equip': case 'profile': case 'devCoins': {
      const pr = c.profileId && profiles.get(c.profileId);
      if (!pr) return send(c, { t: 'err', msg: 'No profile loaded yet' });
      if (m.t === 'devCoins') { if (!process.env.SECTOR_DEV) return; profiles.grant(pr, 5000); }
      const err = m.t === 'buy' ? profiles.buy(pr, String(m.item || '')) : m.t === 'equip' ? profiles.equip(pr, String(m.slot || ''), m.item ? String(m.item) : null) : null;
      if (err) return send(c, { t: 'err', msg: err });
      send(c, { t: 'profile', profile: profiles.view(pr), bought: m.t === 'buy' ? m.item : null });
      if (m.t === 'equip') { if (c.room) c.room.profileChanged(c, pr); partySync(c.party); }
      return;
    }
    // ── accounts ──
    case 'authStart': {
      const prov = PROVIDERS[m.provider];
      if (!prov || !providersOn().includes(m.provider)) return send(c, { t: 'err', msg: 'Signing in with that isn\u2019t set up on this server' });
      if (!c.profileId) return send(c, { t: 'err', msg: 'Your profile hasn\u2019t loaded yet' });
      const state = crypto.randomBytes(18).toString('hex');
      authStates.set(state, { provider: m.provider, profileId: c.profileId, origin: c.origin, at: Date.now() });
      return send(c, { t: 'authGo', url: prov.authUrl(state, redirectUri(c.origin, m.provider), m) });
    }
    case 'authClaim': {
      const cl = claims.get(String(m.code || '')); claims.delete(String(m.code || ''));
      if (!cl || Date.now() - cl.at > 5 * 60000) return send(c, { t: 'authDone', ok: false, msg: 'That sign-in expired. Try again.' });
      return send(c, { t: 'authDone', ok: true, provider: cl.provider, name: cl.name, switched: cl.switched, referral: cl.referral, identity: cl.identity });
    }
    case 'authUnlink': {
      const pr = c.profileId && profiles.get(c.profileId); if (!pr) return;
      profiles.unlink(pr, String(m.provider || ''));
      return send(c, { t: 'profile', profile: profiles.view(pr) });
    }
    case 'publicProfile': { const v = profiles.publicView(String(m.handle || '')); return send(c, v ? { t: 'publicProfile', profile: v } : { t: 'err', msg: 'No such commander' }); }
    case 'leaderboard': return send(c, { t: 'leaderboard', period: m.period === 'all' ? 'all' : 'week', rows: profiles.leaderboard(m.period === 'all' ? 'all' : 'week') });
    // ── parties ──
    case 'partyCreate': {
      if (c.party) return partySync(c.party);
      auth(c, m);
      const pt = { code: newCode(), leader: c, members: new Set([c]) }; parties.set(pt.code, pt); c.party = pt;
      return partySync(pt);
    }
    case 'partyJoin': {
      auth(c, m);
      const pt = parties.get(String(m.code || '').trim().toUpperCase());
      if (!pt) return send(c, { t: 'err', msg: 'That party has broken up' });
      if (pt === c.party) return partySync(pt);
      if (pt.members.size >= PARTY_MAX) return send(c, { t: 'err', msg: 'That party is full' });
      partyLeave(c); pt.members.add(c); c.party = pt;
      return partySync(pt);
    }
    case 'partyLeave': return partyLeave(c);
    case 'partyKick': {
      const pt = c.party; if (!pt || pt.leader !== c) return;
      const t = [...pt.members].find(x => x.cid === m.cid); if (t && t !== c) { partyLeave(t); send(t, { t: 'err', msg: 'You were removed from the party' }); }
      return;
    }
    case 'partyLead': { const pt = c.party; if (!pt || pt.leader !== c) return; const t = [...pt.members].find(x => x.cid === m.cid); if (t) { pt.leader = t; partySync(pt); } return; }
    case 'partyRename': { const nm = m.name && cleanName(m.name, c); if (!nm) return; c.name = nm; const pr = c.profileId && profiles.get(c.profileId); if (pr) profiles.rename(pr, c.name); return partySync(c.party); }
  }
  if (!c.room) return;
  c.room.onMessage(c, m); settle(c);
}
// rooms close once everyone has gone for a while
const ROOM_IDLE = { lobby: 90000, play: 5 * 60000 };
setInterval(() => {
  for (const [code, r] of rooms) {
    if (r.clients.size) { r.emptySince = 0; continue; }
    if (code === MAIN && !r.game) continue;   // the classic lobby stays open
    r.emptySince = r.emptySince || Date.now();
    const playing = r.game && r.game.phase === 'play' && r.kind !== 'public';
    if (Date.now() - r.emptySince > (playing ? ROOM_IDLE.play : ROOM_IDLE.lobby)) { r.destroy(); rooms.delete(code); }
  }
}, 1000).unref();
// the room the server console, host panel and dev panel look at: a war in progress, else the classic lobby
const focusRoom = () => [...rooms.values()].find(r => r.game && r.game.phase === 'play') || rooms.get(MAIN) || [...rooms.values()][0] || null;
const allSeats = () => [...rooms.values()].flatMap(r => r.lobby.players.map(p => ({ p, r })));
// ───────────────────────── accounts: sign in with Google or Discord ─────────────────────────
// Standard OAuth: the player is sent to Google or Discord, approves, and comes back to /auth/<provider>/callback with a
// one-time code. The server swaps it (with the app's secret) for who they are, links that login to their commander, and
// hands the browser a single-use claim code. Each provider switches on once its keys are set (see docs/HOSTING.md).
// SECTOR_URL fixes the public address (https://playsector.io); otherwise the address the player used is used.
const enc = o => Object.entries(o).filter(([, v]) => v != null).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
const PROVIDERS = {
  google: {
    name: 'Google', id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET,
    authUrl: (state, redirect) => 'https://accounts.google.com/o/oauth2/v2/auth?' + enc({ client_id: PROVIDERS.google.id, redirect_uri: redirect, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' }),
    token: 'https://oauth2.googleapis.com/token', me: 'https://openidconnect.googleapis.com/v1/userinfo',
    who: u => ({ id: u.sub, name: u.name || u.email, email: u.email }),
  },
  discord: {
    name: 'Discord', id: process.env.DISCORD_CLIENT_ID, secret: process.env.DISCORD_CLIENT_SECRET,
    authUrl: (state, redirect) => 'https://discord.com/oauth2/authorize?' + enc({ client_id: PROVIDERS.discord.id, redirect_uri: redirect, response_type: 'code', scope: 'identify email', state, prompt: 'none' }),
    token: 'https://discord.com/api/oauth2/token', me: 'https://discord.com/api/users/@me',
    who: u => ({ id: u.id, name: u.global_name || u.username, email: u.email }),
  },
  // testing only (SECTOR_AUTH_MOCK=1): a pretend provider that skips the trip, so the whole flow can be tested offline
  mock: process.env.SECTOR_AUTH_MOCK ? {
    name: 'Test login', id: 'mock', secret: 'mock',
    authUrl: (state, redirect, m) => redirect + '?' + enc({ state, code: 'mock:' + String((m && m.mockUser) || 'tester').slice(0, 40) }),
  } : null,
};
const providersOn = () => Object.keys(PROVIDERS).filter(k => PROVIDERS[k] && PROVIDERS[k].id && PROVIDERS[k].secret);
const authStates = new Map(), claims = new Map();
setInterval(() => { const old = Date.now() - 10 * 60000; for (const [k, v] of authStates) if (v.at < old) authStates.delete(k); for (const [k, v] of claims) if (v.at < old) claims.delete(k); }, 60000).unref();
function originOf(req) {
  if (process.env.SECTOR_URL) return process.env.SECTOR_URL.replace(/\/+$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http')).split(',')[0].trim();
  return (proto === 'https' ? 'https' : 'http') + '://' + String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:' + PORT).split(',')[0].trim();
}
const redirectUri = (origin, provider) => origin + '/auth/' + provider + '/callback';
// a small HTTPS request (form body in, JSON out)
function fetchJson(method, url, { form, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const body = form ? enc(form) : null, u = new URL(url);
    const r = require('https').request({ method, hostname: u.hostname, path: u.pathname + u.search, headers: { Accept: 'application/json', 'User-Agent': 'sector-game/' + VERSION, ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } : {}), ...headers }, timeout: 10000 }, res => {
      let d = ''; res.on('data', x => { d += x; }); res.on('end', () => { try { const j = JSON.parse(d); if (res.statusCode >= 400) reject(new Error(j.error_description || j.error || 'HTTP ' + res.statusCode)); else resolve(j); } catch (e) { reject(new Error('Bad reply from ' + u.hostname)); } });
    });
    r.on('error', reject); r.on('timeout', () => r.destroy(new Error('Timed out talking to ' + u.hostname)));
    if (body) r.write(body); r.end();
  });
}
async function authCallback(req, res, url) {
  const m = url.match(/^\/auth\/([a-z]+)\/callback$/), q = new URL(req.url, 'http://x').searchParams;
  const back = (origin, params) => { res.writeHead(302, { Location: (origin || '') + '/?' + enc(params), 'Cache-Control': 'no-store' }); res.end(); };
  const st = authStates.get(q.get('state') || ''); authStates.delete(q.get('state') || '');
  if (!m || !st || st.provider !== m[1]) return back(st && st.origin, { loginError: 'That sign-in link expired. Try again.' });
  if (q.get('error')) return back(st.origin, { loginError: 'Sign-in was cancelled.' });
  const prov = PROVIDERS[m[1]];
  try {
    let info;
    if (m[1] === 'mock') { const who = String(q.get('code') || '').replace(/^mock:/, ''); info = { id: 'mock-' + who, name: who, email: who + '@example.com' }; }
    else {
      const tok = await fetchJson('POST', prov.token, { form: { client_id: prov.id, client_secret: prov.secret, grant_type: 'authorization_code', code: q.get('code'), redirect_uri: redirectUri(st.origin, m[1]) } });
      info = prov.who(await fetchJson('GET', prov.me, { headers: { Authorization: 'Bearer ' + tok.access_token } }));
    }
    if (!info || !info.id) throw new Error('No account id came back');
    const cur = profiles.get(st.profileId), r = profiles.linkAccount(cur, m[1], info);
    if (!r) throw new Error('No commander to link');
    // the browser gets a key to the commander it should now be playing (its own, or the one this login already had)
    const code = crypto.randomBytes(18).toString('hex');
    claims.set(code, { at: Date.now(), provider: m[1], name: info.name || prov.name, switched: r.switched, referral: r.referral || 0, identity: r.switched ? { id: r.profile.id, secret: profiles.addDevice(r.profile) } : null });
    note('A commander signed in with ' + prov.name);
    back(st.origin, { login: code });
  } catch (e) { console.log('[auth] ' + m[1] + ': ' + e.message); back(st.origin, { loginError: 'Couldn’t sign in with ' + prov.name + ': ' + e.message }); }
}
// ── news for the front menu: the latest releases from the changelog ──
let newsCache = null;
function news() {
  if (newsCache) return newsCache;
  let md = ''; try { md = sea ? Buffer.from(sea.getAsset('CHANGELOG.md')).toString('utf8') : fs.readFileSync(path.join(__dirname, 'docs', 'CHANGELOG.md'), 'utf8'); } catch (e) {}
  const out = [];
  for (const part of md.replace(/\r/g, '').split(/^## /m).slice(1, 4)) {
    const lines = part.split('\n'), version = lines[0].trim();
    const headline = (lines.find(l => /^\*\*.+\*\*$/.test(l.trim())) || '').trim().replace(/^\*\*|\*\*$/g, '');
    const items = lines.filter(l => /^- /.test(l)).slice(0, 12).map(l => l.slice(2).trim());
    out.push({ version, headline, items });
  }
  return (newsCache = { version: VERSION, releases: out });
}
// ───────────────────────── host panel (this computer only) ─────────────────────────
// ───────────── dev panel: /dev, analytics and full control. Off unless SECTOR_DEV_KEY is set ─────────────
// (online, this check becomes "signed in with the whitelisted Google account"; the API behind it stays the same)
const DEV_KEY = process.env.SECTOR_DEV_KEY || '';
const ANALYTICS = process.env.SECTOR_ANALYTICS || path.join(process.env.APPDATA || os.homedir(), 'Sector', 'analytics.jsonl');
function logGame(game) {
  try {
    const w = game.winner || {}, wp = game.players.find(p => p.id === w.pid);
    const line = { at: Date.now(), mode: game.settings.mode, fog: game.settings.fog, teams: game.settings.teams, map: game.map.arch, size: game.settings.mapSize, rounds: game.turn.round,
      players: game.players.map(p => ({ faction: p.faction, bot: p.bot, diff: p.diff || null, alive: p.alive, land: E.ownedLand(game, p.id).length, kills: p.stats.kills, won: (w.pids || [w.pid]).includes(p.id) })),
      winner: wp ? { faction: wp.faction, bot: wp.bot, diff: wp.diff || null } : null, reason: w.reason || null, deploys: (game.tally || {}).deploys || {} };
    fs.mkdirSync(path.dirname(ANALYTICS), { recursive: true }); fs.appendFileSync(ANALYTICS, JSON.stringify(line) + '\n');
  } catch (e) { console.log('[analytics] ' + e.message); }
}
function readGames(max = 2000) {
  try { return fs.readFileSync(ANALYTICS, 'utf8').trim().split('\n').slice(-max).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); } catch (e) { return []; }
}
function devApi(req, res, url) {
  const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
  if (!DEV_KEY) { res.writeHead(404); return res.end(); }
  const given = Buffer.from(String(req.headers['x-dev-key'] || '')), want = Buffer.from(DEV_KEY);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return json(401, { err: 'wrong key' });
  const route = url.slice('/dev/api/'.length);
  const done = body => {
    let b = {}; try { b = body ? JSON.parse(body) : {}; } catch (e) { return json(400, { err: 'bad json' }); }
    // the dev panel looks at one room at a time (b.room picks it; default: a war in progress)
    const R = (b.room && rooms.get(String(b.room).toUpperCase())) || focusRoom(), lobby = R ? R.lobby : { players: [], hostId: null }, game = R ? R.game : null, isConnected = R ? R.isConnected : () => false;
    if (route === 'overview') {
      const games = readGames(), fac = {}, dep = {};
      for (const g of games) { for (const p of g.players) { const f = fac[p.faction] = fac[p.faction] || { played: 0, won: 0 }; f.played++; if (p.won) f.won++; } for (const t in g.deploys || {}) dep[t] = (dep[t] || 0) + g.deploys[t]; }
      return json(200, {
        version: VERSION, uptime: Date.now() - STARTED, memory: Math.round(process.memoryUsage().rss / 1048576), connections: sockets.size, room: R ? R.code : null,
        rooms: [...rooms.values()].map(r => ({ code: r.code, kind: r.kind, humans: r.humans(), players: r.lobby.players.length, phase: r.game ? r.game.phase : 'lobby', round: r.game ? r.game.turn.round : 0 })), menu: menuStats(),
        lobby: lobby.players.map(p => ({ id: p.id, name: p.name, bot: p.bot, diff: p.diff || null, spectator: !!p.spectator, connected: p.bot || isConnected(p.id), profile: p.profileId ? p.profileId.slice(0, 8) : null })),
        game: game ? { phase: game.phase, round: game.turn.round, mode: game.settings.mode, paused: !!game.paused, turn: (game.players[game.turn.idx] || {}).name,
          players: game.players.map(p => ({ id: p.id, name: p.name, bot: p.bot, alive: p.alive, cash: p.cash, land: E.ownedLand(game, p.id).length, income: p.alive ? E.computeIncome(game, p.id).total : 0, army: Object.values(game.units).filter(u => u.owner === p.id).length, kills: p.stats.kills })) } : null,
        profiles: profiles.totals(), store: C.dailyStore(),
        analytics: { games: games.length, avgRounds: games.length ? +(games.reduce((a, g) => a + g.rounds, 0) / games.length).toFixed(1) : 0, botWins: games.filter(g => g.winner && g.winner.bot).length, factions: fac, deploys: dep, recent: games.slice(-12).reverse().map(g => ({ at: g.at, mode: g.mode, rounds: g.rounds, players: g.players.length, winner: g.winner, reason: g.reason })) },
      });
    }
    if (route === 'profiles') {
      // who's playing right now: their profile is on a seat in the running game
      const live = new Set(allSeats().filter(({ p, r }) => p.profileId && r.game && r.game.phase !== 'over' && r.game.players.some(g => g.id === p.id)).map(({ p }) => p.profileId));
      return json(200, { profiles: profiles.list(b.q).map(p => ({ ...p, inGame: live.has(p.id) })) });
    }
    const pr = b.profile && profiles.get(b.profile);
    if (route === 'grant') { if (!pr) return json(404, { err: 'no such profile' }); profiles.grant(pr, b.coins); return json(200, { ok: true, coins: pr.coins }); }
    if (route === 'give') { if (!pr) return json(404, { err: 'no such profile' }); const e = profiles.giveItem(pr, String(b.item || '')); return e ? json(400, { err: e }) : json(200, { ok: true }); }
    if (!R) return json(409, { err: 'no game running' });
    const out = R.admin(route, b);
    return out.err ? json(out.code || 400, { err: out.err }) : json(200, out);
  };
  if (req.method === 'POST') { let body = ''; req.on('data', d => { body += d; if (body.length > 1e5) req.destroy(); }); req.on('end', () => done(body)); }
  else done('');
}
function hostApi(req, res, url) {
  const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }); res.end(JSON.stringify(o)); };
  if (!isLoopback(req)) return json(403, { err: 'host panel is only available on the host computer' });
  if (req.method === 'POST' && req.headers['x-sector-host'] !== '1') return json(403, { err: 'bad request' });
  if (url === '/host' && req.method === 'GET') {
    lastPanelAt = Date.now();
    const f = focusRoom(), lobby = f ? f.lobby : { players: [], hostId: null }, game = f ? f.game : null, isConnected = f ? f.isConnected : () => false, seatsOf = c => c.room ? c.room.seatsOf(c) : [];
    const conns = [...sockets].map(c => {
      const p = lobby.players.find(x => x.id === c.pid);
      const addr = (c.socket.remoteAddress || '').replace('::ffff:', '');
      return { name: p ? p.name : '(joining…)', host: !!c.pid && c.pid === lobby.hostId, here: ['127.0.0.1', '::1'].includes(addr), addr, seats: c.pid ? seatsOf(c).length : 0 };
    });
    return json(200, {
      version: VERSION, uptime: Date.now() - STARTED, port: PORT, lan: lanAddresses().map(a => 'http://' + a + ':' + PORT), packaged: !!sea,
      clients: conns, bots: lobby.players.filter(p => p.bot).length, rooms: [...rooms.values()].map(r => ({ code: r.code, kind: r.kind, humans: r.humans(), phase: r.game ? r.game.phase : 'lobby' })),
      players: lobby.players.map(p => { const c = (f ? [...f.clients] : []).find(x => x.pid === p.id && !x.left); return { name: p.name, color: p.color, bot: !!p.bot, diff: p.diff, local: !!p.local, host: p.id === lobby.hostId, connected: p.bot || isConnected(p.id), addr: c ? (c.socket.remoteAddress || '').replace('::ffff:', '').replace(/^(127\.0\.0\.1|::1)$/, 'this PC') : null }; }), inGame: !!game, round: game ? game.turn.round : 0, phase: game ? game.phase : 'lobby',
      update: { ...updateInfo, canApply: !!sea && process.platform === 'win32' && !!updateInfo.url }, log: sea ? LOG_FILE : null,
    });
  }
  if (url === '/host/play' && req.method === 'POST') { openAppWindow('http://localhost:' + PORT, 'game'); return json(200, { ok: true }); }
  if (url === '/host/stop' && req.method === 'POST') { json(200, { ok: true }); return shutdown('The host stopped the server.'); }
  if (url === '/host/check' && req.method === 'POST') { checkUpdate(); return json(200, { ok: true }); }
  if (url === '/host/update' && req.method === 'POST') {
    if (!sea || process.platform !== 'win32') return json(400, { err: 'Auto-update works in the Windows Sector.exe. Download the new version from GitHub.' });
    note('Update requested from the web panel');
    if (!updateInfo.available || !updateInfo.url) return json(400, { err: 'No update available' });
    applyUpdate(); return json(200, { ok: true });
  }
  json(404, { err: 'unknown' });
}
function shutdown(reason, restart) {
  note('Shutting down: ' + reason);
  for (const c of sockets) send(c, { t: 'serverClosed', reason, restart: !!restart });
  setTimeout(() => process.exit(0), 400);
}

// ───────────────────────── updates from GitHub releases ─────────────────────────
const updateInfo = { available: false, latest: null, url: null, page: 'https://github.com/' + REPO + '/releases/latest', state: 'idle', pct: 0, err: null, checked: 0 };
function httpsGet(url, cb, hops = 0) {
  require('https').get(url, { headers: { 'User-Agent': 'sector-game/' + VERSION, Accept: 'application/vnd.github+json' } }, res => {
    if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && hops < 6) { res.resume(); return httpsGet(new URL(res.headers.location, url).href, cb, hops + 1); }
    cb(null, res);
  }).on('error', e => cb(e));
}
const newerThan = (a, b) => { const pa = a.split('.').map(n => parseInt(n, 10) || 0), pb = b.split('.').map(n => parseInt(n, 10) || 0); for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); return false; };
function checkUpdate() {
  if (process.env.SECTOR_NO_UPDATE) return;
  httpsGet('https://api.github.com/repos/' + REPO + '/releases/latest', (err, res) => {
    updateInfo.checked = Date.now();
    if (err || res.statusCode !== 200) { if (res) res.resume(); return; }
    let body = ''; res.setEncoding('utf8'); res.on('data', d => { body += d; });
    res.on('end', () => {
      try {
        const j = JSON.parse(body), tag = String(j.tag_name || '').replace(/^v/, '');
        const asset = (j.assets || []).find(a => /^sector\.exe$/i.test(a.name));
        updateInfo.latest = tag; updateInfo.page = j.html_url || updateInfo.page; updateInfo.url = asset ? asset.browser_download_url : null;
        updateInfo.available = VERSION !== 'dev' && !!tag && newerThan(tag, VERSION);
        if (updateInfo.available) console.log('  Update available: v' + tag + ' (you have v' + VERSION + ')');
      } catch (e) {}
    });
  });
}
// download the new Sector.exe next to this one, then a tiny script swaps them once we exit and relaunches
function applyUpdate() {
  if (updateInfo.state === 'downloading' || updateInfo.state === 'restarting') return;
  const exe = process.execPath, tmp = path.join(path.dirname(exe), 'Sector.update.exe');
  updateInfo.state = 'downloading'; updateInfo.pct = 0; updateInfo.err = null;
  const fail = e => { updateInfo.state = 'error'; updateInfo.err = String((e && e.message) || e); console.log('[update] failed: ' + updateInfo.err); try { fs.unlinkSync(tmp); } catch (_) {} };
  httpsGet(updateInfo.url, (err, res) => {
    if (err) return fail(err);
    if (res.statusCode !== 200) { res.resume(); return fail('download failed (HTTP ' + res.statusCode + ')'); }
    const total = +res.headers['content-length'] || 0; let got = 0;
    let out; try { out = fs.createWriteStream(tmp); } catch (e) { return fail(e); }
    res.on('data', d => { got += d.length; if (total) updateInfo.pct = Math.round(got / total * 100); });
    res.on('error', fail); out.on('error', fail);
    res.pipe(out);
    out.on('finish', () => out.close(() => {
      if (total && got !== total) return fail('download incomplete');
      if (got < 5e6) return fail('downloaded file looks wrong (' + got + ' bytes)');
      // hand over to the new exe: it waits for us to exit, replaces this file and relaunches it
      updateInfo.state = 'restarting';
      require('child_process').spawn(tmp, ['--sector-finish-update', exe, String(process.pid)], { detached: true, stdio: 'ignore', windowsHide: true, cwd: path.dirname(exe) }).unref();
      shutdown('Updating SECTOR to v' + updateInfo.latest + '…', true);
    }));
  });
}

// the packaged exe closes itself a minute after the last player leaves (there's no console window to close)
let lastClientAt = Date.now(), lastPanelAt = 0;
if (process.env.SECTOR_IDLE_EXIT) setInterval(() => {
  // the host dashboard polls every 1.5s, so an open dashboard keeps the server alive too
  if (sockets.size || Date.now() - lastPanelAt < 10000 || [...rooms.values()].some(r => r.game && r.game.phase === 'play')) { lastClientAt = Date.now(); return; }
  if (Date.now() - lastClientAt > (+process.env.SECTOR_IDLE_EXIT || 60) * 1000) shutdown('Nobody is connected.');
}, 5000);

// ───────────────────────── server console dashboard ─────────────────────────
function openBrowser(url) {
  const cp = require('child_process');
  if (process.platform === 'win32') cp.spawn('explorer.exe', [url], { detached: true, stdio: 'ignore' }).unref();
  else cp.spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
}
const fg = hex => { const n = parseInt(String(hex).slice(1), 16) || 0xffffff; return '\x1b[38;2;' + (n >> 16 & 255) + ';' + (n >> 8 & 255) + ';' + (n & 255) + 'm'; };
const A = { r: '\x1b[0m', b: '\x1b[1m', red: fg('#ff4f5e'), gold: fg('#ffc53d'), green: fg('#59f08a'), blue: fg('#36c9ff'), ink: fg('#f1efe6'), dim: fg('#7f8c98'), banner: '\x1b[1;38;2;255;255;255;48;2;181;43;56m' };
const vis = s => s.replace(/\x1b\[[0-9;]*m/g, '').length;
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - vis(s)));
let quitArm = 0, lastPhase = null;
// the dashboard never takes the server down with it: a drawing error is logged once (logging redraws the dashboard,
// so an error that repeated on every draw would loop forever and starve the games)
let tuiFailed = false;
function tuiDraw() {
  if (!TUI) return;
  try { tuiPaint(); tuiFailed = false; } catch (e) { if (tuiFailed) return; tuiFailed = true; note('[console] ' + (e && e.stack || e)); }
}
function tuiPaint() {
  const out = process.stdout, cols = Math.max(50, out.columns || 80), rows = Math.max(20, out.rows || 30), W = Math.min(cols - 4, 76);
  const rule = '  ' + A.dim + '─'.repeat(W) + A.r, L = [], label = t => '  ' + A.gold + A.b + pad(t, 12) + A.r;
  const f = focusRoom(), lobby = f ? f.lobby : { players: [], hostId: null }, game = f ? f.game : null, clients = f ? f.clients : new Set(), st = menuStats();
  const phase = game ? game.phase : 'lobby';
  if (phase !== lastPhase) { if (lastPhase && phase === 'over' && game && game.winner) { const w = game.players.find(p => p.id === game.winner.pid); setImmediate(() => note('Game over — ' + (w ? w.name : '?') + ' won')); } lastPhase = phase; }
  const up = Math.floor((Date.now() - STARTED) / 60000);
  L.push('');
  L.push('  ' + A.banner + '  ▲ SECTOR SERVER  ' + A.r + '  ' + A.dim + 'v' + VERSION + A.r + '   ' + A.green + '● ONLINE' + A.r + A.dim + ' · up ' + (up < 60 ? up + 'm' : Math.floor(up / 60) + 'h ' + up % 60 + 'm') + A.r);
  L.push(''); L.push(rule);
  L.push(label('PLAY HERE') + A.blue + A.b + pad('http://localhost:' + PORT, 30) + A.r + A.dim + 'press O to open in your browser' + A.r);
  const lan = lanAddresses();
  if (!lan.length) L.push(label('INVITE') + A.dim + 'No network found — connect to Wi-Fi to play with friends' + A.r);
  lan.forEach((a, i) => L.push((i ? '  ' + pad('', 12) : label('INVITE')) + A.green + A.b + pad('http://' + a + ':' + PORT, 30) + A.r + (i ? '' : A.dim + 'same Wi-Fi · C copies it' + A.r)));
  L.push(rule);
  const alive = game ? game.players.filter(p => p.alive).length : 0;
  const status = !game ? 'Lobby open — waiting for the host to press DEPLOY' : phase === 'spawn' ? 'Commanders are choosing HQ locations' : phase === 'draft' ? 'Opening draft in progress' : phase === 'over' ? 'Game over' : 'War in progress · round ' + game.turn.round + ' · ' + alive + ' commanders standing · ' + (game.players[game.turn.idx] || {}).name + "'s turn";
  L.push(label('STATUS') + A.ink + status + A.r);
  if (rooms.size > 1 || st.online) L.push(label('ROOMS') + A.ink + st.rooms + ' open · ' + st.wars + ' at war · ' + st.online + ' online' + A.r + A.dim + (f ? '  (showing ' + (f.code === MAIN ? 'the main lobby' : 'room ' + f.code) + ')' : '') + A.r);
  const counts = {}; if (game) for (const k in game.map.tiles) { const o = game.map.tiles[k].owner; if (o) counts[o] = (counts[o] || 0) + 1; }
  if (!lobby.players.length) L.push(label('COMMANDERS') + A.dim + 'Nobody yet — press O to open the game' + A.r);
  lobby.players.slice(0, 8).forEach((p, i) => {
    const c = [...clients].find(x => x.pid === p.id && !x.left), gp = game && game.players.find(x => x.id === p.id);
    const tags = [p.id === lobby.hostId ? A.gold + 'HOST' + A.r : '', p.spectator ? A.blue + 'spectator' + A.r : '', p.bot ? A.dim + 'bot · ' + (p.diff || 'medium') + A.r : p.local ? A.dim + 'local player' + A.r : c ? A.dim + addrOf(c) + A.r : A.red + 'disconnected' + A.r,
      gp ? (gp.alive ? A.dim + (counts[p.id] || 0) + ' hexes' + A.r : A.red + 'eliminated' + A.r) : ''].filter(Boolean).join(A.dim + ' · ' + A.r);
    L.push((i ? '  ' + pad('', 12) : label('COMMANDERS')) + fg(p.color) + '■ ' + A.r + A.ink + pad(p.name, 20) + A.r + tags);
  });
  L.push(rule);
  const u = updateInfo;
  let upd;
  if (u.state === 'downloading') { const n = Math.round(u.pct / 5); upd = A.blue + 'Downloading v' + u.latest + '  [' + '█'.repeat(n) + '░'.repeat(20 - n) + '] ' + u.pct + '%' + A.r; }
  else if (u.state === 'restarting') upd = A.blue + 'Restarting into v' + u.latest + '…' + A.r;
  else if (u.available) upd = A.green + A.b + '★ v' + u.latest + ' is out!' + A.r + A.ink + (sea && process.platform === 'win32' ? '  Press U to update and restart.' : '  Download it from GitHub.') + A.r + (u.err ? A.red + '  (' + u.err + ')' + A.r : '');
  else upd = A.dim + (process.env.SECTOR_NO_UPDATE ? 'Update checks are off' : u.latest ? 'Up to date (latest release v' + u.latest + ')' : u.checked ? "Couldn't reach GitHub to check for updates" : 'Checking GitHub for updates…') + A.r;
  L.push(label('UPDATES') + upd);
  L.push(rule);
  const room = Math.max(2, rows - L.length - 4);
  const act = activity.slice(-room);
  if (!act.length) L.push(label('ACTIVITY') + A.dim + 'Quiet so far.' + A.r);
  act.forEach((a, i) => L.push((i ? '  ' + pad('', 12) : label('ACTIVITY')) + A.dim + a[0] + '  ' + A.r + A.ink + a[1].slice(0, W - 20) + A.r));
  L.push(rule);
  const key = (k, t) => A.b + A.ink + '[' + A.gold + k + A.ink + ']' + A.r + A.dim + ' ' + t + A.r;
  L.push('  ' + (quitArm > Date.now() ? A.red + A.b + 'Press Q again to stop the server' + ([...sockets].some(c => c.pid) ? ' — players are connected!' : '') + A.r
    : [key('O', 'Open game'), key('C', 'Copy invite'), key('U', 'Update'), key('Q', 'Stop server')].join('   ')));
  out.write('\x1b[H' + L.slice(0, rows - 1).map(l => l + '\x1b[K').join('\n') + '\x1b[J');
}
function tuiStart() {
  const out = process.stdout;
  process.title = 'SECTOR Server';
  out.write('\x1b]0;SECTOR Server\x07\x1b[?25l\x1b[2J');
  process.on('exit', () => { try { out.write('\x1b[?25h\x1b[0m\n'); } catch (e) {} });
  out.on('resize', () => { out.write('\x1b[2J'); tuiDraw(); });
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
    process.stdin.on('data', k => {
      const key = k.toLowerCase();
      if (key === 'o' || key === '\r') { openBrowser('http://localhost:' + PORT); note('Opened the game in your browser'); }
      else if (key === 'c') { const a = lanAddresses()[0]; if (!a) return note('No network address to copy'); const url = 'http://' + a + ':' + PORT; if (process.platform === 'win32') { const p = require('child_process').spawn('clip', [], { windowsHide: true }); p.stdin.end(url); } note('Copied ' + url + ' — paste it to your friends'); }
      else if (key === 'u') { if (updateInfo.available && sea && process.platform === 'win32' && updateInfo.url) { note('Updating to v' + updateInfo.latest + '…'); applyUpdate(); } else if (updateInfo.available) { openBrowser(updateInfo.page); note('Opened the download page'); } else { note('Checking for updates…'); checkUpdate(); } }
      else if (key === 'q' || k === '\u0003') { if (quitArm > Date.now()) shutdown('The host stopped the server.'); else { quitArm = Date.now() + 3000; setTimeout(tuiDraw, 3100); } }
      tuiDraw();
    });
  }
  setInterval(tuiDraw, 1000);
  tuiDraw();
}

// open the game in its own app window (Edge/Chrome --app: no tabs, no address bar), else the default browser
function openGameWindow(url) { openAppWindow(url, 'game'); }
function openAppWindow(url, kind) {
  const cp = require('child_process');
  if (process.platform === 'win32') {
    const pf = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean);
    const cands = [];
    for (const base of pf) cands.push(path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    const exe = cands.find(f => { try { return fs.existsSync(f); } catch (e) { return false; } });
    if (exe) {
      const prof = path.join(os.tmpdir(), 'sector-app-profile');
      const size = kind === 'host' ? '540,860' : '1600,900';
      const child = cp.spawn(exe, ['--app=' + url, '--window-size=' + size, '--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required'], { detached: true, stdio: 'ignore' });
      child.unref();
      console.log('  Opened the ' + kind + ' window: ' + url);
      return;
    }
    cp.exec('start "" "' + url + '"', () => {});
  } else cp.exec((process.platform === 'darwin' ? 'open ' : 'xdg-open ') + url, () => {});
}

let probed = false;
server.on('error', err => {
  // launched twice? if SECTOR is already running here, just reopen its window
  if (err.code === 'EADDRINUSE' && sea && !probed && PORT === BASE_PORT) {
    probed = true;
    http.get({ host: '127.0.0.1', port: PORT, path: '/info', timeout: 1500 }, res => {
      let b = ''; res.on('data', d => { b += d; }); res.on('end', () => {
        try { if (JSON.parse(b).game === 'sector') { process.stdout.write('\n  SECTOR is already running at http://localhost:' + PORT + ' — opening it in your browser.\n'); openBrowser('http://localhost:' + PORT); return setTimeout(() => process.exit(0), 2500); } } catch (e) {}
        PORT++; server.listen(PORT, '0.0.0.0');
      });
    }).on('error', () => { PORT++; server.listen(PORT, '0.0.0.0'); });
    return;
  }
  if (err.code === 'EADDRINUSE' && PORT < BASE_PORT + 10) { console.log('  Port ' + PORT + ' is busy, trying ' + (PORT + 1) + '…'); PORT++; setTimeout(() => server.listen(PORT, '0.0.0.0'), 200); }
  else { console.error(err); process.exit(1); }
});
server.on('listening', () => {
  const lan = lanAddresses();
  checkUpdate(); setInterval(checkUpdate, 30 * 60 * 1000).unref();
  if (TUI) { tuiStart(); note('Server started on port ' + PORT); return; }
  console.log('\n  ███ SECTOR v' + VERSION + ' server running ███\n');
  console.log('  This computer:  http://localhost:' + PORT);
  for (const a of lan) console.log('  Same network:   http://' + a + ':' + PORT);
  console.log('\n  Share a "Same network" link with friends on your Wi-Fi/LAN.');
  console.log('  Keep this window open while you play. Close it to stop the server.\n');
  if (process.env.SECTOR_OPEN && !process.env.SECTOR_NO_OPEN) openBrowser('http://localhost:' + PORT);
});
server.listen(PORT, '0.0.0.0');
