// Every scenario must be solvable: play each one's intended solution through the real engine. node tools/test-scenarios.js [id]
const E = require('../shared/engine'), SC = require('../shared/scenarios');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const HERO = 'hero';
// a tiny driver: the hero's moves by hex label; enemies with ai 'passive' just end their turn, others use the bot
const { botStep } = require('../shared/bot');
function game(id) {
  const s = SC.build(id, HERO, 'Hero'), L = s.scenario.labels, at = l => L[l] || l;
  const unitsAt = (l, pid = HERO) => Object.values(s.units).filter(u => u.hex === at(l) && u.owner === pid);
  const ready = (l, types) => unitsAt(l).filter(u => (!types || types.includes(u.type)) && E.canAct(s, u));
  const rng = () => 0.5;
  const act = (a, quiet) => {
    const r = E.applyAction(s, HERO, a, rng);
    if (!r.ok && !quiet) console.log('     ✗ ' + JSON.stringify(a) + ': ' + r.err);
    return r;
  };
  const g = {
    s, at, unitsAt,
    move(from, to, types) { const ids = ready(from, types).map(u => u.id); return act({ a: 'move', from: at(from), units: ids, to: at(to) }); },
    assault(to, ...groups) { return act({ a: 'assault', to: at(to), groups: groups.map(([from, types]) => ({ from: at(from), units: ready(from, types).map(u => u.id) })) }); },
    fire(from, to, types) { return act({ a: 'fire', from: at(from), units: unitsAt(from).filter(u => !types || types.includes(u.type)).map(u => u.id), to: at(to) }); },
    deploy(unit, hex) { return act({ a: 'deploy', unit, hex: at(hex) }); },
    build(struct, hex) { return act({ a: 'build', struct, hex: at(hex) }); },
    tactic(id, target) { const c = E.player(s, HERO).tactics.find(x => x.id === id); return act({ a: 'tactic', uid: c && c.uid, target: target && at(target) }); },
    odds(to, ...groups) { const us = groups.flatMap(([from, types]) => unitsAt(from).filter(u => !types || types.includes(u.type))); return E.combatCalc(s, HERO, us, groups.map(([f]) => at(f)), at(to), false).winProb; },
    end() {
      act({ a: 'end' });
      // the enemies' turns
      for (let guard = 0; guard < 400 && s.phase === 'play' && E.current(s).id !== HERO; guard++) {
        const cur = E.current(s);
        const a = cur.scenarioAI === 'passive' ? { a: 'end' } : botStep(s, cur.id, (g.mem[cur.id + s.turn.round] = g.mem[cur.id + s.turn.round] || { n: 0 }));
        const r = E.applyAction(s, cur.id, (g.mem[cur.id + s.turn.round] || {}).n > 80 ? { a: 'end' } : a, Math.random);
        if (!r.ok) E.applyAction(s, cur.id, { a: 'end' });
      }
    },
    mem: {},
    won: () => s.phase === 'over' && s.winner.pid === HERO,
  };
  return g;
}
// a situation (a live war on a bigger board): the hero is played by a plain, goal-aware plan (below), many times. It must
// be winnable that way a fair share of the time (a person plans better), and lost by doing nothing
// the plan: take income; keep a garrison on every hex it must hold (and bunker it); spend cash on the best unit it can
// afford at the deploy point nearest the objective; attack an objective when the combined odds are good, else march on it
function heroPlan(s, mem) {
  const me = HERO, sc = s.scenario, p = E.player(s, me), U = () => Object.values(s.units);
  if (s.turn.stage === 'choose') return { a: 'choose', pick: 'income' };
  const foes = s.players.filter(q => q.id !== me && q.alive).map(q => q.id);
  const goals = sc.goal.type === 'eliminate' ? foes.map(f => E.player(s, f).hq).filter(Boolean) : sc.goal.type === 'survive' ? [] : (sc.goal.hexes || []).filter(k => s.map.tiles[k].owner !== me);
  const hold = [...new Set([...(sc.keep || []), ...(sc.goal.type === 'survive' ? sc.goal.hexes : []), p.hq].filter(Boolean))];
  const mine = k => U().filter(u => u.hex === k && u.owner === me);
  const ready = k => mine(k).filter(u => E.canAct(s, u) && E.UNITS[u.type].cls !== 'art');
  mem.step = (mem.step || 0) + 1; if (mem.step > 80) return { a: 'end' };
  // 1. bunkers on the hexes to hold
  for (const k of hold) if (!mem['b' + k] && p.cash >= E.buildCost(s, p, 'bunker', k) + 2) { mem['b' + k] = 1; const r = { a: 'build', struct: 'bunker', hex: k }; if (E.buildHexes(s, me, 'bunker').includes(k)) return r; }
  // 2. artillery: shell anything in range around the objectives first
  for (const u of U().filter(u => u.owner === me && E.UNITS[u.type].range && E.canAct(s, u))) {
    const tg = E.rangedTargets(s, me, [u.id], u.hex).sort((a, b) => Math.min(...goals.map(g => E.dist(a, g)), 9) - Math.min(...goals.map(g => E.dist(b, g)), 9))[0];
    if (tg && !mem['f' + u.id]) { mem['f' + u.id] = 1; return { a: 'fire', from: u.hex, units: [u.id], to: tg }; }
  }
  // 3. attack an objective with every stack that can reach it, if the odds are good
  for (const g of goals) {
    const from = [...new Set(U().filter(u => u.owner === me && E.canAct(s, u) && !hold.includes(u.hex)).map(u => u.hex))].filter(k => { const r = E.reachable(s, me, ready(k).map(u => u.id), k); return r[g] && (r[g].kind === 'attack' || r[g].kind === 'capture' || r[g].kind === 'move'); });
    if (!from.length) continue;
    const units = from.flatMap(k => ready(k));
    const odds = E.combatCalc(s, me, units, from, g, false).winProb;
    if (odds >= 0.55 || s.map.tiles[g].owner == null || !U().some(u => u.hex === g)) return from.length > 1 ? { a: 'assault', to: g, groups: from.map(k => ({ from: k, units: ready(k).map(u => u.id) })) } : { a: 'move', from: from[0], units: ready(from[0]).map(u => u.id), to: g };
  }
  // 4. deploy: guards first for a hex to hold that's thin, then troops at the deploy point nearest an objective
  const spots = E.deployHexes(s, me, 'grunt');
  const thin = hold.find(k => spots.includes(k) && mine(k).length < 6);
  const best = ['mauler', 'lancer', 'jackal', 'grunt'].find(t => p.arsenal.includes(t) && p.cash >= E.unitCost(p, t));
  if (best && spots.length) {
    const at = thin || spots.slice().sort((a, b) => Math.min(...goals.map(g => E.dist(a, g)), 99) - Math.min(...goals.map(g => E.dist(b, g)), 99))[0];
    if (E.deployHexes(s, me, best).includes(at)) return { a: 'deploy', unit: best, hex: at };
    if (p.cash >= 2 && E.deployHexes(s, me, 'grunt').includes(at)) return { a: 'deploy', unit: 'grunt', hex: at };
  }
  // 5. march: stacks not guarding go toward the nearest objective (leaving at least 3 on a hex to hold)
  // (only in groups of three or more, and never next to an enemy stack bigger than the group)
  const enemyNear = k => Math.max(0, ...E.neighbors(k).map(n => U().filter(u => u.hex === n && foes.includes(u.owner)).length));
  for (const k of [...new Set(U().filter(u => u.owner === me && E.canAct(s, u)).map(u => u.hex))]) {
    let us = ready(k); if (hold.includes(k)) us = us.slice(4); if (us.length < 3 || !goals.length) continue;
    const r = E.reachable(s, me, us.map(u => u.id), k), tgt = goals.slice().sort((a, b) => E.dist(k, a) - E.dist(k, b))[0];
    const dest = Object.keys(r).filter(x => (r[x].kind === 'move' || r[x].kind === 'capture') && enemyNear(x) <= us.length + mine(x).length).sort((a, b) => E.dist(a, tgt) - E.dist(b, tgt))[0];
    if (dest && E.dist(dest, tgt) < E.dist(k, tgt) && !mem['m' + k + us[0].id]) { mem['m' + k + us[0].id] = 1; return { a: 'move', from: k, units: us.map(u => u.id), to: dest }; }
  }
  return { a: 'end' };
}
function situation(id, runs = 16) {
  const play = active => {
    const s = SC.build(id, HERO, 'Hero'), mem = {};
    for (let guard = 0; guard < 8000 && s.phase === 'play'; guard++) {
      const cur = E.current(s), key = cur.id + ':' + s.turn.round;
      const m = mem[key] = mem[key] || { n: 0 };
      let a;
      if (process.env.SITTRACE && active && cur.id === HERO && !m.traced) { m.traced = 1; const by = o => { const st = {}; for (const u of Object.values(s.units)) if (u.owner === o) st[u.hex] = (st[u.hex] || '') + u.type[0]; return JSON.stringify(st); };
        console.log(`  r${s.turn.round} $${E.player(s, HERO).cash} hero ${by(HERO)} | foe ${s.players.filter(q => q.id !== HERO).map(q => by(q.id) + ' $' + q.cash).join(' ')} | goal ${s.scenario.goal.hexes.map(k => k + ':' + (s.map.tiles[k].owner || '-')).join(',')}`); }
      if (cur.id === HERO) a = active ? heroPlan(s, m) : (s.turn.stage === 'choose' ? { a: 'choose', pick: 'income' } : { a: 'end' });
      else a = cur.scenarioAI === 'passive' || m.n++ > 120 ? (s.turn.stage === 'choose' ? { a: 'choose', pick: 'income' } : { a: 'end' }) : botStep(s, cur.id, m);
      const r = E.applyAction(s, cur.id, a || { a: 'end' }, Math.random);
      if (!r.ok) { if (cur.id === HERO) m.step = (m.step || 0) + 5; const r2 = cur.id === HERO ? { ok: true } : E.applyAction(s, cur.id, s.turn.stage === 'choose' ? { a: 'choose', pick: 'income' } : { a: 'end' }, Math.random); if (!r2.ok) E.applyAction(s, cur.id, { a: 'end' }, Math.random); }
    }
    return { won: s.phase === 'over' && s.winner.pid === HERO && !s.winner.failed, why: s.winner ? s.winner.failed || s.winner.reason : 'unfinished' };
  };
  let wins = 0, idle = 0; const why = {};
  for (let i = 0; i < runs; i++) { const r = play(true); if (r.won) wins++; else why[r.why] = (why[r.why] || 0) + 1; if (play(false).won) idle++; }
  console.log('     a plain plan won ' + wins + '/' + runs + (Object.keys(why).length ? ' (lost: ' + Object.entries(why).map(([k, v]) => k + ' ×' + v).join(', ') + ')' : '') + '; doing nothing won ' + idle + '/' + runs);
  return { won: wins >= Math.ceil(runs * 0.3) && idle === 0, wins, idle };
}
const SOLUTIONS = {
  pincer(g) {
    const one = g.odds('obj', ['a']), both = g.odds('obj', ['a'], ['b']);
    console.log('     odds: one squad ' + Math.round(one * 100) + '%, pincer ' + Math.round(both * 100) + '%');
    return g.assault('obj', ['a'], ['b']);
  },
  river(g) {
    g.build('bridge', 'x'); g.move('g', 'z'); g.end();   // the bridge opens next turn
    g.move('m', 'y'); g.end();
    console.log('     odds: tank alone ' + Math.round(g.odds('obj', ['y']) * 100) + '%, together ' + Math.round(g.odds('obj', ['y'], ['z']) * 100) + '%');
    return g.assault('obj', ['y'], ['z']);
  },
  airborne(g) {
    g.move('s', 'lz'); g.end();
    console.log('     odds: ' + Math.round(g.odds('obj', ['lz']) * 100) + '%');
    return g.assault('obj', ['lz']);
  },
  leapfrog(g) {
    g.move('w1', 'd1', ['grunt']); g.move('w1', 'd2', ['jackal']);
    return g.move('w3', 'obj');
  },
  blitz(g) {
    g.fire('art', 'guard'); g.move('tank', 'stage'); g.move('heli', 'lz'); g.end();
    console.log('     odds: helicopter ' + Math.round(g.odds('bhq', ['lz']) * 100) + '%, tanks ' + Math.round(g.odds('bhq', ['stage']) * 100) + '%, both ' + Math.round(g.odds('bhq', ['lz'], ['stage']) * 100) + '%');
    const p = E.player(g.s, HERO), withCards = ids => { p.ready = ids; const o = Math.round(g.odds('bhq', ['lz'], ['stage']) * 100); p.ready = []; return o; };
    console.log('     Rally ' + withCards(['rally']) + '%, Barrage ' + withCards(['barrage']) + '%, Bayonets ' + withCards(['bayonets']) + '%, Rally + Bayonets ' + withCards(['rally', 'bayonets']) + '%, Rally + Barrage ' + withCards(['rally', 'barrage']) + '%');
    g.tactic('rally'); g.tactic('barrage');
    return g.assault('bhq', ['lz'], ['stage']);
  },
  endgame(g) {
    // order matters: the tanks clear the bridge before the Ark can sail under it; the guns open the sky for the Buster
    g.fire('art', 'aa'); g.move('sh', 'br'); g.move('n', 'c2'); g.end();
    g.move('br', 'gate'); g.move('c2', 'lz', ['grunt']); g.end();
    g.tactic('buster', 'bhq');
    console.log('     odds: no cards ' + Math.round(g.odds('bhq', ['lz'], ['gate']) * 100) + '%');
    g.tactic('rally'); g.tactic('bayonets');
    console.log('     odds: Rally + Bayonets ' + Math.round(g.odds('bhq', ['lz'], ['gate']) * 100) + '%');
    return g.assault('bhq', ['lz'], ['gate']);
  },
  hold() {
    // a live enemy: play a plain defence many times. It should usually hold, and doing nothing should always lose
    const run = defend => {
      const g = game('hold'), s = g.s, U = l => g.unitsAt(l);
      for (let t = 0; t < 5 && s.phase === 'play'; t++) {
        if (defend) {
          if (t === 0) { g.build('bunker', 'f1'); g.build('bunker', 'f2'); E.applyAction(s, HERO, { a: 'move', from: g.at('hq'), units: U('hq').slice(0, 1).map(u => u.id), to: g.at('r1') }); E.applyAction(s, HERO, { a: 'move', from: g.at('hq'), units: U('hq').slice(1, 2).map(u => u.id), to: g.at('r2') }); }
          else {
            for (const [r, f] of [['r1', 'f1'], ['r2', 'f2']]) { const us = U(r).filter(u => !u.fresh); if (us.length) E.applyAction(s, HERO, { a: 'move', from: g.at(r), units: us.map(u => u.id), to: g.at(f) }); }
            const ready = U('hq').filter(u => !u.fresh); for (const [i, r] of [[0, 'r1'], [1, 'r2']]) { const us = ready.filter((_, k) => k % 2 === i); if (us.length) E.applyAction(s, HERO, { a: 'move', from: g.at('hq'), units: us.map(u => u.id), to: g.at(r) }); }
          }
          if (t > 0) for (const f of ['f1', 'f2']) E.applyAction(s, HERO, { a: 'build', struct: 'bunker', hex: g.at(f) });   // upgrade the bunkers
          while (E.player(s, HERO).cash >= 2 && E.applyAction(s, HERO, { a: 'deploy', unit: 'grunt', hex: g.at('hq') }).ok);
        }
        g.end();
      }
      return g.won();
    };
    let wins = 0, idle = 0; for (let i = 0; i < 30; i++) { if (run(true)) wins++; if (run(false)) idle++; }
    console.log('     a bunkered defence held ' + wins + '/30; doing nothing held ' + idle + '/30');
    return { won: wins >= 1 && idle === 0 };
  },
  guns(g) {
    const O = (from, to) => { const us = g.unitsAt(from); return Math.round(E.combatCalc(g.s, HERO, us, g.at(from), g.at(to), true).winProb * 100); };
    console.log('     basilisk: ' + ['t1', 't2', 't3', 't4'].map(t => t + ' ' + O('bas', t) + '%').join(' ') + ' · thumper: ' + ['t1', 't2', 't3', 't4'].map(t => t + ' ' + O('thu', t) + '%').join(' '));
    g.fire('bas', 't1'); g.fire('thu', 't3'); g.end();
    g.fire('bas', 't2'); return g.fire('thu', 't4');
  },
  airwing(g) {
    const p = E.player(g.s, HERO), choose = () => { if (g.s.turn.stage === 'choose') E.applyAction(g.s, HERO, { a: 'choose', pick: 'income' }); };
    const foes = () => Object.values(g.s.units).filter(u => u.owner !== HERO);
    g.build('airbase', 'ab'); g.end(); choose(); g.end(); choose();
    const log = [];
    for (let t = 0; t < 4 && foes().length; t++) {
      // the black market's cheapest strike, if there's one
      const m = p.market && p.market.cards.findIndex(c => !c.sold && E.AIR_STRIKES.includes(c.id) && c.price <= p.cash);
      if (m >= 0) E.applyAction(g.s, HERO, { a: 'marketBuy', idx: m });
      for (const c of p.tactics.slice()) {
        if (!E.AIR_STRIKES.includes(c.id) || !foes().length) continue;
        const k = foes()[0].hex, r = E.applyAction(g.s, HERO, { a: 'tactic', uid: c.uid, target: k }, () => 0.5);
        log.push(c.id + (r.ok ? '' : ' ✗ ' + r.err));
      }
      if (foes().length) { g.end(); choose(); }
    }
    console.log('     strikes: ' + log.join(', ') + ' · enemy left ' + foes().length);
    return { won: g.won() || !foes().length };
  },
  skyshield(g) {
    g.fire('sg', 'h2'); g.fire('st', 'h3'); g.move('gr', 'g'); g.end();
    return g.fire('sg', 'h1');
  },
  cards(g) {
    console.log('     odds: grunts ' + Math.round(g.odds('ox', ['x']) * 100) + '%, tanks ' + Math.round(g.odds('oy', ['y']) * 100) + '%');
    g.tactic('bayonets'); g.assault('ox', ['x']);
    g.tactic('rally'); return g.assault('oy', ['y']);
  },
  beach(g) {
    g.move('ark', 's2'); g.move('navy', 's1'); g.end();
    g.move('s2', 'beach', ['grunt']); g.end();
    console.log('     odds: with gunfire ' + Math.round(g.odds('obj', ['beach']) * 100) + '%');
    return g.assault('obj', ['beach']);
  },
  ground() {
    const run = defend => {
      const g = game('ground'), s = g.s;
      for (let t = 0; t < 3 && s.phase === 'play'; t++) {
        if (defend) {
          g.build('bunker', 'fort');
          const spare = g.unitsAt('g').filter(u => !u.fresh); if (spare.length) g.move('g', 'fort');
          const hq = g.unitsAt('hq').filter(u => !u.fresh).slice(2); if (hq.length) E.applyAction(s, HERO, { a: 'move', from: g.at('hq'), units: hq.map(u => u.id), to: g.at('fort') });   // two stay home
          const dig = g.unitsAt('fort').filter(u => !u.moved && !u.fresh); if (dig.length) E.applyAction(s, HERO, { a: 'digin', from: g.at('fort'), units: dig.map(u => u.id) });
          while (E.player(s, HERO).cash >= 2 && E.applyAction(s, HERO, { a: 'deploy', unit: 'grunt', hex: g.at('hq') }).ok);
        }
        g.end();
      }
      return g.won();
    };
    let wins = 0, idle = 0; for (let i = 0; i < 40; i++) { if (run(true)) wins++; if (run(false)) idle++; }
    console.log('     a dug-in, bunkered defence held ' + wins + '/40; doing nothing held ' + idle + '/40');
    return { won: wins >= 34 && idle <= 8 };
  },
  fob(g) {
    g.build('fob', 'front'); g.move('g', 'g'); g.end();
    for (let i = 0; i < 4; i++) g.deploy('grunt', 'front'); g.end();
    console.log('     odds: four Grunts from the FOB ' + Math.round(g.odds('obj', ['front']) * 100) + '%');
    return g.assault('obj', ['front']);
  },
  loot(g) {
    const p = E.player(g.s, HERO);
    g.move('sk', 'fort'); g.move('j', 'ru'); console.log('     after turn 1: $' + p.cash); g.end();
    while (p.cash >= 2 && g.deploy('grunt', 'fort').ok);
    g.move('fort', 'relic', ['skitter']); g.move('ru', 'cache'); console.log('     turn 2: $' + p.cash + ', cards ' + p.tactics.map(c => c.id).join(',')); g.end();
    console.log('     odds on the village: ' + Math.round(g.odds('vil', ['fort', ['grunt']], ['cache']) * 100) + '%');
    return g.assault('vil', ['fort', ['grunt']], ['cache']);
  },
  air(g) {
    const s = g.s, cardOf = id => E.player(s, HERO).tactics.find(c => c.id === id);
    const tryDrop = lz => { const c = JSON.parse(JSON.stringify(s)); const card = E.player(c, HERO).tactics.find(x => x.id === 'heli'); return E.applyAction(c, HERO, { a: 'tactic', uid: card.uid, from: g.at('g'), target: g.at(lz) }); };
    const north = tryDrop('lz1'), south = tryDrop('lz2');
    console.log('     heli drop: north clearing ' + (north.ok ? 'allowed' : 'refused (' + north.err + ')') + ', south ' + (south.ok ? 'allowed' : 'refused'));
    if (north.ok || !south.ok) return { won: false };
    const before = g.unitsAt('obj', E.current(s).id === HERO ? s.players[1].id : HERO).length;
    g.tactic('airstrike', 'obj'); g.tactic('gunrun', 'obj');
    E.applyAction(s, HERO, { a: 'tactic', uid: cardOf('heli').uid, from: g.at('g'), target: g.at('lz2') });
    console.log('     defenders left after the strikes: ' + g.unitsAt('obj', s.players[1].id).length + ' of 4; Grunts at the clearing: ' + g.unitsAt('lz2').length);
    g.end();
    console.log('     odds: ' + Math.round(g.odds('obj', ['lz2']) * 100) + '%');
    return g.assault('obj', ['lz2']);
  },
  navy(g) {
    const s = g.s, me = HERO, foe = s.players[1].id, inc0 = E.computeIncome(s, me).total;
    g.deploy('barracuda', 'dock'); g.deploy('barracuda', 'dock');
    // the Marlin sails to a hex within 2 of the lone gunboat but not next to anything
    const mar = g.unitsAt('s0').find(u => u.type === 'marlin'), r = E.reachable(s, me, [mar.id], mar.hex);
    const spot = Object.keys(r).find(k => (r[k].kind === 'move' || r[k].kind === 'capture') && E.dist(k, g.at('e2')) === 2 && E.dist(k, g.at('e1')) >= 2);
    E.applyAction(s, me, { a: 'move', from: mar.hex, units: [mar.id], to: spot }, () => 0.5);
    // the first gunboat claims sea lanes on the way to the pair
    const bar = g.unitsAt('s0').find(u => u.type === 'barracuda'), rb = E.reachable(s, me, [bar.id], bar.hex);
    const lane = Object.keys(rb).filter(k => (rb[k].kind === 'move' || rb[k].kind === 'capture') && E.dist(k, g.at('e1')) === 2).sort((a, b) => rb[b].c - rb[a].c)[0];
    E.applyAction(s, me, { a: 'move', from: bar.hex, units: [bar.id], to: lane }, () => 0.5);
    g.end();
    console.log('     income from the sea: $' + inc0 + ' → $' + E.computeIncome(s, me).total);
    const shot = E.combatCalc(s, me, [mar], spot, g.at('e2'), true).winProb;
    E.applyAction(s, me, { a: 'fire', from: spot, units: [mar.id], to: g.at('e2') }, () => 0.5);
    const groups = [...new Set(Object.values(s.units).filter(u => u.owner === me && u.type === 'barracuda' && E.canAct(s, u)).map(u => u.hex))];
    const us = groups.flatMap(h => Object.values(s.units).filter(u => u.hex === h && u.owner === me && u.type === 'barracuda'));
    const pair = E.combatCalc(s, me, us, groups, g.at('e1'), false).winProb;
    console.log('     odds: Marlin on the lone gunboat ' + Math.round(shot * 100) + '%, three Barracudas on the pair ' + Math.round(pair * 100) + '%');
    return E.applyAction(s, me, { a: 'assault', to: g.at('e1'), groups: groups.map(h => ({ from: h, units: us.filter(u => u.hex === h).map(u => u.id) })) }, () => 0.5);
  },
  encircle(g) {
    console.log('     odds on the guard: ' + Math.round(g.odds('gap', ['g'], ['h']) * 100) + '%');
    const r = g.assault('gap', ['g'], ['h']);
    console.log('     annexed: ' + (r.events || []).filter(e => e.e === 'annex').map(e => e.hexes.length + ' hexes').join(', '));
    return r;
  },
  breakout() { return situation('breakout'); },
  economy(g) {
    const inc = () => E.computeIncome(g.s, HERO).total, p = E.player(g.s, HERO);
    const log = [];
    g.move('sk', 'res'); g.move('g', 'n1'); log.push('t1 ' + inc()); g.end();
    if (g.s.turn.stage === 'choose') g.s.turn.stage === 'choose' && E.applyAction(g.s, HERO, { a: 'choose', pick: 'income' });
    g.build('refinery', 'res'); log.push('t2 refinery ' + inc() + ' cash ' + p.cash);
    // keep the Skitter grabbing land, and a Warehouse beside the refinery when there's cash
    const free = () => Object.keys(g.s.map.tiles).filter(k => { const t = g.s.map.tiles[k]; return E.isLandTile(t) && !t.owner; });
    const roam = () => { const sk = Object.values(g.s.units).find(u => u.owner === HERO && u.type === 'skitter'); if (!sk) return; const r = E.reachable(g.s, HERO, [sk.id], sk.hex); const best = Object.keys(r).filter(k => r[k].kind === 'move' || r[k].kind === 'capture').sort((a, b) => E.dist(b, sk.hex) - E.dist(a, sk.hex))[0]; if (best) E.applyAction(g.s, HERO, { a: 'move', from: sk.hex, units: [sk.id], to: best }); };
    roam(); g.end();
    for (let t = 3; t <= 4 && g.s.phase === 'play'; t++) {
      if (g.s.turn.stage === 'choose') E.applyAction(g.s, HERO, { a: 'choose', pick: 'income' });
      for (const n of E.neighbors(g.at('res'))) if (g.s.map.tiles[n] && g.s.map.tiles[n].owner === HERO && p.cash >= 6) E.applyAction(g.s, HERO, { a: 'build', struct: 'warehouse', hex: n });
      roam(); log.push('t' + t + ' ' + inc() + ' cash ' + p.cash); if (g.s.phase === 'play') g.end();
    }
    console.log('     income: ' + log.join(' · '));
  },
  basic(g) {
    g.move('g', 'w1'); g.end();
    g.deploy('grunt', 'hq'); g.move('w1', 'w2'); g.end();
    return g.assault('obj', ['w2']);
  },
};
const only = process.argv[2];
for (const sc of SC.SCENARIOS.concat(only ? SC.DRAFTS : [])) {   // a draft mission runs when named
  if (only && sc.id !== only) continue;
  const g = game(sc.id), sol = SOLUTIONS[sc.id];
  if (!sol) { ok(false, sc.n + '. ' + sc.name + ': no solution written'); continue; }
  let res; try { res = sol(g); } catch (e) { console.log('     ' + e.stack.split('\n').slice(0, 3).join(' | ')); }
  if (res && res.won !== undefined) { ok(res.won, sc.n + '. ' + sc.name + ' (' + sc.tier + ') can be won'); continue; }
  ok(g.won(), sc.n + '. ' + sc.name + ' (' + sc.tier + ') can be won' + (g.won() ? '' : ': ' + (g.s.winner ? g.s.winner.failed || g.s.winner.reason : 'still playing, round ' + g.s.turn.round)));
}
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
