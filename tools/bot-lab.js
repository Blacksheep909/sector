// Bot lab: how bots actually play, on fixed seeds so a change can be compared before/after.
//   node tools/bot-lab.js [games=12] [diff=hard] [players=4]
// Reports: wars won outright vs run to the round limit, when commanders get knocked out, Arks bought and troops landed
// from the sea, and where economic buildings go (hexes from the nearest enemy land when built) and how many are lost.
const E = require('../shared/engine'); const { botStep, draftStep, battlePick } = require(process.env.BOTMOD || '../shared/bot');
const games = +(process.argv[2] || 12), diff = process.argv[3] || 'hard', N = +(process.argv[4] || 4);
const facs = Object.keys(E.FACTIONS), out = { conquest: 0, timeout: 0, rounds: 0, knockouts: [], arks: 0, landings: 0, econBuilt: 0, econDist: 0, econFront: 0, econLost: 0, hqAttacks: 0, fobDist: 0, fobs: 0, battleCards: 0, hqCards: 0 };
const ECON = ['warehouse', 'refinery', 'depot'];
const from = +(process.env.LABFROM || 0);   // LABFROM: run games from..from+games-1 (to shard a long run across processes)
for (let g = from; g < from + games; g++) {
  if (process.env.LABTURN && g !== +process.env.LABTURN.split(':')[0]) continue;
  Math.random = E.mulberry32(E.hashStr('botlab' + g));   // bots roll Math.random: seed it so a game replays the same
  const roster = Array.from({ length: N }, (_, i) => ({ id: 'p' + i, name: 'Bot' + i, color: E.COLORS[i], faction: facs[(i + g) % facs.length], bot: true, diff: diff.includes(':') ? diff.split(':')[i % 2] : diff }));
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium', timer: 0, maxRounds: 50, seed: 'lab' + g }, roster);
  while (s.phase === 'draft') for (const p of s.players) { const a = draftStep(s, p.id); if (a) E.applyAction(s, p.id, a); }
  const dist = (k, pid) => { let m = 99; for (const q in s.map.tiles) { const t = s.map.tiles[q]; if (t.owner && t.owner !== pid && !E.isAlly(s, pid, t.owner) && E.isLandTile(t)) m = Math.min(m, E.dist(k, q)); } return m; };
  const sieged = {}, kos = []; let actions = 0; const alive = new Set(s.players.map(p => p.id));
  while (s.phase === 'play' && actions < 80000) {
    const p = E.current(s); const mem = {}; let n = 0;
    const dump = process.env.LABTURN === g + ':' + p.id + ':' + s.turn.round;   // LABTURN=game:pid:round prints that turn
    if (dump) { const st = {}; for (const u of Object.values(s.units)) if (u.owner === p.id && !E.isSea(u.type)) (st[u.hex] = st[u.hex] || []).push(u.type); console.error('stacks', JSON.stringify(st), 'cash', p.cash, 'rivals', s.players.filter(q => q.alive && q.id !== p.id).map(q => q.id + '@' + q.hq).join(' ')); }
    while (s.phase === 'play' && E.current(s).id === p.id) {
      let a = botStep(s, p.id, mem); if (++n > 90) a = { a: 'end' };
      const before = a.a === 'build' && ECON.concat('fob').includes(a.struct) && !E.structsOf(s.map.tiles[a.hex]).some(x => x.type === a.struct) ? dist(a.hex, p.id) : null;
      // the pre-roll window, as the server runs it for bots: each side may throw in battle cards
      const b = (a.a === 'move' || a.a === 'assault') && E.openBattle(s, p.id, a);
      if (b) { if (!b.def || b.def === p.id || !E.player(s, b.def)) E.closeBattle(s); else {
        for (let i = 0; i < 6 && s.battle; i++) { let played = false; for (const pid of [b.att, b.def]) { const uid = battlePick(s, pid); if (uid != null && E.battleCard(s, pid, uid).ok) { played = true; out.battleCards++; if (E.structsOf(s.map.tiles[b.hex]).some(x => x.type === 'hq')) out.hqCards++; } } if (!played) break; }
        if (s.battle && !b.cards.att.length && !b.cards.def.length) E.closeBattle(s); } }
      const cash0 = p.cash;
      const r = E.applyAction(s, p.id, a); actions++; if (r.ok && cash0 > p.cash && s.turn.round > 8) { const key = a.a === 'build' ? 'build:' + a.struct : a.a === 'tactic' ? 'tactic' : a.a; (out.spend = out.spend || {})[key] = (out.spend[key] || 0) + cash0 - p.cash; } if (s.battle) E.closeBattle(s, true); if (!r.ok) continue;
      if (dump) console.error(r.ok ? 'ok' : 'NO', JSON.stringify(a).slice(0, 150), '$' + p.cash);
      if (before !== null) { if (a.struct === 'fob') { out.fobs++; out.fobDist += before; } else { out.econBuilt++; out.econDist += before; if (before <= 2) out.econFront++; } }
      if (a.a === 'deploy' && a.unit === 'ark') out.arks++;
      for (const e of r.events) {
        if (e.e === 'move' && e.pid === p.id) { const from = s.map.tiles[(e.path || [])[0]]; const to = s.map.tiles[(e.path || []).slice(-1)[0]]; if (from && to && E.isWater(from) && E.isLandTile(to) && e.units.some(id => s.units[id] && !E.isSea(s.units[id].type))) out.landings++; }
        if (e.e === 'siege') { out.sieges = (out.sieges || 0) + 1; sieged[e.victim] = (sieged[e.victim] || 0) + 1; } if (e.e === 'siegeBroken') out.broken = (out.broken || 0) + 1;
        if (e.e === 'combat' && !e.ranged && e.att) { const c = new Set(e.att.units.filter(t => E.UNITS[t].atk > 0).map(t => E.UNITS[t].cls)).size; out.fights = (out.fights || 0) + 1; out.classes = (out.classes || 0) + c; if (c >= 3) out.ca3 = (out.ca3 || 0) + 1; }
        if (e.e === 'combat' && e.def && e.def.pid && s.map.tiles[e.to] && E.structsOf(s.map.tiles[e.to]).some(x => x.type === 'hq')) out.hqAttacks++;
      }
    }
    for (const q of s.players) if (alive.has(q.id) && !q.alive) { alive.delete(q.id); out.knockouts.push(s.turn.round); kos.push(s.turn.round); }
  }
  // economic buildings still standing at the end vs built (a rough measure of how many were lost)
  if (s.winner && /standing|captured|conquer/i.test(s.winner.reason)) out.conquest++;
  else { out.timeout++; // a stall: could the leader have walked to a rival HQ (land) or was the sea in the way?
    const alive = s.players.filter(q => q.alive), lead = alive.sort((a, b) => E.ownedLand(s, b.id).length - E.ownedLand(s, a.id).length)[0];
    const seen = new Set(E.spawnPoints(s, lead.id)), q = [...seen]; for (let i = 0; i < q.length; i++) for (const n of E.neighbors(q[i])) if (s.map.tiles[n] && !seen.has(n) && E.isLandTile(s.map.tiles[n])) { seen.add(n); q.push(n); }
    const land = alive.some(o => o.id !== lead.id && seen.has(o.hq)); if (land) out.landStall = (out.landStall || 0) + 1; else out.seaStall = (out.seaStall || 0) + 1;
    { const w = new Set(E.spawnPoints(s, lead.id)), q2 = [...w]; for (let i = 0; i < q2.length; i++) for (const n of E.neighbors(q2[i])) { const t = s.map.tiles[n]; if (t && !w.has(n) && E.isLandTile(t) && !(t.river && !t.bridge)) { w.add(n); q2.push(n); } }
      if (land && !alive.some(o => o.id !== lead.id && w.has(o.hq))) out.riverStall = (out.riverStall || 0) + 1; }
    if (process.env.LABDBG) { const us = Object.values(s.units).filter(u => u.owner === lead.id && !E.isSea(u.type) && E.UNITS[u.type].cls !== 'air'), rivals = alive.filter(o => o.id !== lead.id);
      const near = u => Math.min(...rivals.map(o => E.dist(u.hex, o.hq))), ds = us.map(near).sort((a, b) => a - b);
      process.stderr.write(`  ${land ? 'LAND' : 'SEA'} stall g${g}: leader ${lead.id} land army ${us.length} (mv ${(us.reduce((a, u) => a + E.UNITS[u.type].mv, 0) / Math.max(1, us.length)).toFixed(1)}) dist to rival HQ median ${ds[ds.length >> 1]} min ${ds[0]} · rivals ` +
        rivals.map(o => `${o.id} hq★${(E.structsOf(s.map.tiles[o.hq]).find(x => x.type === 'hq') || {}).lvl || 1} on-hq ${Object.values(s.units).filter(u => u.hex === o.hq).length} army ${Object.values(s.units).filter(u => u.owner === o.id).length} sieged×${sieged[o.id] || 0}${E.isAlly(s, lead.id, o.id) ? ' ALLY' : ''}`).join(' | ') + '\n'); } }
  out.rounds += s.turn.round;
  process.stderr.write(`game ${g}: round ${s.turn.round}, ${s.winner ? s.winner.reason : 'unfinished'}, ${s.players.filter(p => p.alive).length} left, KOs at ${kos.join(',') || '-'}\n`);
}
const ko = out.knockouts.sort((a, b) => a - b);
console.log(JSON.stringify({ diff, games, wonOutright: out.conquest, ranToLimit: out.timeout, avgRounds: +(out.rounds / games).toFixed(1), knockouts: ko.length, medianKnockoutRound: ko[Math.floor(ko.length / 2)] || null,
  hqAttacks: out.hqAttacks, arksBought: out.arks, seaLandings: out.landings, econBuilt: out.econBuilt, econAvgHexesFromEnemy: +(out.econDist / Math.max(1, out.econBuilt)).toFixed(2), econOnFront: out.econFront, fobAvgHexesFromEnemy: +(out.fobDist / Math.max(1, out.fobs)).toFixed(2), landStalls: out.landStall || 0, seaStalls: out.seaStall || 0, riverCut: out.riverStall || 0, battleCards: out.battleCards, hqBattleCards: out.hqCards, sieges: out.sieges || 0, siegesBroken: out.broken || 0, spend: out.spend, attacks: out.fights || 0, avgClassesPerAttack: +((out.classes || 0) / Math.max(1, out.fights || 0)).toFixed(2), attacks3Classes: out.ca3 || 0 }));
