// Rooms, quick play and parties against a live server: node tools/test-rooms.js (starts its own server on port 3014)
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const PORT = 3014, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sector-rooms-'));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, SECTOR_NO_OPEN: '1', SECTOR_PLAIN: '1', SECTOR_NO_UPDATE: '1', SECTOR_SAVES: dir, SECTOR_PROFILES: path.join(dir, 'profiles.json'), SECTOR_PUBLIC_WAIT: '4000' }, stdio: 'ignore' });
let n = 0;
function client(name) {
  const ws = new WebSocket('ws://localhost:' + PORT), c = { name, ws, lobby: null, state: null, you: null, party: null, msgs: [] };
  ws.onmessage = e => { const m = JSON.parse(e.data); c.msgs.push(m); if (m.t === 'lobby') c.lobby = m.lobby; if (m.t === 'state') c.state = m.state; if (m.t === 'welcome') c.you = m.you; if (m.t === 'party') c.party = m.party; if (m.t === 'left') { c.lobby = null; c.state = null; c.you = null; } };
  c.send = o => ws.send(JSON.stringify(o));
  const hex = k => (k.repeat(32)).slice(0, 32);
  c.profile = { id: hex(String.fromCharCode(97 + n)), secret: hex(String.fromCharCode(97 + n++)) + 'zz' };
  c.open = new Promise(r => { ws.onopen = () => { c.send({ t: 'auth', name, profile: c.profile }); r(); }; });
  c.last = t => [...c.msgs].reverse().find(m => m.t === t);
  return c;
}
const until = async (f, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (f()) return true; await sleep(50); } return false; };
(async () => {
  try {
    await sleep(1200);
    const a = client('Alice'), b = client('Bob'), c = client('Cara');
    await Promise.all([a.open, b.open, c.open]);
    ok(await until(() => a.last('menu') && a.last('profile')), 'the front menu gets online counts and the profile');
    // ── a private room with a code ──
    a.send({ t: 'create' });
    ok(await until(() => a.lobby && a.lobby.code && a.lobby.kind === 'private' && a.lobby.hostId === a.you), 'CREATE ROOM opens a private room with a code, and you host it');
    const code = a.lobby.code;
    ok(a.lobby.players.find(p => p.id === a.you).faction === 'iron', 'a new commander plays their starter faction');
    a.send({ t: 'me', faction: 'volt' }); await sleep(300);
    ok(a.lobby.players.find(p => p.id === a.you).faction === 'iron', 'a faction you haven’t unlocked is refused');
    b.send({ t: 'join', code: code.toLowerCase() });
    ok(await until(() => b.lobby && b.lobby.code === code && a.lobby.players.length === 2), 'a friend joins with the code (any case)');
    ok(a.lobby.players.find(p => p.id === a.you).handle, 'seats carry a public handle (so you can open their profile)');
    b.send({ t: 'join', code: 'ZZZZZ' });
    ok(await until(() => b.msgs.some(m => m.t === 'err' && /No room/.test(m.msg))), 'a wrong code is refused');
    b.send({ t: 'leave' });
    ok(await until(() => !b.lobby && a.lobby.players.length === 1), 'leaving a room puts you back on the menu and frees the seat');
    // ── quick play: public rooms ──
    b.send({ t: 'quick' }); await until(() => b.lobby && b.you);
    ok(b.lobby.kind === 'public' && b.lobby.hostId === b.you, 'PLAY with no open war opens a public one, hosted by you');
    c.send({ t: 'quick' });
    ok(await until(() => c.lobby && c.lobby.kind === 'public' && b.lobby.code === c.lobby.code && b.lobby.players.length === 2), 'PLAY puts the next commander in that open war');
    c.send({ t: 'settings', settings: { mapSize: 'large' } }); c.send({ t: 'start' }); await sleep(400);
    ok(b.lobby.settings.mapSize !== 'large' && !b.state, 'only the host changes the settings or deploys');
    b.send({ t: 'settings', settings: { mapSize: 'medium' } });
    ok(await until(() => c.lobby.settings.mapSize === 'medium'), 'the host can change the settings');
    b.send({ t: 'start' });
    ok(await until(() => b.state && b.state.phase !== 'over' && c.state, 9000), 'the host deploys it');
    a.send({ t: 'quick' }); await until(() => a.lobby);
    ok(a.lobby && a.lobby.code !== b.lobby.code, 'a war that has deployed takes nobody else from PLAY');
    ok(b.state && b.state.players.length >= 4 && b.state.players.filter(p => p.bot).length >= 2, 'bots fill the empty seats (' + (b.state ? b.state.players.length : 0) + ' commanders)');
    ok(b.state && b.state.settings.timer === 60, 'public wars have a turn clock');
    // ── parties ──
    b.send({ t: 'leave' }); c.send({ t: 'leave' }); a.send({ t: 'leave' });
    await until(() => !a.lobby && !b.lobby && !c.lobby);
    a.send({ t: 'partyCreate' });
    ok(await until(() => a.party && a.party.code && a.party.members.length === 1), 'you can start a party');
    b.send({ t: 'partyJoin', code: a.party.code }); c.send({ t: 'join', code: a.party.code });
    ok(await until(() => a.party.members.length === 3 && b.party && c.party && b.party.code === a.party.code), 'friends join with the party code');
    const mb = a.party.members.find(m => m.name === 'Bob');
    ok(mb && mb.handle && 'banner' in mb, 'party members show their name, handle and banner');
    b.send({ t: 'publicProfile', handle: a.party.members.find(m => m.name === 'Alice').handle });
    ok(await until(() => b.last('publicProfile') && b.last('publicProfile').profile.name === 'Alice'), 'you can open a party member’s profile');
    ok(!('coins' in (b.last('publicProfile') || { profile: {} }).profile), 'a public profile never shows Valor');
    b.send({ t: 'quick' });
    await sleep(400);
    ok(!a.lobby, 'only the leader’s PLAY takes the party along (a member queues alone)');
    b.send({ t: 'leave' }); await until(() => !b.lobby);
    a.send({ t: 'create' });
    ok(await until(() => a.lobby && b.lobby && c.lobby && b.lobby.code === a.lobby.code && c.lobby.code === a.lobby.code), 'the leader opening a room brings the whole party');
    ok(a.party.members.every(m => m.room === a.lobby.code), 'the party shows where everyone is');
    c.send({ t: 'partyLeave' });
    ok(await until(() => !c.party && a.party.members.length === 2), 'leaving the party');
    a.ws.close();
    ok(await until(() => b.party && b.party.members.length === 1 && b.party.leader === b.party.members[0].cid), 'when the leader goes, the party passes to someone else');
    // ── leaderboard and news ──
    b.send({ t: 'leaderboard', period: 'all' });
    ok(await until(() => b.last('leaderboard')), 'the leaderboard answers');
    const news = await (await fetch('http://localhost:' + PORT + '/news')).json();
    ok(news.releases && news.releases.length && news.releases[0].version, 'the news feed reads the changelog (' + (news.releases[0] || {}).version + ')');
    const info = await (await fetch('http://localhost:' + PORT + '/info')).json();
    ok(info.game === 'sector' && info.rooms >= 1, 'the server reports its rooms');
    // a mission straight from the front menu gets a private room of its own
    c.send({ t: 'leave' }); await until(() => !c.lobby);
    c.send({ t: 'scenario', id: require('../shared/scenarios').SCENARIOS[0].id });
    ok(await until(() => c.state && c.state.scenario && c.lobby && c.lobby.kind === 'private' && c.lobby.code !== 'MAIN'), 'a mission picked on the front menu opens its own private room');
    // an old-style client (no room code) still gets the classic lobby
    const d = new WebSocket('ws://localhost:' + PORT), got = [];
    d.onmessage = e => got.push(JSON.parse(e.data)); await new Promise(r => { d.onopen = r; });
    d.send(JSON.stringify({ t: 'hello', name: 'Old' }));
    ok(await until(() => got.some(m => m.t === 'lobby' && m.lobby.code === 'MAIN')), 'a plain hello lands in the classic lobby');
  } catch (e) { console.error(e); fails++; }
  srv.kill();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
