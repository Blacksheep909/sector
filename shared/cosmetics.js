/* SECTOR — cosmetics: skins, coins, objectives and the daily store. Pure looks: nothing here touches the rules.
   Shared by the server (which owns profiles, coins and purchases) and the client (which draws them). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine'));
  else root.SectorCosmetics = factory(root.SectorEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  // ───────── the catalogue ─────────
  // slot: territory (pattern over your land) · border (aura on your frontier) · banner (your name card) · card (a version of one card)
  // buy: false = can't be bought (earned by being early, or by recruiting)
  const ITEMS = {
    // territory: flags and patterns laid over your land, blended with your colour so you're still you on the map
    't-usa': { slot: 'territory', name: 'Stars & Stripes', rarity: 'epic', price: 1600, desc: 'Red and white stripes across your land, stars around your HQ.' },
    't-uk': { slot: 'territory', name: 'Union', rarity: 'epic', price: 1600, desc: 'The crosses of the Union flag on every hex.' },
    't-nato': { slot: 'territory', name: 'Alliance Star', rarity: 'epic', price: 1600, desc: 'Navy blue with the four-point compass star.' },
    't-russia': { slot: 'territory', name: 'Tricolour', rarity: 'epic', price: 1600, desc: 'White, blue and red bands across your land.' },
    't-wood': { slot: 'territory', name: 'Woodland Camo', rarity: 'rare', price: 900, desc: 'Four-colour woodland camouflage.' },
    't-desert': { slot: 'territory', name: 'Desert Camo', rarity: 'rare', price: 900, desc: 'Three-colour desert camouflage.' },
    't-digital': { slot: 'territory', name: 'Digital Camo', rarity: 'rare', price: 1100, desc: 'Pixelated MARPAT-style camouflage.' },
    't-carbon': { slot: 'territory', name: 'Carbon Fibre', rarity: 'uncommon', price: 600, desc: 'A woven carbon weave.' },
    't-hazard': { slot: 'territory', name: 'Hazard', rarity: 'uncommon', price: 600, desc: 'Black and yellow chevrons.' },
    't-founder': { slot: 'territory', name: 'Founder’s Laurel', rarity: 'legendary', buy: false, desc: 'For commanders who made an account in SECTOR’s first months. Never sold.' },
    // borders: an aura round your frontier
    'b-neon': { slot: 'border', name: 'Neon', rarity: 'rare', price: 800, desc: 'Your frontier glows in your colour.' },
    'b-gold': { slot: 'border', name: 'Gold Leaf', rarity: 'epic', price: 1400, desc: 'A gilded edge on every border.' },
    'b-frost': { slot: 'border', name: 'Frostline', rarity: 'rare', price: 900, desc: 'An icy white-blue haze.' },
    'b-ember': { slot: 'border', name: 'Embers', rarity: 'epic', price: 1400, desc: 'A smouldering orange glow with sparks.' },
    'b-static': { slot: 'border', name: 'Static', rarity: 'rare', price: 900, desc: 'A crackling electric line.' },
    'b-void': { slot: 'border', name: 'Void', rarity: 'legendary', price: 2400, desc: 'A deep violet shadow that bleeds outward.' },
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
  const SLOTS = { territory: 'Territory', border: 'Borders', banner: 'Banners', card: 'Cards' };

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
  // today's store: a featured territory or border, a banner, and four card versions. Same for everyone, new every day (UTC)
  function dailyStore(day = dayKey()) {
    const r = seeded('store:' + day), buyable = slot => Object.values(ITEMS).filter(i => i.slot === slot && i.buy !== false);
    const big = pick(buyable('territory').concat(buyable('border')), 2, r), banner = pick(buyable('banner'), 1, r), cards = pick(buyable('card'), 4, r);
    return { day, items: big.concat(banner, cards).map(i => i.id) };
  }
  function dailyObjectives(day = dayKey()) { return pick(DAILY, 3, seeded('daily:' + day)); }
  function weeklyObjectives(week = weekKey()) { return pick(WEEKLY, 2, seeded('weekly:' + week)); }

  // ───────── bots: labelled as bots, but some wear a skin ─────────
  function botLoadout(rng = Math.random) {
    const out = {}, buyable = slot => Object.values(ITEMS).filter(i => i.slot === slot && i.buy !== false);
    for (const slot of ['territory', 'border', 'banner']) if (rng() < 0.08) { const l = buyable(slot); out[slot] = l[Math.floor(rng() * l.length)].id; }
    return out;
  }
  // a loadout from the client is only trusted for items the profile owns (the server checks; this tidies the shape)
  function cleanLoadout(eq, owned) {
    const out = {}, has = id => ITEMS[id] && (!owned || owned.includes(id));
    for (const slot of ['territory', 'border', 'banner']) if (eq && has(eq[slot]) && ITEMS[eq[slot]].slot === slot) out[slot] = eq[slot];
    return out;
  }

  return { ITEMS, VARIANTS, SLOTS, DAILY, WEEKLY, DAY_SOFT, matchCoins, diminish, dayKey, weekKey, msToNextDay, dailyStore, dailyObjectives, weeklyObjectives, botLoadout, cleanLoadout };
});
