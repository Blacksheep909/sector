/* SECTOR — heuristic bot. botStep returns one action at a time, or {a:'end'}. */
'use strict';
const E = require('./engine');

const BOT_NAMES = ['Vex', 'Kestrel', 'Morrow', 'Juno', 'Halcyon', 'Rook', 'Sable', 'Ajax', 'Nyx', 'Corvid'];

function unitValue(type) { const d = E.UNITS[type]; return d.atk + d.def + d.mv * 0.6; }
function stackValue(units) { return units.reduce((a, u) => a + unitValue(u.type), 0); }

function cardScore(s, p, id) {
  const d = E.cardDef(id);
  const rar = { common: 1, uncommon: 2, rare: 3.2, legendary: 6 }[d.rarity];
  if (d.kind === 'unit') return rar * (p.arsenal.length < 4 ? 1.4 : 0.9);
  return rar * 0.8;
}

const SKILL = {
  easy: { attack: 0.72, noise: 2.5, idle: 0.35, tactics: 0.4 },
  medium: { attack: 0.55, noise: 0.6, idle: 0.05, tactics: 1 },
  hard: { attack: 0.5, noise: 0.3, idle: 0, tactics: 1 },
  impossible: { attack: 0.45, noise: 0.15, idle: 0, tactics: 1 },
};

// accept a trade if what we get is worth clearly more than what we give
function tradeReply(s, pid) {
  const t = s.trade; if (!t || t.to !== pid) return null;
  const p = E.player(s, pid), from = E.player(s, t.from);
  const cardVal = id => { const d = E.TACTICS[id]; return d ? d.cost + { common: 2, uncommon: 4, rare: 7, legendary: 14 }[d.rarity] : 0; };
  const gain = t.give.cash + (t.cardIds || []).reduce((a, id) => a + cardVal(id), 0);
  const cost = t.get.cash;
  const greed = { easy: 1, medium: 1.15, hard: 1.35, impossible: 1.6 }[p.diff] || 1.15;
  const leader = E.ownedTiles(s, from.id).length > E.ownedTiles(s, pid).length * 1.6;
  return { a: 'tradeReply', accept: cost <= p.cash && gain >= cost * greed && !(leader && cost > 0) };
}

function botStep(s, pid, mem) {
  const p = E.player(s, pid);
  const K = SKILL[p.diff] || SKILL.medium;
  if (s.turn.stage === 'choose') {
    const scores = s.turn.offer.map(id => cardScore(s, p, id));
    let bi = 0; scores.forEach((v, i) => { if (v > scores[bi]) bi = i; });
    const income = s.turn.income;
    const threshold = 2.2 + income / 10 - (s.turn.round <= 3 ? 0.6 : 0);
    if (scores.length && scores[bi] >= threshold) return { a: 'choose', pick: 'card', idx: bi };
    return { a: 'choose', pick: 'income' };
  }
  mem.tried = mem.tried || new Set();
  const tryOnce = (act) => { const k = JSON.stringify(act); if (mem.tried.has(k)) return null; mem.tried.add(k); return act; };
  const idx = E.buildIndex(s);
  const tiles = s.map.tiles;
  const enemyNear = (k, r) => E.area(k, r).some(a => (idx[a] || []).some(u => u.owner !== pid));

  // 1. instant / opportunistic tactics
  for (const c of p.tactics) {
    const d = E.TACTICS[c.id];
    if (p.cash < d.cost || Math.random() > K.tactics) continue;
    let act = null;
    if (c.id === 'cache' || c.id === 'bonds') act = { a: 'tactic', uid: c.uid };
    else if (['airstrike', 'mutiny', 'nuke', 'sabotage', 'emp'].includes(c.id)) {
      const ts = E.tacticTargets(s, pid, c.id);
      let best = null, bv = 0;
      for (const k of ts) {
        let v = 0;
        if (c.id === 'sabotage') v = tiles[k].struct.type === 'fob' ? 10 : 5;
        else if (c.id === 'nuke' || c.id === 'emp') for (const a of E.area(k, 1)) for (const u of idx[a] || []) v += u.owner === pid ? -unitValue(u.type) * 2 : unitValue(u.type);
        else v = stackValue(idx[k] || []);
        if (v > bv) { bv = v; best = k; }
      }
      const need = { airstrike: 9, mutiny: 8, nuke: 30, sabotage: 5, emp: 20 }[c.id];
      if (best && bv >= need) act = { a: 'tactic', uid: c.uid, target: best };
    } else if (c.id === 'conscript') {
      const ts = E.tacticTargets(s, pid, c.id); if (ts.length) act = { a: 'tactic', uid: c.uid, target: ts[0] };
    } else if (c.id === 'blitz') {
      const ready = Object.values(s.units).filter(u => u.owner === pid && !u.moved).length;
      if (ready >= 6) act = { a: 'tactic', uid: c.uid };
    }
    if (act && (act = tryOnce(act))) return act;
  }

  // 2. economy builds
  const sup = E.supplySet(s, pid);
  for (const k of sup) {
    const t = tiles[k];
    if (t.res && !t.struct && p.cash >= E.structCost(p, 'refinery')) { const a = tryOnce({ a: 'build', struct: 'refinery', hex: k }); if (a) return a; }
  }
  if (!tiles[p.hq].struct || tiles[p.hq].struct.type !== 'hq') { /* lost */ }
  if (enemyNear(p.hq, 3)) {
    const ring = E.neighbors(p.hq).filter(n => tiles[n] && tiles[n].owner === pid && !tiles[n].struct && sup.has(n));
    if (ring.length && p.cash >= E.structCost(p, 'bunker') + 4) { const a = tryOnce({ a: 'build', struct: 'bunker', hex: ring[0] }); if (a) return a; }
  }

  // 3. ranged fire
  for (const k in idx) {
    const art = idx[k].filter(u => u.owner === pid && E.UNITS[u.type].range && E.canAct(s, u));
    if (!art.length) continue;
    const ids = art.map(u => u.id);
    const targets = E.rangedTargets(s, pid, ids, k, idx);
    let best = null, bv = 0;
    for (const t of targets) {
      const c = E.combatCalc(s, pid, art, k, t, true, idx);
      const v = c.winProb * stackValue(idx[t]);
      if (c.winProb > 0.4 && v > bv) { bv = v; best = t; }
    }
    if (best) { const a = tryOnce({ a: 'fire', from: k, units: ids, to: best }); if (a) return a; }
  }

  // 4. manoeuvre stacks
  mem.skip = mem.skip || new Set();
  const enemyTiles = Object.keys(tiles).filter(k => tiles[k].owner && tiles[k].owner !== pid);
  // land we could still grab: un-owned land touching our territory
  const frontier = new Set();
  for (const k in tiles) if (tiles[k].owner === pid) for (const n of E.neighbors(k)) if (tiles[n] && E.isLandTile(tiles[n]) && tiles[n].owner !== pid) frontier.add(n);
  const stuck = frontier.size < 3;            // our landmass is (nearly) full: time to go by sea
  const targets = Object.keys(tiles).filter(k => E.isLandTile(tiles[k]) && tiles[k].owner !== pid);
  const nearest = (k, list) => { let md = 99; for (const e of list) { const d = E.dist(k, e); if (d < md) md = d; } return md; };
  for (const k in idx) {
    if (mem.skip.has(k)) continue;
    let movers = idx[k].filter(u => u.owner === pid && E.canAct(s, u));
    if (!movers.length) continue;
    const atSea = tiles[k].t === 'water';
    // troops aboard a transport: disembark onto land if anything is worth taking
    if (atSea) {
      const cargo = movers.filter(u => !E.isSea(u.type));
      if (cargo.length) {
        const r = E.reachable(s, pid, cargo.map(u => u.id), k, idx);
        let best = null, bv = 0;
        for (const d in r) {
          if (r[d].kind === 'start' || r[d].kind === 'pass' || r[d].kind === 'board' || tiles[d].t === 'water') continue;
          let v = tiles[d].owner === pid ? 0.5 : 5;
          if (r[d].kind === 'attack') { const c = E.combatCalc(s, pid, cargo, E.pathTo(r, d).slice(-2)[0], d, false, idx); if (c.winProb < 0.55) continue; v += 4; }
          if (v > bv) { bv = v; best = d; }
        }
        if (best) { const a = tryOnce({ a: 'move', from: k, units: cargo.map(u => u.id), to: best }); if (a) return a; }
      }
      movers = movers.filter(u => E.isSea(u.type));
      if (!movers.length) { mem.skip.add(k); continue; }
    }
    // keep a garrison at HQ when threatened
    if (k === p.hq && enemyNear(k, 4)) {
      const all = idx[k].filter(u => u.owner === pid);
      if (all.length <= movers.length) movers = movers.slice().sort((a, b) => E.UNITS[b.type].def - E.UNITS[a.type].def).slice(1);
      if (!movers.length) { mem.skip.add(k); continue; }
    }
    // artillery / gunships that can still shoot later should stay put
    if (movers.every(u => E.UNITS[u.type].range) && enemyNear(k, 3)) { mem.skip.add(k); continue; }
    const ids = movers.map(u => u.id);
    const fleet = movers.some(u => E.isSea(u.type));
    const carrying = fleet && (idx[k] || []).some(u => u.owner === pid && !E.isSea(u.type));
    // empty transports wait at the dock for troops
    if (fleet && !carrying && movers.every(u => u.type === 'ark')) { mem.skip.add(k); continue; }
    const reach = E.reachable(s, pid, ids, k, idx);
    let best = null, bv = 0.5;
    for (const dest in reach) {
      const r = reach[dest];
      if (r.kind === 'start' || r.kind === 'pass') continue;
      const t = tiles[dest];
      let v = 0;
      const path = E.pathTo(reach, dest);
      for (const pk of path.slice(1, -1)) if (tiles[pk].owner !== pid && E.isLandTile(tiles[pk])) v += 2.5;
      if (r.kind === 'board') {
        const aboard = idx[dest].filter(u => !E.isSea(u.type)).length;
        v = stuck ? 7 - aboard : -1;
      } else if (r.kind === 'attack') {
        const stage = path[path.length - 2];
        const c = E.combatCalc(s, pid, movers, stage, dest, false, idx);
        const isHQ = t.struct && t.struct.type === 'hq';
        const need = isHQ ? K.attack - 0.2 : K.attack;
        if (c.winProb < need || carrying) continue;
        v += c.winProb * (8 + stackValue(c.defenders) + (isHQ ? 80 : 0) + (t.struct ? 5 : 0)) - (1 - c.winProb) * stackValue(movers);
      } else if (fleet) {
        // transports with cargo sail for un-owned coast; warships hunt enemies
        if (carrying) v += (nearest(k, targets) - nearest(dest, targets)) * 2.5 + (nearest(dest, targets) <= 1 ? 4 : 0);
        else if (enemyTiles.length) v += (nearest(k, enemyTiles) - nearest(dest, enemyTiles)) * 0.8;
        else continue;
      } else {
        if (t.owner !== pid) v += t.owner ? 6 : 3;
        if (t.res && t.owner !== pid) v += 4;
        if (t.struct && t.owner !== pid) v += 6;
        if (s.map.beacon === dest) v += 10;
        if (enemyTiles.length) v += (nearest(k, enemyTiles) - nearest(dest, enemyTiles)) * 0.8;
        if (r.kind === 'move' && t.owner === pid && v < 1.5) continue;
        let threat = 0; for (const n of E.neighbors(dest)) for (const u of idx[n] || []) if (u.owner !== pid) threat += E.UNITS[u.type].atk;
        const myDef = movers.reduce((a, u) => a + E.UNITS[u.type].def, 0);
        if (threat > myDef * 2) v -= 4;
      }
      v += Math.random() * K.noise;
      if (v > bv) { bv = v; best = dest; }
    }
    mem.skip.add(k);
    if (Math.random() < K.idle) continue;
    if (best) { const a = tryOnce({ a: 'move', from: k, units: ids, to: best }); if (a) return a; }
  }

  // 5. infrastructure: forward base, and a port when the sea is the only way forward
  const myPorts = Object.keys(tiles).filter(k => tiles[k].owner === pid && tiles[k].struct && tiles[k].struct.type === 'port');
  const wantsNavy = stuck || p.arsenal.some(t => E.isSea(t) && t !== 'ark');
  if (wantsNavy && !myPorts.length && p.cash >= E.structCost(p, 'port') && !mem.portTried) {
    mem.portTried = true;
    let best = null, bv = 99;
    for (const k of sup) { const t = tiles[k]; if (t.struct || !E.isCoastal(s, k)) continue; const v = nearest(k, targets.length ? targets : enemyTiles); if (v < bv) { bv = v; best = k; } }
    if (best) return { a: 'build', struct: 'port', hex: best };
  }
  const owns = type => Object.keys(tiles).filter(k => tiles[k].owner === pid && tiles[k].struct && tiles[k].struct.type === type).length;
  if (p.diff !== 'easy' && !mem.mktTried && p.cash >= E.structCost(p, 'market') + 4 && owns('market') < 1 + Math.floor(s.turn.round / 10)) {
    mem.mktTried = true;
    const spot = [...sup].find(k => !tiles[k].struct && !enemyNear(k, 3));
    if (spot) return { a: 'build', struct: 'market', hex: spot };
  }
  if (!mem.depotTried && p.cash >= E.structCost(p, 'depot') + 6 && owns('depot') < 1 && s.turn.round > 4) {
    mem.depotTried = true;
    const spot = [...sup].filter(k => !tiles[k].struct).sort((a, b) => nearest(a, enemyTiles) - nearest(b, enemyTiles))[0];
    if (spot && enemyTiles.length) return { a: 'build', struct: 'depot', hex: spot };
  }
  if (p.cash >= E.structCost(p, 'fob') + 3 && !mem.fobTried && !stuck) {
    mem.fobTried = true;
    const bases = E.spawnPoints(s, pid);
    let best = null, bv = -1;
    for (const k of sup) {
      const t = tiles[k]; if (t.struct) continue;
      if (E.area(k, 2).some(a => tiles[a] && tiles[a].struct && ['hq', 'fob'].includes(tiles[a].struct.type))) continue;
      const far = Math.min(...bases.map(b => E.dist(b, k)));
      if (far < 4) continue;
      const fr = E.neighbors(k).filter(n => tiles[n] && E.isLandTile(tiles[n]) && tiles[n].owner !== pid).length;
      const v = far + fr * 1.5;
      if (v > bv) { bv = v; best = k; }
    }
    if (best) return { a: 'build', struct: 'fob', hex: best };
  }

  // 6. deploy
  const mine = Object.values(s.units).filter(u => u.owner === pid);
  const myArks = mine.filter(u => u.type === 'ark').length;
  const warships = mine.filter(u => E.isSea(u.type) && u.type !== 'ark').length, landUnits = mine.length - warships - myArks;
  const options = p.arsenal.filter(t => E.unitCost(p, t) <= p.cash && E.deployHexes(s, pid, t, idx).length)
    .filter(t => t !== 'ark' || (stuck && myArks < 2))
    .filter(t => !E.isSea(t) || t === 'ark' || (warships < landUnits / 2 && Math.random() < 0.5));
  if (options.length) {
    const scored = options.map(t => [t, (t === 'ark' ? 9 : unitValue(t) / Math.sqrt(E.unitCost(p, t))) + Math.random() * 0.5 + (E.unitCost(p, t) >= 5 ? 0.6 : 0)]).sort((a, b) => b[1] - a[1]);
    const type = scored[0][0];
    const hexes = E.deployHexes(s, pid, type, idx);
    const goal = enemyTiles.length ? enemyTiles : targets;
    let bs = hexes[0], bd = 99;
    for (const sp of hexes) { const md = nearest(sp, goal); if (md < bd) { bd = md; bs = sp; } }
    const a = tryOnce({ a: 'deploy', unit: type, hex: bs, n: mem.deployN = (mem.deployN || 0) + 1 });
    if (a) { delete a.n; return a; }
  }
  return { a: 'end' };
}

module.exports = { botStep, tradeReply, BOT_NAMES };
