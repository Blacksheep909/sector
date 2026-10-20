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

// ── strategy: once per turn, pick a war target and read where the danger is ──
function sideStrength(s, idx, owner, near, r, atk) {
  let v = 0; const seen = new Set();
  for (const k of near) for (const a of E.area(k, r)) for (const u of idx[a] || []) if (u.owner === owner && !seen.has(u.id)) { seen.add(u.id); v += atk ? E.unitAtk(s, u) : E.unitDef(s, u); }
  return v;
}
function botMem(s, pid) { s.botMem = s.botMem || {}; return s.botMem[pid] = s.botMem[pid] || {}; }
function strategy(s, pid, idx) {
  const p = E.player(s, pid), tiles = s.map.tiles, bm = botMem(s, pid);
  const th = threats(s, pid), mine = E.threatOf(s, pid);
  const rivals = s.players.filter(q => q.alive && q.id !== pid && !E.isAlly(s, pid, q.id));
  // how much of our border each rival shares
  const border = {};
  for (const k in tiles) if (tiles[k].owner === pid) for (const n of E.neighbors(k)) { const o = tiles[n] && tiles[n].owner; if (o && o !== pid) border[o] = (border[o] || 0) + 1; }
  const top = Math.max(0, ...Object.values(th));
  let focus = null, fv = -1e9;
  for (const q of rivals) {
    let v = (border[q.id] || 0) * 1.2 + (mine - th[q.id]) * 0.15 - E.moodOf(s, pid, q.id) * 0.08;
    if (p.vengeance && p.vengeance.vs === q.id) v += 40;                      // pay the traitor back
    if (th[q.id] > mine * 1.3 && th[q.id] === top) v += 18;                   // gang up on the runaway leader
    if (!border[q.id]) v -= 10;
    if (v > fv) { fv = v; focus = q.id; }
  }
  if (bm.plot && (s.turn.round - bm.plot.since > 6 || !E.isAlly(s, pid, bm.plot.vs))) delete bm.plot;
  const target = bm.plot ? bm.plot.vs : focus;
  const goal = target ? Object.keys(tiles).filter(k => tiles[k].owner === target) : [];
  // what the enemy fields near us decides what we buy
  const seen = { air: 0, veh: 0, fort: 0 };
  for (const id in s.units) { const u = s.units[id]; if (u.owner === pid || E.isAlly(s, pid, u.owner)) continue; const c = E.UNITS[u.type].cls; if (c === 'air') seen.air++; else if (c === 'veh') seen.veh++; }
  for (const k of goal) if (E.structsOf(tiles[k]).some(x => ['hq', 'fob', 'bunker'].includes(x.type) && x.owner === target)) seen.fort++;
  // bases under threat get reinforcements first
  const danger = {};
  for (const sp of E.spawnPoints(s, pid)) {
    let atk = 0; for (const a of E.area(sp, 2)) for (const u of idx[a] || []) if (u.owner !== pid && !E.isAlly(s, pid, u.owner)) atk += E.unitAtk(s, u);
    const def = (idx[sp] || []).filter(u => u.owner === pid).reduce((a, u) => a + E.unitDef(s, u), 0);
    if (atk > def) danger[sp] = atk - def;
  }
  return { focus, target, goal, seen, danger };
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
  const tryOnce = (act) => { if (act && act.a === 'move') act = keepTogether(act); const k = JSON.stringify(act); if (mem.tried.has(k)) return null; mem.tried.add(k); return act; };
  // a carrier doesn't drive off and strand more Grunts than the hex can hold: take them along, or leave the carrier
  const keepTogether = (act) => {
    const here = (idx[act.from] || []).filter(u => u.owner === pid), ids = new Set(act.units), left = () => here.filter(u => !ids.has(u.id));
    if (!left().length || E.stackFits(left(), [])) return act;
    const reaches = set => { const r = E.reachable(s, pid, [...set], act.from, idx)[act.to]; return r && r.kind !== 'start' && r.kind !== 'pass'; };
    // first choice: bring the stranded Grunts along (if the group can still get there)
    const all = new Set(ids); for (const u of left()) if (u.type === 'grunt' && E.canAct(s, u)) all.add(u.id);
    if (E.stackFits(here.filter(u => !all.has(u.id)), []) && reaches(all)) return { ...act, units: [...all] };
    // otherwise the carrier stays behind with them
    const rest = new Set([...ids].filter(id => !E.UNITS[s.units[id].type].lift));
    if (rest.size && E.stackFits(here.filter(u => !rest.has(u.id)), []) && reaches(rest)) return { ...act, units: [...rest] };
    return act;
  };
  const idx = E.buildIndex(s);
  const tiles = s.map.tiles;
  const enemyNear = (k, r) => E.area(k, r).some(a => (idx[a] || []).some(u => u.owner !== pid));

  const strat = mem.strat = mem.strat || strategy(s, pid, idx);
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
    else if (c.id === 'fortify' && enemyNear(p.hq, 4) && (((E.structsOf(tiles[p.hq]).find(x => x.type === 'hq') || {}).lvl || 1) < E.MAX_SLVL)) act = { a: 'tactic', uid: c.uid, target: p.hq };
    else if (c.id === 'embargo') { const lead = s.players.filter(o => o.alive && o.id !== pid).sort((a, b) => E.ownedLand(s, b.id).length - E.ownedLand(s, a.id).length)[0]; const k = lead && E.tacticTargets(s, pid, 'embargo').find(k => tiles[k].owner === lead.id); if (k) act = { a: 'tactic', uid: c.uid, target: k }; }
    else if (c.id === 'aegis' && (enemyNear(p.hq, 3) || Object.values(s.units).some(u => u.owner !== pid && E.dist(u.hex, p.hq) <= 2))) act = { a: 'tactic', uid: c.uid };
    else if (c.id === 'spy') { const ts = E.tacticTargets(s, pid, 'spy'); const k = ts.sort((a, b) => E.player(s, tiles[b].owner).tactics.length - E.player(s, tiles[a].owner).tactics.length)[0]; if (k) act = { a: 'tactic', uid: c.uid, target: k }; }
    else if (c.id === 'quarry') { const ts = E.tacticTargets(s, pid, 'quarry'); const k = ts.find(k => E.neighbors(k).some(n => tiles[n] && tiles[n].owner && tiles[n].owner !== pid) && E.neighbors(k).some(n => tiles[n] && tiles[n].owner === pid)); if (k) act = { a: 'tactic', uid: c.uid, target: k }; }
    else if (['airstrike', 'kamikaze', 'gunrun', 'precision', 'buster', 'strategic', 'mutiny', 'nuke', 'sabotage', 'emp', 'carpet', 'orbital', 'tsar', 'regime'].includes(c.id)) {
      const ts = E.tacticTargets(s, pid, c.id);
      let best = null, bv = 0;
      for (const k of ts) {
        let v = 0;
        if (c.id === 'sabotage') v = tiles[k].struct.type === 'fob' ? 10 : 5;
        else if (c.id === 'precision') v = (idx[k] || []).length ? Math.max(0, ...(idx[k] || []).map(u => unitValue(u.type))) * 1.3 : E.infraValue(s, k) * 1.5;
        else if (c.id === 'strategic') { for (const a of E.area(k, 1)) { const t = tiles[a]; if (t && t.owner && t.owner !== pid && !E.isAlly(s, pid, t.owner) && E.isLandTile(t)) v += 1 + E.infraValue(s, a) * 0.6 + (t.res ? 1 : 0); } }
        else if ((c.id === 'airstrike' || c.id === 'gunrun' || c.id === 'kamikaze') && !(idx[k] || []).length) v = E.infraValue(s, k) * (c.id === 'airstrike' ? 1.4 : 0.9);
        else if (c.id === 'buster') { v = stackValue(idx[k] || []) * 0.5; for (const x of E.structsOf(tiles[k])) if (['bunker', 'fob', 'flak', 'mine', 'hq'].includes(x.type) && x.owner === tiles[k].owner) v += 5 * (x.lvl || 1); }
        else if (c.id === 'nuke' || c.id === 'emp' || c.id === 'carpet') for (const a of E.area(k, 1)) for (const u of idx[a] || []) v += u.owner === pid ? -unitValue(u.type) * 2 : unitValue(u.type);
        else if (c.id === 'tsar') for (const a of E.tsarArea(s, k)) { for (const u of idx[a] || []) v += u.owner === pid ? -unitValue(u.type) * 2 : unitValue(u.type); if (tiles[a].owner === pid) v -= 3; else if (tiles[a].owner) v += 1; }
        else if (c.id === 'regime') for (const a of E.area(k, 1)) { if (tiles[a] && tiles[a].owner === tiles[k].owner && !E.structsOf(tiles[a]).some(x => x.type === 'hq')) { v += 2; for (const u of idx[a] || []) v += unitValue(u.type); } }
        else v = stackValue(idx[k] || []);
        if (v > bv) { bv = v; best = k; }
      }
      if (best && E.AIR_STRIKES.includes(c.id)) bv *= 1 - E.interceptChance(s, pid, best, c.id);   // air defences might shoot it down
      const need = { strategic: 12, kamikaze: 4, gunrun: 4, precision: 9, buster: 12, airstrike: 9, mutiny: 8, nuke: 30, sabotage: 5, emp: 20, carpet: 18, orbital: 14, tsar: 36, regime: 14 }[c.id];
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
    const walk = E.reachable(s, pid, ids, k, idx);
    for (const t of targets) {
      // an empty enemy building we can just walk onto is better captured than shelled
      if (!(idx[t] || []).length) { if (walk[t] && ['move', 'capture'].includes(walk[t].kind)) continue; const v = E.infraValue(s, t) * 0.8; if (v > bv && v >= 3) { bv = v; best = t; } continue; }   // shell undefended buildings
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
  // walking distance over open land (around mountains and lakes), so troops don't pile up against a ridge they can't cross.
  // Falls back to straight-line distance where there's no land route at all (islands: that's the navy's job)
  const walkMaps = mem.walkMaps && mem.walkMaps.key === s.v + ':' + s.turn.round + ':' + s.turn.idx ? mem.walkMaps : (mem.walkMaps = { key: s.v + ':' + s.turn.round + ':' + s.turn.idx });
  const walkField = (name, list) => {
    if (walkMaps[name]) return walkMaps[name];
    const f = {}, q = [];
    for (const k of list) if (tiles[k]) { f[k] = 0; q.push(k); }
    for (let i = 0; i < q.length; i++) for (const n of E.neighbors(q[i])) { const t = tiles[n]; if (!t || n in f || !E.isLandTile(t) || t.t === 'mountain') continue; f[n] = f[q[i]] + 1; q.push(n); }
    return (walkMaps[name] = f);
  };
  const walkGain = (name, list, from, to) => { const f = walkField(name, list); return from in f && to in f ? f[from] - f[to] : nearest(from, list) - nearest(to, list); };
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
      for (const pk of path.slice(1, -1)) if (tiles[pk].owner !== pid && !(tiles[pk].owner && E.isAlly(s, pid, tiles[pk].owner)) && E.isLandTile(tiles[pk])) v += 2.5;
      // allied land is for passing through, not for parking troops (they'd be lost if the pact ends)
      if (t.owner && t.owner !== pid && E.isAlly(s, pid, t.owner)) continue;
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
        v += c.winProb * (8 + stackValue(c.defenders) + (isHQ ? 80 : 0) + (t.struct ? 5 : 0) + (neutralSite ? 10 : 0) + (c.def.pid && c.def.pid === strat.target ? 6 : 0)) - (1 - c.winProb) * stackValue(movers);
      } else if (fleet) {
        // transports with cargo sail for un-owned coast; warships hunt enemies
        for (const pk of path.slice(1)) if (tiles[pk].owner !== pid && E.isWater(tiles[pk])) v += tiles[pk].res ? 5 : tiles[pk].fish ? 4 : 1.2;
        { const tt = tiles[dest]; if (tt && !E.isWater(tt) && (tt.poi === 'relic' || tt.poi === 'cache' || tt.poi === 'ruins')) v += 6; }
        if (carrying) v += (nearest(k, targets) - nearest(dest, targets)) * 2.5 + (nearest(dest, targets) <= 1 ? 4 : 0);
        else if (enemyTiles.length) v += (nearest(k, enemyTiles) - nearest(dest, enemyTiles)) * 0.6;
      } else {
        if (t.owner !== pid) v += t.owner ? 6 : 3;
        if (t.poi === 'ruins' || t.poi === 'cache') v += 6;
        if (t.poi === 'fort' && !t.owner) v += 9;   // an abandoned FOB: a free forward base
        if (t.poi === 'relic' && t.owner !== pid) v += 8;
        if (t.res && t.owner !== pid) v += 4;
        if (t.struct && t.owner !== pid) v += 6;
        if (s.map.beacon === dest) v += 10;
        if (strat.goal.length) v += walkGain('goal', strat.goal, k, dest) * 1.1 + walkGain('enemy', enemyTiles, k, dest) * 0.3;
        else if (enemyTiles.length) v += walkGain('enemy', enemyTiles, k, dest) * 0.8;
        if (t.owner && t.owner === strat.target) v += 3;
        // mass up: join a friendly stack on the front line so the next push has the numbers
        if (t.owner === pid && (idx[dest] || []).some(u => u.owner === pid) && E.neighbors(dest).some(n => (idx[n] || []).some(u => u.owner !== pid && !E.isAlly(s, pid, u.owner)))) v += 2.5;
        if (r.kind === 'move' && t.owner === pid && v < 1) continue;   // a step closer to the front is worth taking
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
  // vehicles can't ford rivers: bridge the river hex nearest the front when we field them
  if (!mem.riverTried && p.cash >= E.structCost(p, 'bridge') + 4 && p.arsenal.some(t => ['veh', 'art'].includes(E.UNITS[t].cls))) {
    mem.riverTried = true;
    const spots = E.buildHexes(s, pid, 'bridge').filter(k => tiles[k].river).sort((a, b) => nearest(a, targets) - nearest(b, targets));
    if (spots[0] && nearest(spots[0], enemyTiles.length ? enemyTiles : targets) <= 5) return { a: 'build', struct: 'bridge', hex: spots[0] };
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
  if (myPorts.length && !mem.mineTried && p.cash >= E.structCost(p, 'mine') + 6) {
    mem.mineTried = true;
    const enemyShips = Object.values(s.units).filter(u => u.owner !== pid && E.isSea(u.type) && !E.isAlly(s, pid, u.owner));
    if (enemyShips.length) {
      const cands = Object.keys(tiles).filter(k => { const t = tiles[k]; return E.isWater(t) && t.owner === pid && sup.has(k) && !E.structsOf(t).length && myPorts.some(pk => E.dist(pk, k) <= 2); });
      cands.sort((a, b) => Math.min(...enemyShips.map(u => E.dist(u.hex, a))) - Math.min(...enemyShips.map(u => E.dist(u.hex, b))));
      if (cands[0] && Math.min(...enemyShips.map(u => E.dist(u.hex, cands[0]))) <= 6) return { a: 'build', struct: 'mine', hex: cands[0] };
    }
  }
  const owns = type => Object.keys(tiles).filter(k => tiles[k].owner === pid && tiles[k].struct && tiles[k].struct.type === type).length;
  if (!mem.upTried && p.cash >= 20) {
    mem.upTried = true;
    const ups = Object.keys(tiles).filter(k => { const t = tiles[k]; return t.owner === pid && t.struct && ['warehouse', 'refinery'].includes(t.struct.type) && (t.struct.lvl || 1) < 3 && sup.has(k); });
    const k = ups.sort((a, b) => (tiles[a].struct.lvl || 1) - (tiles[b].struct.lvl || 1))[0];
    if (k && p.cash >= E.buildCost(s, p, tiles[k].struct.type, k) + 6) return { a: 'build', struct: tiles[k].struct.type, hex: k };
  }
  if (!mem.hqTried && tiles[p.hq].owner === pid && enemyNear(p.hq, 3) && tiles[p.hq].struct && tiles[p.hq].struct.type === 'hq' && (tiles[p.hq].struct.lvl || 1) < 3) {
    mem.hqTried = true;
    if (p.cash >= E.buildCost(s, p, 'hq', p.hq) + 3) return { a: 'build', struct: 'hq', hex: p.hq };
  }
  if (p.diff !== 'easy' && !mem.wareTried && p.cash >= E.structCost(p, 'warehouse') + 4 && owns('warehouse') < 1 + Math.floor(s.turn.round / 10)) {
    mem.wareTried = true;
    const spot = supLand.find(k => !tiles[k].struct && !tiles[k].contam && !enemyNear(k, 3));
    if (spot) return { a: 'build', struct: 'warehouse', hex: spot };
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

  // 5b. stacks with nothing better to do on the front line watch for enemy moves instead
  if (!mem.owDone) {
    mem.owDone = true;
    for (const k in idx) {
      const st = idx[k].filter(u => u.owner === pid && E.canAct(s, u) && E.UNITS[u.type].atk > 0 && !E.isSea(u.type));
      if (st.length && k !== p.hq && enemyNear(k, 2) && Math.random() < 0.7) return { a: 'overwatch', from: k, units: st.map(u => u.id) };
    }
  }
  // 6. deploy
  const mine = Object.values(s.units).filter(u => u.owner === pid);
  const myArks = mine.filter(u => u.type === 'ark').length;
  const warships = mine.filter(u => E.isSea(u.type) && u.type !== 'ark').length, landUnits = mine.length - warships - myArks;
  const options = p.arsenal.filter(t => E.unitCost(p, t) <= p.cash && E.deployHexes(s, pid, t, idx).length)
    .filter(t => t !== 'ark' || (stuck && myArks < 2))
    .filter(t => !E.isSea(t) || t === 'ark' || (warships < landUnits / 2 && Math.random() < 0.5));
  if (options.length) {
    // counter what the enemy fields: anti-air against air power, tank hunters against armour, siege against forts
    const counter = t => { const d = E.UNITS[t]; let b = 0;
      if (d.aa) b += Math.min(2.4, strat.seen.air * 0.5);
      if (d.ability === 'hunter') b += Math.min(1.6, strat.seen.veh * 0.25);
      if (['siege', 'titan'].includes(d.ability)) b += Math.min(1.5, strat.seen.fort * 0.5);
      return b; };
    const scored = options.map(t => [t, (t === 'ark' ? 9 : unitValue(t) / Math.sqrt(E.unitCost(p, t))) + counter(t) + Math.random() * 0.5 + (E.unitCost(p, t) >= 5 ? 0.6 : 0)]).sort((a, b) => b[1] - a[1]);
    const type = scored[0][0];
    const hexes = E.deployHexes(s, pid, type, idx);
    const goal = strat.goal.length ? strat.goal : enemyTiles.length ? enemyTiles : targets;
    let bs = hexes[0], bd = 99;
    const gf = walkField('deploy', goal);
    for (const sp of hexes) { const md = (sp in gf ? gf[sp] : nearest(sp, goal) + 20) - (strat.danger[sp] ? 6 + strat.danger[sp] / 3 : 0); if (md < bd) { bd = md; bs = sp; } }
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
// ready to betray: our strike force on their border beats what they keep there, nobody else is at our throat,
// and the prize (their HQ) helps tip it
function betrayReady(s, pid, o, diff) {
  if (diff === 'easy') return true;
  const tiles = s.map.tiles, idx = E.buildIndex(s);
  const ourEdge = [], theirEdge = [];
  for (const k in tiles) {
    const ow = tiles[k].owner; if (ow !== pid && ow !== o) continue;
    if (E.neighbors(k).some(n => tiles[n] && tiles[n].owner === (ow === pid ? o : pid))) (ow === pid ? ourEdge : theirEdge).push(k);
  }
  if (!ourEdge.length) return false;
  const strike = sideStrength(s, idx, pid, ourEdge, 2, true), guard = sideStrength(s, idx, o, theirEdge, 2, false);
  // a second front: other rivals massing on our border
  let pressure = 0, home = 0;
  for (const q of s.players) if (q.alive && q.id !== pid && q.id !== o && !E.isAlly(s, pid, q.id)) {
    const edge = Object.keys(tiles).filter(k => tiles[k].owner === pid && E.neighbors(k).some(n => tiles[n] && tiles[n].owner === q.id));
    if (edge.length) { pressure += sideStrength(s, idx, q.id, edge, 2, true); home += sideStrength(s, idx, pid, edge, 1, false); }
  }
  const op = E.player(s, o), hqNear = op && op.hq && ourEdge.some(k => E.dist(k, op.hq) <= 4);
  const need = { medium: 1.25, hard: 1.4, impossible: 1.5 }[diff] || 1.3;
  return strike >= Math.max(6, guard * (hqNear ? need * 0.8 : need)) && pressure <= home * 1.2 + 4;
}
// propose or break pacts on our own turn (at most one diplomatic move per turn)
function diplomacy(s, pid, mem) {
  if (mem.diplo || s.settings.teams === 'on') return null; mem.diplo = true;
  const p = E.player(s, pid), alive = s.players.filter(q => q.alive);
  const th = threats(s, pid), mine = E.threatOf(s, pid), lead = leaderOf(th);
  const pacts = (s.allies || []).filter(x => x.a === pid || x.b === pid);
  if (alive.length <= 1) return null;
  // how ruthless: harder bots betray sooner and more often
  const ruthless = { easy: 0.4, medium: 0.7, hard: 1, impossible: 1.25 }[p.diff] || 0.7;
  const total = Object.values(th).reduce((a, v) => a + v, 0) || 1;
  const others = alive.filter(q => q.id !== pid && !E.isAlly(s, pid, q.id));
  for (const x of pacts) {
    if (x.ending) continue;
    const o = x.a === pid ? x.b : x.a;
    // 1. an ally who has become the runaway leader (or who we've come to hate) gets the knife
    const runaway = o === lead && th[o] > mine * (1.9 - ruthless * 0.3) && th[o] > total * 0.42;
    if (runaway || E.moodOf(s, pid, o) < -45) return { a: 'allyBreak', with: o };
    // 2. the common enemy is beaten: once every non-ally rival is weak, the pact has done its job
    const threatGone = others.length && others.every(q => th[q.id] < Math.min(mine, th[o]) * 0.45);
    // 3. opportunism: a feeble ally sitting on land next to ours, while we're the strongest on the board
    const borders = Object.keys(s.map.tiles).some(k => s.map.tiles[k].owner === o && E.neighbors(k).some(n => s.map.tiles[n] && s.map.tiles[n].owner === pid));
    const weakAlly = th[o] < mine * 0.45 * ruthless && borders && mine >= Math.max(...Object.values(th));
    // 4. endgame: with only this ally left besides us, someone has to win outright (shared wins are for the meek)
    const lastTwo = alive.length === 2 && ruthless >= 1 && mine > th[o] * 1.15;
    const held = s.turn.round - (x.since || 0);   // pacts younger than 3 rounds are honoured
    // renewal: in the pact's last 2 rounds, keep it if it still pays (a shared enemy, no plot against them, no grudge)
    if (x.until && x.until - s.turn.round <= 2 && !(x.renew && x.renew[pid])) {
      const bm = botMem(s, pid), plotting = bm.plot && bm.plot.vs === o;
      const stillUseful = !threatGone && !(lastTwo) && E.moodOf(s, pid, o) > -20;
      if (!plotting && stillUseful) return { a: 'allyRenew', with: o };
    }
    if (held >= 3 && (threatGone || weakAlly || lastTwo) && (mem.betrayRoll = mem.betrayRoll ?? Math.random()) < 0.5 * ruthless) {
      // a smart traitor strikes when it can: mass troops on the border first, break once the knife is in reach
      const bm = botMem(s, pid);
      if (!bm.plot || bm.plot.vs !== o) bm.plot = { vs: o, since: s.turn.round };
      if (betrayReady(s, pid, o, p.diff)) { delete bm.plot; return { a: 'allyBreak', with: o }; }
    }
  }
  if (alive.length <= 2 || p.traitor || s.allyOffer || pacts.length >= 2 || s.turn.round < 4) return null;
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
