/* SECTOR — cosmetics: skins, coins, objectives and the daily store. Pure looks: nothing here touches the rules.
   Shared by the server (which owns profiles, coins and purchases) and the client (which draws them). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine'));
  else root.SectorCosmetics = factory(root.SectorEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  // ───────── the catalogue ─────────
  // slot: territory (one big pattern over all your land) · border (an aura round your frontier) · trim (the frontier line itself)
  //       · banner (your name card) · card (a version of one card)
  // buy: false = can't be bought (earned by being early, or by recruiting)
  const ITEMS = {
    // territory: one big picture over your whole territory (a flag draped across it, camouflage that spans hexes),
    // blended with your colour so you're still you on the map
    't-usa': { slot: 'territory', name: 'Stars & Stripes', rarity: 'epic', price: 1600, desc: 'One giant flag across your whole territory. It grows as you do.' },
    't-uk': { slot: 'territory', name: 'Union', rarity: 'epic', price: 1600, desc: 'The Union flag, draped across all your land.' },
    't-nato': { slot: 'territory', name: 'Alliance Star', rarity: 'epic', price: 1600, desc: 'Navy blue, with the great compass star over your HQ and its lines running to your borders.' },
    't-russia': { slot: 'territory', name: 'Tricolour', rarity: 'epic', price: 1600, desc: 'White, blue and red bands across your whole territory.' },
    't-germany': { slot: 'territory', name: 'Germany', rarity: 'epic', price: 1500, desc: 'Black, red and gold across your whole territory.' },
    't-france': { slot: 'territory', name: 'France', rarity: 'epic', price: 1500, desc: 'The Tricolore: blue, white and red.' },
    't-italy': { slot: 'territory', name: 'Italy', rarity: 'epic', price: 1500, desc: 'Il Tricolore: green, white and red.' },
    't-ireland': { slot: 'territory', name: 'Ireland', rarity: 'epic', price: 1500, desc: 'Green, white and orange.' },
    't-netherlands': { slot: 'territory', name: 'Netherlands', rarity: 'epic', price: 1500, desc: 'Red, white and blue bands.' },
    't-poland': { slot: 'territory', name: 'Poland', rarity: 'epic', price: 1500, desc: 'White over red.' },
    't-ukraine': { slot: 'territory', name: 'Ukraine', rarity: 'epic', price: 1500, desc: 'Blue sky over golden wheat.' },
    't-spain': { slot: 'territory', name: 'Spain', rarity: 'epic', price: 1500, desc: 'Red and gold, the gold band twice as wide.' },
    't-sweden': { slot: 'territory', name: 'Sweden', rarity: 'epic', price: 1500, desc: 'A golden Nordic cross on blue, crossing at your HQ.' },
    't-norway': { slot: 'territory', name: 'Norway', rarity: 'epic', price: 1500, desc: 'A blue and white Nordic cross on red, crossing at your HQ.' },
    't-denmark': { slot: 'territory', name: 'Denmark', rarity: 'epic', price: 1500, desc: 'The Dannebrog: a white cross on red, crossing at your HQ.' },
    't-scotland': { slot: 'territory', name: 'Scotland', rarity: 'epic', price: 1500, desc: 'The Saltire: a white cross on blue, crossing at your HQ.' },
    't-japan': { slot: 'territory', name: 'Japan', rarity: 'epic', price: 1500, desc: 'The rising sun disc, centred on your HQ.' },
    't-korea': { slot: 'territory', name: 'South Korea', rarity: 'epic', price: 1600, desc: 'The Taegukgi: the red and blue taegeuk round your HQ, the four trigrams around it.' },
    't-china': { slot: 'territory', name: 'China', rarity: 'epic', price: 1600, desc: 'Red with the five golden stars over your HQ.' },
    't-india': { slot: 'territory', name: 'India', rarity: 'epic', price: 1600, desc: 'Saffron, white and green, with the Ashoka Chakra at your HQ.' },
    't-canada': { slot: 'territory', name: 'Canada', rarity: 'epic', price: 1600, desc: 'The Maple Leaf, centred on your HQ.' },
    't-brazil': { slot: 'territory', name: 'Brazil', rarity: 'epic', price: 1600, desc: 'The golden rhombus and starry globe, round your HQ.' },
    't-australia': { slot: 'territory', name: 'Australia', rarity: 'epic', price: 1600, desc: 'The Union Jack, the Commonwealth Star and the Southern Cross.' },
    't-blueprint': { slot: 'territory', name: 'Blueprint', rarity: 'epic', price: 1300, desc: 'Your land as an engineer’s drawing: grid paper, gears and dimension lines.' },
    't-circuit': { slot: 'territory', name: 'Circuit Board', rarity: 'epic', price: 1400, desc: 'Copper traces, solder pads and chips on green board.' },
    't-splinter': { slot: 'territory', name: 'Splinter Camo', rarity: 'rare', price: 1000, desc: 'Hard-edged splinters of green and brown, with rain streaks.' },
    't-nightvision': { slot: 'territory', name: 'Night Vision', rarity: 'epic', price: 1400, desc: 'Seen through the goggles: green phosphor, grain and scan lines.' },
    't-lava': { slot: 'territory', name: 'Molten', rarity: 'mythic', price: 2400, desc: 'Black rock split by glowing cracks of lava.' },
    't-jolly': { slot: 'territory', name: 'Jolly Roger', rarity: 'legendary', price: 2400, desc: 'Black as night, with a skull and crossbones over your HQ.' },
    't-dazzle': { slot: 'territory', name: 'Dazzle', rarity: 'legendary', price: 2200, desc: 'Razzle-dazzle, the warship camouflage of 1917: slabs of hard stripes at clashing angles.' },
    't-tiger': { slot: 'territory', name: 'Tiger Stripe', rarity: 'epic', price: 1400, desc: 'Long, ragged jungle stripes.' },
    't-topo': { slot: 'territory', name: 'Topographic', rarity: 'epic', price: 1400, desc: 'Your land as a survey map: contour lines with every fifth one inked heavier.' },
    't-wood': { slot: 'territory', name: 'Woodland Camo', rarity: 'rare', price: 900, desc: 'Four-colour woodland camouflage, blobs the size of a hex.' },
    't-desert': { slot: 'territory', name: 'Desert Camo', rarity: 'rare', price: 900, desc: 'Three-colour desert camouflage.' },
    't-arctic': { slot: 'territory', name: 'Arctic Camo', rarity: 'rare', price: 1000, desc: 'Snow white with grey and slate.' },
    't-digital': { slot: 'territory', name: 'Digital Camo', rarity: 'rare', price: 1100, desc: 'Pixelated MARPAT-style camouflage.' },
    't-carbon': { slot: 'territory', name: 'Carbon Fibre', rarity: 'common', price: 600, desc: 'A woven carbon weave.' },
    't-hazard': { slot: 'territory', name: 'Hazard', rarity: 'uncommon', price: 600, desc: 'Black and yellow chevrons.' },
    't-founder': { slot: 'territory', name: 'Founder’s Laurel', rarity: 'legendary', buy: false, desc: 'For commanders who made an account in SECTOR’s first months: gold rays and a laurel wreath round your HQ. Never sold.' },
    // auras: animated light round your frontier
    'b-neon': { slot: 'border', name: 'Neon', rarity: 'uncommon', price: 800, desc: 'A gas tube in your colour, flickering faintly like a real one.' },
    'b-pulse': { slot: 'border', name: 'Sonar', rarity: 'rare', price: 900, desc: 'A ring of light ripples out from your border while a ping races round it.' },
    'b-frost': { slot: 'border', name: 'Frostline', rarity: 'rare', price: 900, desc: 'Icy light with crystals catching the sun and snow drifting off the edge.' },
    'b-static': { slot: 'border', name: 'Static', rarity: 'rare', price: 950, desc: 'Live electricity: the arc re-forms a dozen times a second and throws sparks.' },
    'b-gold': { slot: 'border', name: 'Gold Leaf', rarity: 'epic', price: 1400, desc: 'Polished gilt edging, with a glint that runs all the way round.' },
    'b-ember': { slot: 'border', name: 'Embers', rarity: 'epic', price: 1400, desc: 'A smouldering line with embers lifting off it.' },
    'b-plasma': { slot: 'border', name: 'Plasma', rarity: 'epic', price: 1500, desc: 'Two charged currents, cyan and magenta, flowing opposite ways.' },
    'b-toxic': { slot: 'border', name: 'Toxic', rarity: 'epic', price: 1400, desc: 'A radioactive glow that breathes, with bubbles rising off it.' },
    'b-prism': { slot: 'border', name: 'Prism', rarity: 'epic', price: 1600, desc: 'A holographic edge: the whole spectrum slides along your border.' },
    'b-blood': { slot: 'border', name: 'Blood Moon', rarity: 'epic', price: 1500, desc: 'Deep crimson light that beats like a heart.' },
    'b-stars': { slot: 'border', name: 'Starfield', rarity: 'epic', price: 1500, desc: 'A band of night sky round your land, stars twinkling in it.' },
    'b-void': { slot: 'border', name: 'Void', rarity: 'legendary', price: 2400, desc: 'Dark matter: a black rim, a violet edge, and tendrils that reach out and pull back.' },
    'b-aurora': { slot: 'border', name: 'Aurora', rarity: 'mythic', price: 2600, desc: 'The northern lights: curtains of green, teal and violet rising from your border.' },
    'b-solar': { slot: 'border', name: 'Solar Flare', rarity: 'legendary', price: 2600, desc: 'A white-hot corona with flares licking outward.' },
    // border lines: the frontier line itself, always in your colour
    'h-tactical': { slot: 'trim', name: 'Map Boundary', rarity: 'uncommon', price: 500, desc: 'A hard line with ticks along the outside, like a boundary on a military map.' },
    'h-double': { slot: 'trim', name: 'Double Line', rarity: 'common', price: 450, desc: 'A bevelled double rule in your colour.' },
    'h-hazard': { slot: 'trim', name: 'Hazard Tape', rarity: 'uncommon', price: 500, desc: 'Yellow and black tape edged in your colour.' },
    'h-plate': { slot: 'trim', name: 'Steel Plate', rarity: 'rare', price: 800, desc: 'Riveted armour plate round your land.' },
    'h-sandbag': { slot: 'trim', name: 'Sandbags', rarity: 'rare', price: 900, desc: 'Two staggered courses of sandbags along every border.' },
    'h-rail': { slot: 'trim', name: 'Railway', rarity: 'rare', price: 900, desc: 'A railway running round your territory.' },
    'h-chain': { slot: 'trim', name: 'Heavy Chain', rarity: 'rare', price: 950, desc: 'Steel links, face-on and edge-on.' },
    'h-trench': { slot: 'trim', name: 'Trench Line', rarity: 'epic', price: 1200, desc: 'A dug trench with plank revetments, the parapet in your colour.' },
    'h-barbed': { slot: 'trim', name: 'Barbed Wire', rarity: 'epic', price: 1300, desc: 'Concertina razor wire on wooden pickets.' },
    'h-teeth': { slot: 'trim', name: 'Dragon’s Teeth', rarity: 'epic', price: 1300, desc: 'Two rows of concrete tank traps along the frontier.' },
    'h-pylons': { slot: 'trim', name: 'Power Lines', rarity: 'epic', price: 1300, desc: 'Pylons at every corner with cables sagging between them.' },
    'h-laser': { slot: 'trim', name: 'Laser Fence', rarity: 'mythic', price: 2000, desc: 'A white-hot beam between emitter posts, glowing in your colour.' },
    // banners: your name card
    'n-carbon': { slot: 'banner', name: 'Carbon', rarity: 'common', price: 400, desc: 'A carbon-fibre name card.' },
    'n-usa': { slot: 'banner', name: 'Old Glory', rarity: 'rare', price: 700, desc: 'Stars and stripes behind your name.' },
    'n-uk': { slot: 'banner', name: 'Union', rarity: 'rare', price: 700, desc: 'The Union flag behind your name.' },
    'n-nato': { slot: 'banner', name: 'Alliance', rarity: 'rare', price: 700, desc: 'Navy and the compass star.' },
    'n-russia': { slot: 'banner', name: 'Tricolour', rarity: 'rare', price: 700, desc: 'White, blue and red.' },
    'n-camo': { slot: 'banner', name: 'Woodland', rarity: 'uncommon', price: 450, desc: 'Woodland camouflage.' },
    'n-gold': { slot: 'banner', name: 'Gilded', rarity: 'epic', price: 1200, desc: 'Gold with a slow sheen.' },
    'n-founder': { slot: 'banner', name: 'Founder', rarity: 'legendary', buy: false, desc: 'For commanders who made an account in SECTOR’s first months. Never sold.' },
    'n-recruiter': { slot: 'banner', name: 'Recruiter', rarity: 'epic', buy: false, desc: 'Bring 3 friends who make an account and finish a game.' },
  };
  // every card comes in three versions
  // one of every rarity, uncommon to mythic
  const VARIANTS = {
    worn: { name: 'Battle-Worn', rarity: 'uncommon', price: 120, desc: 'Scuffed, taped up and stencilled: it has seen some fighting.' },
    foil: { name: 'Foil', rarity: 'rare', price: 250, desc: 'A rainbow holographic sheen.' },
    gilded: { name: 'Gilded', rarity: 'epic', price: 600, desc: 'Gold frame and a gold-washed picture.' },
    blackout: { name: 'Blackout', rarity: 'legendary', price: 1200, desc: 'Matte black, the picture in negative, and a glowing edge.' },
    celestial: { name: 'Celestial', rarity: 'mythic', price: 2400, desc: 'Night sky and drifting stars inside a shifting aurora frame. The rarest version there is.' },
  };
  const CARD_MULT = { common: 1, uncommon: 1, rare: 1.25, epic: 1.5, legendary: 2, mythic: 2.5 };
  // card versions are for units only, the cards you put on the map (tactic cards have none)
  const cardIds = () => Object.keys(E.UNITS);
  // a tactic-card version bought before they were retired: what it cost, to refund it
  function retiredCardPrice(itemId) {
    const m = /^c-(.+)-([a-z]+)$/.exec(itemId || ''); if (!m || E.UNITS[m[1]] || !VARIANTS[m[2]]) return 0;
    const d = E.cardDef(m[1]); return d ? Math.round(VARIANTS[m[2]].price * (CARD_MULT[d.rarity] || 1) / 10) * 10 : 0;
  }
  // every card's mythic version has a name of its own
  const MYTHIC_NAME = {
    grunt: 'Valhalla', skitter: 'Phantom Limb', thumper: 'Thunderclap', barracuda: 'Moonshark', stinger: 'Starwasp', corpsman: 'Seraphic', jackal: 'Anubis', coyote: 'Trickster',
    lancer: 'Comet', warden: 'All-Seeing', sapper: 'Supernova', scorpion: 'Antares', bulwark: 'Aegis Eternal', hornet: 'Nebula', mauler: 'Dreadnought Prime', ark: 'Covenant',
    marlin: 'Tidecaller', basilisk: 'Gorgon', ranger: 'Pathfinder', skyguard: 'Heavenward', hellcat: 'Inferno Queen', wraith: 'Revenant', kraken: 'Leviathan Deep', goliath: 'Colossus',
    valkyrie: 'Einherjar', mule: 'Sleipnir', wren: 'Hummingstar', ravager: 'Starfall', stormcrow: 'Odin’s Raven', phantom: 'Ghost Protocol', hailstorm: 'Meteor Shower', sentinel: 'Watcher of Worlds', grumble: 'Polar Night', bastion: 'Celestial Keep',
    leviathan: 'World Serpent', titan: 'Atlas', seraph: 'Archangel', banshee: 'Wailing Star', carrier: 'Starhaven', oracle: 'Pythia', trident: 'Poseidon', abyssal: 'Event Horizon',
  };
  for (const cid of cardIds()) for (const v in VARIANTS) {
    const d = E.cardDef(cid), V = VARIANTS[v], mythic = v === 'celestial' && MYTHIC_NAME[cid];
    ITEMS['c-' + cid + '-' + v] = { slot: 'card', card: cid, variant: v, name: mythic ? mythic + ' ' + d.name : V.name + ' ' + d.name, rarity: V.rarity, price: Math.round(V.price * (CARD_MULT[d.rarity] || 1) / 10) * 10, desc: mythic ? 'Mythic. ' + V.desc : V.desc };
  }
  // what a look costs follows its rarity: the rarer it is, the more it costs (cards are priced above, by version)
  const PRICE = { common: 200, uncommon: 450, rare: 900, epic: 1500, legendary: 2400, mythic: 3600 }, SLOT_PRICE = { territory: 1, border: 1, trim: 0.85, banner: 0.6 };
  for (const id in ITEMS) { const it = ITEMS[id]; if (it.slot !== 'card' && it.buy !== false && PRICE[it.rarity]) it.price = Math.round(PRICE[it.rarity] * SLOT_PRICE[it.slot] / 50) * 50; }
  // every country's flag costs the same, whichever country it is
  const COUNTRIES = ['usa', 'uk', 'russia', 'germany', 'france', 'italy', 'ireland', 'netherlands', 'poland', 'ukraine', 'spain', 'sweden', 'norway', 'denmark', 'scotland', 'japan', 'korea', 'china', 'india', 'canada', 'brazil', 'australia'];
  for (const c of COUNTRIES) Object.assign(ITEMS['t-' + c], { rarity: 'epic', price: PRICE.epic, country: true });
  for (const id in ITEMS) ITEMS[id].id = id;
  // anything can be bought any day: at its price while it's in today's store, or for OFF_ROTATION times that otherwise
  const OFF_ROTATION = 3;
  const priceOf = (id, day) => { const it = ITEMS[id]; if (!it) return 0; return dailyStore(day).items.includes(id) ? it.price : it.price * OFF_ROTATION; };
  const SLOTS = { territory: 'Territory', border: 'Auras', trim: 'Border Lines', banner: 'Banners', card: 'Cards' };
  const LOOKS = ['territory', 'border', 'trim', 'banner'];   // the slots worn on the map and name card (cards are per card)

  // ───────── crates: card skins aren't sold outright. A few rotate through the daily store; otherwise you open crates ─────────
  // odds are percentages by rarity; a duplicate pays back part of its value
  const BOXES = {
    field: { name: 'Field Pack', price: 300, odds: { uncommon: 62, rare: 28, epic: 8, legendary: 1.8, mythic: 0.2 }, desc: 'A card skin for any unit card: mostly Battle-Worn and Foil, with a slim chance of something special.' },
    elite: { name: 'Elite Pack', price: 1000, odds: { rare: 55, epic: 32, legendary: 11, mythic: 2 }, desc: 'Rare or better, guaranteed. One in fifty is Mythic.' },
  };
  const DUP_REFUND = 0.3;
  function rollBox(boxId, owned, rng = Math.random) {
    const B = BOXES[boxId]; if (!B) return null;
    let x = rng() * 100, rarity = 'uncommon';
    for (const [r, w] of Object.entries(B.odds)) { rarity = r; if (x < w) break; x -= w; }
    const pool = Object.values(ITEMS).filter(i => i.slot === 'card' && i.rarity === rarity), fresh = pool.filter(i => !(owned || []).includes(i.id));
    const list = fresh.length ? fresh : pool, it = list[Math.floor(rng() * list.length)];
    return { item: it.id, rarity, dup: !fresh.length, refund: fresh.length ? 0 : Math.round(it.price * DUP_REFUND) };
  }

  // ───────── coins ─────────
  // a finished match pays by placement and how well you fought; the more you've earned today, the less each match adds
  // (a smooth curve, not a wall: nobody gets an insane amount from a mis-tuned reward, and nobody is ever cut off)
  const DAY_SOFT = 600;   // after this many coins in a day, a match pays half; after twice this, a third…
  // a game counts once you've played at least 5 minutes of it and destroyed at least 10 enemy units
  const MIN_MINUTES = 5, MIN_KILLS = 10;
  const counts = r => !!r && (r.minutes ?? 99) >= MIN_MINUTES && (r.kills || 0) >= MIN_KILLS;
  function matchCoins(r) {
    // r: { won, place, players, rounds, minutes, kills, captured, vsHumans, left }
    // left: you walked out mid-war. You're paid for what you did up to then (no win, no placing), and nothing after
    if (!counts(r)) return { base: 0, total: 0, why: 'Too short to count: play ' + MIN_MINUTES + '+ minutes and destroy ' + MIN_KILLS + '+ enemy units' };
    let base = (r.left ? 15 : 30 + Math.max(0, (r.players - r.place)) * 12 + (r.won ? 70 : 0)) + Math.min(30, r.kills) + Math.min(25, Math.floor(r.captured / 4));
    if (!r.vsHumans) base = Math.round(base * 0.6);   // bot games count, at a lower rate
    return { base, total: base };
  }
  function diminish(amount, earnedToday) { return Math.round(amount / (1 + Math.max(0, earnedToday) / DAY_SOFT)); }

  // ───────── objectives ─────────
  // stat keys add up over finished games: games, wins, kills, captured, legendaries (played), crates (opened), bridges (built)
  const DAILY = [
    { id: 'd-play2', text: 'Finish 2 games', stat: 'games', need: 2, coins: 120 },
    { id: 'd-win', text: 'Win a game', stat: 'wins', need: 1, coins: 150 },
    { id: 'd-cap60', text: 'Capture 60 hexes', stat: 'captured', need: 60, coins: 100 },
    { id: 'd-kill25', text: 'Destroy 25 enemy units', stat: 'kills', need: 25, coins: 100 },
    { id: 'd-crate2', text: 'Open 2 Supply Drops', stat: 'crates', need: 2, coins: 80 },
    { id: 'd-cap120', text: 'Capture 120 hexes', stat: 'captured', need: 120, coins: 160 },
  ];
  const WEEKLY = [
    { id: 'w-win5', text: 'Win 5 games', stat: 'wins', need: 5, coins: 700 },
    { id: 'w-play12', text: 'Finish 12 games', stat: 'games', need: 12, coins: 600 },
    { id: 'w-kill200', text: 'Destroy 200 enemy units', stat: 'kills', need: 200, coins: 600 },
    { id: 'w-cap600', text: 'Capture 600 hexes', stat: 'captured', need: 600, coins: 650 },
  ];

  // ───────── days, weeks and the daily store ─────────
  const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
  const weekKey = (t = Date.now()) => { const d = new Date(t); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  const msToNextDay = (t = Date.now()) => { const d = new Date(t); d.setUTCHours(24, 0, 0, 0); return d - t; };
  function seeded(str) { let h = E.hashStr(str); return () => { h = (h + 0x6D2B79F5) | 0; let x = Math.imul(h ^ (h >>> 15), 1 | h); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
  function pick(list, n, r) { const l = list.slice(), out = []; while (out.length < n && l.length) out.push(l.splice(Math.floor(r() * l.length), 1)[0]); return out; }
  // today's store: three featured territories, auras or border lines, a banner, and four card versions. Same for everyone, new every day (UTC)
  function dailyStore(day = dayKey()) {
    const r = seeded('store:' + day), buyable = slot => Object.values(ITEMS).filter(i => i.slot === slot && i.buy !== false);
    const big = pick(buyable('territory').concat(buyable('border'), buyable('trim')), 3, r), banner = pick(buyable('banner'), 1, r), cards = pick(buyable('card'), 4, r);
    return { day, items: big.concat(banner, cards).map(i => i.id) };
  }
  function dailyObjectives(day = dayKey()) { return pick(DAILY, 3, seeded('daily:' + day)); }
  function weeklyObjectives(week = weekKey()) { return pick(WEEKLY, 2, seeded('weekly:' + week)); }

  // ───────── factions: everyone starts with one; the rest are unlocked with Valor in the Store ─────────
  const FACTION_START = 'iron', FACTION_PRICE = 1500;
  const factionsOf = p => { const f = (p && p.factions) || []; return f.includes(FACTION_START) ? f : [FACTION_START, ...f]; };

  // ───────── bots: labelled as bots, but some wear a skin ─────────
  function botLoadout(rng = Math.random) {
    const out = {}, buyable = slot => Object.values(ITEMS).filter(i => i.slot === slot && i.buy !== false);
    for (const slot of LOOKS) if (rng() < 0.02) { const l = buyable(slot); out[slot] = l[Math.floor(rng() * l.length)].id; }
    if (rng() < 0.02) { const l = buyable('card'), it = l[Math.floor(rng() * l.length)]; out.cards = { [it.card]: it.variant }; }
    return out;
  }
  // a loadout from the client is only trusted for items the profile owns (the server checks; this tidies the shape)
  // cards: the card versions equipped ({ cardId: variant }), shown to everyone on the board and in fights
  function cleanLoadout(eq, owned, cards) {
    const out = {}, has = id => ITEMS[id] && (!owned || owned.includes(id));
    for (const slot of LOOKS) if (eq && has(eq[slot]) && ITEMS[eq[slot]].slot === slot) out[slot] = eq[slot];
    if (cards) for (const cid in cards) if (has('c-' + cid + '-' + cards[cid])) (out.cards = out.cards || {})[cid] = cards[cid];
    return out;
  }

  // plain dictionaries: '__proto__', 'constructor' and the like are never items, crates or slots (see engine.js)
  for (const t of [ITEMS, VARIANTS, SLOTS, BOXES, PRICE, CARD_MULT]) Object.setPrototypeOf(t, null);
  return { retiredCardPrice, OFF_ROTATION, priceOf, FACTION_START, FACTION_PRICE, factionsOf, ITEMS, VARIANTS, SLOTS, LOOKS, BOXES, rollBox, DAILY, WEEKLY, DAY_SOFT, matchCoins, matchCounts: counts, MIN_MINUTES, MIN_KILLS, diminish, dayKey, weekKey, msToNextDay, dailyStore, dailyObjectives, weeklyObjectives, botLoadout, cleanLoadout };
});
