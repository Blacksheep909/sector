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
      id: 'basic', name: 'Basic Training', tier: 'Tutorial', technique: 'Moving, capturing, deploying and attacking',
      brief: 'General Hale walks you through the basics: claim land, raise troops, and take an enemy outpost.',
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
        { text: 'Welcome to SECTOR, recruit. I\'m General Hale. Let\'s get you fighting fit. Click anywhere to continue.', wait: 'click' },
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
      id: 'economy', name: 'War Chest', tier: 'Tutorial', technique: 'Income, resupply and economic buildings',
      brief: 'Wars are won with money. Grow your income from $4 to $15 a turn before the enemy notices.',
      turns: 4, live: true,
      players: { A: { name: 'You', cash: 0, arsenal: ['grunt', 'skitter'] }, B: { name: 'Far Garrison', ai: 'passive' } },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
        '~ . . . f . . . . . ~',
        '~ .A .A@hq .A . .@n1 . . h . ~',
        '~ .A@g .A@sk . . . .@res . . . ~',
        '~ . .A . . f . . . . ~',
        '~ . . . h . . . .B .B@bhq ~',
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
      ],
      res: ['res'],
      structs: { hq: [['A', 'hq']], bhq: [['B', 'hq', 3]] },
      units: { sk: [['A', 'skitter', 1]], g: [['A', 'grunt', 2]], bhq: [['B', 'grunt', 6]] },
      goal: { type: 'income', amount: 15 },
      guide: [
        { text: 'Money wins wars, recruit. Every turn you earn **income**: a base $3, plus **$1 for every 3 hexes** of land you hold. You\'re on $4. Get it to **$15 a turn**. Click to go on.', wait: 'click' },
        { text: 'The fastest way to grow is land. Your **Skitter** buggy moves 4 hexes, and every empty hex it drives through becomes yours. **Drive it toward the glowing resource node** (the derrick in the middle).', focus: 'res', wait: 'move' },
        { text: '**Resource nodes** pay +$2 a turn just for holding them. Spread the Grunts out to grab more land too, then **END TURN**.', wait: 'turn' },
        { text: 'This is **resupply**. Each turn you either take **one of these cards and most of your income** (the cash you keep shows under each card), or **skip them for the full income**. Cards are how your army grows; cash is how you build. Today you want cash: press **COLLECT** for the full income.', wait: 'pick' },
        { text: 'Now build. A **Refinery** on a resource node pays +$3 a turn ($1 anywhere else). Open the build bar (bottom left), pick **Refinery** and click the node.', focus: 'res', wait: 'build' },
        { text: 'A **Warehouse** pays +$2 a turn, or **+$3 next to a Refinery, resource node or Port**. Keep claiming land, build when you can afford it, and watch your income in the top-left panel. **Reach $15 a turn.**', wait: 'win' },
      ],
      hints: ['Land: every 3 hexes is +$1. The Skitter grabs 4 a turn; keep it moving into empty land.', 'Refinery on the node (+$3), then a Warehouse right next to it (+$3). Take full income at every resupply.'],
    },
    {
      id: 'pincer', name: 'Strength in Numbers', tier: 'Easy', technique: 'Pincer attacks: hit one hex from several sides at once',
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
      id: 'ground', name: 'Holding Ground', tier: 'Easy', technique: 'Defence: holding ground and your HQ (high ground, digging in, Bunkers, fortifying the HQ)',
      brief: 'Raiders are coming for your hill fort and your HQ. Hold both for three turns.',
      turns: 3,
      players: { A: { name: 'You', cash: 8, arsenal: ['grunt'] }, B: { name: 'Raiders', ai: 'bot', diff: 'medium', cash: 6, arsenal: ['grunt', 'mauler'] } },
      income: { A: 4, B: 10 },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
        '~ .A .A . . . .B .B ~',
        '~ .A@hq .A hA@fort . . .B@e1 .B ~',
        '~ .A .A@g . . . .B .B@bhq ~',
        '~ .A .A . f . .B@e2 .B ~',
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
      ],
      structs: { hq: [['A', 'hq']], bhq: [['B', 'hq', 3]] },
      units: { fort: [['A', 'grunt', 2]], g: [['A', 'grunt', 2]], e1: [['B', 'grunt', 4]], e2: [['B', 'grunt', 3], ['B', 'mauler', 1]] },
      keep: ['fort', 'hq'],
      goal: { type: 'survive', hexes: ['fort', 'hq'] },
      intro: 'Hold the **hill fort** and your **HQ** until your 3rd turn ends: lose either and it\'s over. Defenders win ties, and you can stack the odds: **Highlands** give defenders +2 Mult. A **Bunker** ($4) adds a garrison of +3 Chips and +2 Mult. A stack that hasn\'t moved can **Dig In** (select it, press **G**): +1 Mult until it moves again. Your **HQ** defends itself with a garrison, and building **HQ** on it again **fortifies** it (+3 Chips and +1 Mult a level). If an HQ does fall, it\'s only **under siege**: retake it before the enemy\'s next turn and you\'re still in the war. Hover a hex to see what an attacker faces.',
      hints: ['Turn 1: a Bunker on the fort, the spare Grunts into it, then dig the fort stack in (G). Keep some Grunts on the HQ.', 'Fresh Grunts deployed at the HQ defend it straight away. Don\'t attack out: let them come to you.'],
    },
    {
      id: 'river', name: 'Crossing', tier: 'Easy', technique: 'Rivers, bridges and combined arms',
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
      id: 'fob', name: 'Forward Base', tier: 'Easy', technique: 'FOBs: deploying at the front, not just at home',
      brief: 'The enemy outpost is a long march from your HQ. Three turns. Bring the front line to the troops.',
      turns: 3,
      players: { A: { name: 'You', cash: 8, arsenal: ['grunt'] }, B: { name: 'Outpost', ai: 'passive' } },
      income: { A: 8 },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
        '~ .A .A .A .A .A .A . . .B .B ~ ~',
        '~ .A@hq .A@g .A .A .A .A@front . fB@obj .B .B@bhq ~',
        '~ .A .A .A .A .A .A . . .B .B ~ ~',
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
      ],
      structs: { hq: [['A', 'hq']], bhq: [['B', 'hq', 3]] },
      units: { g: [['A', 'grunt', 2]], obj: [['B', 'grunt', 3, { dug: true }]] },
      goal: { type: 'capture', hexes: ['obj'] },
      intro: 'Troops only deploy at your **HQ** or a **FOB** (forward base, $8), and Grunts walk 2 hexes a turn: from home they\'d never make it. **Build a FOB on your front-line hex**, deploy fresh troops there next turn, and they\'re in range of the outpost the turn after. (A **Depot**, $4, gives units that start their turn near it +1 move.)',
      hints: ['Turn 1: build a FOB on the easternmost hex of your land (the one nearest the outpost).', 'Turn 2: deploy four Grunts at the FOB. Turn 3: attack the woods with all four together.'],
    },
    {
      id: 'loot', name: 'Spoils of War', tier: 'Medium', technique: 'Ruins, caches, villages, relics and abandoned FOBs',
      brief: 'No money, a few fast trucks and a map full of treasure. Take the village and the relic in three turns.',
      turns: 3,
      players: { A: { name: 'You', cash: 0, arsenal: ['grunt'] }, B: { name: 'Bandits', ai: 'passive' } },
      income: { A: 3 },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
        '~ .A .A . .@ru . . h . ~',
        '~ .A@hq .A@sk . . .@fort .@vil .@relic . ~',
        '~ .A .A@j . .@cache f . .B .B ~',
        '~ ~ ~ ~ ~ ~ ~ ~ .B .B@bhq ~',
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
      ],
      pois: { ru: 'ruins', fort: 'fort', vil: 'village', relic: 'relic', cache: 'cache' },
      gar: { vil: 6 },
      structs: { hq: [['A', 'hq']], bhq: [['B', 'hq', 3]] },
      units: { sk: [['A', 'skitter', 1]], j: [['A', 'jackal', 1]], bhq: [['B', 'grunt', 4]] },
      goal: { type: 'capture', hexes: ['vil', 'relic'] },
      intro: 'The map is full of **points of interest**. **Ruins** pay $4–10 to the first unit through. A **supply cache** hands over a tactic card. An **abandoned FOB** becomes yours when you drive onto it: a deploy point at the front. A **village** has a militia to beat, then pays +$2 a turn; a **relic** pays +$3. You start broke: loot first, then spend it.',
      hints: ['Turn 1: the Skitter claims the abandoned FOB; the Jackal loots the ruins.', 'Turn 2: deploy Grunts at the FOB with the loot, and send the Skitter to the relic. Turn 3: everything attacks the village.'],
    },
    {
      id: 'airborne', name: 'Over the Mountains', tier: 'Medium', technique: 'Helicopters carry Grunts',
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
      id: 'leapfrog', name: 'Breakthrough', tier: 'Medium', technique: 'Leapfrogging: each wave passes through the last to punch deeper',
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
      id: 'guns', name: 'Big Guns', tier: 'Hard', technique: 'Artillery: firing from range',
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
      intro: '**Artillery fires instead of moving**: select a gun and click a target in range. A won shot destroys a unit (two if it beats the defence by half again, three if by two and a half times); a lost one does nothing. The Basilisk (range 3) hits hard; the Thumper (range 2) is light. Four targets, four shots: **every shot has to be a sure kill.**',
      hints: ['Hover each target with each gun selected and compare the odds. Some shots are certain, some aren\'t.', 'The Thumper can only be sure of killing Grunts. Save the Basilisk for what the Thumper can\'t do.'],
    },
    {
      id: 'cards', name: 'All In', tier: 'Hard', technique: 'Battle cards: tipping a fight before the dice roll',
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
      id: 'air', name: 'Air Power', tier: 'Hard', technique: 'Air strikes, Gun Runs, Heli Drops and Flak',
      brief: 'The objective is cut off by mountains and sea. No road leads there, but you have $9 and three cards.',
      turns: 2,
      players: { A: { name: 'You', cash: 9, arsenal: ['grunt'], tactics: ['airstrike', 'gunrun', 'heli'] }, B: { name: 'Cliff Guard', ai: 'passive' } },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
        '~ .A .A m ~ .@lz1 .B .B@flak ~ ~',
        '~ .A@hq .A@g m ~ fB@obj .B .B@bhq ~',
        '~ .A .A m ~ .@lz2 .B .B ~ ~',
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
      ],
      structs: { hq: [['A', 'hq']], bhq: [['B', 'hq', 3]], flak: [['B', 'flak', 2]] },
      units: { g: [['A', 'grunt', 4]], obj: [['B', 'grunt', 4, { dug: true }]] },
      goal: { type: 'capture', hexes: ['obj'] },
      intro: '**Tactic cards** act straight from your hand. An **Airstrike** ($4) bombs a hex within 4 of your land and kills 1–3 troops; a **Gun Run** ($2) kills 1 on a 3+. A **Heli Drop** ($3) flies a stack up to 5 hexes onto empty land. But enemy **Flak** shoots at air strikes in its range and blocks Heli Drops there: hover the Flak site to see how far it reaches.',
      hints: ['The northern clearing is inside the Flak\'s reach; the southern one isn\'t.', 'Turn 1: Airstrike and Gun Run the woods, then Heli Drop your Grunts onto the southern clearing. Turn 2: attack.'],
    },
    {
      id: 'airwing', name: 'Air Wing', tier: 'Medium', technique: 'Airbases, strike cards and the black market',
      brief: 'An enemy garrison sits on an island your troops can\'t reach. Build an airbase and bomb it out, with a little help from the black market.',
      turns: 7, live: true, market: true,
      players: { A: { name: 'You', cash: 40, arsenal: ['grunt'] }, B: { name: 'Island Garrison', ai: 'passive' } },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~ ~',
        '~ .A .A .A .A ~ .B .B ~',
        '~ .A .A@hq .A .A@ab ~ .B@e1 .B@bhq ~',
        '~ .A .A .A .A ~ .B@e2 .B ~',
        '~ .A .A .A .A ~ .B .B ~',
        '~ ~ ~ ~ ~ ~ ~ ~ ~',
      ],
      structs: { hq: [['A', 'hq']], bhq: [['B', 'hq', 3]] },
      units: { hq: [['A', 'grunt', 3]], e1: [['B', 'grunt', 1]], e2: [['B', 'grunt', 1]] },
      goal: { type: 'destroy' },
      guide: [
        { text: 'No boats and no bridge, recruit, so this one is done from the air. An **Airbase** hands you an **air-strike card every turn**. Click to go on.', wait: 'click' },
        { text: 'Open the build bar (bottom left), pick **Airbase** ($15) and build it on the glowing hex by the coast. Each one you own makes the next dearer.', focus: 'ab', wait: 'build' },
        { text: 'Like a FOB, an airbase **takes a turn to get ready**: see the crane. **END TURN.**', wait: 'turn' },
        { text: 'Resupply: take a card or the full income, your call.', wait: 'pick' },
        { text: 'The ground crew are still at it; your first strike card comes **next turn**. **END TURN.**', wait: 'turn' },
        { text: 'Resupply again.', wait: 'pick' },
        { text: 'Your airbase delivered a **strike card**: it\'s in your hand. A ★ airbase sends commons (**Gun Run**, **Kamikaze Drone**). Click it, then click the enemy troops on the island.', focus: 'e1', wait: 'tactic' },
        { text: 'See the **purple badge** on your cash panel? That\'s the **black market**: 5 tactic cards for cash, new stock every turn. In a real war it opens once you earn **$50 a turn**. Open it and buy something useful.', wait: 'market' },
        { text: 'Upgrade the airbase (build it again on the same hex) and it hands out **rares at ★★** (Cruise Missile, Precision Strike, Strategic Bombing) and **epics at ★★★**. Each upgrade takes a turn. **Destroy every enemy unit on the island.**', wait: 'win' },
      ],
      hints: ['Each strike card needs a roll: a Gun Run kills on a 3+, a Kamikaze Drone on a 4+. Keep the cards coming and play them all on the island.', 'Upgrade to ★★ when you can afford it: a Cruise Missile kills the strongest unit on a 2+. The black market may sell strikes too.'],
    },
    {
      id: 'skyshield', name: 'Sky Shield', tier: 'Hard', technique: 'Anti-air: shooting down aircraft from range',
      brief: 'Enemy helicopters have landed in the valley. Your air defence has two turns to bring them all down, and your Grunts must clear their guard.',
      turns: 2, reward: 100,
      players: { A: { name: 'You', arsenal: ['grunt'] }, B: { name: 'Rotor Wing', ai: 'passive' } },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~',
        '~ .A@hq .A@sg .A .B@h1 .B .B ~',
        '~ .A .A .A .B@h2 .B@bhq ~',
        '~ .A .A@gr .A@st .B@h3 .B ~',
        '~ .A .A .B@g .B .B .B ~',
        '~ ~ ~ ~ ~ ~ ~ ~',
      ],
      structs: { hq: [['A', 'hq']], bhq: [['B', 'hq', 3]] },
      units: { sg: [['A', 'skyguard', 1]], st: [['A', 'stinger', 1]], gr: [['A', 'grunt', 4]], h1: [['B', 'ravager', 1]], h2: [['B', 'valkyrie', 1]], h3: [['B', 'hornet', 1]], g: [['B', 'grunt', 2]] },
      goal: { type: 'destroy' },
      intro: '**Anti-air fires from range, like artillery, but only at aircraft**: select it and click an aircraft in range. A Stinger team reaches **1 hex**, a Skyguard **2**, and the Sentinel (Patriot) and Grumble (S-300) batteries **3**. Each stack fires once a turn instead of moving. Against troops on the ground anti-air is weak, so **send the Grunts** for the guard.',
      hints: ['Hover each aircraft with each gun selected: the Stinger isn\'t sure of the Valkyrie, the Skyguard is.', 'Turn 1: Skyguard on the Valkyrie, Stingers on the Hornet, Grunts on the guard. Turn 2: Skyguard on the Ravager.'],
    },
    {
      id: 'navy', name: 'Sea Lanes', tier: 'Hard', technique: 'Ports, warships and sea control',
      brief: 'An enemy flotilla is squatting on your shipping lanes. Build a navy and send it to the bottom.',
      turns: 2,
      players: { A: { name: 'You', cash: 8, arsenal: ['barracuda'] }, B: { name: 'Corsairs', ai: 'passive' } },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
        '~ .A .A@port ~@dock ~ ~ ~ ~ .B ~ ~',
        '~ .A@hq .A ~@s0 ~ ~@e1 ~ .B .B@bhq ~',
        '~ .A .A ~ ~ ~ ~@e2 ~ .B ~ ~',
        '~ .A .A ~ ~ ~ ~ ~ .B .B ~',
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
      ],
      structs: { hq: [['A', 'hq']], port: [['A', 'port']], bhq: [['B', 'hq', 3]] },
      units: { s0: [['A', 'marlin', 1], ['A', 'barracuda', 1]], e1: [['B', 'barracuda', 2]], e2: [['B', 'barracuda', 1]] },
      goal: { type: 'destroy' },
      intro: 'A **Port** launches ships into the sea next to it: deploy warships there like any unit. Ships **claim every sea hex they sail through**, and your sea pays income (+$1 per 4 hexes, more through a Port). A **Marlin** destroyer shells ships 2 hexes away instead of moving. **Sink every enemy ship** in two turns.',
      hints: ['Turn 1: launch two Barracudas from the Port. Sail the Marlin to within 2 hexes of the lone gunboat (it can\'t fire on a turn it moves), and send your first gunboat out to claim sea lanes.', 'Turn 2: the Marlin shells the lone gunboat; all three Barracudas attack the pair together.'],
    },
    {
      id: 'beach', name: 'Beachhead', tier: 'Very Hard', technique: 'Transports, landings and naval gunfire',
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
      id: 'encircle', name: 'The Cauldron', tier: 'Hard', technique: 'Encirclement: cutting off a pocket to take it whole',
      brief: 'Four flags spread across an enemy pocket, and one turn. You can\'t reach them all. You don\'t have to.',
      turns: 1,
      players: { A: { name: 'You', arsenal: ['grunt'] }, B: { name: 'Pocket Army', ai: 'passive' } },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
        '~ .A .A .A .A .A .A m .B .B ~',
        '~ .A .A .B@o1 .B .B@o2 .A@g m .B ~',
        '~ .A@hq .A .B .B .B@gap .B .B .B@bhq ~',
        '~ .A .A .B@o3 .B .B@o4 .A@h m .B ~',
        '~ .A .A .A .A .A .A m .B .B ~',
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
      ],
      structs: { hq: [['A', 'hq']], bhq: [['B', 'hq', 3]] },
      units: { g: [['A', 'grunt', 2]], h: [['A', 'grunt', 2]], gap: [['B', 'grunt', 1]] },
      goal: { type: 'capture', hexes: ['o1', 'o2', 'o3', 'o4'] },
      intro: '**Encirclement:** when your land completely surrounds a pocket of 10 hexes or fewer (mountains count as walls, the sea doesn\'t), the whole pocket becomes yours at once. It only works on land with **no enemy troops** and no HQ, FOB, Port or Bunker. Find the one hex that ties this pocket to the enemy\'s homeland.',
      hints: ['The pocket is only joined to the enemy\'s land through the hex where their guard stands.', 'Attack the guard with both squads together. The moment that hex is yours, the pocket is cut off and flips to you.'],
    },
    {
      id: 'hold', name: 'Hold the Line', tier: 'Expert', technique: 'Defence: bunkers, terrain and reserves',
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
      id: 'blitz', name: 'Lightning War', tier: 'Impossible', technique: 'Everything at once',
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
    // ───────── situations: bigger boards, live enemies, real income and resupply ─────────
    {
      id: 'breakout', draft: true, name: 'Breakout', tier: 'Situation', technique: 'A cut-off division and a relief push: two forces, one plan',
      brief: 'Your 3rd Division is surrounded deep behind enemy lines. Smash the fortified gate town between them and home before the pocket falls.',
      turns: 8, live: true,
      players: { A: { name: 'You', cash: 6, arsenal: ['grunt', 'jackal', 'mauler', 'thumper'] }, B: { name: 'Iron Ring', ai: 'bot', diff: 'easy', cash: 4, arsenal: ['grunt', 'mauler', 'thumper'] } },
      map: [
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
        '~ .A .A . f .B .B hB .B .B .A .A . ~ ~ ~',
        '~ .A@hq .A@west . .B .B@n1 .B .B@n2 .B .A@pocket .A . ~ ~ ~',
        '~ .A .A . f .B fB .B@gate .B .B .A .A@p2 . ~ ~ ~',
        '~ .A .A@sw . .B .B .B .B .B@s2 .B . . ~ ~ ~',
        '~ ~ ~ . . .B .B .B@bhq .B .B ~ ~ ~ ~ ~ ~',
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
      ],
      structs: { hq: [['A', 'hq']], pocket: [['A', 'fob'], ['A', 'bunker']], gate: [['B', 'bunker', 1]], bhq: [['B', 'hq', 2]] },
      units: {
        west: [['A', 'grunt', 4], ['A', 'mauler', 1]], sw: [['A', 'grunt', 2], ['A', 'thumper', 1]],
        pocket: [['A', 'grunt', 3], ['A', 'lancer', 1]], p2: [['A', 'jackal', 2]],
        gate: [['B', 'grunt', 2]], n1: [['B', 'grunt', 2]], n2: [['B', 'grunt', 3], ['B', 'mauler', 1]], s2: [['B', 'grunt', 3]], bhq: [['B', 'grunt', 3]],
      },
      keep: ['pocket'],
      goal: { type: 'capture', hexes: ['gate'] },
      intro: '**Situation.** A live enemy, real income and resupply, eight turns. Your **3rd Division** holds a FOB in a pocket to the east; your main army is at home. Between them, the **gate town** behind a Bunker. **Take it before turn 8 ends**, and don\'t lose the pocket\'s FOB. The enemy will go for the pocket. Hit the gate from both sides at once.',
      hints: ['The pocket FOB is a deploy point: reinforce it, or the enemy will roll it up.', 'Bring the Thumper up to shell the gate, and attack it from the west and the east in the same turn: every extra side is +1 Mult.'],
    },
  ];
  // the order they're played and unlocked in (each builds on the ones before), and so their numbers
  const ORDER = ['basic', 'economy', 'pincer', 'ground', 'river', 'fob', 'leapfrog', 'loot', 'airborne', 'guns', 'cards', 'air', 'airwing', 'skyshield', 'navy', 'beach', 'encircle', 'hold', 'blitz', 'breakout', 'islands', 'relief', 'fronts', 'total'];
  SCENARIOS.sort((a, b) => (ORDER.indexOf(a.id) + 1 || 99) - (ORDER.indexOf(b.id) + 1 || 99));
  // missions still being tuned (draft: true) aren't on the board yet; the tests can still reach them
  const DRAFTS = SCENARIOS.filter(sc => sc.draft);
  for (const d of DRAFTS) SCENARIOS.splice(SCENARIOS.indexOf(d), 1);
  SCENARIOS.forEach((sc, i) => { sc.n = i + 1; });
  const byId = Object.create(null); SCENARIOS.concat(DRAFTS).forEach(s => { byId[s.id] = s; });

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
    // points of interest (a village's militia strength in gar), and resource nodes
    for (const [l, poi] of Object.entries(sc.pois || {})) { const t = tiles[at(l)]; t.poi = poi; if (poi === 'village') t.gar = (sc.gar || {})[l] || 4; }
    for (const l of sc.res || []) tiles[at(l)].res = true;
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
    s.scenario = { id, hero: heroId, live: !!sc.live, market: !!sc.market, goal: { ...sc.goal, hexes: (sc.goal.hexes || []).map(at) }, keep: (sc.keep || []).map(at), turns: sc.turns, heroTurns: 0, income, targets: (sc.goal.hexes || []).map(at), labels };
    s.log.push('🎯 ' + sc.name + ': ' + sc.brief);
    return s;
  }
  // what the menu and the client need about each mission (no boards)
  const list = () => SCENARIOS.map(({ id, n, name, tier, technique, brief, turns, reward }) => ({ id, n, name, tier, technique, brief, turns, reward }));
  // every mission pays REWARD the first time a commander clears it, and ALL_BONUS once they've cleared them all
  const REWARD = 100, ALL_BONUS = 1000;
  SCENARIOS.forEach(s => { s.reward = REWARD; });
  return { SCENARIOS, DRAFTS, build, list, get: id => byId[id], parse, REWARD, ALL_BONUS };
});
