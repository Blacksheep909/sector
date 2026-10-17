/* SECTOR — LAN game server. Zero dependencies: `node server.js`, then open the printed URL. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const E = require('./shared/engine');
const { botStep, draftStep, spawnStep, tradeReply, BOT_NAMES } = require('./shared/bot');

let PORT = +process.env.PORT || 3000;
const BASE_PORT = PORT;
// build-exe injects __SECTOR_VERSION; from source we read package.json
const VERSION = typeof __SECTOR_VERSION !== 'undefined' ? __SECTOR_VERSION : (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version; } catch (e) { return 'dev'; } })();
const REPO = 'Blacksheep909/sector';
const STARTED = Date.now();
const PUBLIC = path.join(__dirname, 'public');
const SERVER_ID = crypto.randomBytes(6).toString('hex'); // lets LAN scanners spot one server reachable on several addresses
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2' };

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  return out;
}

// packaged as a single executable? then client files are embedded assets
let sea = null;
try { sea = require('node:sea'); if (!sea.isSea()) sea = null; } catch (e) { sea = null; }
// the packaged exe has no console window: keep a log file instead
const LOG_FILE = path.join(os.tmpdir(), 'sector-server.log');
if (sea && !process.env.SECTOR_CONSOLE) {
  try { fs.writeFileSync(LOG_FILE, 'SECTOR v' + VERSION + ' ' + new Date().toISOString() + '\n'); } catch (e) {}
  const w = (...a) => { try { fs.appendFileSync(LOG_FILE, a.map(x => x instanceof Error ? x.stack : String(x)).join(' ') + '\n'); } catch (e) {} };
  console.log = console.info = console.warn = console.error = w;
  process.on('uncaughtException', e => w('[crash]', e));
}
const isLoopback = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

// ───────────────────────── http ─────────────────────────
const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (url === '/') url = '/index.html';
  if (url === '/info') {
    // discovery: other SECTOR clients on the LAN scan for this
    const host = lobby.players.find(p => p.id === lobby.hostId);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify({ game: 'sector', version: VERSION, id: SERVER_ID, host: host ? host.name : null, players: lobby.players.length, humans: lobby.players.filter(p => !p.bot).length, inGame: !!game, round: game ? game.turn.round : 0, port: PORT, lan: lanAddresses() }));
  }
  if (url === '/host' || url.startsWith('/host/')) return hostApi(req, res, url);
  const name = url.replace(/^\/+/, '');
  if (!name || name.includes('..') || name.includes('\\')) { res.writeHead(403); return res.end(); }
  const rel = name === 'engine.js' ? (sea ? 'engine.js' : 'shared/engine.js') : 'public/' + name;
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
const lobby = { players: [], hostId: null, settings: { mode: 'domination', mapSize: 'medium', mapType: 'random', spawns: 'random', timer: 0, maxRounds: 0, conquestPct: 60, seed: '' } };
let game = null;           // engine state
let botMem = {}, botTimer = null, turnTimer = null, idleTimer = null;
let nextPid = 1;
const autoPids = new Set(); // dev: humans driven by the bot AI (SECTOR_DEV=1)

function lobbyView() {
  return {
    players: lobby.players.map(p => ({ id: p.id, name: p.name, color: p.color, faction: p.faction, bot: p.bot, diff: p.diff, local: !!p.local, controller: p.controller || null, connected: p.bot || isConnected(p.id) })),
    hostId: lobby.hostId, settings: lobby.settings, inGame: !!game, version: VERSION, lan: lanAddresses().map(a => 'http://' + a + ':' + PORT), port: PORT,
  };
}
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
function broadcastLobby() { const v = lobbyView(); for (const c of clients) send(c, { t: 'lobby', lobby: v }); }
function broadcastState(events, by, seq) {
  for (const c of clients) { if (c.left) continue; const seat = seatFor(c); send(c, { t: 'state', state: E.view(game, seat), events: filterEvents(events, seat), by, seq, seat, mine: controls(c, by) }); }
}
function filterEvents(events, pid) {
  return events.map(e => (e.e === 'card' && e.pid !== pid && e.kind === 'tactic' && e.rarity !== 'legendary') ? { ...e, id: null } : e);
}
function freeColor() { return E.COLORS.find(c => !lobby.players.some(p => p.color === c)) || E.COLORS[0]; }

function onMessage(c, m) {
  switch (m.t) {
    case 'hello': {
      c.left = false;
      let p = m.token && lobby.players.find(x => x.token === m.token);
      if (!p && game) { send(c, { t: 'welcome', you: null, spectator: true }); send(c, { t: 'lobby', lobby: lobbyView() }); send(c, { t: 'state', state: E.view(game, null), events: [] }); return; }
      if (!p) {
        if (lobby.players.length >= 8) return send(c, { t: 'err', msg: 'Lobby is full' });
        p = { id: 'p' + nextPid++, token: crypto.randomBytes(12).toString('hex'), name: String(m.name || 'Commander').slice(0, 16), color: freeColor(), faction: Object.keys(E.FACTIONS)[Math.floor(Math.random() * 5)], bot: false };
        lobby.players.push(p);
      }
      c.pid = p.id;
      if (!lobby.hostId || !lobby.players.some(x => x.id === lobby.hostId && !x.bot)) lobby.hostId = p.id;
      send(c, { t: 'welcome', you: p.id, token: p.token });
      broadcastLobby();
      if (game) { const seat = seatFor(c); send(c, { t: 'state', state: E.view(game, seat), events: [], seat }); afterChange(); }
      return;
    }
    case 'me': {
      const p = lobby.players.find(x => x.id === c.pid); if (!p || game) return;
      if (m.name) p.name = String(m.name).slice(0, 16);
      if (m.faction && E.FACTIONS[m.faction]) p.faction = m.faction;
      if (m.color && E.COLORS.includes(m.color) && !lobby.players.some(x => x.color === m.color && x !== p)) p.color = m.color;
      return broadcastLobby();
    }
    case 'settings': if (c.pid !== lobby.hostId || game) return; Object.assign(lobby.settings, pick(m.settings, ['mode', 'mapSize', 'mapType', 'spawns', 'timer', 'maxRounds', 'conquestPct', 'seed'])); return broadcastLobby();
    case 'addLocal': {
      if (game || !c.pid || lobby.players.length >= 6) return;
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
      if (c.pid !== lobby.hostId || game || lobby.players.length >= 6) return;
      const used = new Set(lobby.players.map(p => p.name));
      const name = BOT_NAMES.find(n => !used.has(n)) || 'Bot';
      lobby.players.push({ id: 'p' + nextPid++, token: null, name, color: freeColor(), faction: Object.keys(E.FACTIONS)[Math.floor(Math.random() * 5)], bot: true, diff: E.DIFFICULTY[m.diff] ? m.diff : 'medium' });
      return broadcastLobby();
    }
    case 'botCfg': {
      if (c.pid !== lobby.hostId || game) return;
      const b = lobby.players.find(p => p.id === m.id && p.bot); if (!b) return;
      if (m.diff && E.DIFFICULTY[m.diff]) b.diff = m.diff;
      if (m.faction && E.FACTIONS[m.faction]) b.faction = m.faction;
      return broadcastLobby();
    }
    case 'kick': {
      if (game || m.id === c.pid) return;
      const target = lobby.players.find(p => p.id === m.id);
      if (!target || !(c.pid === lobby.hostId || (target.local && target.controller === c.pid))) return;
      lobby.players = lobby.players.filter(p => p.id !== m.id && p.controller !== m.id);
      for (const cl of clients) if (cl.pid === m.id) { send(cl, { t: 'kicked' }); cl.pid = null; }
      return broadcastLobby();
    }
    case 'start': {
      if (c.pid !== lobby.hostId || game) return;
      if (lobby.players.length < 2) return send(c, { t: 'err', msg: 'Need at least 2 commanders (add a bot)' });
      const s = { ...lobby.settings, timer: +lobby.settings.timer || 0, maxRounds: +lobby.settings.maxRounds || 0, conquestPct: +lobby.settings.conquestPct || 60 };
      const r = E.createGame(s, lobby.players);
      game = r.state; botMem = {};
      console.log('[game] started: ' + lobby.players.length + ' players, ' + s.mode + ', map ' + s.mapSize);
      broadcastLobby();
      broadcastState(r.events, null);
      return afterChange();
    }
    case 'act': {
      if (!game) return;
      const actor = m.as && controls(c, m.as) ? m.as : c.pid;
      const r = E.applyAction(game, actor, m.action || {});
      if (!r.ok) return send(c, { t: 'err', msg: r.err, seq: m.seq });
      game.v++;
      broadcastState(r.events, actor, m.seq);
      return afterChange(r.events);
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
      if (game) {
        for (const id of seats) {
          const lp = lobby.players.find(p => p.id === id), gp = game.players.find(p => p.id === id);
          if (lp) { lp.bot = true; lp.diff = lp.diff || 'medium'; lp.local = false; lp.controller = null; lp.token = null; lp.name = lp.name.replace(/ \(bot\)$/, '') + ' (bot)'; }
          if (gp && gp.alive) { gp.bot = true; gp.diff = gp.diff || 'medium'; gp.name = lp ? lp.name : gp.name; }
          if (game.trade && game.trade.to === id) game.trade = null;
        }
        pushLeave(seats);
      } else lobby.players = lobby.players.filter(p => !seats.includes(p.id));
      if (seats.includes(lobby.hostId)) { const h = lobby.players.find(p => !p.bot && !p.local && isConnected(p.id) && !seats.includes(p.id)); lobby.hostId = h ? h.id : null; }
      c.pid = null; c.left = true;
      send(c, { t: 'left' });
      broadcastLobby();
      if (game) { game.v++; broadcastState([], null); afterChange(); }
      return;
    }
    case 'toLobby': if (c.pid !== lobby.hostId || !game) return; console.log('[game] host ' + c.pid + ' ended the game'); endGame(); return;
    case 'ping': return send(c, { t: 'pong' });
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
  game = null; clearTimeout(botTimer); clearTimeout(turnTimer); clearTimeout(idleTimer);
  for (const c of clients) send(c, { t: 'state', state: null, events: [] });
  broadcastLobby();
}

function onDisconnect(c) {
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
let tradeTimer = null, draftTimer = null;
function afterChange(events) {
  clearTimeout(botTimer); clearTimeout(turnTimer); clearTimeout(idleTimer);
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
    botTimer = setTimeout(runBot, delay * (process.env.SECTOR_FAST ? 0.25 : 1));
    return;
  }
  if (game.turn.deadline) {
    turnTimer = setTimeout(() => forceEnd(cur.id), Math.max(0, game.turn.deadline - Date.now()) + 300);
  }
  if (!isConnected(cur.id)) idleTimer = setTimeout(() => { if (!isConnected(cur.id)) forceEnd(cur.id); }, 30000);
}
function forceEnd(pid) {
  if (!game || game.phase !== 'play' || E.current(game).id !== pid) return;
  const r = E.applyAction(game, pid, { a: 'end' });
  if (r.ok) { game.v++; broadcastState(r.events, pid); afterChange(r.events); }
}
function runBot() {
  if (!game || game.phase !== 'play') return;
  const cur = E.current(game);
  const mem = botMem[cur.id + ':' + game.turn.round] || (botMem = {}, botMem[cur.id + ':' + game.turn.round] = { n: 0 });
  let a = mem.n++ > 60 ? { a: 'end' } : botStep(game, cur.id, mem);
  let r = E.applyAction(game, cur.id, a);
  if (!r.ok) { if (a.a === 'end') return; return void (botTimer = setTimeout(runBot, 10)); }
  game.v++;
  broadcastState(r.events, cur.id);
  afterChange(r.events);
}

// ───────────────────────── host panel (this computer only) ─────────────────────────
function hostApi(req, res, url) {
  const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }); res.end(JSON.stringify(o)); };
  if (!isLoopback(req)) return json(403, { err: 'host panel is only available on the host computer' });
  if (req.method === 'POST' && req.headers['x-sector-host'] !== '1') return json(403, { err: 'bad request' });
  if (url === '/host' && req.method === 'GET') {
    const conns = [...clients].filter(c => !c.left).map(c => {
      const p = lobby.players.find(x => x.id === c.pid);
      const addr = (c.socket.remoteAddress || '').replace('::ffff:', '');
      return { name: p ? p.name : '(joining…)', host: !!c.pid && c.pid === lobby.hostId, here: ['127.0.0.1', '::1'].includes(addr), addr, seats: c.pid ? seatsOf(c).length : 0 };
    });
    return json(200, {
      version: VERSION, uptime: Date.now() - STARTED, port: PORT, lan: lanAddresses().map(a => 'http://' + a + ':' + PORT), packaged: !!sea,
      clients: conns, bots: lobby.players.filter(p => p.bot).length, inGame: !!game, round: game ? game.turn.round : 0, phase: game ? game.phase : 'lobby',
      update: { ...updateInfo, canApply: !!sea && process.platform === 'win32' && !!updateInfo.url }, log: sea ? LOG_FILE : null,
    });
  }
  if (url === '/host/stop' && req.method === 'POST') { json(200, { ok: true }); return shutdown('The host stopped the server.'); }
  if (url === '/host/check' && req.method === 'POST') { checkUpdate(); return json(200, { ok: true }); }
  if (url === '/host/update' && req.method === 'POST') {
    if (!sea || process.platform !== 'win32') return json(400, { err: 'Auto-update works in the Windows Sector.exe. Download the new version from GitHub.' });
    if (!updateInfo.available || !updateInfo.url) return json(400, { err: 'No update available' });
    applyUpdate(); return json(200, { ok: true });
  }
  json(404, { err: 'unknown' });
}
function shutdown(reason, restart) {
  console.log('[server] shutting down: ' + reason);
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
  const exe = process.execPath, tmp = path.join(path.dirname(exe), path.basename(exe, '.exe') + '.update.exe');
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
      const cmd = path.join(os.tmpdir(), 'sector-update-' + process.pid + '.cmd');
      fs.writeFileSync(cmd, ['@echo off', 'set SECTOR_NO_OPEN=1', ':wait', 'timeout /t 1 /nobreak >nul',
        'tasklist /FI "PID eq ' + process.pid + '" 2>nul | find "' + process.pid + '" >nul', 'if not errorlevel 1 goto wait',
        'move /y "' + tmp + '" "' + exe + '" >nul', 'start "" "' + exe + '"', '(goto) 2>nul & del "%~f0"'].join('\r\n'));
      updateInfo.state = 'restarting';
      require('child_process').spawn('cmd.exe', ['/d', '/c', cmd], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
      shutdown('Updating SECTOR to v' + updateInfo.latest + '…', true);
    }));
  });
}

// the packaged exe closes itself a minute after the last player leaves (there's no console window to close)
let lastClientAt = Date.now();
if (sea || process.env.SECTOR_IDLE_EXIT) setInterval(() => {
  if ([...clients].some(c => !c.left)) { lastClientAt = Date.now(); return; }
  if (Date.now() - lastClientAt > (+process.env.SECTOR_IDLE_EXIT || 60) * 1000) shutdown('Nobody is connected.');
}, 5000);

// open the game in its own app window (Edge/Chrome --app: no tabs, no address bar), else the default browser
function openGameWindow(url) {
  const cp = require('child_process');
  if (process.platform === 'win32') {
    const pf = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean);
    const cands = [];
    for (const base of pf) cands.push(path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    const exe = cands.find(f => { try { return fs.existsSync(f); } catch (e) { return false; } });
    if (exe) {
      const prof = path.join(os.tmpdir(), 'sector-app-profile');
      const child = cp.spawn(exe, ['--app=' + url, '--window-size=1600,900', '--user-data-dir=' + prof, '--no-first-run', '--autoplay-policy=no-user-gesture-required'], { detached: true, stdio: 'ignore' });
      child.unref();
      console.log('  Opened the game window. (Close it any time; reopen with ' + url + ')');
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
        try { if (JSON.parse(b).game === 'sector') { openGameWindow('http://localhost:' + PORT); return setTimeout(() => process.exit(0), 1500); } } catch (e) {}
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
  console.log('\n  ███ SECTOR v' + VERSION + ' server running ███\n');
  console.log('  This computer:  http://localhost:' + PORT);
  for (const a of lan) console.log('  Same network:   http://' + a + ':' + PORT);
  console.log('\n  Share a "Same network" link with friends on your Wi-Fi/LAN.');
  console.log(sea ? '  Manage the server from the SERVER button in the game window.\n' : '  Keep this window open while you play. Close it to stop the server.\n');
  checkUpdate(); setInterval(checkUpdate, 30 * 60 * 1000).unref();
  if ((sea || process.env.SECTOR_OPEN) && !process.env.SECTOR_NO_OPEN) openGameWindow('http://localhost:' + PORT);
});
server.listen(PORT, '0.0.0.0');
