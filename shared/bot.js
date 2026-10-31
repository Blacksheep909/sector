/* SECTOR — heuristic bot. botStep returns one action at a time, or {a:'end'}. */
'use strict';
const E = require('./engine');
const PZ = require('./personas');
// this bot's personality settings ({} for a plain bot)
const playOf = p => (p && p.persona && PZ.PERSONAS[p.persona] && PZ.PERSONAS[p.persona].play) || {};

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
    // a war across the sea: no land route to any rival HQ. Then a transport is the card that wins it
    if (s.phase === 'play' && overseas(s, p.id)) { if (id === 'ark') v = p.arsenal.includes('ark') ? 4 : 14; else if (d.cls === 'sea') v *= 1.3; }
    const taste = (playOf(p).cls || {})[d.cls]; if (taste) v *= 1 + taste * 0.25;
  } else v *= 0.85 * (playOf(p).tactics || 1);
  return v;
}
const overseasMemo = new WeakMap();
function overseas(s, pid) {
  const key = s.turn.round + ':' + s.turn.idx, m = overseasMemo.get(s) || {}; if (m.key !== key) { m.key = key; m.v = {}; overseasMemo.set(s, m); }
  if (pid in m.v) return m.v[pid];
  const tiles = s.map.tiles, hqs = new Set(s.players.filter(q => q.alive && q.id !== pid && q.hq && !E.isAlly(s, pid, q.id)).map(q => q.hq));
  const seen = new Set(), q = Object.keys(tiles).filter(k => tiles[k].owner === pid && E.isLandTile(tiles[k]));
  q.forEach(k => seen.add(k)); let hit = false;
  for (let i = 0; i < q.length && !hit; i++) { if (hqs.has(q[i])) hit = true; for (const n of E.neighbors(q[i])) if (tiles[n] && !seen.has(n) && E.isLandTile(tiles[n])) { seen.add(n); q.push(n); } }
  return (m.v[pid] = hqs.size > 0 && q.length > 0 && !hit);
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

// attack: odds needed to commit · combo: stacks it will mass into one blow · guard: how hard it holds the front
// noise/idle: how sloppy its moves are · heli: how carefully it flies helicopters
// lethal: how hard it goes for the kill (picks on a weakened rival, marches on their HQ, masses more and takes closer odds there)
// Easy still plays a real game (it attacks, masses a little, defends a little) — it just makes more mistakes
const SKILL = {
  easy: { attack: 0.52, combo: 1, guard: 0.35, noise: 2.2, idle: 0.15, tactics: 0.5, heli: 0.4, lethal: 0.2 },
  medium: { attack: 0.58, combo: 2, guard: 0.7, noise: 1.1, idle: 0.05, tactics: 0.8, heli: 0.75, lethal: 0.6 },
  hard: { attack: 0.6, combo: 3, guard: 1, noise: 0.4, idle: 0, tactics: 1, heli: 1, lethal: 1 },
  impossible: { attack: 0.6, combo: 3, guard: 1, noise: 0.15, idle: 0, tactics: 1, heli: 1, lethal: 1.4 },
};

// an ally about to stop being one: a break has been announced (by either side), or the pact is in its last round and they
// haven't agreed to renew it. Bots plan their defence against them from then on, and get their troops out of that land in time
function soonFoe(s, pid, q) {
  const x = (s.allies || []).find(x => (x.a === pid && x.b === q) || (x.b === pid && x.a === q));
  if (!x || x.team) return false;
  return !!x.ending || (!!x.until && s.turn.round >= x.until - 1 && !(x.renew && x.renew[q]));
}
// someone to guard against: an enemy, or an ally on the way out
const wary = (s, pid, q) => !!q && q !== pid && (!E.isAlly(s, pid, q) || soonFoe(s, pid, q));
// ── the threat map: how much enemy punch could land on each of our hexes next turn ──
function threatMap(s, pid, idx) {
  const out = {}, tiles = s.map.tiles;
  for (const k in idx) {
    const foes = idx[k].filter(u => wary(s, pid, u.owner) && E.UNITS[u.type].atk > 0);
    if (!foes.length) continue;
    const atk = foes.reduce((a, u) => a + E.unitAtk(s, u), 0);
    const reach = Math.min(5, Math.max(1, ...foes.map(u => E.UNITS[u.type].range || E.moveAllow(s, u))));
    for (const a of E.area(k, reach)) { const t = tiles[a]; if (t && t.owner === pid) out[a] = (out[a] || 0) + atk * (E.dist(a, k) <= 1 ? 1 : 0.7); }
  }
  return out;
}
// anti-air: only fires at aircraft, so it moves with the army rather than sitting back like artillery
const isAA = u => ['aa', 'sam'].includes(E.UNITS[u.type].ability);
const holdOf = (s, pid, units) => units.filter(u => u.owner === pid).reduce((a, u) => a + E.unitDef(s, u), 0);
// anti-air and Grunts near a hex: what a helicopter landing there would face
function heliDanger(s, pid, idx, k) {
  let d = 0;
  for (const a of E.area(k, 2)) for (const u of idx[a] || []) {
    if (u.owner === pid || E.isAlly(s, pid, u.owner)) continue;
    const def = E.UNITS[u.type];
    if (def.aa && E.dist(a, k) <= (def.range || 1)) d += def.aa;
    if (def.cls === 'inf' && E.dist(a, k) <= 1) d += 1;
  }
  return d;
}

// ── the assault planner: every attack on the board, with up to K.combo stacks massed into one blow ──
function planAssault(s, pid, idx, K, strat, mem) {
  const tiles = s.map.tiles, stacks = [];
  for (const k in idx) {
    if (mem.skip && mem.skip.has(k)) continue;
    const units = idx[k].filter(u => u.owner === pid && E.canAct(s, u) && E.UNITS[u.type].atk > 0 && !E.UNITS[u.type].range && !E.isSea(u.type));
    if (!units.length || E.isWater(tiles[k])) continue;
    stacks.push({ k, units, reach: E.reachable(s, pid, units.map(u => u.id), k, idx) });
  }
  const by = {};
  for (const st of stacks) for (const t in st.reach) if (st.reach[t].kind === 'attack') (by[t] = by[t] || []).push(st);
  const p = E.player(s, pid);
  const held = besiegedBy(s, pid);
  const hqOf = o => { const q = E.player(s, o); return q && q.alive && wary(s, pid, o) && q.hq && s.map.tiles[q.hq].owner === o ? q.hq : null; };
  let best = null, bv = 0;
  for (const t in by) {
    const tt = tiles[t], defs = (idx[t] || []).filter(u => u.owner !== pid);
    const isHQ = tt.struct && tt.struct.type === 'hq' && tt.owner !== pid;
    const prize = 6 + stackValue(defs) * 1.2 + (isHQ ? 90 * (1 + 0.5 * (K.lethal || 0)) : 0) + (tt.struct ? 6 : 0) + (tt.res ? 3 : 0) + (!tt.owner && ['village', 'silo'].includes(tt.poi) ? 10 : 0) + (tt.owner && tt.owner === strat.target ? 6 : 0) + (p && p.vengeance && p.vengeance.vs === tt.owner ? 8 : 0)
      + (held.some(h => E.dist(h, t) === 1) && tt.owner && tt.owner !== pid ? 30 : 0)
      // encircle before the kill: every hex of theirs round their HQ is a place they could muster a counterattack from
      + (tt.owner && tt.owner !== pid && !isHQ && hqOf(tt.owner) && E.dist(hqOf(tt.owner), t) === 1 ? (K.ringW === undefined ? 15 : K.ringW) * (K.lethal || 0) : 0);   // the land round an HQ we're besieging is where its owner musters: take it
    // strongest contributors first; add stacks until the odds are good enough (or we run out of stacks we're allowed to mass)
    // and combined arms: a stack that brings a kind of unit the blow doesn't have yet (troops, armour, air) is worth more
    // a killer bot masses more stacks on an HQ than on anything else
    const maxCombo = K.combo + (isHQ ? Math.round(2 * (K.lethal || 0)) : 0);
    const list = by[t].slice().sort((a, b) => stackValue(b.units) - stackValue(a.units)).slice(0, Math.max(5, maxCombo + 1));
    const used = [], kinds = new Set();
    const kindsOf = st => st.units.filter(u => E.UNITS[u.type].atk > 0).map(u => E.UNITS[u.type].cls);
    const worth = st => stackValue(st.units) * (1 + 0.6 * new Set(kindsOf(st).filter(k => !kinds.has(k))).size);
    let calc = null;
    while (used.length < maxCombo) {
      const left = list.filter(st => !used.includes(st)); if (!left.length) break;
      const st = left.reduce((x, y) => worth(y) > worth(x) ? y : x);
      used.push(st); for (const k of kindsOf(st)) kinds.add(k);
      const stages = used.map(u => E.pathTo(u.reach, t).slice(-2)[0]);
      calc = E.combatCalc(s, pid, used.flatMap(u => u.units), stages, t, false, idx);
      // good enough odds: stop, unless another stack nearby would add a new kind of unit to the blow
      if (calc.winProb >= Math.max(K.attack, 0.85) && !list.some(x => !used.includes(x) && kindsOf(x).some(k => !kinds.has(k)))) break;
    }
    if (!calc) continue;
    // our own HQ under siege: any real chance of taking it back beats being knocked out next turn
    const press = tt.owner && tt.owner === strat.target ? (strat.rich || 0) * (K.richW === undefined ? 0.15 : K.richW) * (K.lethal || 0) : 0;
    const need = isHQ && t === (p && p.hq) ? 0.15 : (isHQ ? K.attack - 0.15 - 0.08 * (K.lethal || 0) : K.attack) - press;
    if (calc.winProb < need) continue;
    const risk = used.reduce((a, u) => a + stackValue(u.units), 0);
    // helicopters that win are left sitting on the hex: count what they'd face there
    const helis = used.some(u => u.units.some(x => E.UNITS[x.type].heli));
    const exposure = helis ? heliDanger(s, pid, idx, t) * 2 * K.heli : 0;
    const v = calc.winProb * prize - (1 - calc.winProb) * risk * 0.8 * (1 - press * 2) - exposure;
    if (v > bv) { bv = v; best = { t, used, calc }; }
  }
  if (!best) return null;
  for (const u of best.used) mem.skip && mem.skip.add(u.k);
  if (best.used.length === 1) return { a: 'move', from: best.used[0].k, units: best.used[0].units.map(u => u.id), to: best.t };
  return { a: 'assault', to: best.t, groups: best.used.map(u => ({ from: u.k, units: u.units.map(x => x.id) })) };
}

// enemy HQs we've taken and are holding under siege (they fall for good if we're still there when our next turn starts)
function besiegedBy(s, pid) {
  const out = []; for (const k in s.map.tiles) { const t = s.map.tiles[k]; if (t.owner !== pid) continue; const h = E.structsOf(t).find(x => x.type === 'hq'); if (h && h.owner !== pid && h.siege && h.siege.by === pid) out.push(k); }
  return out;
}
// accept a trade if what we get is worth clearly more than what we give
function tradeReply(s, pid) {
  const t = s.trade; if (!t || t.to !== pid) return null;
  const p = E.player(s, pid), from = E.player(s, t.from);
  const cardVal = id => { const d = E.TACTICS[id]; return d ? d.cost + { common: 2, uncommon: 4, rare: 7, epic: 10, legendary: 14, mythic: 22 }[d.rarity] : 0; };
  const gain = t.give.cash + (t.cardIds || []).reduce((a, id) => a + cardVal(id), 0);
  const cost = t.get.cash;
  const greed = ({ easy: 1, medium: 1.15, hard: 1.35, impossible: 1.6 }[p.diff] || 1.15) * (playOf(p).greed || 1);
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
  const p = E.player(s, pid), tiles = s.map.tiles, bm = botMem(s, pid), pl = playOf(p);
  const th = threats(s, pid), mine = E.threatOf(s, pid);
  const rivals = s.players.filter(q => q.alive && q.id !== pid && !E.isAlly(s, pid, q.id));
  // how much of our border each rival shares
  const border = {};
  for (const k in tiles) if (tiles[k].owner === pid) for (const n of E.neighbors(k)) { const o = tiles[n] && tiles[n].owner; if (o && o !== pid) border[o] = (border[o] || 0) + 1; }
  const top = Math.max(0, ...Object.values(th));
  const lethal = (SKILL[p.diff] || SKILL.medium).lethal || 0;
  const myLand = Object.keys(tiles).filter(k => tiles[k].owner === pid);
  const reachHQ = q => { if (!q.hq || !tiles[q.hq]) return 99; let m = 99; for (const k of myLand) { const d = E.dist(k, q.hq); if (d < m) m = d; } return m; };
  let focus = null, fv = -1e9;
  for (const q of rivals) {
    let v = (border[q.id] || 0) * 1.2 + (mine - th[q.id]) * 0.15 - E.moodOf(s, pid, q.id) * 0.08;
    // the kill: a rival that's fallen well behind us, with its HQ within striking distance, is worth finishing off
    if (lethal) { const weak = Math.max(0, 1 - th[q.id] / Math.max(1, mine)); v += weak * 16 * lethal + Math.max(0, 8 - reachHQ(q)) * 1.5 * lethal; }
    if (pl.prey && border[q.id]) v += (mine - th[q.id]) * 0.2 * pl.prey;          // a Warlord picks on the weakest neighbour
    if (pl.grudge) v -= Math.min(0, E.moodOf(s, pid, q.id)) * 0.5 * pl.grudge;    // an Avenger hunts whoever hurt it
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
  for (const id in s.units) { const u = s.units[id]; if (!wary(s, pid, u.owner)) continue; const c = E.UNITS[u.type].cls; if (c === 'air') seen.air++; else if (c === 'veh') seen.veh++; }
  for (const k of goal) if (E.structsOf(tiles[k]).some(x => ['hq', 'fob', 'bunker'].includes(x.type) && x.owner === target)) seen.fort++;
  // bases under threat get reinforcements first
  const danger = {};
  for (const sp of E.spawnPoints(s, pid)) {
    let atk = 0; for (const a of E.area(sp, 2)) for (const u of idx[a] || []) if (wary(s, pid, u.owner)) atk += E.unitAtk(s, u);
    const def = (idx[sp] || []).filter(u => u.owner === pid).reduce((a, u) => a + E.unitDef(s, u), 0);
    if (atk > def) danger[sp] = atk - def;
  }
  const tq = target && E.player(s, target);
  const edge = target ? Math.max(0, Math.min(1, (mine - th[target]) / Math.max(1, mine))) : 0;
  // out-earning them: a war of attrition we win, so even trades are worth taking (0 at parity, 1 at twice their income)
  const rich = target ? Math.max(0, Math.min(1, E.computeIncome(s, pid).total / Math.max(1, E.computeIncome(s, target).total) - 1)) : 0;
  return { edge, rich, focus, target, goal, seen, danger, hq: tq && tq.alive && tq.hq && tiles[tq.hq] && tiles[tq.hq].owner === target ? tq.hq : null };
}

// experiments only (balance lab): BOTX=noguard,noplan,atk=0.5,… switches parts of the bot off to measure what each is worth
const BOTX = (typeof process !== 'undefined' && process.env && process.env.BOTX || '').split(',').filter(Boolean);
// fog of war: a bot sees what a player in its seat would, its own fogged view with what it has explored and last seen
// there, and decides from that. Its orders still run against the real board (a hidden army it walks into is an ambush)
const fogMems = new WeakMap();
function botStep(s, pid, mem) {
  if (s.settings && s.settings.fog === 'on' && s.phase === 'play') {
    let byPid = fogMems.get(s); if (!byPid) fogMems.set(s, byPid = {});
    const seen = byPid[pid] = byPid[pid] || { explored: new Set(), seen: {} };
    for (let i = 0; i < 4; i++) {
      const v = E.view(s, pid, seen);
      v.botMem = s.botMem = s.botMem || {};   // its plans and grudges live on the real game
      const act = botTurn(v, pid, mem);
      // a base it remembers may have fallen out of sight since: told "you can't deploy / build there", it picks again
      const refused = act && ((act.a === 'deploy' && !E.deployHexes(s, pid, act.unit).includes(act.hex)) || (act.a === 'build' && E.buildError(s, pid, act.struct, act.hex)));
      if (!refused) return act;
      (mem.badHex = mem.badHex || new Set()).add(act.hex);
    }
    return { a: 'end' };
  }
  return botTurn(s, pid, mem);
}
function botTurn(s, pid, mem) {
  const p = E.player(s, pid);
  let K = SKILL[p.diff] || SKILL.medium;
  const PL = playOf(p);
  if (p.persona) {
    K = { ...K, attack: K.attack + (PL.attack || 0) + (PL.late && s.turn.round < PL.late ? 0.05 : 0), guard: K.guard * (PL.guard || 1), tactics: Math.min(1, K.tactics * (PL.tactics || 1)), heli: Math.min(1.3, K.heli * (PL.heli || 1)), noise: K.noise + (PL.noise || 0) };
  }
  if (BOTX.length) { K = { ...K }; for (const x of BOTX) { const [k, v] = x.split('='); if (v !== undefined) K[k] = +v; else K[k] = true; } }
  if (s.turn.stage === 'choose') {
    const c = choosePick(s, p, s.turn.offer);
    // what the card costs in income this turn (about half early on, much less of a big economy)
    const fee = c ? E.cardFee(s.turn.income, s.turn.offer[c.idx]) : 0;
    const threshold = 2.4 + Math.min(fee / 5, 1.2 + fee / 20) - (s.turn.round <= 3 ? 0.6 : 0) + (PL.income || 0);
    if (c && !c.scrap && c.value >= threshold) return { a: 'choose', pick: 'card', idx: c.idx, replace: c.replace };
    return { a: 'choose', pick: 'income' };
  }
  // team games: a bot with money to spare tides over a broke teammate (once a turn)
  if (s.turn.stage === 'act' && !mem.gifted && s.settings.teams === 'on' && p.cash >= 24) {
    mem.gifted = true;
    const poor = s.players.filter(q => q.alive && E.teammate(s, pid, q.id) && q.cash < 6).sort((x, y) => x.cash - y.cash)[0];
    if (poor) return { a: 'gift', to: poor.id, amount: Math.min(10, Math.floor(p.cash / 4)) };
  }
  if (s.turn.stage === 'crate') {
    const c = choosePick(s, p, s.turn.crate.cards);
    if (!c || c.scrap) return { a: 'scrap' };
    return { a: 'pick', idx: c.idx, replace: c.replace };
  }
  mem.tried = mem.tried || new Set();
  const tryOnce = (act) => { if (act && act.a === 'move') act = keepTogether(act); if (act && act.a === 'build' && (E.buildError(s, pid, act.struct, act.hex) || E.buildCost(s, p, act.struct, act.hex) > p.cash)) return null;   // never propose a build the rules refuse (a river, a full hex) or it can't pay for
    // money-makers never eat the army's budget: once the war is on, most of each turn's income is kept for troops
    if (act && act.a === 'build' && ['refinery', 'warehouse', 'depot'].includes(act.struct) && p.cash - E.buildCost(s, p, act.struct, act.hex) < (s.turn.income || 0) * (s.turn.round <= 8 ? 0.2 : PL.build && PL.build.economy ? 0.4 : (K.armyShare === undefined ? 0.8 : K.armyShare))) return null;
    const k = JSON.stringify(act); if (mem.tried.has(k)) return null; mem.tried.add(k); return act; };
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
  // (mustered troops strike the same turn): keep buying the hardest hitters we can afford until the odds of retaking it are good,
  // or there's no room or money left. Losing the HQ loses the game, so nothing else gets the money while it's under siege
  { const mh = E.musterHexes(s, pid);
    if (mh.length && (mem.musterN || 0) < 16) {
      const hq = p.hq, strikers = mh.flatMap(k => (idx[k] || []).filter(u => u.owner === pid && E.canAct(s, u) && E.UNITS[u.type].atk > 0 && !E.UNITS[u.type].range));
      const odds = strikers.length ? E.combatCalc(s, pid, strikers, [...new Set(strikers.map(u => u.hex))], hq, false, idx).winProb : 0;
      if (odds < 0.85) {
        const land = p.arsenal.filter(t => !E.isSea(t) && E.unitCost(p, t) <= p.cash && E.UNITS[t].atk > 0 && !E.UNITS[t].range && !E.UNITS[t].aa && E.UNITS[t].cls !== 'air')
          .sort((a, b) => E.UNITS[b].atk / Math.sqrt(E.unitCost(p, b)) - E.UNITS[a].atk / Math.sqrt(E.unitCost(p, a)));
        for (const t of land) {
          const spot = E.deployHexes(s, pid, t, idx).find(k => mh.includes(k));
          if (spot) { mem.musterN = (mem.musterN || 0) + 1; return { a: 'deploy', unit: t, hex: spot }; }
        }
      }
    } }
  // 0a. an ally on the way out: get every stack out of their land first (the pact's end kills whatever is still inside),
  // home if it can reach, else any land that isn't theirs, nearest our HQ
  for (const k in idx) {
    const t = tiles[k]; if (!t.owner || t.owner === pid || !E.isAlly(s, pid, t.owner) || !soonFoe(s, pid, t.owner)) continue;
    const ids = idx[k].filter(u => u.owner === pid && E.canAct(s, u)).map(u => u.id); if (!ids.length) continue;
    const r = E.reachable(s, pid, ids, k, idx);
    const outs = Object.keys(r).filter(d => ['move', 'capture'].includes(r[d].kind) && !(tiles[d].owner && tiles[d].owner !== pid && E.isAlly(s, pid, tiles[d].owner)));
    if (!outs.length) continue;
    const score = d => (tiles[d].owner === pid ? 0 : 10) + (p.hq ? E.dist(d, p.hq) : 0);
    const a = tryOnce({ a: 'move', from: k, units: ids, to: outs.sort((x, y) => score(x) - score(y))[0] }); if (a) return a;
  }
  // 0b. the black market is a luxury: troops come first. One card a turn at most, a good one, and only while our army
  // stands up to the strongest rival's (bots used to spend more there than on their armies, and wars stalled out)
  if (p.market && p.market.round === s.turn.round && !mem.bought) {
    const army = q => Object.values(s.units).filter(u => u.owner === q && !E.isSea(u.type)).reduce((n, u) => n + unitValue(u.type), 0);
    const mine = army(pid), rival = Math.max(0, ...s.players.filter(q => q.alive && q.id !== pid && !E.isAlly(s, pid, q.id)).map(q => army(q.id)));
    const reserve = Math.max(10, s.turn.income * 0.8), strong = mine >= rival;
    const best = p.market.cards.map((c, i) => ({ c, i, v: cardScore(s, p, c.id) })).filter(x => !x.c.sold && p.cash - x.c.price >= reserve && x.v >= (strong ? 2.5 : 4.5)).sort((a, b) => b.v - a.v)[0];
    if (best) { mem.bought = 1; return { a: 'marketBuy', idx: best.i }; }
  }
  // fog of war: a bot only strikes and shells what it can actually see, like a player would
  const seen = s.settings.fog === 'on' ? E.visionOf(s, pid) : null, sees = k => !seen || seen.has(k);
  // 1. instant / opportunistic tactics
  for (const c of p.tactics) {
    const d = E.TACTICS[c.id];
    if (p.cash < d.cost || Math.random() > K.tactics) continue;
    let act = null;
    if (c.id === 'bonds' || c.id.startsWith('drop_')) act = { a: 'tactic', uid: c.uid };
    else if (c.id === 'bounty' && Object.values(s.units).filter(u => u.owner === pid && !u.moved).length >= 4) act = { a: 'tactic', uid: c.uid };
    else if (c.id === 'fortify' && enemyNear(p.hq, 4) && (((E.structsOf(tiles[p.hq]).find(x => x.type === 'hq') || {}).lvl || 1) < E.MAX_SLVL)) act = { a: 'tactic', uid: c.uid, target: p.hq };
    else if (c.id === 'embargo') { const lead = s.players.filter(o => o.alive && o.id !== pid).sort((a, b) => E.ownedLand(s, b.id).length - E.ownedLand(s, a.id).length)[0]; const k = lead && E.tacticTargets(s, pid, 'embargo').find(k => tiles[k].owner === lead.id); if (k) act = { a: 'tactic', uid: c.uid, target: k }; }
    else if (c.id === 'aegis' && Object.values(tiles).reduce((n, t) => n + E.structsOf(t).filter(x => x.owner === pid && E.UPGRADABLE.includes(x.type) && (x.lvl || 1) < E.MAX_SLVL).length, 0) >= 4) act = { a: 'tactic', uid: c.uid };   // Industrial Revolution: worth it once there's plenty to upgrade
    else if (c.id === 'spy') { const ts = E.tacticTargets(s, pid, 'spy'); const k = ts.sort((a, b) => E.player(s, tiles[b].owner).tactics.length - E.player(s, tiles[a].owner).tactics.length)[0]; if (k) act = { a: 'tactic', uid: c.uid, target: k }; }
    else if (c.id === 'quarry') { const ts = E.tacticTargets(s, pid, 'quarry'); const k = ts.find(k => E.neighbors(k).some(n => tiles[n] && tiles[n].owner && tiles[n].owner !== pid) && E.neighbors(k).some(n => tiles[n] && tiles[n].owner === pid)); if (k) act = { a: 'tactic', uid: c.uid, target: k }; }
    else if (['airstrike', 'kamikaze', 'gunrun', 'precision', 'buster', 'strategic', 'mutiny', 'nuke', 'sabotage', 'emp', 'carpet', 'orbital', 'tsar', 'regime', 'cruise'].includes(c.id)) {
      const ts = E.tacticTargets(s, pid, c.id).filter(sees);
      let best = null, bv = 0;
      for (const k of ts) {
        let v = 0;
        if (c.id === 'sabotage') v = tiles[k].struct.type === 'fob' ? 10 : 5;
        else if (c.id === 'precision' || c.id === 'cruise') v = (idx[k] || []).length ? Math.max(0, ...(idx[k] || []).map(u => unitValue(u.type))) * 1.3 : E.infraValue(s, k) * 1.5;
        else if (c.id === 'strategic') { for (const a of E.area(k, 1)) { const t = tiles[a]; if (t && t.owner && t.owner !== pid && !E.isAlly(s, pid, t.owner) && E.isLandTile(t)) v += 1 + E.infraValue(s, a) * 0.6 + (t.res ? 1 : 0); } }
        else if (['airstrike', 'gunrun', 'kamikaze'].includes(c.id) && !(idx[k] || []).length) v = E.infraValue(s, k) * (c.id === 'airstrike' ? 1.4 : 0.9);
        else if (c.id === 'buster') { v = stackValue(idx[k] || []) * 0.5; for (const x of E.structsOf(tiles[k])) if (['bunker', 'fob', 'flak', 'mine', 'hq'].includes(x.type) && x.owner === tiles[k].owner) v += 5 * (x.lvl || 1); }
        else if (c.id === 'nuke' || c.id === 'emp' || c.id === 'carpet') for (const a of E.area(k, 1)) for (const u of idx[a] || []) v += u.owner === pid ? -unitValue(u.type) * 2 : unitValue(u.type);
        else if (c.id === 'tsar') for (const a of E.tsarArea(s, k)) { for (const u of idx[a] || []) v += u.owner === pid ? -unitValue(u.type) * 2 : unitValue(u.type); if (tiles[a].owner === pid) v -= 3; else if (tiles[a].owner) v += 1; }
        else if (c.id === 'regime') for (const a of E.area(k, 1)) { if (tiles[a] && tiles[a].owner === tiles[k].owner && !E.structsOf(tiles[a]).some(x => x.type === 'hq')) { v += 2; for (const u of idx[a] || []) v += unitValue(u.type); } }
        else v = stackValue(idx[k] || []);
        if (v > bv) { bv = v; best = k; }
      }
      if (best && E.AIR_STRIKES.includes(c.id)) bv *= 1 - E.interceptChance(s, pid, best, c.id);   // air defences might shoot it down
      const need = { cruise: 8, strategic: 12, kamikaze: 4, gunrun: 4, precision: 9, buster: 12, airstrike: 9, mutiny: 8, nuke: 30, sabotage: 5, emp: 20, carpet: 18, orbital: 14, tsar: 36, regime: 14 }[c.id];
      if (best && bv >= need) act = { a: 'tactic', uid: c.uid, target: best };
    } else if (c.id === 'conscript') {
      const ts = E.tacticTargets(s, pid, c.id).sort((a, b) => (strat.danger[b] || 0) - (strat.danger[a] || 0) || (strat.goal.length ? Math.min(...strat.goal.slice(0, 60).map(g => E.dist(a, g))) - Math.min(...strat.goal.slice(0, 60).map(g => E.dist(b, g))) : 0));
      if (ts.length) act = { a: 'tactic', uid: c.uid, target: ts[0] };
    } else if (c.id === 'heli') {
      let best = null, bv = 5;
      for (const from of E.tacticTargets(s, pid, 'heli')) {
        const ms = (idx[from] || []).filter(u => u.owner === pid && E.canAct(s, u) && !E.isSea(u.type)); if (!ms.length || from === p.hq) continue;
        for (const k of E.tacticTargets(s, pid, 'heli', from)) {
          const t = tiles[k]; let v = t.owner === pid ? -9 : t.owner ? 6 : 2;
          if (t.poi && ['relic', 'cache', 'ruins'].includes(t.poi)) v += 6; if (t.res) v += 3; if (t.struct && t.owner !== pid) v += 5;
          if (strat.hq) v += Math.max(0, 6 - E.dist(k, strat.hq)) * 1.5 * (K.lethal || 0);
          let foe = 0; for (const n of E.neighbors(k)) for (const u of idx[n] || []) if (wary(s, pid, u.owner)) foe += E.unitAtk(s, u);
          v -= foe * 0.6 - stackValue(ms) * 0.1;
          if (v > bv) { bv = v; best = { from, k }; }
        }
      }
      if (best) act = { a: 'tactic', uid: c.uid, from: best.from, target: best.k };
    } else if (c.id === 'blitz') {
      const ready = Object.values(s.units).filter(u => u.owner === pid && !u.moved).length;
      if (ready >= 6) act = { a: 'tactic', uid: c.uid };
    }
    if (act && (act = tryOnce(act))) return act;
  }

  // economy builds
  const sup = E.supplySet(s, pid);
  const supLand = [...sup].filter(k => E.isLandTile(tiles[k]) && !tiles[k].bridge);
  // where buildings go: money-makers well behind the lines (they're lost when the front moves), never on the border
  const foeLand = Object.keys(tiles).filter(k => tiles[k].owner && wary(s, pid, tiles[k].owner));
  const fromFoe = k => { let m = 99; for (const e of foeLand) { const d = E.dist(k, e); if (d < m) m = d; } for (const id in s.units) { const u = s.units[id]; if (wary(s, pid, u.owner)) { const d = E.dist(k, u.hex) - 1; if (d < m) m = d; } } return m; };
  const rearSpot = list => list.map(k => [k, fromFoe(k)]).filter(([, d]) => d >= 3).sort((a, b) => b[1] - a[1] + (Math.random() - 0.5) * 0.5).map(([k]) => k)[0];
  for (const k of sup) {
    const t = tiles[k];
    if (t.res && !t.struct && !t.contam && p.cash >= E.structCost(p, 'refinery') && fromFoe(k) >= 2) { const a = tryOnce({ a: 'build', struct: 'refinery', hex: k }); if (a) return a; }
  }
  if (!tiles[p.hq].struct || tiles[p.hq].struct.type !== 'hq') { /* lost */ }
  if (enemyNear(p.hq, 3)) {
    const ring = E.neighbors(p.hq).filter(n => supLand.includes(n) && !tiles[n].struct && !tiles[n].contam);
    if (ring.length && p.cash >= E.structCost(p, 'bunker') + 4) { const a = tryOnce({ a: 'build', struct: 'bunker', hex: ring[0] }); if (a) return a; }
  }

  // personality builds: a Fortress walls its border and raises its HQ, a Tycoon builds its economy early
  if (PL.build && !mem.persBuild) {
    mem.persBuild = true;
    const B = PL.build;
    if (B.bunkers && p.cash >= E.structCost(p, 'bunker') + 8) {
      const edge = supLand.filter(k => !tiles[k].struct && !tiles[k].contam && E.neighbors(k).some(n => tiles[n] && wary(s, pid, tiles[n].owner)));
      if (edge.length) { const k = edge.sort((a, b) => E.dist(a, p.hq) - E.dist(b, p.hq))[0]; const a = tryOnce({ a: 'build', struct: 'bunker', hex: k }); if (a) return a; }
    }
    if (B.hq && s.turn.round >= 6 && tiles[p.hq].owner === pid && tiles[p.hq].struct && tiles[p.hq].struct.type === 'hq' && (tiles[p.hq].struct.lvl || 1) < 3 && p.cash >= E.buildCost(s, p, 'hq', p.hq) + 6) { const a = tryOnce({ a: 'build', struct: 'hq', hex: p.hq }); if (a) return a; }
    if (B.economy && p.cash >= E.structCost(p, 'warehouse') + 2 && Object.keys(tiles).filter(k => tiles[k].owner === pid && tiles[k].struct && tiles[k].struct.type === 'warehouse').length < 2 + Math.floor(s.turn.round / 8)) {
      const spot = rearSpot(supLand.filter(k => !tiles[k].struct && !tiles[k].contam)); if (spot) { const a = tryOnce({ a: 'build', struct: 'warehouse', hex: spot }); if (a) return a; }
    }
  }

  // 3. ranged fire
  for (const k in idx) for (const aa of [false, true]) {
    // guns and anti-air fire separately: anti-air only shoots at aircraft
    const art = idx[k].filter(u => u.owner === pid && E.UNITS[u.type].range && E.canAct(s, u) && isAA(u) === aa);
    if (!art.length) continue;
    const ids = art.map(u => u.id);
    const targets = E.rangedTargets(s, pid, ids, k, idx).filter(sees);
    let best = null, bv = 0;
    const walk = E.reachable(s, pid, ids, k, idx);
    for (const t of targets) {
      // an empty enemy building we can just walk onto is better captured than shelled
      if (!(idx[t] || []).length) { if (walk[t] && ['move', 'capture'].includes(walk[t].kind)) continue; const v = E.infraValue(s, t) * 0.8; if (v > bv && v >= 3) { bv = v; best = t; } continue; }   // shell undefended buildings
      const c = E.combatCalc(s, pid, art, k, t, true, idx);
      const v = c.winProb * stackValue(idx[t]);
      if (c.winProb > (aa ? 0.25 : 0.18) && v > bv) { bv = v; best = t; }   // a shot from range risks nothing: take any real chance
    }
    if (best) { const a = tryOnce({ a: 'fire', from: k, units: ids, to: best }); if (a) return a; }
  }

  mem.skip = mem.skip || new Set();
  // 3c. attacks: the planner picks the best one on the board, massing stacks into pincers when one isn't enough
  if (!mem.noAssault && !K.noplan) {
    const a = planAssault(s, pid, idx, K, strat, mem);
    if (a) { const t = tryOnce(a); if (t) return t; }
    else mem.noAssault = true;
  }
  const threat = mem.threat = mem.threat || threatMap(s, pid, idx);
  // 3d. helicopters don't loiter where they'll be shot down: pull them back over safe ground
  if (!mem.heliDone && Math.random() < K.heli) {
    mem.heliDone = true;
    for (const k in idx) {
      if (mem.skip.has(k)) continue;
      const hs = idx[k].filter(u => u.owner === pid && E.canAct(s, u) && E.UNITS[u.type].heli);
      if (!hs.length || hs.length !== idx[k].filter(u => u.owner === pid && !(u.type === 'grunt')).length) continue;   // only all-helicopter stacks (and their passengers)
      if (heliDanger(s, pid, idx, k) < 2 && !(threat[k] > holdOf(s, pid, idx[k]) * 1.5)) continue;
      const ids = idx[k].filter(u => u.owner === pid && E.canAct(s, u)).map(u => u.id), r = E.reachable(s, pid, ids, k, idx);
      let best = null, bv = 1e9;
      for (const d in r) { if (r[d].kind !== 'move' || tiles[d].owner !== pid) continue; const v = heliDanger(s, pid, idx, d) * 3 + (threat[d] || 0) - ((idx[d] || []).some(u => u.owner === pid && !E.UNITS[u.type].heli) ? 4 : 0); if (v < bv) { bv = v; best = d; } }
      mem.skip.add(k);
      if (best) { const a = tryOnce({ a: 'move', from: k, units: ids, to: best }); if (a) return a; }
    }
  }
  // 3e. hold the front: sturdy stacks move onto our threatened bases, buildings and resources (plain land isn't worth standing still for)
  if (!mem.guardDone && !K.noguard && Math.random() < K.guard) {
    mem.guardDone = true;
    const weak = Object.keys(threat).filter(k => { const t = tiles[k]; if (!E.isLandTile(t) || t.t === 'mountain') return false; if (!t.struct && !t.res && !t.poi) return false; const hold = holdOf(s, pid, idx[k] || []) + (t.struct && ['hq', 'fob', 'bunker'].includes(t.struct.type) ? 6 : 0); return threat[k] > hold * 1.3; })
      .map(k => ({ k, v: threat[k] + (tiles[k].struct ? (tiles[k].struct.type === 'hq' ? 40 : 12) : 0) + (tiles[k].res ? 4 : 0) })).sort((a, b) => b.v - a.v).slice(0, 3);
    for (const w of weak) {
      let pick = null, pv = 0;
      for (const k in idx) {
        if (k === w.k || mem.skip.has(k) || E.dist(k, w.k) > 5) continue;
        if (threat[k] && threat[k] > holdOf(s, pid, idx[k]) * 0.9) continue;   // don't strip one threatened hex to save another
        const us = idx[k].filter(u => u.owner === pid && E.canAct(s, u) && !E.isSea(u.type) && !E.UNITS[u.type].heli);
        if (!us.length || (k === p.hq && enemyNear(k, 3))) continue;
        const r = E.reachable(s, pid, us.map(u => u.id), k, idx)[w.k]; if (!r || r.kind !== 'move') continue;
        const v = us.reduce((a, u) => a + E.unitDef(s, u), 0);
        if (v > pv) { pv = v; pick = { k, us }; }
      }
      if (pick) { mem.skip.add(pick.k); const a = tryOnce({ a: 'move', from: pick.k, units: pick.us.map(u => u.id), to: w.k }); if (a) return a; }
    }
    // a bunker on the most threatened chokepoint we can afford to fortify
    const spot = weak.find(w => { const t = tiles[w.k]; return !t.struct && !t.contam && E.supplySet(s, pid).has(w.k) && E.neighbors(w.k).filter(n => tiles[n] && tiles[n].owner === pid).length <= 3; });
    if (spot && p.cash >= E.structCost(p, 'bunker') + 6 && K.guard >= 0.7) { const a = tryOnce({ a: 'build', struct: 'bunker', hex: spot.k }); if (a) return a; }
  }

  // 4. manoeuvre stacks
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
  // (no ground unit crosses an unbridged river; `fordable` pretends it can, for 'could a bridge get us there?')
  const walkField = (name, list, fordable) => {
    if (walkMaps[name]) return walkMaps[name];
    const f = {}, q = [];
    for (const k of list) if (tiles[k]) { f[k] = 0; q.push(k); }
    for (let i = 0; i < q.length; i++) for (const n of E.neighbors(q[i])) { const t = tiles[n]; if (!t || n in f || !E.isLandTile(t) || t.t === 'mountain' || (t.river && !t.bridge && !fordable)) continue; f[n] = f[q[i]] + 1; q.push(n); }
    return (walkMaps[name] = f);
  };
  // no dry route: count the river crossings (infantry ford them, and we bridge them) before falling back to a straight line
  const walkGain = (name, list, from, to) => { const f = walkField(name, list); if (from in f && to in f) return f[from] - f[to]; const g = walkField(name + '~', list, true); return from in g && to in g ? g[from] - g[to] : nearest(from, list) - nearest(to, list); };
  // overseas: no land route from anything we hold to the war target. That's the Ark's job: load troops and sail at them
  const seaborne = strat.goal.length > 0 && (() => { const f = walkField('goalFord', strat.goal, true); const sp = E.spawnPoints(s, pid); return !(sp.length ? sp : [p.hq]).some(k => k in f); })();   // judged from the bases new troops come from: a lone beachhead doesn't make the war a land war
  const navalNeed = stuck || seaborne;
  const arkHexes = Object.keys(idx).filter(k => E.isWater(tiles[k]) && idx[k].some(u => u.owner === pid && u.type === 'ark' && idx[k].filter(x => x.owner === pid && !E.isSea(x.type)).length < 3));   // room aboard (an Ark carries 3)
  const landFor = seaborne ? strat.goal : targets;   // where a loaded transport heads
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
    // out of contact, a mixed stack doesn't crawl at its slowest: the faster units (and the troops, ahead of the guns) go on,
    // and the rest move as their own group when the loop comes back to this hex
    let split = false;
    if (!atSea && movers.length > 1 && !movers.some(u => E.isSea(u.type) || E.UNITS[u.type].lift) && !enemyNear(k, 2) && !(mem.split = mem.split || new Set()).has(k)) {
      const sp = u => E.moveAllow(s, u), lo = Math.min(...movers.map(sp)), gun = u => E.UNITS[u.type].range && !isAA(u);
      let lead = movers.filter(u => sp(u) > lo);
      if (!lead.length && movers.some(gun) && movers.some(u => !gun(u))) lead = movers.filter(u => !gun(u));
      if (lead.length && lead.length < movers.length) { movers = lead; split = true; mem.split.add(k); }
    }
    // keep a garrison at HQ when threatened
    if (k === p.hq && enemyNear(k, 4)) {
      const all = idx[k].filter(u => u.owner === pid);
      if (all.length <= movers.length) movers = movers.slice().sort((a, b) => E.UNITS[b.type].def - E.UNITS[a.type].def).slice(1);
      if (!movers.length) { mem.skip.add(k); continue; }
    }
    // roles: guns fight from range, anti-air covers the army, empty troop helicopters fetch troops
    // what guns aim at and keep their distance from: enemy troops on the ground, and enemy buildings worth shelling
    const landFoes = mem.landFoes = mem.landFoes || Object.values(s.units).filter(u => wary(s, pid, u.owner) && !E.isSea(u.type) && E.UNITS[u.type].cls !== 'air').map(u => u.hex).concat(Object.keys(tiles).filter(x => tiles[x].owner && wary(s, pid, tiles[x].owner) && E.structsOf(tiles[x]).length));
    const foeDist = h => { let m = 99; for (const f of landFoes) { const d = E.dist(f, h); if (d < m) m = d; } return m; };
    const guns = !movers.some(u => E.isSea(u.type)) && movers.every(u => E.UNITS[u.type].range && !isAA(u));
    const gunRange = guns ? Math.min(...movers.map(u => E.UNITS[u.type].range)) : 0;
    // a gun battery already in range (but not in contact) holds and shoots next turn
    // (only with something to shoot at: a battery idling in a narrow pass blocks the whole army behind it)
    if (guns && foeDist(k) >= 2 && foeDist(k) <= gunRange && E.rangedTargets(s, pid, movers.map(u => u.id), k, idx).length) { mem.skip.add(k); continue; }
    const airCover = !movers.some(u => E.isSea(u.type)) && movers.every(isAA);
    const reachAA = airCover ? Math.max(...movers.map(u => E.aaReach(u))) : 0;
    const myStacks = airCover ? (mem.myStacks = mem.myStacks || [...new Set(Object.values(s.units).filter(u => u.owner === pid && !isAA(u) && !E.isSea(u.type)).map(u => u.hex))].concat(E.spawnPoints(s, pid))) : null;
    const coverAt = h => myStacks.filter(x => E.dist(x, h) <= reachAA).length;
    const liftAir = movers.every(u => E.UNITS[u.type].cls === 'air' && E.UNITS[u.type].lift) && !movers.some(u => u.type === 'grunt');
    const ids = movers.map(u => u.id);
    const fleet = movers.some(u => E.isSea(u.type));
    const carrying = fleet && (idx[k] || []).some(u => u.owner === pid && !E.isSea(u.type));
    // empty transports wait at the dock for troops
    // empty transports wait at the dock for troops, or (a war overseas) sail to where the army is waiting
    if (fleet && !carrying && movers.every(u => u.type === 'ark')) {
      const army = navalNeed ? (mem.armyHexes = mem.armyHexes || [...new Set(Object.values(s.units).filter(u => u.owner === pid && !E.isSea(u.type) && E.UNITS[u.type].cls !== 'air' && E.isLandTile(tiles[u.hex])).map(u => u.hex))]) : [];
      if (army.length && nearest(k, army) > 1) {
        const r = E.reachable(s, pid, ids, k, idx); let to = null, bd = nearest(k, army);
        for (const d in r) if ((r[d].kind === 'move' || r[d].kind === 'capture') && E.isWater(tiles[d])) { const dd = nearest(d, army); if (dd < bd) { bd = dd; to = d; } }
        if (to) { const a = tryOnce({ a: 'move', from: k, units: ids, to }); if (a) return a; }
      }
      mem.skip.add(k); continue;
    }
    const reach = E.reachable(s, pid, ids, k, idx);
    const carryingAttackOnly = false;
    const friendsHere = d => (idx[d] || []).filter(u => u.owner === pid);
    const late = Math.max(0, Math.min(1, (s.turn.round - 12) / 18));   // 0 until round 12, 1 from round 30
    const myDefHere = movers.reduce((a, u) => a + E.unitDef(s, u), 0), myAtkHere = movers.reduce((a, u) => a + E.unitAtk(s, u), 0);
    let best = null, bv = 0.5;
    const exposed = tiles[k].owner && tiles[k].owner !== pid && E.isAlly(s, pid, tiles[k].owner) && soonFoe(s, pid, tiles[k].owner);
    if (exposed) bv = -99;   // any way out beats staying: the pact's end kills every unit still inside
    // covered airspace: enemy air defence fires on aircraft that stop inside it (once a turn), and Grunts aboard go down too
    const flies = movers.some(u => E.UNITS[u.type].cls === 'air' && E.UNITS[u.type].ability !== 'stealth'), az = flies ? E.aaZone(s, pid) : null;
    for (const dest in reach) {
      const r = reach[dest];
      if (r.kind === 'start' || r.kind === 'pass') continue;
      const t = tiles[dest];
      let v = 0;
      const path = E.pathTo(reach, dest);
      for (const pk of path.slice(1, -1)) if (tiles[pk].owner !== pid && !(tiles[pk].owner && E.isAlly(s, pid, tiles[pk].owner)) && E.isLandTile(tiles[pk])) v += 2.5;
      // allied land is for passing through, not for parking troops (they'd be lost if the pact ends)
      if (t.owner && t.owner !== pid && E.isAlly(s, pid, t.owner)) continue;
      if (exposed) v += 20 + (t.owner === pid ? 10 : 0);   // out of the ally's land, home if possible
      if (r.kind !== 'attack' && r.kind !== 'board' && (guns || airCover || liftAir)) {
        const fd = foeDist(dest);
        if (guns) v += fd <= 1 ? -14 : fd <= gunRange ? 8 + ((idx[dest] || []).some(u => u.owner === pid) ? 1.5 : 0) : (foeDist(k) - fd) * 1.6;   // in range, never in contact
        else if (airCover) v += (coverAt(dest) - coverAt(k)) * 2.2 + (fd <= 1 ? -12 : 0) + ((idx[dest] || []).some(u => u.owner === pid && !isAA(u)) ? 1.5 : 0);   // umbrella over the army
        else { const g = (idx[dest] || []).filter(u => u.owner === pid && u.type === 'grunt' && E.canAct(s, u)).length; v += g ? 4 + Math.min(g, 3) : -1; if (az && az[dest]) v -= 6; }   // fly to troops waiting for a lift
        if (t.owner !== pid && fd >= 2) v += t.owner ? 2 : 1;   // still glad to claim ground on the way
        v += Math.random() * K.noise;
        if (v > bv) { bv = v; best = dest; }
        continue;
      }
      if (r.kind === 'board') {
        const aboard = idx[dest].filter(u => !E.isSea(u.type)).length;
        v = navalNeed ? 7 - aboard : -1;
      } else if (r.kind === 'attack' && !carryingAttackOnly && !K.noplan) {
        continue;   // fights are the assault planner's job (it masses stacks and picks its moment)
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
        if (carrying) v += (nearest(k, landFor) - nearest(dest, landFor)) * 2.5 + (nearest(dest, landFor) <= 1 ? 4 : 0);
        else if (movers.some(u => u.type === 'carrier') && enemyTiles.length) { const d0 = nearest(k, landFor), d1 = nearest(dest, landFor); v += (Math.abs(d0 - 3) - Math.abs(d1 - 3)) * 2 + (d1 <= 1 ? -6 : 0); }   // a floating airbase stands off the enemy coast, in strike range
        else if (enemyTiles.length) v += (nearest(k, enemyTiles) - nearest(dest, enemyTiles)) * 0.6;
      } else {
        // a war that drags on narrows to the kill: grabbing land off the road to their HQ counts for less
        if (t.owner !== pid) v += (t.owner ? 6 + (p.faction === 'ashen' ? 2.5 : 0) : 3) * (strat.hq && !seaborne ? 1 - 0.6 * late : 1);
        if (t.poi === 'ruins' || t.poi === 'cache') v += 6;
        if (t.poi === 'fort' && !t.owner) v += 9;   // an abandoned FOB: a free forward base
        if (t.poi === 'relic' && t.owner !== pid) v += 8;
        if (t.res && t.owner !== pid) v += 4;
        if (t.struct && t.owner !== pid) v += 6;
        if (s.map.beacon === dest) v += 10;
        // hold what we've besieged: pile onto the HQ and take the land round it, where its owner would muster a counterattack
        { const held = mem.held = mem.held || besiegedBy(s, pid);
          if (held.includes(dest)) v += 10;
          else if (t.owner !== pid && held.some(h => E.dist(h, dest) === 1)) v += 12; }
        if (strat.goal.length) v += walkGain('goal', strat.goal, k, dest) * 1.1 + walkGain('enemy', enemyTiles, k, dest) * 0.3;
        else if (enemyTiles.length) v += walkGain('enemy', enemyTiles, k, dest) * 0.8;
        if (t.owner && t.owner === strat.target) v += 3;
        if (strat.hq && K.lethal && !seaborne) v += walkGain('hq', [strat.hq], k, dest) * (0.9 + (K.edgeW === undefined ? 3 : K.edgeW) * (strat.edge || 0) + (K.lateW === undefined ? 3 : K.lateW) * late) * K.lethal;   // close on their HQ, not just any of their land (and harder the more we outgun them)
        // combined arms: join a friendly stack that lacks our kind of unit (troops with armour with aircraft), facing the enemy
        if (t.owner === pid && friendsHere(dest).length && E.stackFits(friendsHere(dest), movers) && nearest(dest, enemyTiles) <= nearest(k, enemyTiles)) {
          const have = new Set(friendsHere(dest).filter(u => E.UNITS[u.type].atk > 0 && !E.UNITS[u.type].range).map(u => E.UNITS[u.type].cls));
          v += new Set(movers.filter(u => E.UNITS[u.type].atk > 0 && !E.UNITS[u.type].range && !have.has(E.UNITS[u.type].cls)).map(u => E.UNITS[u.type].cls)).size * 2.5 * K.combo / 3;
        }
        // overseas war: infantry make for a waiting Ark to be carried across
        if (seaborne && arkHexes.length && movers.every(u => !E.isSea(u.type) && E.UNITS[u.type].cls !== 'air')) v += (nearest(k, arkHexes) - nearest(dest, arkHexes)) * 2;
        // mass up: join a friendly stack on the front line so the next push has the numbers
        if (t.owner === pid && (idx[dest] || []).some(u => u.owner === pid) && E.neighbors(dest).some(n => (idx[n] || []).some(u => wary(s, pid, u.owner)))) v += 2.5;
        if (r.kind === 'move' && t.owner === pid && v < 1 && !exposed) continue;   // a step closer to the front is worth taking
        let near = 0; for (const n of E.neighbors(dest)) for (const u of idx[n] || []) if (wary(s, pid, u.owner)) near += E.unitAtk(s, u);
        const friends = (idx[dest] || []).filter(u => u.owner === pid).reduce((a, u) => a + E.unitDef(s, u), 0);
        if (near > (myDefHere + friends) * 1.6) v -= 4 + near / 4 * K.guard;   // don't walk alone into a stronger enemy's reach
        // massing: close on the war target together, joining friendly stacks on the way rather than trickling in
        if (strat.goal.length && friends && (stuck || near) && E.stackFits(idx[dest].filter(u => u.owner === pid), movers)) v += 2 + Math.min(4, friends / 4) * K.guard;
        if (movers.some(u => E.UNITS[u.type].heli) && !movers.some(u => u.type === 'grunt')) v -= heliDanger(s, pid, idx, dest) * 1.5 * K.heli;   // helicopters keep away from AA and riflemen
        if (az && az[dest]) v -= (3 + stackValue(movers) * 0.5) * az[dest].length * (K.heli || 1);
      }
      v += Math.random() * K.noise;
      if (v > bv) { bv = v; best = dest; }
    }
    if (!split) mem.skip.add(k);
    if (Math.random() < K.idle) continue;
    if (best) { const a = tryOnce({ a: 'move', from: k, units: ids, to: best }); if (a) return a; }
  }

  // 5. infrastructure: bridges over narrow straits, forward base, and a port when the sea is the only way forward
  if (stuck && !mem.bridgeTried && p.cash >= E.structCost(p, 'bridge') + 2) {
    mem.bridgeTried = true;
    const spots = E.buildHexes(s, pid, 'bridge');
    if (spots.length) { const b_ = tryOnce({ a: 'build', struct: 'bridge', hex: spots.sort((a, b) => nearest(a, targets) - nearest(b, targets))[0] }); if (b_) return b_; }
  }
  // a river between our army and the war's target (its HQ, or its land): bridge it where the crossing is shortest
  // (one at a time, as it takes a turn to build, unless money is no object)
  if (strat.goal.length && !seaborne && !mem.crossTried && p.cash >= E.structCost(p, 'bridge') + 2 && (p.cash >= E.structCost(p, 'bridge') * 3 + (s.turn.income || 0) * 0.3 || !Object.values(tiles).some(t => t.river && E.structsOf(t).some(x => x.type === 'bridge' && x.owner === pid && x.lock)))) {
    mem.crossTried = true;
    const sp = E.spawnPoints(s, pid), army = [...new Set(Object.values(s.units).filter(u => u.owner === pid && !E.isSea(u.type) && E.UNITS[u.type].cls !== 'air' && E.isLandTile(tiles[u.hex])).map(u => u.hex))];
    const home = walkField('home+', (sp.length ? sp : [p.hq]).concat(army)), there = walkField(strat.hq ? 'hqDry' : 'goal', strat.hq ? [strat.hq] : strat.goal);
    if (!Object.keys(home).some(k => k in there)) {
      let best = null, bv = 1e9;
      for (const k of E.buildHexes(s, pid, 'bridge')) { if (!tiles[k].river) continue; const ns = E.neighbors(k), a = Math.min(...ns.map(n => n in home ? home[n] : 1e3)), b = Math.min(...ns.map(n => n in there ? there[n] : 1e3)); const v = a >= 1e3 ? 1e9 : a + (b >= 1e3 ? 60 + nearest(k, strat.goal) : b); if (v < bv) { bv = v; best = k; } }
      if (best) { const b_ = tryOnce({ a: 'build', struct: 'bridge', hex: best }); if (b_) return b_; }
    }
  }
  // vehicles can't ford rivers: bridge the river hex nearest the front when we field them
  if (!mem.riverTried && p.cash >= E.structCost(p, 'bridge') + 4 && p.arsenal.some(t => ['veh', 'art'].includes(E.UNITS[t].cls))) {
    mem.riverTried = true;
    const spots = E.buildHexes(s, pid, 'bridge').filter(k => tiles[k].river).sort((a, b) => nearest(a, targets) - nearest(b, targets));
    if (spots[0] && nearest(spots[0], enemyTiles.length ? enemyTiles : targets) <= 5) { const b_ = tryOnce({ a: 'build', struct: 'bridge', hex: spots[0] }); if (b_) return b_; }
  }
  const myPorts = Object.keys(tiles).filter(k => tiles[k].owner === pid && tiles[k].struct && tiles[k].struct.type === 'port');
  // sea prizes (rigs, fishing grounds, treasure islands) near our coast make a port worth it too
  const seaPrize = supLand.some(k => E.isCoastal(s, k) && E.area(k, 4).some(n => { const w = tiles[n]; return w && w.owner !== pid && ((E.isWater(w) && (w.res || w.fish)) || (!E.isWater(w) && w.poi && !w.owner && ['relic', 'cache', 'ruins'].includes(w.poi))); }));
  const wantsNavy = navalNeed || p.arsenal.some(t => E.isSea(t) && t !== 'ark') || (seaPrize && s.turn.round >= 3) || (PL.navy && s.turn.round >= 2);
  if (wantsNavy && !myPorts.length && p.cash >= E.structCost(p, 'port') && !mem.portTried) {
    mem.portTried = true;
    let best = null, bv = 99;
    for (const k of supLand) { const t = tiles[k]; if (t.struct || t.contam || !E.isCoastal(s, k)) continue; const v = nearest(k, targets.length ? targets : enemyTiles); if (v < bv) { bv = v; best = k; } }
    if (best) { const b_ = tryOnce({ a: 'build', struct: 'port', hex: best }); if (b_) return b_; }
  }
  if (myPorts.length && !mem.mineTried && p.cash >= E.structCost(p, 'mine') + 6) {
    mem.mineTried = true;
    const enemyShips = Object.values(s.units).filter(u => u.owner !== pid && E.isSea(u.type) && !E.isAlly(s, pid, u.owner));
    if (enemyShips.length) {
      const cands = Object.keys(tiles).filter(k => { const t = tiles[k]; return E.isWater(t) && t.owner === pid && sup.has(k) && !E.structsOf(t).length && myPorts.some(pk => E.dist(pk, k) <= 2); });
      cands.sort((a, b) => Math.min(...enemyShips.map(u => E.dist(u.hex, a))) - Math.min(...enemyShips.map(u => E.dist(u.hex, b))));
      if (cands[0] && Math.min(...enemyShips.map(u => E.dist(u.hex, cands[0]))) <= 6) { const b_ = tryOnce({ a: 'build', struct: 'mine', hex: cands[0] }); if (b_) return b_; }
    }
  }
  const owns = type => Object.keys(tiles).filter(k => tiles[k].owner === pid && tiles[k].struct && tiles[k].struct.type === type).length;
  if (!mem.upTried && p.cash >= (PL.build && PL.build.economy ? 12 : 20)) {
    mem.upTried = true;
    const ups = Object.keys(tiles).filter(k => { const t = tiles[k]; return t.owner === pid && t.struct && ['warehouse', 'refinery'].includes(t.struct.type) && (t.struct.lvl || 1) < 3 && sup.has(k); });
    const k = ups.sort((a, b) => (tiles[a].struct.lvl || 1) - (tiles[b].struct.lvl || 1))[0];
    if (k && p.cash >= E.buildCost(s, p, tiles[k].struct.type, k) + 6) { const b_ = tryOnce({ a: 'build', struct: tiles[k].struct.type, hex: k }); if (b_) return b_; }
  }
  if (!mem.hqTried && tiles[p.hq].owner === pid && enemyNear(p.hq, 3) && tiles[p.hq].struct && tiles[p.hq].struct.type === 'hq' && (tiles[p.hq].struct.lvl || 1) < 3) {
    mem.hqTried = true;
    if (p.cash >= E.buildCost(s, p, 'hq', p.hq) + 3) { const b_ = tryOnce({ a: 'build', struct: 'hq', hex: p.hq }); if (b_) return b_; }
  }
  // airbases: one once the war is under way (more as it drags on), well back from the front; upgrade them when rich
  if (!mem.airTried && s.turn.round >= 5) {
    mem.airTried = true;
    const mine = Object.keys(tiles).filter(k => { const ab = E.structsOf(tiles[k]).find(x => x.type === 'airbase'); return ab && ab.owner === pid && tiles[k].owner === pid; });
    const up = mine.filter(k => { const ab = E.structsOf(tiles[k]).find(x => x.type === 'airbase'); return !ab.lock && (ab.lvl || 1) < 3 && sup.has(k); })[0];
    if (up && p.cash >= E.buildCost(s, p, 'airbase', up) + 8 + s.turn.income * 0.15) { const b_ = tryOnce({ a: 'build', struct: 'airbase', hex: up }); if (b_) return b_; }
    if (mine.length < 1 + Math.floor(s.turn.round / 20) && p.cash >= E.structCost(p, 'airbase') + 10) {
      const ok = new Set(E.buildHexes(s, pid, 'airbase'));
      const spot = supLand.filter(k => ok.has(k) && !mine.includes(k) && !E.structsOf(tiles[k]).some(x => x.type === 'airbase') && !enemyNear(k, 3)).sort((a, b) => nearest(b, enemyTiles) - nearest(a, enemyTiles))[0];
      if (spot) { const b_ = tryOnce({ a: 'build', struct: 'airbase', hex: spot }); if (b_) return b_; }
    }
  }
  if (p.diff !== 'easy' && !mem.wareTried && p.cash >= E.structCost(p, 'warehouse') + 4 && owns('warehouse') < (p.faction === 'verdant' ? 2 + Math.floor(s.turn.round / 6) : 1 + Math.floor(s.turn.round / 10))) {   // Verdant: every building pays
    mem.wareTried = true;
    const spot = rearSpot(supLand.filter(k => !tiles[k].struct && !tiles[k].contam));
    if (spot) { const b_ = tryOnce({ a: 'build', struct: 'warehouse', hex: spot }); if (b_) return b_; }
  }
  if (!mem.depotTried && p.cash >= E.structCost(p, 'depot') + 6 && owns('depot') < 1 && s.turn.round > 4) {
    mem.depotTried = true;
    const spot = supLand.filter(k => !tiles[k].struct && !tiles[k].contam && fromFoe(k) >= 2).sort((a, b) => Math.abs(fromFoe(a) - 3) - Math.abs(fromFoe(b) - 3))[0];   // staging distance, not on the line
    if (spot && enemyTiles.length) { const b_ = tryOnce({ a: 'build', struct: 'depot', hex: spot }); if (b_) return b_; }
  }
  // FOBs: one a turn, and a second when money is piling up (troops need somewhere forward to deploy)
  if (p.cash >= E.structCost(p, 'fob') + 3 && (mem.fobTried || 0) < (p.cash >= E.structCost(p, 'fob') * 3 + (s.turn.income || 0) * 0.5 ? 2 : 1) && !stuck) {
    mem.fobTried = (mem.fobTried || 0) + 1;
    const bases = E.spawnPoints(s, pid);
    const gField = strat.goal.length ? walkField('goal', strat.goal) : null, gBase = gField ? Math.min(99, ...bases.map(b => b in gField ? gField[b] : 99)) : 0;
    let best = null, bv = -1;
    for (const k of supLand) {
      const t = tiles[k]; if (t.struct || t.contam) continue;
      if (E.area(k, 2).some(a => tiles[a] && tiles[a].struct && ['hq', 'fob'].includes(tiles[a].struct.type))) continue;
      const far = Math.min(...bases.map(b => E.dist(b, k)));
      if (far < 4) continue;
      const fr = E.neighbors(k).filter(n => tiles[n] && E.isLandTile(tiles[n]) && !tiles[n].owner).length;   // neutral land to grow into
      const df = fromFoe(k);
      if (df <= 1) continue;   // never on the front line: it'd be the first thing lost
      let v = far * 0.7 + fr * 1.2 - (df === 2 ? 2 : df > 5 ? (df - 5) * 0.8 : 0);
      // on the road to the war: reinforcements that start nearer the target's HQ get there while it still matters
      if (gField && k in gField) v += Math.max(0, gBase - gField[k]) * 0.9;
      if (v > bv) { bv = v; best = k; }
    }
    if (best) { const b_ = tryOnce({ a: 'build', struct: 'fob', hex: best }); if (b_) return b_; }
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
  // battle cards are paid for when the fight starts: keep the price of the two cheapest in hand (they win HQ assaults)
  const keep = Math.min(Math.round((s.turn.income || 0) * 0.5), p.tactics.filter(c => E.TACTICS[c.id].target === 'battle').map(c => E.TACTICS[c.id].cost).sort((a, b) => a - b).slice(0, 2).reduce((a, b) => a + b, 0));
  const options = p.arsenal.filter(t => E.unitCost(p, t) <= p.cash - (t === 'ark' ? 0 : keep) && E.deployHexes(s, pid, t, idx).some(h => !(mem.badHex && mem.badHex.has(h))))
    .filter(t => t !== 'ark' || (navalNeed && myArks < Math.min(6, 1 + Math.floor(landUnits / 8)) && !mine.some(u => u.type === 'ark' && !mine.some(x => x.hex === u.hex && !E.isSea(x.type)))))   // a big army stranded on an island needs a fleet of transports (but not while one waits empty)
    .filter(t => !E.isSea(t) || t === 'ark' || (t === 'carrier' && !mine.some(u => u.type === 'carrier') && p.arsenal.some(x => E.UNITS[x].cls === 'air')) || (PL.navy ? warships < landUnits && Math.random() < 0.85 : warships < landUnits / 2 && Math.random() < 0.5));
  if (options.length) {
    // counter what the enemy fields: anti-air against air power, tank hunters against armour, siege against forts
    const mix = (() => {
      const land = mine.filter(u => !E.isSea(u.type) && E.UNITS[u.type].atk > 0 && !E.UNITS[u.type].aa), n = Math.max(1, land.length);
      const kinds = ['inf', 'veh', 'air'].filter(c => p.arsenal.some(t => E.UNITS[t].cls === c && !E.UNITS[t].range && !E.UNITS[t].aa && E.UNITS[t].atk >= 2));
      const melee = {}, fighters = land.filter(u => !E.UNITS[u.type].range); for (const c of kinds) melee[c] = fighters.filter(u => E.UNITS[u.type].cls === c).length / Math.max(1, fighters.length);
      return { gun: land.filter(u => E.UNITS[u.type].range).length / n, slow: land.filter(u => E.UNITS[u.type].mv <= 1 && E.UNITS[u.type].cls !== 'air').length / n, melee, ideal: 1 / Math.max(1, kinds.length) };
    })();
    const counter = t => { const d = E.UNITS[t]; let b = 0;
      // anti-air only earns its keep against aircraft: none seen means don't buy it, and don't outnumber them
      if (d.aa) { const ownAA = mine.filter(u => E.UNITS[u.type].aa).length; b += !strat.seen.air ? -4 : ownAA >= strat.seen.air * 1.5 ? -2 : Math.min(3, strat.seen.air * 0.6); }
      if (d.ability === 'hunter') b += Math.min(1.6, strat.seen.veh * 0.25);
      // a carrier is only worth it with aircraft to fly off it (and pays off most in a war across the sea)
      if (t === 'carrier') b += p.arsenal.some(x => E.UNITS[x].cls === 'air') ? 2 + (navalNeed ? 2 : 0) : -6;
      if (['siege', 'titan'].includes(d.ability)) b += Math.min(1.5, strat.seen.fort * 0.5);
      const pc = (PL.cls || {})[d.cls]; if (pc) b += pc * 0.6;
      // play to the faction: Volt's aircraft are cheaper and stronger, Ashen's Skitters cheap land-grabbers, Iron holds ground
      if (p.faction === 'volt' && d.cls === 'air') b += 1.4;
      if (p.faction === 'ashen' && (t === 'skitter' || d.mv >= 4)) b += t === 'skitter' ? 1.2 : 0.5;
      if (p.faction === 'iron') b += d.def * 0.12;
      if (PL.def) b += d.def * PL.def * 0.15;
      // a balanced army: guns can't take ground (a gun in close combat is just its crew), so they stay about a third of it at most,
      // and of the troops that do the taking (infantry, armour, aircraft) buy whichever kind we're short of. An attack that
      // brings three kinds gets Combined Arms (up to +2 Mult), and the bot plans its blows around that
      if (d.range && !d.aa) b -= Math.max(0, mix.gun - (K.gunCap || 0.35)) * (K.capSlope || 40);
      // the heavy tanks crawl a hex a turn: a quarter of the army at most, or the war is over before they reach it
      if (d.mv <= 1 && d.cls !== 'air') b -= Math.max(0, mix.slow - (K.slowCap || 0.25)) * (K.capSlope || 40);
      else if (!d.aa && d.atk >= 2 && mix.melee[d.cls] !== undefined) b += (mix.ideal - mix.melee[d.cls]) * 5 * Math.min(1, d.atk / 4);
      // guns need a base near the fighting: without one they'd spend the war walking to it
      if (d.range && !d.aa && !E.isSea(t) && d.cls !== 'air' && !E.spawnPoints(s, pid).some(sp => nearest(sp, enemyTiles) <= d.range + 3)) b -= 2.5;
      return b; };
    // what to buy: early on, punch per dollar; once money is plentiful, punch per slot (a hex only holds 5).
    // Under pressure, sturdiness counts double
    // a long march to the war: slow juggernauts arrive after it's over, so speed counts for more
    const march = (gf0 => Math.min(99, ...E.spawnPoints(s, pid).map(sp => sp in gf0 ? gf0[sp] : 99)))(walkField('deploy', strat.goal.length ? strat.goal : enemyTiles.length ? enemyTiles : targets));
    const far = march >= 8, mvW = Math.max(0.4, Math.min(2.2, (march - 2) / 4));   // the further the march, the more speed is worth
    const rich = Math.min(1, (s.turn.income || 0) / 45), pressed = Object.values(mem.threat || {}).reduce((a, v) => Math.max(a, v), 0) > 0;
    const worth = t => { const d = E.UNITS[t], lv = (p.levels[t] || 0), a = d.atk + (d.atk ? lv : 0), df = d.def + lv, c = E.unitCost(p, t);
      const aa = !!d.aa;   // anti-air: only its crew's small arms count against ground, and its range is only for aircraft
      const power = (aa ? 1 : a) * (pressed ? 0.8 : 1.1) + df * (pressed ? 1.3 : 0.8) + Math.min(d.mv, 5) * mvW - (d.mv <= 1 && far && d.cls !== 'air' ? 4 : 0) + (d.range && !aa ? 2 : 0);
      return (power / c) * 3 * (1 - rich) + (power / 4) * rich; };
    const scored = options.map(t => [t, (t === 'ark' ? 9 : K.deploy2 === false ? unitValue(t) / Math.sqrt(E.unitCost(p, t)) + (E.unitCost(p, t) >= 5 ? 0.6 : 0) : worth(t)) + counter(t) + Math.random() * 0.5]).sort((a, b) => b[1] - a[1]);
    const type = scored[0][0];
    const hexes = E.deployHexes(s, pid, type, idx).filter(h => !(mem.badHex && mem.badHex.has(h)));
    if (!hexes.length) return { a: 'end' };
    const goal = strat.goal.length ? strat.goal : enemyTiles.length ? enemyTiles : targets;
    let bs = hexes[0], bd = 99;
    const gf = walkField('deploy', goal);
    const flier = E.UNITS[type].cls === 'air', gun = E.UNITS[type].range && !E.UNITS[type].aa && !E.isSea(type) && !flier;   // aircraft fly: straight-line distance (and a carrier off the enemy coast is the closest start)
    // guns deploy at the base just behind the front
    for (const sp of hexes) { const md = (gun ? (d0 => d0 <= 1 ? 50 : Math.max(0, d0 - (E.UNITS[type].range + 1)))(nearest(sp, enemyTiles)) : flier ? nearest(sp, goal) : sp in gf ? gf[sp] : nearest(sp, goal) + 20) - (strat.danger[sp] ? 6 + strat.danger[sp] / 3 : 0); if (md < bd) { bd = md; bs = sp; } }
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
  const pl = playOf(p), ruthless = ({ easy: 0.4, medium: 0.7, hard: 1, impossible: 1.25 }[p.diff] || 0.7) + (pl.ruthless || 0);
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
      if (!plotting && stillUseful && E.blocOf(s, pid).size <= E.blocCap(s)) return { a: 'allyRenew', with: o };
    }
    if (held >= 3 && (threatGone || weakAlly || lastTwo) && (mem.betrayRoll = mem.betrayRoll ?? Math.random()) < 0.5 * ruthless) {
      // a smart traitor strikes when it can: mass troops on the border first, break once the knife is in reach
      const bm = botMem(s, pid);
      if (!bm.plot || bm.plot.vs !== o) bm.plot = { vs: o, since: s.turn.round };
      if (betrayReady(s, pid, o, p.diff)) { delete bm.plot; return { a: 'allyBreak', with: o }; }
    }
  }
  if (alive.length <= 2 || p.traitor || s.allyOffer || pacts.length >= 2 || s.turn.round < (pl.diplo ? 2 : 4)) return null;
  if ((mem.offered || 0) > 0 || (p._offerRound && s.turn.round - p._offerRound < 3)) return null;
  if (!lead || th[lead] < mine * (pl.diplo ? 0.9 : 1.25)) return null;
  // ask the friendliest commander who isn't the leader and isn't already on our side
  let best = null, bm = -31;
  for (const q of alive) {
    if (q.id === pid || q.id === lead || q.traitor || E.isAlly(s, pid, q.id) || E.blocTooBig(s, pid, q.id)) continue;
    const m = E.moodOf(s, pid, q.id) + (th[q.id] < th[lead] ? 10 : 0);
    if (m > bm) { bm = m; best = q.id; }
  }
  if (!best) return null;
  mem.offered = 1; p._offerRound = s.turn.round;
  return { a: 'allyOffer', to: best };
}
// battle cards: in an open battle, throw in the card that moves the odds the most per dollar, if the fight is worth it
// (a sure win or a hopeless fight isn't worth a card; easier bots spot fewer chances and save less carefully)
function battlePick(s, pid) {
  const b = s.battle, p = E.player(s, pid); if (!b || !p) return null;
  const hand = E.battleHand(s, pid); if (!hand.length) return null;
  const K = SKILL[p.diff] || SKILL.medium;
  if (Math.random() > K.tactics) return null;
  const side = b.att === pid ? 'att' : 'def', mine = c => side === 'att' ? c.winProb : 1 - c.winProb;
  const base = E.battleOdds(s); if (!base) return null;
  const now = mine(base);
  if (now >= 0.98) return null;
  // what's riding on it: the units on both sides, more for an HQ or a base
  const stake = base.defenders.concat(b.units.map(id => s.units[id]).filter(Boolean)).reduce((a, u) => a + E.UNITS[u.type].cost, 0)
    + (E.structsOf(s.map.tiles[b.hex]).some(x => x.type === 'hq') ? 40 : 0) + (E.structsOf(s.map.tiles[b.hex]).length ? 8 : 0);
  let best = null;
  for (const c of hand) {
    b.cards[side].push(c.id); const o = E.battleOdds(s); b.cards[side].pop();
    const gain = mine(o) - now, cost = E.TACTICS[c.id].cost;
    const worth = gain * stake - cost * (1.2 + (p.cash < 6 ? 2 : 0)) + (Math.random() - 0.5) * K.noise;
    const bold = playOf(p).cards;   // a Wildcard throws cards in on a whim
    if (gain >= (bold ? 0.03 : 0.06) && (worth > 0 || (bold && Math.random() < 0.35)) && (!best || worth > best.worth)) best = { uid: c.uid, worth };
  }
  return best ? best.uid : null;
}
module.exports = { botStep, battlePick, draftStep, spawnStep, tradeReply, allyReply, BOT_NAMES };
