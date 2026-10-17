/* SECTOR — LAN game server. Zero dependencies: `node server.js`, then open the printed URL. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const E = require('./shared/engine');
const { botStep, tradeReply, BOT_NAMES } = require('./shared/bot');

let PORT = +process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2' };

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  return out;
}

// packaged as a single executable? then client files are embedded assets
let sea = null;
try { sea = require('node:sea'); if (!sea.isSea()) sea = null; } catch (e) { sea = null; }

// ───────────────────────── http ─────────────────────────
const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (url === '/') url = '/index.html';
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
  const client = { socket, buf: Buffer.alloc(0), pid: null, frags: [] };
  clients.add(client);
  socket.on('data', d => { client.buf = Buffer.concat([client.buf, d]); readFrames(client); });
  const close = () => { if (!clients.has(client)) return; clients.delete(client); onDisconnect(client); };
  socket.on('close', close); socket.on('error', close); socket.on('end', close);
});

function readFrames(c) {
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

// ───────────────────────── lobby / game ─────────────────────────
const lobby = { players: [], hostId: null, settings: { mode: 'domination', mapSize: 'medium', mapType: 'random', timer: 0, maxRounds: 0, conquestPct: 60, seed: '' } };
let game = null;           // engine state
let botMem = {}, botTimer = null, turnTimer = null, idleTimer = null;
let nextPid = 1;
const autoPids = new Set(); // dev: humans driven by the bot AI (SECTOR_DEV=1)

function lobbyView() {
  return {
    players: lobby.players.map(p => ({ id: p.id, name: p.name, color: p.color, faction: p.faction, bot: p.bot, diff: p.diff, connected: p.bot || isConnected(p.id) })),
    hostId: lobby.hostId, settings: lobby.settings, inGame: !!game, lan: lanAddresses().map(a => 'http://' + a + ':' + PORT), port: PORT,
  };
}
const isConnected = pid => [...clients].some(c => c.pid === pid);
function broadcastLobby() { const v = lobbyView(); for (const c of clients) send(c, { t: 'lobby', lobby: v }); }
function broadcastState(events, by, seq) {
  for (const c of clients) send(c, { t: 'state', state: E.view(game, c.pid), events: filterEvents(events, c.pid), by, seq });
}
function filterEvents(events, pid) {
  return events.map(e => (e.e === 'card' && e.pid !== pid && e.kind === 'tactic' && e.rarity !== 'legendary') ? { ...e, id: null } : e);
}
function freeColor() { return E.COLORS.find(c => !lobby.players.some(p => p.color === c)) || E.COLORS[0]; }

function onMessage(c, m) {
  switch (m.t) {
    case 'hello': {
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
      if (game) { send(c, { t: 'state', state: E.view(game, p.id), events: [] }); afterChange(); }
      return;
    }
    case 'me': {
      const p = lobby.players.find(x => x.id === c.pid); if (!p || game) return;
      if (m.name) p.name = String(m.name).slice(0, 16);
      if (m.faction && E.FACTIONS[m.faction]) p.faction = m.faction;
      if (m.color && E.COLORS.includes(m.color) && !lobby.players.some(x => x.color === m.color && x !== p)) p.color = m.color;
      return broadcastLobby();
    }
    case 'settings': if (c.pid !== lobby.hostId || game) return; Object.assign(lobby.settings, pick(m.settings, ['mode', 'mapSize', 'mapType', 'timer', 'maxRounds', 'conquestPct', 'seed'])); return broadcastLobby();
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
      if (c.pid !== lobby.hostId || game || m.id === c.pid) return;
      lobby.players = lobby.players.filter(p => p.id !== m.id);
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
      const r = E.applyAction(game, c.pid, m.action || {});
      if (!r.ok) return send(c, { t: 'err', msg: r.err, seq: m.seq });
      game.v++;
      broadcastState(r.events, c.pid, m.seq);
      return afterChange(r.events);
    }
    case 'chat': {
      const p = lobby.players.find(x => x.id === c.pid);
      const text = String(m.text || '').slice(0, 140).trim(); if (!text) return;
      for (const cl of clients) send(cl, { t: 'chat', from: p ? p.name : 'Spectator', color: p ? p.color : '#888', text });
      return;
    }
    case 'toLobby': if (c.pid !== lobby.hostId || !game) return; console.log('[game] host ' + c.pid + ' ended the game'); endGame(); return;
    case 'ping': return send(c, { t: 'pong' });
    case 'autoplay': if (!process.env.SECTOR_DEV || !c.pid) return; m.on ? autoPids.add(c.pid) : autoPids.delete(c.pid); return afterChange();
  }
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
      lobby.players = lobby.players.filter(p => p.id !== c.pid);
      if (lobby.hostId === c.pid) { const h = lobby.players.find(p => !p.bot); lobby.hostId = h ? h.id : null; }
      broadcastLobby();
    }, 4000);
  } else broadcastLobby();
  if (game) afterChange();
}

// after every change: schedule bots, timers, idle-skips
let tradeTimer = null;
function afterChange(events) {
  clearTimeout(botTimer); clearTimeout(turnTimer); clearTimeout(idleTimer);
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
      if (e.e === 'combat') delay = Math.max(delay, 5200);
      else if (e.e === 'eliminate' || e.e === 'tactic') delay = Math.max(delay, 2600);
      else if (e.e === 'move') delay = Math.max(delay, 500 + e.path.length * 170);
      else if (e.e === 'turn') delay = Math.max(delay, 1500);
      else if (e.e === 'card') delay = Math.max(delay, 1200);
    }
    botTimer = setTimeout(runBot, delay);
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

server.on('error', err => {
  if (err.code === 'EADDRINUSE' && PORT < (+process.env.PORT || 3000) + 10) { console.log('  Port ' + PORT + ' is busy, trying ' + (PORT + 1) + '…'); PORT++; setTimeout(() => server.listen(PORT, '0.0.0.0'), 200); }
  else { console.error(err); process.exit(1); }
});
server.on('listening', () => {
  const lan = lanAddresses();
  console.log('\n  ███ SECTOR server running ███\n');
  console.log('  This computer:  http://localhost:' + PORT);
  for (const a of lan) console.log('  Same network:   http://' + a + ':' + PORT);
  console.log('\n  Share a "Same network" link with friends on your Wi-Fi/LAN.');
  console.log('  Keep this window open while you play. Close it to stop the server.\n');
  if ((sea || process.env.SECTOR_OPEN) && !process.env.SECTOR_NO_OPEN) {
    const url = 'http://localhost:' + PORT;
    const cmd = process.platform === 'win32' ? 'start "" "' + url + '"' : process.platform === 'darwin' ? 'open ' + url : 'xdg-open ' + url;
    require('child_process').exec(cmd, () => {});
  }
});
server.listen(PORT, '0.0.0.0');
