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
    't-germany': { slot: 'territory', name: 'Germany', rarity: 'rare', price: 1200, desc: 'Black, red and gold across your whole territory.' },
    't-france': { slot: 'territory', name: 'France', rarity: 'rare', price: 1200, desc: 'The Tricolore: blue, white and red.' },
    't-italy': { slot: 'territory', name: 'Italy', rarity: 'rare', price: 1200, desc: 'Il Tricolore: green, white and red.' },
    't-ireland': { slot: 'territory', name: 'Ireland', rarity: 'rare', price: 1200, desc: 'Green, white and orange.' },
    't-netherlands': { slot: 'territory', name: 'Netherlands', rarity: 'rare', price: 1200, desc: 'Red, white and blue bands.' },
    't-poland': { slot: 'territory', name: 'Poland', rarity: 'rare', price: 1200, desc: 'White over red.' },
    't-ukraine': { slot: 'territory', name: 'Ukraine', rarity: 'rare', price: 1200, desc: 'Blue sky over golden wheat.' },
    't-spain': { slot: 'territory', name: 'Spain', rarity: 'rare', price: 1200, desc: 'Red and gold, the gold band twice as wide.' },
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
    't-lava': { slot: 'territory', name: 'Molten', rarity: 'legendary', price: 2400, desc: 'Black rock split by glowing cracks of lava.' },
    't-jolly': { slot: 'territory', name: 'Jolly Roger', rarity: 'legendary', price: 2400, desc: 'Black as night, with a skull and crossbones over your HQ.' },
    't-dazzle': { slot: 'territory', name: 'Dazzle', rarity: 'legendary', price: 2200, desc: 'Razzle-dazzle, the warship camouflage of 1917: slabs of hard stripes at clashing angles.' },
    't-tiger': { slot: 'territory', name: 'Tiger Stripe', rarity: 'epic', price: 1400, desc: 'Long, ragged jungle stripes.' },
    't-topo': { slot: 'territory', name: 'Topographic', rarity: 'epic', price: 1400, desc: 'Your land as a survey map: contour lines with every fifth one inked heavier.' },
    't-wood': { slot: 'territory', name: 'Woodland Camo', rarity: 'rare', price: 900, desc: 'Four-colour woodland camouflage, blobs the size of a hex.' },
    't-desert': { slot: 'territory', name: 'Desert Camo', rarity: 'rare', price: 900, desc: 'Three-colour desert camouflage.' },
    't-arctic': { slot: 'territory', name: 'Arctic Camo', rarity: 'rare', price: 1000, desc: 'Snow white with grey and slate.' },
    't-digital': { slot: 'territory', name: 'Digital Camo', rarity: 'rare', price: 1100, desc: 'Pixelated MARPAT-style camouflage.' },
    't-carbon': { slot: 'territory', name: 'Carbon Fibre', rarity: 'uncommon', price: 600, desc: 'A woven carbon weave.' },
    't-hazard': { slot: 'territory', name: 'Hazard', rarity: 'uncommon', price: 600, desc: 'Black and yellow chevrons.' },
    't-founder': { slot: 'territory', name: 'Founder’s Laurel', rarity: 'legendary', buy: false, desc: 'For commanders who made an account in SECTOR’s first months: gold rays and a laurel wreath round your HQ. Never sold.' },
    // auras: animated light round your frontier
    'b-neon': { slot: 'border', name: 'Neon', rarity: 'rare', price: 800, desc: 'A gas tube in your colour, flickering faintly like a real one.' },
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
    'b-aurora': { slot: 'border', name: 'Aurora', rarity: 'legendary', price: 2600, desc: 'The northern lights: curtains of green, teal and violet rising from your border.' },
    'b-solar': { slot: 'border', name: 'Solar Flare', rarity: 'legendary', price: 2600, desc: 'A white-hot corona with flares licking outward.' },
    // border lines: the frontier line itself, always in your colour
    'h-tactical': { slot: 'trim', name: 'Map Boundary', rarity: 'uncommon', price: 500, desc: 'A hard line with ticks along the outside, like a boundary on a military map.' },
    'h-double': { slot: 'trim', name: 'Double Line', rarity: 'uncommon', price: 450, desc: 'A bevelled double rule in your colour.' },
    'h-hazard': { slot: 'trim', name: 'Hazard Tape', rarity: 'uncommon', price: 500, desc: 'Yellow and black tape edged in your colour.' },
    'h-plate': { slot: 'trim', name: 'Steel Plate', rarity: 'rare', price: 800, desc: 'Riveted armour plate round your land.' },
    'h-sandbag': { slot: 'trim', name: 'Sandbags', rarity: 'rare', price: 900, desc: 'Two staggered courses of sandbags along every border.' },
    'h-rail': { slot: 'trim', name: 'Railway', rarity: 'rare', price: 900, desc: 'A railway running round your territory.' },
    'h-chain': { slot: 'trim', name: 'Heavy Chain', rarity: 'rare', price: 950, desc: 'Steel links, face-on and edge-on.' },
    'h-trench': { slot: 'trim', name: 'Trench Line', rarity: 'epic', price: 1200, desc: 'A dug trench with plank revetments, the parapet in your colour.' },
    'h-barbed': { slot: 'trim', name: 'Barbed Wire', rarity: 'epic', price: 1300, desc: 'Concertina razor wire on wooden pickets.' },
    'h-teeth': { slot: 'trim', name: 'Dragon’s Teeth', rarity: 'epic', price: 1300, desc: 'Two rows of concrete tank traps along the frontier.' },
    'h-pylons': { slot: 'trim', name: 'Power Lines', rarity: 'epic', price: 1300, desc: 'Pylons at every corner with cables sagging between them.' },
    'h-laser': { slot: 'trim', name: 'Laser Fence', rarity: 'legendary', price: 2000, desc: 'A white-hot beam between emitter posts, glowing in your colour.' },
    // banners: your name card
    'n-carbon': { slot: 'banner', name: 'Carbon', rarity: 'uncommon', price: 400, desc: 'A carbon-fibre name card.' },
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
  const VARIANTS = {
    foil: { name: 'Foil', rarity: 'rare', price: 250, desc: 'A rainbow holographic sheen.' },
    gilded: { name: 'Gilded', rarity: 'epic', price: 600, desc: 'Gold frame and a gold-washed picture.' },
    blackout: { name: 'Blackout', rarity: 'legendary', price: 1200, desc: 'Matte black, the picture in negative, and a glowing edge.' },
  };
  const CARD_MULT = { common: 1, uncommon: 1, rare: 1.25, epic: 1.5, legendary: 2, mythic: 2.5 };
  const cardIds = () => Object.keys(E.UNITS).concat(Object.keys(E.TACTICS).filter(id => !id.startsWith('drop_') || id === 'drop_rare'));
  for (const cid of cardIds()) for (const v in VARIANTS) {
    const d = E.cardDef(cid), V = VARIANTS[v];
    ITEMS['c-' + cid + '-' + v] = { slot: 'card', card: cid, variant: v, name: V.name + ' ' + d.name, rarity: V.rarity, price: Math.round(V.price * (CARD_MULT[d.rarity] || 1) / 10) * 10, desc: V.desc };
  }
  for (const id in ITEMS) ITEMS[id].id = id;
  const SLOTS = { territory: 'Territory', border: 'Auras', trim: 'Border Lines', banner: 'Banners', card: 'Cards' };
  const LOOKS = ['territory', 'border', 'trim', 'banner'];   // the slots worn on the map and name card (cards are per card)

  // ───────── coins ─────────
  // a finished match pays by placement and how well you fought; the more you've earned today, the less each match adds
  // (a smooth curve, not a wall: nobody gets an insane amount from a mis-tuned reward, and nobody is ever cut off)
  const DAY_SOFT = 600;   // after this many coins in a day, a match pays half; after twice this, a third…
  function matchCoins(r) {
    // r: { won, place, players, rounds, kills, captured, vsHumans }
    if (!r || r.rounds < 6) return { base: 0, total: 0, why: 'Too short to count (6+ rounds)' };
    let base = 30 + Math.max(0, (r.players - r.place)) * 12 + (r.won ? 70 : 0) + Math.min(30, r.kills) + Math.min(25, Math.floor(r.captured / 4));
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

  // ───────── bots: labelled as bots, but some wear a skin ─────────
  function botLoadout(rng = Math.random) {
    const out = {}, buyable = slot => Object.values(ITEMS).filter(i => i.slot === slot && i.buy !== false);
    for (const slot of LOOKS) if (rng() < 0.035) { const l = buyable(slot); out[slot] = l[Math.floor(rng() * l.length)].id; }
    return out;
  }
  // a loadout from the client is only trusted for items the profile owns (the server checks; this tidies the shape)
  function cleanLoadout(eq, owned) {
    const out = {}, has = id => ITEMS[id] && (!owned || owned.includes(id));
    for (const slot of LOOKS) if (eq && has(eq[slot]) && ITEMS[eq[slot]].slot === slot) out[slot] = eq[slot];
    return out;
  }

  return { ITEMS, VARIANTS, SLOTS, LOOKS, DAILY, WEEKLY, DAY_SOFT, matchCoins, diminish, dayKey, weekKey, msToNextDay, dailyStore, dailyObjectives, weeklyObjectives, botLoadout, cleanLoadout };
});
