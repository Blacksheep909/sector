// Every scenario must be solvable: play each one's intended solution through the real engine. node tools/test-scenarios.js [id]
const E = require('../shared/engine'), SC = require('../shared/scenarios');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const HERO = 'hero';
// a tiny driver: the hero's moves by hex label; enemies with ai 'passive' just end their turn, others use the bot
const { botStep } = require('../shared/bot');
function game(id) {
  const s = SC.build(id, HERO, 'Hero'), L = s.scenario.labels, at = l => L[l] || l;
  const unitsAt = (l, pid = HERO) => Object.values(s.units).filter(u => u.hex === at(l) && u.owner === pid);
  const rng = () => 0.5;
  const act = (a, quiet) => {
    const r = E.applyAction(s, HERO, a, rng);
    if (!r.ok && !quiet) console.log('     ✗ ' + JSON.stringify(a) + ': ' + r.err);
    return r;
  };
  const g = {
    s, at, unitsAt,
    move(from, to, types) { const ids = unitsAt(from).filter(u => !types || types.includes(u.type)).map(u => u.id); return act({ a: 'move', from: at(from), units: ids, to: at(to) }); },
    assault(to, ...groups) { return act({ a: 'assault', to: at(to), groups: groups.map(([from, types]) => ({ from: at(from), units: unitsAt(from).filter(u => !types || types.includes(u.type)).map(u => u.id) })) }); },
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
const SOLUTIONS = {
  pincer(g) {
    const one = g.odds('obj', ['a']), both = g.odds('obj', ['a'], ['b']);
    console.log('     odds: one squad ' + Math.round(one * 100) + '%, pincer ' + Math.round(both * 100) + '%');
    return g.assault('obj', ['a'], ['b']);
  },
  river(g) {
    g.build('bridge', 'x'); g.move('m', 'y'); g.move('g', 'z'); g.end();
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
          const hq = g.unitsAt('hq').filter(u => !u.fresh); if (hq.length) E.applyAction(s, HERO, { a: 'move', from: g.at('hq'), units: hq.map(u => u.id), to: g.at('fort') });
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
for (const sc of SC.SCENARIOS) {
  if (only && sc.id !== only) continue;
  const g = game(sc.id), sol = SOLUTIONS[sc.id];
  if (!sol) { ok(false, sc.n + '. ' + sc.name + ': no solution written'); continue; }
  let res; try { res = sol(g); } catch (e) { console.log('     ' + e.stack.split('\n').slice(0, 3).join(' | ')); }
  if (res && res.won !== undefined) { ok(res.won, sc.n + '. ' + sc.name + ' (' + sc.tier + ') can be won'); continue; }
  ok(g.won(), sc.n + '. ' + sc.name + ' (' + sc.tier + ') can be won' + (g.won() ? '' : ': ' + (g.s.winner ? g.s.winner.failed || g.s.winner.reason : 'still playing, round ' + g.s.turn.round)));
}
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
