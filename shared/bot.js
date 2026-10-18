/* SECTOR — heuristic bot. botStep returns one action at a time, or {a:'end'}. */
'use strict';
const E = require('./engine');

const BOT_NAMES = ['Vex', 'Kestrel', 'Morrow', 'Juno', 'Halcyon', 'Rook', 'Sable', 'Ajax', 'Nyx', 'Corvid'];

function unitValue(type) { const d = E.UNITS[type]; return d.atk + d.def + d.mv * 0.6; }
function stackValue(units) { return units.reduce((a, u) => a + unitValue(u.type), 0); }

const RAR = { common: 1, uncommon: 2, rare: 3.2, epic: 4.6, legendary: 6.5, mythic: 9 };
// how much a card is worth to this player right now
function cardScore(s, p, id) {
  const d = E.cardDef(id);
  let v = RAR[d.rarity];
  if (d.kind === 'unit') {
    if (p.arsenal.includes(id)) v = 2 + (E.UNITS[id].cost / 3);              // upgrade
    else v *= p.arsenal.length < 6 ? 1.4 : 1;
    if (d.cls === 'sea' && !hasCoast(s, p)) v *= 0.4;
  } else v *= 0.85;
  return v;
}
function hasCoast(s, p) { return E.ownedLand(s, p.id).some(k => E.isCoastal(s, k)); }
// pick the best card from an offer; if the deck is full, replace the weakest unit
function choosePick(s, p, cards) {
  let bi = -1, bv = -1;
  cards.forEach((id, i) => { const v = cardScore(s, p, id); if (v > bv) { bv = v; bi = i; } });
  if (bi < 0) return null;
  const id = cards[bi], d = E.cardDef(id);
  const act = { idx: bi, value: bv };
  if (d.kind === 'unit' && !p.arsenal.includes(id) && p.arsenal.length >= E.DECK_MAX) {
    const worst = p.arsenal.filter(t => t !== 'grunt').sort((a, b) => cardScore(s, p, a) - cardScore(s, p, b))[0];
    if (!worst || cardScore(s, p, worst) >= bv) return { scrap: true };
    act.replace = worst;
  }
  return act;
}

const SKILL = {
  easy: { attack: 0.8, noise: 3, idle: 0.45, tactics: 0.3 },
  medium: { attack: 0.64, noise: 1.4, idle: 0.18, tactics: 0.7 },
  hard: { attack: 0.53, noise: 0.45, idle: 0.03, tactics: 1 },
  impossible: { attack: 0.46, noise: 0.15, idle: 0, tactics: 1 },
};

// accept a trade if what we get is worth clearly more than what we give
function tradeReply(s, pid) {
  const t = s.trade; if (!t || t.to !== pid) return null;
  const p = E.player(s, pid), from = E.player(s, t.from);
  const cardVal = id => { const d = E.TACTICS[id]; return d ? d.cost + { common: 2, uncommon: 4, rare: 7, epic: 10, legendary: 14, mythic: 22 }[d.rarity] : 0; };
  const gain = t.give.cash + (t.cardIds || []).reduce((a, id) => a + cardVal(id), 0);
  const cost = t.get.cash;
  const greed = { easy: 1, medium: 1.15, hard: 1.35, impossible: 1.6 }[p.diff] || 1.15;
  const leader = E.ownedLand(s, from.id).length > E.ownedLand(s, pid).length * 1.6;
  return { a: 'tradeReply', accept: cost <= p.cash && gain >= cost * greed && !(leader && cost > 0) };
}

function spawnStep(s, pid) {
  if (!s.spawn || s.spawn.order[s.spawn.i] !== pid) return null;
  const ch = E.spawnChoices(s); if (!ch.length) return { a: 'spawnPick', auto: true };
  const taken = s.players.filter(p => p.hq).map(p => p.hq);
  const isL = k => s.map.tiles[k] && E.TERRAIN[s.map.tiles[k].t].land;
  let best = ch[0], bv = -1e9;
  for (const k of ch) {
    const room = E.area(k, 3).filter(isL).length;
    const res = E.area(k, 3).filter(n => s.map.tiles[n] && s.map.tiles[n].res).length;
    const far = taken.length ? Math.min(...taken.map(h => E.dist(h, k))) : 0;
    const v = room + res * 3 + Math.min(far, 12) * 1.5 + Math.random() * 4;
    if (v > bv) { bv = v; best = k; }
  }
  return { a: 'spawnPick', hex: best };
}
function draftStep(s, pid) {
  const p = E.player(s, pid);
  if (!s.draft || s.draft.picked[pid]) return null;
  const c = choosePick(s, p, s.draft.offers[pid] || []);
  if (!c || c.scrap) return { a: 'draftPick', idx: 0 };
  return { a: 'draftPick', idx: c.idx, replace: c.replace };
}

function botStep(s, pid, mem) {
  const p = E.player(s, pid);
  const K = SKILL[p.diff] || SKILL.medium;
  if (s.turn.stage === 'choose') {
    const c = choosePick(s, p, s.turn.offer);
    const threshold = 2.4 + s.turn.income / 10 - (s.turn.round <= 3 ? 0.6 : 0);
    if (c && !c.scrap && c.value >= threshold) return { a: 'choose', pick: 'card', idx: c.idx, replace: c.replace };
    return { a: 'choose', pick: 'income' };
  }
  if (s.turn.stage === 'crate') {
    const c = choosePick(s, p, s.turn.crate.cards);
    if (!c || c.scrap) return { a: 'scrap' };
    return { a: 'pick', idx: c.idx, replace: c.replace };
  }
  mem.tried = mem.tried || new Set();
  const tryOnce = (act) => { const k = JSON.stringify(act); if (mem.tried.has(k)) return null; mem.tried.add(k); return act; };
  const idx = E.buildIndex(s);
  const tiles = s.map.tiles;
  const enemyNear = (k, r) => E.area(k, r).some(a => (idx[a] || []).some(u => u.owner !== pid));

  { const d = diplomacy(s, pid, mem); if (d) return d; }
  // 0. HQ under siege: rush defenders onto the muster hexes so the attack logic can retake it this turn
  { const mh = E.musterHexes(s, pid);
    if (mh.length && (mem.musterN || 0) < 4) {
      const land = p.arsenal.filter(t => !E.isSea(t) && E.unitCost(p, t) <= p.cash && E.UNITS[t].atk > 0).sort((a, b) => E.UNITS[b].atk / E.unitCost(p, b) - E.UNITS[a].atk / E.unitCost(p, a));
      const spot = E.deployHexes(s, pid, land[0] || 'grunt', idx).find(k => mh.includes(k));
      if (land.length && spot) { mem.musterN = (mem.musterN || 0) + 1; return { a: 'deploy', unit: land[0], hex: spot }; }
    } }
  // 1. instant / opportunistic tactics
  for (const c of p.tactics) {
    const d = E.TACTICS[c.id];
    if (p.cash < d.cost || Math.random() > K.tactics) continue;
    let act = null;
    if (c.id === 'bonds' || c.id.startsWith('drop_')) act = { a: 'tactic', uid: c.uid };
    else if ((c.id === 'rally' || c.id === 'bounty') && Object.values(s.units).filter(u => u.owner === pid && !u.moved).length >= 4) act = { a: 'tactic', uid: c.uid };
    else if (c.id === 'fortify' && enemyNear(p.hq, 4)) act = { a: 'tactic', uid: c.uid, target: p.hq };
    else if (c.id === 'embargo') { const lead = s.players.filter(o => o.alive && o.id !== pid).sort((a, b) => E.ownedLand(s, b.id).length - E.ownedLand(s, a.id).length)[0]; const k = lead && E.tacticTargets(s, pid, 'embargo').find(k => tiles[k].owner === lead.id); if (k) act = { a: 'tactic', uid: c.uid, target: k }; }
    else if (c.id === 'aegis' && (enemyNear(p.hq, 3) || Object.values(s.units).some(u => u.owner !== pid && E.dist(u.hex, p.hq) <= 2))) act = { a: 'tactic', uid: c.uid };
    else if (c.id === 'spy') { const ts = E.tacticTargets(s, pid, 'spy'); const k = ts.sort((a, b) => E.player(s, tiles[b].owner).tactics.length - E.player(s, tiles[a].owner).tactics.length)[0]; if (k) act = { a: 'tactic', uid: c.uid, target: k }; }
    else if (c.id === 'quarry') { const ts = E.tacticTargets(s, pid, 'quarry'); const k = ts.find(k => E.neighbors(k).some(n => tiles[n] && tiles[n].owner && tiles[n].owner !== pid) && E.neighbors(k).some(n => tiles[n] && tiles[n].owner === pid)); if (k) act = { a: 'tactic', uid: c.uid, target: k }; }
    else if (['airstrike', 'mutiny', 'nuke', 'sabotage', 'emp', 'carpet', 'orbital', 'tsar', 'regime'].includes(c.id)) {
      const ts = E.tacticTargets(s, pid, c.id);
      let best = null, bv = 0;
      for (const k of ts) {
        let v = 0;
        if (c.id === 'sabotage') v = tiles[k].struct.type === 'fob' ? 10 : 5;
        else if (c.id === 'nuke' || c.id === 'emp' || c.id === 'carpet') for (const a of E.area(k, 1)) for (const u of idx[a] || []) v += u.owner === pid ? -unitValue(u.type) * 2 : unitValue(u.type);
        else if (c.id === 'tsar') for (const a of E.tsarArea(s, k)) { for (const u of idx[a] || []) v += u.owner === pid ? -unitValue(u.type) * 2 : unitValue(u.type); if (tiles[a].owner === pid) v -= 3; else if (tiles[a].owner) v += 1; }
        else if (c.id === 'regime') for (const a of E.area(k, 1)) { if (tiles[a] && tiles[a].owner === tiles[k].owner && !E.structsOf(tiles[a]).some(x => x.type === 'hq')) { v += 2; for (const u of idx[a] || []) v += unitValue(u.type); } }
        else v = stackValue(idx[k] || []);
        if (v > bv) { bv = v; best = k; }
      }
      const need = { airstrike: 9, mutiny: 8, nuke: 30, sabotage: 5, emp: 20, carpet: 18, orbital: 14, tsar: 36, regime: 14 }[c.id];
      if (best && bv >= need) act = { a: 'tactic', uid: c.uid, target: best };
    } else if (c.id === 'conscript') {
      const ts = E.tacticTargets(s, pid, c.id); if (ts.length) act = { a: 'tactic', uid: c.uid, target: ts[0] };
    } else if (c.id === 'blitz') {
      const ready = Object.values(s.units).filter(u => u.owner === pid && !u.moved).length;
      if (ready >= 6) act = { a: 'tactic', uid: c.uid };
    }
    if (act && (act = tryOnce(act))) return act;
  }

  // economy builds
  const sup = E.supplySet(s, pid);
  const supLand = [...sup].filter(k => E.isLandTile(tiles[k]) && !tiles[k].bridge);
  for (const k of sup) {
    const t = tiles[k];
    if (t.res && !t.struct && !t.contam && p.cash >= E.structCost(p, 'refinery')) { const a = tryOnce({ a: 'build', struct: 'refinery', hex: k }); if (a) return a; }
  }
  if (!tiles[p.hq].struct || tiles[p.hq].struct.type !== 'hq') { /* lost */ }
  if (enemyNear(p.hq, 3)) {
    const ring = E.neighbors(p.hq).filter(n => supLand.includes(n) && !tiles[n].struct && !tiles[n].contam);
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
        const neutralSite = !t.owner && (t.poi === 'village' || t.poi === 'fort');
        const need = isHQ ? K.attack - 0.2 : K.attack;
        if (carrying) continue;
        if (c.winProb < need) {
          // look for a second stack that can also hit this target (pincer)
          for (const k2 in idx) {
            if (k2 === k || mem.skip.has(k2)) continue;
            const m2 = idx[k2].filter(u => u.owner === pid && E.canAct(s, u) && !E.UNITS[u.type].range);
            if (!m2.length) continue;
            const r2 = E.reachable(s, pid, m2.map(u => u.id), k2, idx);
            if (!r2[dest] || r2[dest].kind !== 'attack') continue;
            const st2 = E.pathTo(r2, dest).slice(-2)[0];
            const c2 = E.combatCalc(s, pid, movers.concat(m2), [stage, st2], dest, false, idx);
            if (c2.winProb >= need) {
              mem.skip.add(k); mem.skip.add(k2);
              const a = tryOnce({ a: 'assault', to: dest, groups: [{ from: k, units: movers.map(u => u.id) }, { from: k2, units: m2.map(u => u.id) }] });
              if (a) return a;
            }
          }
          continue;
        }
        v += c.winProb * (8 + stackValue(c.defenders) + (isHQ ? 80 : 0) + (t.struct ? 5 : 0) + (neutralSite ? 10 : 0)) - (1 - c.winProb) * stackValue(movers);
      } else if (fleet) {
        // transports with cargo sail for un-owned coast; warships hunt enemies
        for (const pk of path.slice(1)) if (tiles[pk].owner !== pid && E.isWater(tiles[pk])) v += tiles[pk].res ? 5 : tiles[pk].fish ? 4 : 1.2;
        { const tt = tiles[dest]; if (tt && !E.isWater(tt) && (tt.poi === 'relic' || tt.poi === 'cache' || tt.poi === 'ruins')) v += 6; }
        if (carrying) v += (nearest(k, targets) - nearest(dest, targets)) * 2.5 + (nearest(dest, targets) <= 1 ? 4 : 0);
        else if (enemyTiles.length) v += (nearest(k, enemyTiles) - nearest(dest, enemyTiles)) * 0.6;
      } else {
        if (t.owner !== pid) v += t.owner ? 6 : 3;
        if (t.poi === 'ruins' || t.poi === 'cache') v += 6;
        if (t.poi === 'relic' && t.owner !== pid) v += 8;
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

  // 5. infrastructure: bridges over narrow straits, forward base, and a port when the sea is the only way forward
  if (stuck && !mem.bridgeTried && p.cash >= E.structCost(p, 'bridge') + 2) {
    mem.bridgeTried = true;
    const spots = E.buildHexes(s, pid, 'bridge');
    if (spots.length) return { a: 'build', struct: 'bridge', hex: spots.sort((a, b) => nearest(a, targets) - nearest(b, targets))[0] };
  }
  const myPorts = Object.keys(tiles).filter(k => tiles[k].owner === pid && tiles[k].struct && tiles[k].struct.type === 'port');
  // sea prizes (rigs, fishing grounds, treasure islands) near our coast make a port worth it too
  const seaPrize = supLand.some(k => E.isCoastal(s, k) && E.area(k, 4).some(n => { const w = tiles[n]; return w && w.owner !== pid && ((E.isWater(w) && (w.res || w.fish)) || (!E.isWater(w) && w.poi && !w.owner && ['relic', 'cache', 'ruins'].includes(w.poi))); }));
  const wantsNavy = stuck || p.arsenal.some(t => E.isSea(t) && t !== 'ark') || (seaPrize && s.turn.round >= 3);
  if (wantsNavy && !myPorts.length && p.cash >= E.structCost(p, 'port') && !mem.portTried) {
    mem.portTried = true;
    let best = null, bv = 99;
    for (const k of supLand) { const t = tiles[k]; if (t.struct || t.contam || !E.isCoastal(s, k)) continue; const v = nearest(k, targets.length ? targets : enemyTiles); if (v < bv) { bv = v; best = k; } }
    if (best) return { a: 'build', struct: 'port', hex: best };
  }
  const owns = type => Object.keys(tiles).filter(k => tiles[k].owner === pid && tiles[k].struct && tiles[k].struct.type === type).length;
  if (!mem.upTried && p.cash >= 20) {
    mem.upTried = true;
    const ups = Object.keys(tiles).filter(k => { const t = tiles[k]; return t.owner === pid && t.struct && ['market', 'refinery'].includes(t.struct.type) && (t.struct.lvl || 1) < 3 && sup.has(k); });
    const k = ups.sort((a, b) => (tiles[a].struct.lvl || 1) - (tiles[b].struct.lvl || 1))[0];
    if (k && p.cash >= E.buildCost(s, p, tiles[k].struct.type, k) + 6) return { a: 'build', struct: tiles[k].struct.type, hex: k };
  }
  if (!mem.hqTried && tiles[p.hq].owner === pid && enemyNear(p.hq, 3) && tiles[p.hq].struct && tiles[p.hq].struct.type === 'hq' && (tiles[p.hq].struct.lvl || 1) < 3) {
    mem.hqTried = true;
    if (p.cash >= E.buildCost(s, p, 'hq', p.hq) + 3) return { a: 'build', struct: 'hq', hex: p.hq };
  }
  if (p.diff !== 'easy' && !mem.mktTried && p.cash >= E.structCost(p, 'market') + 4 && owns('market') < 1 + Math.floor(s.turn.round / 10)) {
    mem.mktTried = true;
    const spot = supLand.find(k => !tiles[k].struct && !tiles[k].contam && !enemyNear(k, 3));
    if (spot) return { a: 'build', struct: 'market', hex: spot };
  }
  if (!mem.depotTried && p.cash >= E.structCost(p, 'depot') + 6 && owns('depot') < 1 && s.turn.round > 4) {
    mem.depotTried = true;
    const spot = supLand.filter(k => !tiles[k].struct && !tiles[k].contam).sort((a, b) => nearest(a, enemyTiles) - nearest(b, enemyTiles))[0];
    if (spot && enemyTiles.length) return { a: 'build', struct: 'depot', hex: spot };
  }
  if (p.cash >= E.structCost(p, 'fob') + 3 && !mem.fobTried && !stuck) {
    mem.fobTried = true;
    const bases = E.spawnPoints(s, pid);
    let best = null, bv = -1;
    for (const k of supLand) {
      const t = tiles[k]; if (t.struct || t.contam) continue;
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

// alliance offers: say yes to someone who isn't running away with the game, when we aren't either
// ── diplomacy: bots read the board. They team up against whoever is most dangerous, hold grudges, and turn on allies who get too big ──
function threats(s, pid) {
  const out = {}; for (const p of s.players) if (p.alive && p.id !== pid) out[p.id] = E.threatOf(s, p.id);
  return out;
}
function leaderOf(th, except) { let best = null; for (const id in th) if (id !== except && (!best || th[id] > th[best])) best = id; return best; }
function allyReply(s, pid) {
  const o = s.allyOffer; if (!o || o.to !== pid) return null;
  const alive = s.players.filter(p => p.alive);
  if (alive.length <= 2) return { a: 'allyReply', accept: false };
  const mood = E.moodOf(s, pid, o.from), th = threats(s, pid), mine = E.threatOf(s, pid);
  const lead = leaderOf(th, o.from), from = th[o.from] || 0;
  // worth it when someone else is the real danger, and we don't hate the one asking
  const danger = lead && th[lead] > Math.max(mine, from) * 1.15;
  const notTheBully = from < Math.max(mine, th[lead] || 0) * 1.25;
  const accept = mood > 45 || (mood > -30 && danger && notTheBully);
  return { a: 'allyReply', accept };
}
// propose or break pacts on our own turn (at most one diplomatic move per turn)
function diplomacy(s, pid, mem) {
  if (mem.diplo || s.settings.teams === 'on') return null; mem.diplo = true;
  const p = E.player(s, pid), alive = s.players.filter(q => q.alive);
  if (alive.length <= 2) return null;
  const th = threats(s, pid), mine = E.threatOf(s, pid), lead = leaderOf(th);
  const pacts = (s.allies || []).filter(x => x.a === pid || x.b === pid);
  for (const x of pacts) {
    if (x.ending) continue;
    const o = x.a === pid ? x.b : x.a;
    // an ally who has become the runaway leader (or who we've come to hate) gets the knife
    const runaway = o === lead && th[o] > mine * 1.6 && th[o] > Object.values(th).reduce((a, v) => a + v, 0) * 0.45;
    if (runaway || E.moodOf(s, pid, o) < -45) return { a: 'allyBreak', with: o };
  }
  if (p.traitor || s.allyOffer || pacts.length >= 2 || s.turn.round < 4) return null;
  if ((mem.offered || 0) > 0 || (p._offerRound && s.turn.round - p._offerRound < 3)) return null;
  if (!lead || th[lead] < mine * 1.25) return null;
  // ask the friendliest commander who isn't the leader and isn't already on our side
  let best = null, bm = -31;
  for (const q of alive) {
    if (q.id === pid || q.id === lead || q.traitor || E.isAlly(s, pid, q.id)) continue;
    const m = E.moodOf(s, pid, q.id) + (th[q.id] < th[lead] ? 10 : 0);
    if (m > bm) { bm = m; best = q.id; }
  }
  if (!best) return null;
  mem.offered = 1; p._offerRound = s.turn.round;
  return { a: 'allyOffer', to: best };
}
module.exports = { botStep, draftStep, spawnStep, tradeReply, allyReply, BOT_NAMES };
