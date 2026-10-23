/* SECTOR — LAN game server. Zero dependencies: `node server.js`, then open the printed URL. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const E = require('./shared/engine');
const { botStep, battlePick, draftStep, spawnStep, tradeReply, allyReply, BOT_NAMES } = require('./shared/bot');
const C = require('./shared/cosmetics');
const { createProfiles } = require('./profiles');

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
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2' };

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
const TUI = !!process.stdout.isTTY && !process.env.SECTOR_PLAIN;
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
// the host panel only answers the host's own computer. Requests relayed by a tunnel or reverse proxy (Cloudflare Tunnel,
// ngrok, a cloud load balancer) also arrive from 127.0.0.1, so anything carrying forwarding headers is treated as remote,
// and SECTOR_PUBLIC=1 switches the panel off entirely for internet-facing servers
const FWD = ['x-forwarded-for', 'x-real-ip', 'forwarded', 'cf-connecting-ip', 'true-client-ip', 'x-forwarded-host', 'fly-client-ip'];
const isLoopback = req => !process.env.SECTOR_PUBLIC && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && !FWD.some(h => req.headers[h]);

// ───────────────────────── http ─────────────────────────
const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (url === '/') url = '/index.html';
  if (url === '/info') {
    // discovery: other SECTOR clients on the LAN scan for this
    const host = lobby.players.find(p => p.id === lobby.hostId);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify({ game: 'sector', version: VERSION, id: SERVER_ID, host: host ? host.name : null, players: lobby.players.length, humans: lobby.players.filter(p => !p.bot).length, inGame: !!game, round: game ? game.turn.round : 0, bots: game ? game.players.filter(p => p.alive && p.bot).length : lobby.players.filter(p => p.bot).length, port: PORT, lan: lanAddresses() }));
  }
  if (url === '/host' || url.startsWith('/host/')) return hostApi(req, res, url);
  if (url === '/dev' && DEV_KEY) url = '/dev.html';
  if (url.startsWith('/dev/api/')) return devApi(req, res, url);
  const name = url.replace(/^\/+/, '');
  if (!name || name.includes('..') || name.includes('\\')) { res.writeHead(403); return res.end(); }
  if (name === 'dev.html' && !DEV_KEY) { res.writeHead(404); return res.end('not found'); }   // no key, no panel
  const rel = name === 'engine.js' ? (sea ? 'engine.js' : 'shared/engine.js') : name === 'cosmetics.js' ? (sea ? 'cosmetics.js' : 'shared/cosmetics.js') : 'public/' + name;
  const done = (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(name)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  };
  if (sea) { try { done(null, Buffer.from(sea.getAsset(rel))); } catch (e) { done(e); } }
  else fs.readFile(path.join(__dirname, rel), done);
});

// ───────────────────────── minimal websocket ─────────────────────────
const clients = new Set();
server.on('upgrade', (req, socket) => {
  if (req.headers['upgrade'] !== 'websocket') return socket.destroy();
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  const client = { socket, buf: Buffer.alloc(0), pid: null, frags: [], seen: Date.now() };
  clients.add(client);
  socket.on('data', d => { client.buf = Buffer.concat([client.buf, d]); readFrames(client); });
  const close = () => { if (!clients.has(client)) return; clients.delete(client); onDisconnect(client); };
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
    if (c.buf.length < off + len) return;
    const payload = Buffer.from(c.buf.subarray(off, off + len));
    if (masked) for (let i = 0; i < len; i++) payload[i] ^= c.buf[maskOff + (i & 3)];
    c.buf = c.buf.subarray(off + len);
    if (op === 8) { try { c.socket.end(); } catch (e) {} return; }
    if (op === 9) { sendFrame(c, payload, 10); continue; }
    if (op === 1 || op === 0) {
      c.frags.push(payload);
      if (fin) { const text = Buffer.concat(c.frags).toString('utf8'); c.frags = []; let msg; try { msg = JSON.parse(text); } catch (e) { continue; } onMessage(c, msg); }
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
  for (const c of [...clients]) {
    if (Date.now() - c.seen > 20000) { try { c.socket.destroy(); } catch (e) {} clients.delete(c); onDisconnect(c); }
    else sendFrame(c, Buffer.alloc(0), 9);
  }
}, 6000);

// ───────────────────────── lobby / game ─────────────────────────
const lobby = { players: [], hostId: null, settings: { mode: 'domination', mapSize: 'medium', mapType: 'random', spawns: 'pick', fog: 'on', events: 'on', timer: 0, maxRounds: 0, conquestPct: 60, seed: '', teams: 'off', speed: 'fast', bank: 'off' } };
let game = null;           // engine state
// profiles live next to the saved games; SECTOR_OG_UNTIL=YYYY-MM-DD gives early accounts the Founder skins
const profiles = createProfiles(process.env.SECTOR_PROFILES || path.join(process.env.APPDATA || os.homedir(), 'Sector', 'profiles.json'), { ogUntil: process.env.SECTOR_OG_UNTIL });
let botMem = {}, botTimer = null, turnTimer = null, idleTimer = null;
let nextPid = 1;
const autoPids = new Set(); // dev: humans driven by the bot AI (SECTOR_DEV=1)

function lobbyView() {
  return {
    players: lobby.players.map(p => ({ id: p.id, name: p.name, color: p.color, faction: p.faction, bot: p.bot, diff: p.diff, local: !!p.local, controller: p.controller || null, spectator: !!p.spectator, team: p.team || 0, cos: p.cos || null, ready: isReady(p), away: !!p.away, afk: !!p.afk, connected: p.bot || isConnected(p.id) })),
    hostId: lobby.hostId, settings: lobby.settings, inGame: !!game, saves: game ? [] : listSaves(), version: VERSION, lan: lanAddresses().map(a => 'http://' + a + ':' + PORT), port: PORT,
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
  for (const c of clients) { if (c.left) continue; const seat = seatFor(c); send(c, { t: 'state', state: E.view(game, seat, fogFor(seat)), events: filterEvents(events, seat), by, seq, seat, mine: controls(c, by), undo: undoStack.owner === seat ? undoStack.length : 0, timeLeft: game && game.turn.deadline ? Math.max(0, game.turn.deadline - (game.turn.pausedAt || Date.now())) : 0, paused: !!(game && game.turn.pausedAt) }); }
}
// ally war room: arrows and circles each commander draws on the map, shown only to them and their allies
const warNotes = {};
function sendNotes() {
  if (!game) return;
  for (const c of clients) {
    if (c.left) continue; const seat = seatFor(c); if (!seat) { send(c, { t: 'notes', notes: [] }); continue; }
    const notes = Object.keys(warNotes).filter(pid => pid === seat || E.isAlly(game, seat, pid)).map(pid => ({ pid, shapes: warNotes[pid] }));
    send(c, { t: 'notes', notes });
  }
}
function filterEvents(events, pid) {
  let out = events.map(e => (e.e === 'card' && e.pid !== pid && e.kind === 'tactic' && e.rarity !== 'legendary') ? { ...e, id: null } : e);
  const pl = game && pid && game.players.find(p => p.id === pid);
  // fog of war: where a rival set up their HQ stays secret
  if (game && game.settings.fog === 'on') out = out.filter(e => e.e !== 'spawnPicked' || e.pid === pid || (pid && E.isAlly(game, pid, e.pid)));
  if (game && game.settings.fog === 'on' && pl && pl.alive && game.phase === 'play') {
    const vis = E.visionOf(game, pid), mine = e => e.pid === pid || (e.pid && E.isAlly(game, pid, e.pid));
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
        if (lobby.players.length >= 8) return send(c, { t: 'err', msg: 'Lobby is full' });
        p = { id: 'p' + nextPid++, token: crypto.randomBytes(12).toString('hex'), name: String(m.name || 'Commander').slice(0, 16), color: freeColor(), faction: Object.keys(E.FACTIONS)[Math.floor(Math.random() * 5)], bot: false };
        lobby.players.push(p);
        note(p.name + ' joined from ' + addrOf(c));
      } else if (!isConnected(p.id)) note(p.name + ' reconnected');
      if (p.away && game) { c.pid = p.id; returnSeats(p); }
      c.pid = p.id;
      // the player's profile (coins, skins): their loadout shows on their seat for everyone
      if (m.profile) { const pr = profiles.open(m.profile.id, m.profile.secret, p.name, m.ref); if (pr) { p.profileId = pr.id; p.cos = C.cleanLoadout(pr.equipped, pr.owned); send(c, { t: 'profile', profile: profiles.view(pr) }); } }
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
      const name = String(m.name || 'Commander').slice(0, 16), was = gp.name.replace(/ \(bot\)$/, '');
      lp.bot = false; lp.diff = null; lp.spectator = false; lp.token = crypto.randomBytes(12).toString('hex'); lp.name = name;
      gp.bot = false; gp.diff = null; gp.name = name;
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
      if (m.name) p.name = String(m.name).slice(0, 16);
      if (m.faction && E.FACTIONS[m.faction]) p.faction = m.faction;
      if (m.color && E.COLORS.includes(m.color) && m.color !== p.color) {
        // a human-held colour stays locked; a bot holding it swaps to your old colour so nobody clashes
        const holder = lobby.players.find(x => x.color === m.color && x !== p);
        if (!holder) p.color = m.color;
        else if (holder.bot || (holder.local && holder.controller === c.pid)) { holder.color = p.color; p.color = m.color; }
      }
      return broadcastLobby();
    }
    case 'settings': if (c.pid !== lobby.hostId || game) return; Object.assign(lobby.settings, pick(m.settings, ['mode', 'mapSize', 'mapType', 'spawns', 'fog', 'events', 'timer', 'maxRounds', 'conquestPct', 'seed', 'teams', 'speed', 'bank'])); for (const p of lobby.players) if (p.id !== lobby.hostId) p.ready = false; return broadcastLobby();
    case 'addLocal': {
      if (game || !c.pid || lobby.players.length >= 8) return;
      const n = lobby.players.filter(p => p.local).length + 2;
      lobby.players.push({ id: 'p' + nextPid++, token: null, name: 'Player ' + n, color: freeColor(), faction: Object.keys(E.FACTIONS)[Math.floor(Math.random() * 5)], bot: false, local: true, controller: c.pid });
      return broadcastLobby();
    }
    case 'seatCfg': {
      const sp = lobby.players.find(p => p.id === m.id && p.local && p.controller === c.pid);
      if (!sp || game) return;
      if (m.name) sp.name = String(m.name).slice(0, 16);
      if (m.faction && E.FACTIONS[m.faction]) sp.faction = m.faction;
      if (m.color && E.COLORS.includes(m.color) && !lobby.players.some(x => x.color === m.color && x !== sp)) sp.color = m.color;
      return broadcastLobby();
    }
    case 'addBot': {
      if (c.pid !== lobby.hostId || game || lobby.players.length >= 8) return;
      const used = new Set(lobby.players.map(p => p.name));
      const name = BOT_NAMES.find(n => !used.has(n)) || 'Bot';
      // a new bot takes the difficulty of the bot above it (so filling a lobby with Hard bots is one setting, not five)
      const prev = [...lobby.players].reverse().find(p => p.bot);
      const diff = E.DIFFICULTY[m.diff] || m.diff === 'random' ? m.diff : prev ? prev.diff : 'medium';
      lobby.players.push({ id: 'p' + nextPid++, token: null, name, color: freeColor(), faction: Object.keys(E.FACTIONS)[Math.floor(Math.random() * 5)], bot: true, diff, cos: C.botLoadout() });
      return broadcastLobby();
    }
    case 'buy': case 'equip': case 'profile': case 'devCoins': {
      const lp = lobby.players.find(x => x.id === c.pid), pr = lp && lp.profileId && profiles.get(lp.profileId);
      if (!pr) return send(c, { t: 'err', msg: 'No profile: rejoin to load your skins' });
      if (m.t === 'devCoins') { if (!process.env.SECTOR_DEV) return; profiles.grant(pr, 5000); }
      const err = m.t === 'buy' ? profiles.buy(pr, String(m.item || '')) : m.t === 'equip' ? profiles.equip(pr, String(m.slot || ''), m.item ? String(m.item) : null) : null;
      if (err) return send(c, { t: 'err', msg: err });
      send(c, { t: 'profile', profile: profiles.view(pr), bought: m.t === 'buy' ? m.item : null });
      if (m.t === 'equip' && !game) { lp.cos = C.cleanLoadout(pr.equipped, pr.owned); broadcastLobby(); }
      return;
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
        for (const cl of clients) if (seats.includes(cl.pid)) { send(cl, { t: 'kicked' }); cl.pid = null; cl.left = true; }
        note(target.name.replace(/ \(bot\)$/, '') + ' was kicked by the host');
        game.v++; broadcastLobby(); broadcastState([], null); return afterChange();
      }
      lobby.players = lobby.players.filter(p => p.id !== m.id && p.controller !== m.id);
      for (const cl of clients) if (cl.pid === m.id) { send(cl, { t: 'kicked' }); cl.pid = null; }
      return broadcastLobby();
    }
    case 'start': {
      if (c.pid !== lobby.hostId || game) return;
      const diffs = Object.keys(E.DIFFICULTY);
      const roster = lobby.players.filter(p => !p.spectator).map(p => p.bot && p.diff === 'random' ? { ...p, diff: diffs[Math.floor(Math.random() * diffs.length)] } : p);
      if (roster.length < 2) return send(c, { t: 'err', msg: lobby.players.length < 2 ? 'Need at least 2 commanders (add a bot)' : 'Need at least 2 commanders who are playing, not spectating' });
      const host = lobby.players.find(p => p.id === c.pid); if (host) host.ready = true;   // pressing DEPLOY readies the host
      const waiting = notReady();
      if (waiting.length) return send(c, { t: 'err', msg: 'Waiting for ' + waiting.map(p => p.name).join(', ') + ' to ready up' });
      const s = { ...lobby.settings, timer: +lobby.settings.timer || 0, maxRounds: +lobby.settings.maxRounds || 0, conquestPct: +lobby.settings.conquestPct || 60 };
      if (s.bank && s.bank !== 'off') s.timer = 0;   // the time bank replaces the per-turn timer
      for (const k in bankLeft) delete bankLeft[k]; bankKey = ''; bankPid = null;
      const r = E.createGame(s, roster);
      game = r.state; botMem = {}; fogMem = {};
      game.saveId = 'g' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex');
      console.log('[game] started: ' + lobby.players.length + ' players, ' + s.mode + ', map ' + s.mapSize);
      broadcastLobby();
      broadcastState(r.events, null);
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
      if (m.t === 'ping') { if (!game.map.tiles[m.hex] || !PINGS.includes(m.kind)) return; for (const cl of clients) send(cl, { t: 'ping', pid: p.id, hex: m.hex, kind: m.kind }); }
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
      const text = String(m.text || '').slice(0, 140).trim(); if (!text) return;
      for (const cl of clients) send(cl, { t: 'chat', from: p ? p.name : 'Spectator', color: p ? p.color : '#888', text });
      return;
    }
    case 'leave': {
      // leaving: in a running game your seats become bots so the match carries on
      const seats = seatsOf(c);
      if (game) { pushLeave(seats); botifySeats(seats, true); } else lobby.players = lobby.players.filter(p => !seats.includes(p.id));
      if (seats.includes(lobby.hostId)) { const h = lobby.players.find(p => !p.bot && !p.local && isConnected(p.id) && !seats.includes(p.id)); lobby.hostId = h ? h.id : null; }
      { const p = lobby.players.find(x => x.id === seats[0]); if (p) note(p.name.replace(/ \(bot\)$/, '') + (game ? ' left — a bot took over' : ' left the lobby')); }
      c.pid = null; c.left = true;
      send(c, { t: 'left' });
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
    case 'dropSave': if (c.pid !== lobby.hostId || game) return; dropSave(m.id); return broadcastLobby();
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
function pushLeave(seats) {
  for (const id of seats) { const gp = game.players.find(p => p.id === id); if (gp) game.log.push('🚪 ' + gp.name.replace(' (bot)', '') + ' left — a bot took over.'); }
  while (game.log.length > 40) game.log.shift();
}
function pick(o, keys) { const r = {}; for (const k of keys) if (o && k in o) r[k] = o[k]; return r; }

function endGame() {
  console.log('[game] returned to lobby');
  // ending a war early keeps it saved, so it can be resumed from the lobby
  if (game && game.phase === 'play') writeSave(); else clearTimeout(saveTimer);
  for (const k in warNotes) delete warNotes[k];
  game = null; clearTimeout(botTimer); clearTimeout(turnTimer); clearTimeout(idleTimer);
  for (const p of lobby.players) p.ready = false;   // everyone readies up again for the next war
  for (const c of clients) send(c, { t: 'state', state: null, events: [] });
  broadcastLobby();
}

// ───────────── saved games: every war in progress autosaves to its own file, and the host can resume it from the lobby ─────────────
const SAVE_DIR = process.env.SECTOR_SAVES || path.join(process.env.APPDATA || os.homedir(), 'Sector', 'saves');
const SAVE_KEEP = 20;
let saveTimer = null, saveList = null;
const savePath = id => path.join(SAVE_DIR, String(id).replace(/[^a-z0-9_-]/gi, '') + '.json');
function saveTitle(g) {
  const mode = { domination: 'Domination', conquest: 'Conquest', koth: 'Beacon', worldwar: 'World War' }[g.settings.mode] || g.settings.mode;
  return mode + ' · round ' + g.turn.round + ' · ' + g.players.filter(p => p.alive).map(p => p.name.replace(/ \(bot\)$/, '')).join(', ');
}
function writeSave() {
  clearTimeout(saveTimer); saveTimer = null;
  if (!game || game.phase !== 'play' || !game.saveId) return null;
  const fog = {}; for (const k in fogMem) fog[k] = { explored: [...fogMem[k].explored], seen: fogMem[k].seen };
  const seats = lobby.players.filter(p => game.players.some(g => g.id === p.id)).map(p => pick(p, ['id', 'name', 'color', 'faction', 'bot', 'diff', 'local', 'controller', 'team']));
  const data = { v: 1, version: VERSION, id: game.saveId, savedAt: Date.now(), title: saveTitle(game), round: game.turn.round, mode: game.settings.mode, game, fog, seats, bank: bankLeft };
  try {
    fs.mkdirSync(SAVE_DIR, { recursive: true });
    const f = savePath(game.saveId); fs.writeFileSync(f + '.tmp', JSON.stringify(data)); fs.renameSync(f + '.tmp', f);
    saveList = null;
    // keep the newest few
    const old = listSaves().slice(SAVE_KEEP); for (const o of old) try { fs.unlinkSync(savePath(o.id)); } catch (e) {}
    if (old.length) saveList = null;
    return data;
  } catch (e) { console.log('[save] failed: ' + e.message); return null; }
}
function scheduleSave() { if (!saveTimer && game && game.phase === 'play' && game.saveId) saveTimer = setTimeout(writeSave, 3000); }
function dropSave(id) { try { fs.unlinkSync(savePath(id)); } catch (e) {} saveList = null; }
function listSaves() {
  if (saveList) return saveList;
  let files = []; try { files = fs.readdirSync(SAVE_DIR).filter(f => f.endsWith('.json')); } catch (e) {}
  const out = [];
  for (const f of files) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(SAVE_DIR, f), 'utf8'));
      if (!d || !d.game || !d.id) continue;
      out.push({ id: d.id, title: d.title, round: d.round, mode: d.mode, savedAt: d.savedAt, humans: (d.seats || []).filter(p => !p.bot).map(p => p.name) });
    } catch (e) {}
  }
  return (saveList = out.sort((a, b) => b.savedAt - a.savedAt));
}
function loadSave(c, id) {
  let d; try { d = JSON.parse(fs.readFileSync(savePath(id), 'utf8')); } catch (e) { return send(c, { t: 'err', msg: 'That save could not be read' }); }
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
    players.push({ id: gp.id, name: gp.name, color: gp.color, faction: gp.faction, team: gp.team || 0, bot: true, diff: gp.diff || sv.diff || 'medium', local: false, controller: null, token: null, _local: sv.local ? sv.controller : null });
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
  Object.assign(lobby.settings, pick(g.settings, ['mode', 'mapSize', 'mapType', 'spawns', 'fog', 'events', 'timer', 'maxRounds', 'conquestPct', 'teams', 'speed', 'bank']));
  // clocks were wall-clock times when saved: restart this turn's
  g.turn.pausedAt = 0; g.paused = false;
  g.turn.deadline = g.settings.timer ? Date.now() + g.settings.timer * 1000 : 0; g.turn.prevDeadline = 0;
  game = g; game.v = (game.v || 0) + 1; botMem = {}; undoStack.length = 0; undoStack.owner = null;
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
const addrOf = c => { const a = (c.socket.remoteAddress || '').replace('::ffff:', ''); return a === '127.0.0.1' || a === '::1' ? 'this PC' : a; };
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
function payOut() {
  if (!game || game.phase !== 'over' || game.paid) return;
  game.paid = true;
  logGame();
  const w = game.winner || {}, winners = w.pids || [w.pid];
  const land = id => E.ownedLand(game, id).length;
  const order = game.players.slice().sort((a, b) => (winners.includes(b.id) - winners.includes(a.id)) || (b.alive - a.alive) || land(b.id) - land(a.id));
  const humans = game.players.filter(p => !p.bot || (lobby.players.find(x => x.id === p.id) || {}).away);
  for (const gp of game.players) {
    const lp = lobby.players.find(x => x.id === gp.id), pr = lp && !lp.bot && lp.profileId && profiles.get(lp.profileId);
    if (!pr) continue;
    const r = { won: winners.includes(gp.id), place: order.indexOf(gp) + 1, players: game.players.length, rounds: game.turn.round, kills: gp.stats.kills, captured: gp.stats.captured, crates: gp.stats.crates, vsHumans: humans.length > 1 };
    const out = profiles.finishGame(pr, r);
    for (const cl of clients) if (cl.pid === lp.id || (lp.local && cl.pid === lp.controller)) send(cl, { t: 'reward', reward: out, profile: profiles.view(pr) });
  }
}
function afterChange(events) {
  clearTimeout(botTimer); clearTimeout(turnTimer); clearTimeout(idleTimer);
  payOut();
  if (game && game.phase === 'play') scheduleSave();
  else if (game && game.phase === 'over' && game.saveId) { clearTimeout(saveTimer); saveTimer = null; dropSave(game.saveId); game.saveId = null; }   // a finished war can't be resumed
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
  if ((lp && lp.bot) || autoPids.has(cur.id)) {
    let delay = 450;
    if (events) for (const e of events) {
      if (e.e === 'combat') delay = Math.max(delay, 5600);
      else if (e.e === 'crate') delay = Math.max(delay, 3200);
      else if (e.e === 'eliminate' || e.e === 'tactic') delay = Math.max(delay, 2600);
      else if (e.e === 'move') delay = Math.max(delay, 500 + e.path.length * 170);
      else if (e.e === 'turn') delay = Math.max(delay, 1500);
      else if (e.e === 'card') delay = Math.max(delay, 1200);
    }
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
function runBot() {
  if (!game || game.phase !== 'play' || game.paused || pendingOw || pendingBattle) return;
  const cur = E.current(game);
  const mem = botMem[cur.id + ':' + game.turn.round] || (botMem = {}, botMem[cur.id + ':' + game.turn.round] = { n: 0 });
  let a = mem.n++ > 60 ? { a: 'end' } : botStep(game, cur.id, mem);
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

// ───────────────────────── host panel (this computer only) ─────────────────────────
// ───────────── dev panel: /dev, analytics and full control. Off unless SECTOR_DEV_KEY is set ─────────────
// (online, this check becomes "signed in with the whitelisted Google account"; the API behind it stays the same)
const DEV_KEY = process.env.SECTOR_DEV_KEY || '';
const ANALYTICS = process.env.SECTOR_ANALYTICS || path.join(process.env.APPDATA || os.homedir(), 'Sector', 'analytics.jsonl');
function logGame() {
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
    if (route === 'overview') {
      const games = readGames(), fac = {}, dep = {};
      for (const g of games) { for (const p of g.players) { const f = fac[p.faction] = fac[p.faction] || { played: 0, won: 0 }; f.played++; if (p.won) f.won++; } for (const t in g.deploys || {}) dep[t] = (dep[t] || 0) + g.deploys[t]; }
      return json(200, {
        version: VERSION, uptime: Date.now() - STARTED, memory: Math.round(process.memoryUsage().rss / 1048576), connections: [...clients].filter(c => !c.left).length,
        lobby: lobby.players.map(p => ({ id: p.id, name: p.name, bot: p.bot, diff: p.diff || null, spectator: !!p.spectator, connected: p.bot || isConnected(p.id), profile: p.profileId ? p.profileId.slice(0, 8) : null })),
        game: game ? { phase: game.phase, round: game.turn.round, mode: game.settings.mode, paused: !!game.paused, turn: (game.players[game.turn.idx] || {}).name,
          players: game.players.map(p => ({ id: p.id, name: p.name, bot: p.bot, alive: p.alive, cash: p.cash, land: E.ownedLand(game, p.id).length, income: p.alive ? E.computeIncome(game, p.id).total : 0, army: Object.values(game.units).filter(u => u.owner === p.id).length, kills: p.stats.kills })) } : null,
        profiles: profiles.totals(), store: C.dailyStore(),
        analytics: { games: games.length, avgRounds: games.length ? +(games.reduce((a, g) => a + g.rounds, 0) / games.length).toFixed(1) : 0, botWins: games.filter(g => g.winner && g.winner.bot).length, factions: fac, deploys: dep, recent: games.slice(-12).reverse().map(g => ({ at: g.at, mode: g.mode, rounds: g.rounds, players: g.players.length, winner: g.winner, reason: g.reason })) },
      });
    }
    if (route === 'profiles') {
      // who's playing right now: their profile is on a seat in the running game
      const live = new Set(game && game.phase !== 'over' ? lobby.players.filter(p => p.profileId && game.players.some(g => g.id === p.id)).map(p => p.profileId) : []);
      return json(200, { profiles: profiles.list(b.q).map(p => ({ ...p, inGame: live.has(p.id) })) });
    }
    const pr = b.profile && profiles.get(b.profile);
    if (route === 'grant') { if (!pr) return json(404, { err: 'no such profile' }); profiles.grant(pr, b.coins); return json(200, { ok: true, coins: pr.coins }); }
    if (route === 'give') { if (!pr) return json(404, { err: 'no such profile' }); const e = profiles.giveItem(pr, String(b.item || '')); return e ? json(400, { err: e }) : json(200, { ok: true }); }
    if (!game) return json(409, { err: 'no game running' });
    if (route === 'cash') { const gp = game.players.find(p => p.id === b.pid); if (!gp) return json(404, { err: 'no such player' }); gp.cash = Math.max(0, gp.cash + (b.amount | 0)); game.log.push('🛠 The admin adjusted ' + gp.name + "'s treasury."); }
    else if (route === 'pause') { game.paused = !!b.on; if (b.on) { clearTimeout(botTimer); clearTimeout(turnTimer); clearTimeout(idleTimer); } else resumeClock(); }
    else if (route === 'end') { endGame(); return json(200, { ok: true }); }
    else return json(404, { err: 'unknown route' });
    game.v++; broadcastState([], null); afterChange();
    return json(200, { ok: true });
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
    const conns = [...clients].filter(c => !c.left).map(c => {
      const p = lobby.players.find(x => x.id === c.pid);
      const addr = (c.socket.remoteAddress || '').replace('::ffff:', '');
      return { name: p ? p.name : '(joining…)', host: !!c.pid && c.pid === lobby.hostId, here: ['127.0.0.1', '::1'].includes(addr), addr, seats: c.pid ? seatsOf(c).length : 0 };
    });
    return json(200, {
      version: VERSION, uptime: Date.now() - STARTED, port: PORT, lan: lanAddresses().map(a => 'http://' + a + ':' + PORT), packaged: !!sea,
      clients: conns, bots: lobby.players.filter(p => p.bot).length,
      players: lobby.players.map(p => { const c = [...clients].find(x => x.pid === p.id && !x.left); return { name: p.name, color: p.color, bot: !!p.bot, diff: p.diff, local: !!p.local, host: p.id === lobby.hostId, connected: p.bot || isConnected(p.id), addr: c ? (c.socket.remoteAddress || '').replace('::ffff:', '').replace(/^(127\.0\.0\.1|::1)$/, 'this PC') : null }; }), inGame: !!game, round: game ? game.turn.round : 0, phase: game ? game.phase : 'lobby',
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
  for (const c of clients) send(c, { t: 'serverClosed', reason, restart: !!restart });
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
  if ([...clients].some(c => !c.left) || Date.now() - lastPanelAt < 10000 || (game && game.phase === 'play')) { lastClientAt = Date.now(); return; }
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
function tuiDraw() {
  if (!TUI) return;
  const out = process.stdout, cols = Math.max(50, out.columns || 80), rows = Math.max(20, out.rows || 30), W = Math.min(cols - 4, 76);
  const rule = '  ' + A.dim + '─'.repeat(W) + A.r, L = [], label = t => '  ' + A.gold + A.b + pad(t, 12) + A.r;
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
  L.push('  ' + (quitArm > Date.now() ? A.red + A.b + 'Press Q again to stop the server' + ([...clients].some(c => !c.left && c.pid) ? ' — players are connected!' : '') + A.r
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
