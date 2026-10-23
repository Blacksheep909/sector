/* SECTOR — scenarios: hand-built puzzle missions, from the tutorial to Impossible.
   Each one is a small fixed board with set armies, cash and cards, a goal and a number of turns. No resupply draws,
   no weather: the same position every time, so each one has a solution to find. Each teaches one technique.
   Shared by the server (which builds and referees them) and the client (menu, briefings, the guide). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine'));
  else root.SectorScenarios = factory(root.SectorEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  // ── boards are drawn as rows of tokens, one per hex (odd rows sit half a hex to the right) ──
  // terrain: . plains  f forest  h hills (highlands)  j jungle  d desert  t tundra  s swamp  m mountain  ~ sea  r river (a ford)
  // then optionally A (yours) or B / C (enemy) for who owns it, then optionally @label to name the hex
  const TERR = { '.': 'plains', f: 'forest', h: 'hills', j: 'jungle', d: 'desert', t: 'tundra', s: 'swamp', c: 'canyon', m: 'mountain', '~': 'water', r: 'plains' };
  function parse(rows, ids) {
    const tiles = {}, labels = {};
    rows.forEach((row, r) => row.trim().split(/\s+/).forEach((tok, c) => {
      if (tok === '_') return;   // no hex here
      const m = /^([.fhjdtscm~r])([ABC]?)(?:@(\w+))?$/.exec(tok); if (!m) throw new Error('bad hex "' + tok + '" at row ' + r);
      const q = c - (r - (r & 1)) / 2, k = q + ',' + r;
      const t = { q, r, t: TERR[m[1]], owner: m[2] ? ids[m[2]] : null, struct: null, structs: [], res: false, contam: 0, smoke: null };
      if (m[1] === '~') t.deep = false;
      if (m[1] === 'r') t.river = true;
      tiles[k] = t;
      if (m[3]) labels[m[3]] = k;
    }));
    return { tiles, labels };
  }

  // ───────── the missions ─────────
  // players: who's in it (A is always you). units / structs / pois are keyed by hex label.
  // guide: the tutorial's script (shown by the client). hints: shown one at a time when you ask.
  const SCENARIOS = [
    {
      id: 'basic', n: 1, name: 'Basic Training', tier: 'Tutorial', technique: 'Moving, capturing, deploying and attacking',
      brief: 'Sergeant Hale walks you through the basics: claim land, raise troops, and take an enemy outpost.',
      turns: 4, reward: 100,
      players: { A: { name: 'You', cash: 0, arsenal: ['grunt'] }, B: { name: 'Outpost', ai: 'passive' } },
      income: { A: 4 },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~ ~',
        '~ . . f . . . h ~',
        '~ .A@hq .A . . .@w2 .B@obj .B ~',
        '~ .A@g . .@w1 f . .B ~',
        '~ . . . . . .B@bhq ~',
        '~ ~ ~ ~ ~ ~ ~ ~ ~',
      ],
      structs: { hq: [['A', 'hq']], bhq: [['B', 'hq', 3]] },
      units: { g: [['A', 'grunt', 2]], obj: [['B', 'grunt', 1]] },
      goal: { type: 'capture', hexes: ['obj'] },
      guide: [
        { text: 'Welcome to SECTOR, recruit. I\'m Sergeant Hale. Let\'s get you fighting fit. Click anywhere to continue.', wait: 'click' },
        { text: 'This is your **HQ**, the heart of your territory. Lose it and you\'re out of the war.', focus: 'hq', wait: 'click' },
        { text: 'Your goal today: take that enemy outpost, marked with the gold flag. You have 4 turns.', focus: 'obj', wait: 'click' },
        { text: 'First, your troops. **Click your Grunts** to select them.', focus: 'g', wait: 'select' },
        { text: 'The glowing hexes show where they can reach. Every empty hex they walk through becomes **your land**, and land pays income. **Click a hex to move them toward the outpost.**', wait: 'move' },
        { text: 'Good. Each unit moves once per turn. When you\'re done, press **END TURN** (bottom right).', wait: 'turn' },
        { text: 'New turn: you got your income ($4). Spend it! Your deck is the card bar at the bottom. **Click the Grunts card**, then click your HQ to deploy a fresh squad.', wait: 'deploy' },
        { text: 'Fresh troops can\'t move until next turn, but they defend straight away. Now march your first squad right up next to the outpost.', wait: 'move' },
        { text: 'Hover any enemy to see your odds. Fights are **chips × (d6 + mult)**: chips come from your units\' attack, mult from bonuses. Bigger stacks win more often. **End your turn** to bring everyone into range.', wait: 'turn' },
        { text: 'Now **attack**: select a stack next to the outpost and click the enemy hex. If both squads can reach it, **Shift-click** the second to attack together.', wait: 'win' },
      ],
      hints: ['Move your Grunts toward the gold flag on turn 1, deploy more on turn 2, and attack with everything once you\'re next to it.'],
    },
    {
      id: 'pincer', n: 2, name: 'Strength in Numbers', tier: 'Easy', technique: 'Pincer attacks: hit one hex from several sides at once',
      brief: 'Three Grunts are dug into the woods. Neither of your squads can shift them alone, but together…',
      turns: 1, reward: 150,
      players: { A: { name: 'You', arsenal: ['grunt'] }, B: { name: 'Woodsmen', ai: 'passive' } },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~',
        '~ .A@hq .A . fB .B .B ~',
        '~ .A .A@a fB@obj .B .B@bhq ~',
        '~ .A .A@b . .B .B ~',
        '~ ~ ~ ~ ~ ~ ~ ~',
      ],
      structs: { hq: [['A', 'hq']], bhq: [['B', 'hq', 3]] },
      units: { a: [['A', 'grunt', 2]], b: [['A', 'grunt', 2]], obj: [['B', 'grunt', 3, { dug: true }]] },
      goal: { type: 'capture', hexes: ['obj'] },
      intro: 'You have one turn. Attack with one squad and you\'ll probably lose it. **Select one squad, Shift-click the other, then click the forest**: both attack together, and every extra stack adds **+1 Mult (Pincer)**.',
      hints: ['Hover the forest with one squad selected: see the odds. Now Shift-click the second squad and hover again.', 'Select squad A, Shift-click squad B, click the forest. A guaranteed win shows as 100%.'],
    },
    {
      id: 'river', n: 3, name: 'Crossing', tier: 'Easy', technique: 'Rivers, bridges and combined arms',
      brief: 'A river stands between your tank column and the enemy. Infantry can wade it. Tanks can\'t.',
      turns: 2, reward: 200,
      players: { A: { name: 'You', cash: 6, arsenal: ['grunt', 'mauler'] }, B: { name: 'Rivermen', ai: 'passive' } },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~ ~',
        '~ .A@hq .A r . . .B ~',
        '~ .A .A@m r@x .@y .B@obj .B ~',
        '~ .A .A@g r .@z .B .B@bhq ~',
        '~ ~ ~ ~ ~ ~ ~ ~ ~',
      ],
      structs: { hq: [['A', 'hq']], bhq: [['B', 'hq', 3]] },
      units: { m: [['A', 'mauler', 1]], g: [['A', 'grunt', 2]], obj: [['B', 'grunt', 3]] },
      goal: { type: 'capture', hexes: ['obj'] },
      intro: '**Infantry** can ford a river straight across, but it takes their whole move. **Vehicles need a bridge**: build one ($6) on a river hex next to your land. And mixing unit types in an attack earns **Combined Arms** (+1 Mult per extra type).',
      hints: ['Build a Bridge on the river beside your tank, drive the tank over it, and wade the Grunts across.', 'Turn 2: attack the outpost with the tank and the Grunts together.'],
    },
    {
      id: 'airborne', n: 4, name: 'Over the Mountains', tier: 'Medium', technique: 'Helicopters carry Grunts',
      brief: 'The enemy outpost sits behind a wall of mountains and sea. No road leads there. The sky does.',
      turns: 2, reward: 300,
      players: { A: { name: 'You', arsenal: ['grunt', 'stormcrow'] }, B: { name: 'Highlanders', ai: 'passive' } },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~ ~',
        '~ .A@hq .A m . . .B ~',
        '~ .A .A@s m .@lz .B@obj .B ~',
        '~ .A .A m m . .B@bhq ~',
        '~ ~ ~ ~ ~ ~ ~ ~ ~',
      ],
      structs: { hq: [['A', 'hq']], bhq: [['B', 'hq', 3]] },
      units: { s: [['A', 'stormcrow', 1], ['A', 'grunt', 4]], obj: [['B', 'grunt', 2]] },
      goal: { type: 'capture', hexes: ['obj'] },
      intro: '**Troop carriers**: Grunts moving together with a helicopter ride along, over mountains and water. A Stormcrow seats 6. **Select the whole stack** (the Stormcrow and its Grunts) and fly it over.',
      hints: ['Turn 1: fly the whole stack over the mountains to the empty hex beside the outpost.', 'Turn 2: attack from there. Helicopters and infantry together earn Combined Arms.'],
    },
    {
      id: 'leapfrog', n: 5, name: 'Breakthrough', tier: 'Medium', technique: 'Leapfrogging: each wave passes through the last to punch deeper',
      brief: 'A mountain pass, held in depth. One turn to punch all the way through to the depot behind it.',
      turns: 1, reward: 400,
      players: { A: { name: 'You', arsenal: ['grunt'] }, B: { name: 'Pass Guard', ai: 'passive' } },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
        '~ .A .A m m m m m m m ~',
        '~ .A@hq .A@w3 .A@w1 .B@d1 .B@d2 .B@obj .B .B@bhq ~ ~',
        '~ .A .A m m m m m m m ~',
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
      ],
      structs: { hq: [['A', 'hq']], bhq: [['B', 'hq', 3]] },
      units: { w1: [['A', 'grunt', 3], ['A', 'jackal', 2]], w3: [['A', 'skitter', 2]], d1: [['B', 'grunt', 1]], d2: [['B', 'grunt', 1]] },
      goal: { type: 'capture', hexes: ['obj'] },
      intro: 'Your units can **move through hexes your own troops hold**. So: the first wave breaks the front, the second **passes through them** to hit the next line, and the fast third wave **passes through both** and keeps going. Order matters: whoever attacks stops where they fought.',
      hints: ['Only the Grunts are slow: they can reach the first defender and no further. Use them first.', 'Grunts take the first hex. The Jackals pass through them to take the second. The Skitters drive through both onto the depot.'],
    },
    {
      id: 'guns', n: 6, name: 'Big Guns', tier: 'Hard', technique: 'Artillery: firing from range',
      brief: 'Four enemy units across the strait, out of reach of any assault. You have two guns and two turns.',
      turns: 2, reward: 600,
      players: { A: { name: 'You', arsenal: ['grunt'] }, B: { name: 'Coastal Battery', ai: 'passive' } },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~',
        '~ .A@hq .A ~ .B@t1 .B .B@bhq ~',
        '~ .A .A@bas ~ .B .B@t2 .B ~',
        '~ .A .A@thu ~ .B@t3 .B .B ~',
        '~ .A .A ~ .B@t4 .B .B ~',
        '~ ~ ~ ~ ~ ~ ~ ~',
      ],
      structs: { hq: [['A', 'hq']], bhq: [['B', 'hq', 3]] },
      units: { bas: [['A', 'basilisk', 1]], thu: [['A', 'thumper', 1]], t1: [['B', 'jackal', 1]], t2: [['B', 'grunt', 1]], t3: [['B', 'grunt', 1]], t4: [['B', 'grunt', 1]] },
      goal: { type: 'destroy' },
      intro: '**Artillery fires instead of moving**: select a gun and click a target in range. A won shot destroys a unit; a lost one does nothing. The Basilisk (range 3) hits hard; the Thumper (range 2) is light. Four targets, four shots: **every shot has to be a sure kill.**',
      hints: ['Hover each target with each gun selected and compare the odds. Some shots are certain, some aren\'t.', 'The Thumper can only be sure of killing Grunts. Save the Basilisk for what the Thumper can\'t do.'],
    },
    {
      id: 'cards', n: 7, name: 'All In', tier: 'Hard', technique: 'Battle cards: tipping a fight before the dice roll',
      brief: 'Two attacks that can\'t quite win on their own, and just $2 to tip the scales. Spend it exactly right.',
      turns: 1, reward: 800,
      players: { A: { name: 'You', cash: 2, arsenal: ['grunt'], tactics: ['rally', 'bayonets', 'barrage', 'reserves'] }, B: { name: 'Ridge Guard', ai: 'passive' } },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~',
        '~ .A@hq .A@x fB@ox .B .B ~',
        '~ .A .A . .B .B@bhq ~',
        '~ .A .A@y hB@oy .B .B ~',
        '~ ~ ~ ~ ~ ~ ~ ~',
      ],
      structs: { hq: [['A', 'hq']], bhq: [['B', 'hq', 3]] },
      units: { x: [['A', 'grunt', 3]], y: [['A', 'mauler', 1], ['A', 'lancer', 1]], ox: [['B', 'grunt', 2, { dug: true }]], oy: [['B', 'grunt', 4]] },
      goal: { type: 'capture', hexes: ['ox', 'oy'] },
      intro: '**Battle cards** are thrown into a fight before the dice roll. Play one on your turn and it\'s **readied for your next attack**, or throw it in when the fight opens. Each costs cash, and you only have **$2**. Check the odds on both attacks, then work out which card goes where.',
      hints: ['Rally (+2 Mult) and Fix Bayonets (+1 Chip per attacker) cost $1 each. Barrage and Reserves cost $2.', 'The three Grunts need either Rally or Bayonets. The tank column can only be tipped by Rally for $1. So: Bayonets for the Grunts, Rally for the tanks, one attack at a time.'],
    },
    {
      id: 'beach', n: 8, name: 'Beachhead', tier: 'Very Hard', technique: 'Transports, landings and naval gunfire',
      brief: 'An island fort and an army on the wrong shore. You have a transport, two gunboats and three turns.',
      turns: 3, reward: 1000,
      players: { A: { name: 'You', arsenal: ['grunt'] }, B: { name: 'Island Garrison', ai: 'passive' } },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
        '~ .A@hq .A ~ ~ ~ ~ .B .B@bhq ~',
        '~ .A .A@port ~@ark ~ ~ ~ .B ~',
        '~ .A .A ~@navy ~ ~ .@beach .B@obj ~',
        '~ .A .A ~ ~ ~ ~@s2 ~@s1 ~',
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
      ],
      structs: { hq: [['A', 'hq']], port: [['A', 'port']], bhq: [['B', 'hq', 3]] },
      units: { ark: [['A', 'ark', 1], ['A', 'grunt', 3]], navy: [['A', 'barracuda', 2]], obj: [['B', 'grunt', 2, { dug: true }]] },
      goal: { type: 'capture', hexes: ['obj'] },
      intro: 'Your Grunts are aboard the **Ark**. Sail it across, then **click a beach** to wade ashore. Warships next to a land fight add **Naval Gunfire**: +2 Chips each to your side (up to 3 ships), even when they aren\'t in the fight.',
      hints: ['Turn 1: sail the Ark to the sea by the empty beach, and send both gunboats to the water beside the fort.', 'Turn 2: wade ashore. Turn 3: attack the fort from the beach while the gunboats sit next to it.'],
    },
    {
      id: 'hold', n: 9, name: 'Hold the Line', tier: 'Expert', technique: 'Defence: bunkers, terrain and reserves',
      brief: 'A full assault is coming, and it keeps coming. Hold both hill forts and your HQ until your fifth turn ends.',
      turns: 5, reward: 1500,
      players: { A: { name: 'You', cash: 12, arsenal: ['grunt', 'lancer'] }, B: { name: 'Iron Tide', ai: 'bot', diff: 'hard', cash: 10, arsenal: ['grunt', 'mauler', 'thumper'] } },
      income: { A: 4, B: 12 },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
        '~ .A .A .A hA@f1 . . .B .B .B ~',
        '~ .A .A@r1 .A . . f .B@e1 .B .B ~',
        '~ .A@hq .A .A . m . .B .B@e2 .B@bhq ~',
        '~ .A .A@r2 .A . . f .B@e3 .B .B ~',
        '~ .A .A .A hA@f2 . . .B .B .B ~',
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
      ],
      structs: { hq: [['A', 'hq']], bhq: [['B', 'hq', 3]] },
      units: { f1: [['A', 'grunt', 2]], f2: [['A', 'grunt', 2]], hq: [['A', 'grunt', 2]], e1: [['B', 'grunt', 3], ['B', 'mauler', 1]], e2: [['B', 'grunt', 3], ['B', 'thumper', 2]], e3: [['B', 'grunt', 3], ['B', 'mauler', 1]] },
      keep: ['f1', 'f2'],
      goal: { type: 'survive', hexes: ['f1', 'f2'] },
      intro: 'You win by **still holding both hill forts when your 5th turn ends**, and lose the moment either falls. Hills give defenders +2 Mult. A **Bunker** adds a garrison and more Mult (build it on the fort). Deploy fresh troops at your HQ and march them up: fresh troops can\'t move on the turn they arrive.',
      hints: ['Turn 1: Bunkers on both forts, and a squad from the HQ marching to each.', 'Big stacks on hills behind bunkers are very hard to crack. Keep feeding troops forward every turn, and don\'t leave the HQ empty.'],
    },
    {
      id: 'blitz', n: 10, name: 'Lightning War', tier: 'Impossible', technique: 'Everything at once',
      brief: 'Two turns to take a ★★★ fortress HQ. Guns, tanks, a helicopter strike and three dollars. Every piece has a job, and every dollar too.',
      turns: 2, reward: 2500,
      players: { A: { name: 'You', cash: 3, arsenal: ['grunt'], tactics: ['rally', 'barrage', 'bayonets'] }, B: { name: 'High Command', ai: 'passive' } },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~ ~',
        '~ .A .A@heli m m .@lz .B ~ ~',
        '~ .A@hq .A m m .B@bhq .B .B ~',
        '~ .A .A@tank fB@guard .B@stage .B .B ~',
        '~ .A .A@art .A ~ ~ ~ ~ ~',
        '~ ~ ~ ~ ~ ~ ~ ~ ~',
      ],
      structs: { hq: [['A', 'hq']], bhq: [['B', 'hq', 3]] },
      units: { heli: [['A', 'stormcrow', 1], ['A', 'grunt', 6]], tank: [['A', 'mauler', 1], ['A', 'lancer', 1]], art: [['A', 'basilisk', 1]], guard: [['B', 'grunt', 1, { dug: true }]], bhq: [['B', 'grunt', 5]] },
      goal: { type: 'capture', hexes: ['bhq'] },
      intro: 'The enemy HQ is a ★★★ fortress packed with troops. Nothing you have can take it alone. Plan both turns before you touch anything: **where must each force be at the start of turn 2?**',
      hints: ['The guard in the woods blocks the only road for your tanks, and attacking it would leave them stuck there. Something else should deal with it.', 'Turn 1: the Basilisk shells the guard; the tanks drive through to the hex beside the HQ; the Stormcrow flies its Grunts to the clearing on the other side.', 'Turn 2: no single card is enough. Ready two that stack, like Rally with Fix Bayonets, then attack the HQ with both stacks at once (Shift-click).'],
    },
  ];
  const byId = {}; SCENARIOS.forEach(s => { byId[s.id] = s; });

  // build the starting state for a mission. heroId: the id of the human playing it
  function build(id, heroId, heroName, color) {
    const sc = byId[id] || SCENARIOS.find(x => x.id === id); if (!sc) return null;
    const keys = Object.keys(sc.players), ids = {};
    keys.forEach((k, i) => { ids[k] = k === 'A' ? heroId : 's' + k.toLowerCase() + '_' + id; });
    const roster = keys.map((k, i) => ({ id: ids[k], name: k === 'A' ? (heroName || 'You') : sc.players[k].name, color: k === 'A' ? (color || E.COLORS[0]) : E.COLORS[(i + 1) % E.COLORS.length], faction: sc.players[k].faction || 'volt', bot: k !== 'A', diff: sc.players[k].diff || 'medium' }));
    const { state: s } = E.createGame({ mode: 'domination', mapSize: 'small', spawns: 'random', fog: 'off', events: 'off' }, roster);
    const { tiles, labels } = parse(sc.map, ids);
    const at = l => { const k = labels[l]; if (!k) throw new Error(id + ': no hex labelled ' + l); return k; };
    s.map.tiles = tiles; s.map.beacon = null; delete s.map.silos;
    s.map.landCount = Object.values(tiles).filter(t => E.isLandTile(t)).length;
    s.units = {}; s.weather = null; s.log = [];
    for (const [l, list] of Object.entries(sc.structs || {})) for (const [o, type, lvl] of list) {
      const t = tiles[at(l)], st = { type, owner: ids[o], lvl: lvl || 1 };
      t.structs.push(st); t.struct = t.structs.find(x => x.type === 'hq') || t.structs[0]; t.owner = ids[o];
      if (type === 'bridge') { t.bridge = true; if (t.river) t.riverBridge = true; }
    }
    for (const [l, poi] of Object.entries(sc.pois || {})) tiles[at(l)].poi = poi;
    for (const [l, list] of Object.entries(sc.units || {})) for (const [o, type, n, extra] of list)
      for (let i = 0; i < (n || 1); i++) { const uid = s.nextId++; s.units[uid] = { id: uid, owner: ids[o], type, hex: at(l), moved: false, fresh: false, stun: 0, mvBonus: 0, ...(extra || {}) }; }
    s.players.sort((a, b) => keys.indexOf(Object.keys(ids).find(k => ids[k] === a.id)) - keys.indexOf(Object.keys(ids).find(k => ids[k] === b.id)));
    for (const k of keys) {
      const p = E.player(s, ids[k]), d = sc.players[k];
      p.cash = d.cash || 0; p.arsenal = (d.arsenal || ['grunt']).slice(); p.levels = {}; p.tactics = (d.tactics || []).map(tid => ({ uid: s.nextId++, id: tid }));
      p.hq = Object.keys(tiles).find(x => (tiles[x].structs || []).some(st => st.type === 'hq' && st.owner === p.id)) || null;
      if (d.ai) p.scenarioAI = d.ai;
    }
    s.phase = 'play'; delete s.draft;
    s.turn = { idx: 0, round: 1, stage: 'act', offer: [], rerolls: 0, crate: null, income: 0, deadline: 0 };
    const income = {}; for (const k in sc.income || {}) income[ids[k]] = sc.income[k];
    s.scenario = { id, hero: heroId, goal: { ...sc.goal, hexes: (sc.goal.hexes || []).map(at) }, keep: (sc.keep || []).map(at), turns: sc.turns, heroTurns: 0, income, targets: (sc.goal.hexes || []).map(at), labels };
    s.log.push('🎯 ' + sc.name + ': ' + sc.brief);
    return s;
  }
  // what the menu and the client need about each mission (no boards)
  const list = () => SCENARIOS.map(({ id, n, name, tier, technique, brief, turns, reward }) => ({ id, n, name, tier, technique, brief, turns, reward }));
  return { SCENARIOS, build, list, get: id => byId[id], parse };
});
