/* SECTOR — shared rules engine (runs on server and in browser) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SectorEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ───────────────────────── hex math ─────────────────────────
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const key = (q, r) => q + ',' + r;
  function parse(k) { const i = k.indexOf(','); return [+k.slice(0, i), +k.slice(i + 1)]; }
  function dist(a, b) {
    const [q1, r1] = parse(a), [q2, r2] = parse(b);
    const dq = q1 - q2, dr = r1 - r2;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  }
  function neighbors(k) { const [q, r] = parse(k); return DIRS.map(d => key(q + d[0], r + d[1])); }
  function area(k, n) {
    const [q, r] = parse(k), out = [];
    for (let dq = -n; dq <= n; dq++)
      for (let dr = Math.max(-n, -dq - n); dr <= Math.min(n, -dq + n); dr++) out.push(key(q + dq, r + dr));
    return out;
  }
  function cubeRound(x, z) {
    const y = -x - z;
    let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
    const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
    return key(rx, rz);
  }
  function line(a, b) {
    const n = dist(a, b), [q1, r1] = parse(a), [q2, r2] = parse(b), out = [];
    for (let i = 0; i <= n; i++) {
      const t = n === 0 ? 0 : i / n;
      out.push(cubeRound(q1 + (q2 - q1) * t + 1e-6, r1 + (r2 - r1) * t + 1e-6));
    }
    return out;
  }

  // ───────────────────────── rng / noise ─────────────────────────
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function makeNoise(seed) {
    const h = (x, y) => {
      let n = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    };
    const sm = t => t * t * (3 - 2 * t);
    const n2 = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
      const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
      return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
    };
    return (x, y, oct = 3) => {
      let v = 0, amp = 1, f = 1, tot = 0;
      for (let i = 0; i < oct; i++) { v += n2(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2; }
      return v / tot;
    };
  }

  // ───────────────────────── content ─────────────────────────
  const RARITY = {
    common: { name: 'Common', color: '#9fb3c8' },
    uncommon: { name: 'Uncommon', color: '#3fd07a' },
    rare: { name: 'Rare', color: '#3fa0ff' },
    epic: { name: 'Epic', color: '#c25cff' },
    legendary: { name: 'Legendary', color: '#ffb52e' },
    mythic: { name: 'Mythic', color: '#f4fbff' },
  };
  const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

  // crates come from Supply Drop cards: the reel spins a tier, then 3 cards are drawn with its odds
  const CRATES = {
    standard: { name: 'Standard Crate', odds: { common: 46, uncommon: 30, rare: 15, epic: 7, legendary: 2, mythic: 0 } },
    gilded: { name: 'Gilded Crate', odds: { common: 8, uncommon: 30, rare: 32, epic: 21, legendary: 8, mythic: 1 } },
    mythic: { name: 'Mythic Crate', odds: { common: 0, uncommon: 6, rare: 29, epic: 36, legendary: 25, mythic: 4 } },
  };
  // reel odds per Supply Drop rarity (standard / gilded / mythic)
  const DROP_TIERS = { drop_rare: { standard: 60, gilded: 32, mythic: 8 }, drop_epic: { standard: 15, gilded: 55, mythic: 30 }, drop_legendary: { standard: 0, gilded: 35, mythic: 65 } };
  const TURN_ODDS = { common: 45, uncommon: 30, rare: 16, epic: 7, legendary: 2, mythic: 0.5 };
  const SCRAP_VALUE = 2, DECK_MAX = 10, MAX_LEVEL = 3;

  const TERRAIN = {
    water: { name: 'Sea', land: false },
    plains: { name: 'Plains', land: true },
    forest: { name: 'Forest', land: true, defMult: 1 },
    hills: { name: 'Highlands', land: true, defMult: 2, moveCost: 2 },
    desert: { name: 'Desert', land: true },
    jungle: { name: 'Jungle', land: true, defMult: 1, moveCost: 2 },
    tundra: { name: 'Tundra', land: true, moveCost: 2 },
    swamp: { name: 'Swamp', land: true, moveCost: 2, bog: true },
    canyon: { name: 'Red Canyons', land: true, defMult: 1, moveCost: 2 },
    mountain: { name: 'Mountains', land: false },
  };

  // cls: inf | veh | air | art | sea
  const UNITS = {
    grunt: { name: 'Grunts', cls: 'inf', cost: 2, atk: 2, def: 2, mv: 2, rarity: 'common', desc: 'Cheap, dependable rifle squad.' },
    skitter: { name: 'Skitter', cls: 'veh', cost: 3, atk: 2, def: 1, mv: 4, rarity: 'common', desc: 'Raider buggy. Grabs land fast.' },
    thumper: { name: 'Thumper', cls: 'art', cost: 4, atk: 3, def: 1, mv: 1, range: 2, rarity: 'common', desc: 'Mortar crew. Fires 2 hexes instead of moving.' },
    barracuda: { name: 'Barracuda', cls: 'sea', cost: 4, atk: 3, def: 2, mv: 4, rarity: 'common', desc: 'Fast gunboat. Claims sea lanes, raids coasts.' },
    stinger: { name: 'Stinger', cls: 'inf', cost: 3, atk: 1, def: 2, mv: 2, rarity: 'common', ability: 'aa', aa: 3, desc: 'MANPADS team. Anti-air: +3 Chips in any fight involving enemy aircraft.' },
    corpsman: { name: 'Corpsman', cls: 'inf', cost: 3, atk: 1, def: 3, mv: 2, rarity: 'common', ability: 'medic', desc: 'Medic squad. Its stack never suffers pyrrhic losses.' },
    lancer: { name: 'Lancer', cls: 'inf', cost: 4, atk: 3, def: 2, mv: 2, rarity: 'uncommon', ability: 'hunter', desc: 'Tank Hunter: +3 Chips when fighting vehicles.' },
    warden: { name: 'Warden', cls: 'air', cost: 4, atk: 1, def: 3, mv: 3, rarity: 'uncommon', ability: 'aegis', desc: 'Airborne radar plane. Aegis: +1 Mult when its hex defends.' },
    sapper: { name: 'Sapper', cls: 'inf', cost: 4, atk: 2, def: 2, mv: 2, rarity: 'uncommon', ability: 'sapper', desc: 'Demolitions: +3 Chips attacking a hex with buildings.' },
    scorpion: { name: 'Scorpion', cls: 'veh', cost: 5, atk: 2, def: 3, mv: 3, rarity: 'uncommon', ability: 'aa', aa: 4, desc: 'Flak tank. Anti-air: +4 Chips in any fight involving enemy aircraft.' },
    bulwark: { name: 'Bulwark', cls: 'veh', cost: 6, atk: 3, def: 5, mv: 3, rarity: 'uncommon', desc: 'Armoured carrier. Holds the line.' },
    hornet: { name: 'Hornet', cls: 'air', cost: 5, atk: 4, def: 1, mv: 4, rarity: 'uncommon', desc: 'Strike drone. Flies over mountains and water.' },
    mauler: { name: 'Mauler', cls: 'veh', cost: 6, atk: 5, def: 4, mv: 2, rarity: 'uncommon', desc: 'Main battle tank.' },
    ark: { name: 'Ark', cls: 'sea', cost: 4, atk: 0, def: 3, mv: 4, rarity: 'uncommon', ability: 'transport', desc: 'Transport. Carries up to 3 land units across the sea.' },
    marlin: { name: 'Marlin', cls: 'sea', cost: 7, atk: 5, def: 4, mv: 4, range: 2, rarity: 'rare', desc: 'Destroyer. Shells coasts and ships 2 hexes away.' },
    basilisk: { name: 'Basilisk', cls: 'art', cost: 7, atk: 7, def: 2, mv: 1, range: 3, rarity: 'rare', desc: 'Rocket artillery truck. Fires 3 hexes.' },
    ranger: { name: 'Ranger', cls: 'inf', cost: 6, atk: 4, def: 3, mv: 3, rarity: 'rare', ability: 'pathfinder', desc: 'Pathfinders: rough terrain costs only 1 move.' },
    skyguard: { name: 'Skyguard', cls: 'veh', cost: 7, atk: 3, def: 4, mv: 3, rarity: 'rare', ability: 'aa', aa: 6, desc: 'Gun-missile air defence truck. Anti-air: +6 Chips in any fight involving enemy aircraft.' },
    hellcat: { name: 'Hellcat', cls: 'veh', cost: 7, atk: 6, def: 2, mv: 3, rarity: 'rare', ability: 'blitzer', desc: 'Strike tank. Can act on the turn it is deployed.' },
    wraith: { name: 'Wraith', cls: 'veh', cost: 8, atk: 6, def: 3, mv: 4, rarity: 'rare', ability: 'hover', desc: 'Armed hovercraft. Glides across water.' },
    kraken: { name: 'Kraken', cls: 'sea', cost: 8, atk: 7, def: 2, mv: 4, rarity: 'rare', ability: 'torpedo', desc: 'Submarine. Torpedoes: +4 Chips vs ships.' },
    goliath: { name: 'Goliath', cls: 'veh', cost: 10, atk: 7, def: 6, mv: 1, rarity: 'epic', ability: 'siege', desc: 'Siege mortar tank. +2 Mult vs fortified hexes.' },
    valkyrie: { name: 'Valkyrie', cls: 'air', cost: 10, atk: 6, def: 4, mv: 4, rarity: 'epic', ability: 'strafe', desc: 'Tiltrotor assault transport. Strafing Run: +2 Mult attacking ground targets.' },
    phantom: { name: 'Phantom', cls: 'air', cost: 10, atk: 7, def: 3, mv: 5, rarity: 'epic', ability: 'stealth', desc: 'Stealth bomber. Immune to artillery, airstrikes and bombardment.' },
    sentinel: { name: 'Sentinel', cls: 'art', cost: 9, atk: 6, def: 3, mv: 1, range: 3, rarity: 'epic', ability: 'sam', aa: 4, desc: 'SAM battery. Shoots down aircraft up to 3 hexes away (air targets only). +4 Chips vs aircraft.' },
    bastion: { name: 'Bastion', cls: 'sea', cost: 11, atk: 8, def: 8, mv: 3, range: 3, rarity: 'epic', desc: 'Battleship. Long guns, range 3.' },
    leviathan: { name: 'Leviathan', cls: 'veh', cost: 14, atk: 12, def: 10, mv: 1, rarity: 'legendary', ability: 'juggernaut', desc: 'Land dreadnought. Never suffers pyrrhic losses.' },
    titan: { name: 'Titan', cls: 'veh', cost: 16, atk: 13, def: 12, mv: 1, rarity: 'legendary', ability: 'titan', desc: 'Landship with naval guns. Siege Breaker and never suffers pyrrhic losses.' },
    seraph: { name: 'Seraph', cls: 'air', cost: 12, atk: 9, def: 4, mv: 5, rarity: 'legendary', ability: 'strafe', desc: 'Heavy gunship. Strafing Run: +2 Mult attacking ground targets.' },
    carrier: { name: 'Carrier', cls: 'sea', cost: 13, atk: 3, def: 9, mv: 3, rarity: 'legendary', ability: 'carrier', desc: 'Floating airbase: deploy aircraft onto it and fly them off it. Holds 4.' },
    oracle: { name: 'Oracle', cls: 'art', cost: 11, atk: 8, def: 3, mv: 2, range: 4, rarity: 'legendary', ability: 'orbital', desc: 'Orbital uplink. Range 4, ignores mountains.' },
    abyssal: { name: 'Abyssal', cls: 'sea', cost: 15, atk: 12, def: 10, mv: 3, range: 4, rarity: 'legendary', ability: 'juggernaut', desc: 'Sea dreadnought. Range 4. Never suffers pyrrhic losses.' },
  };

  // target: none | ownHex | ownStack | spawn | enemyUnits | heli | enemyStruct | area | nuke | mutiny
  const TACTICS = {
    smoke: { name: 'Smoke Screen', rarity: 'common', cost: 1, target: 'ownHex', desc: 'A hex you own gets +2 Mult on defence until your next turn.' },
    march: { name: 'Forced March', rarity: 'common', cost: 1, target: 'ownStack', desc: 'Units on one hex may act again, with +2 move.' },
    rally: { name: 'Rally', rarity: 'common', cost: 1, target: 'none', desc: 'Your next attack this turn gets +2 Mult.' },
    fortify: { name: 'Fortify', rarity: 'common', cost: 2, target: 'ownHex', desc: 'Build or upgrade a Bunker on one of your hexes for free (on your HQ hex it fortifies the HQ instead).' },
    conscript: { name: 'Conscription', rarity: 'common', cost: 1, target: 'spawn', desc: 'Deploy 2 free Grunts at a deploy point.' },
    gunrun: { name: 'Gun Run', rarity: 'common', cost: 2, target: 'enemyUnits', range: 3, desc: 'Attack jet, within 3 of your land. Troops: roll 3+ kills 1. Undefended buildings: knocks a level off one.' },
    airstrike: { name: 'Airstrike', rarity: 'uncommon', cost: 4, target: 'enemyUnits', range: 4, desc: 'Bomb a hex within 4 of your land. Troops: roll to kill 1–3. Undefended buildings: knocks 1–2 levels off them.' },
    heli: { name: 'Heli Drop', rarity: 'uncommon', cost: 3, target: 'heli', range: 5, desc: 'Fly a stack up to 5 hexes onto any empty land and seize it.' },
    sabotage: { name: 'Sabotage', rarity: 'uncommon', cost: 3, target: 'enemyStruct', range: 3, desc: 'Destroy an enemy structure (or bridge) within 3 of your land.' },
    embargo: { name: 'Embargo', rarity: 'uncommon', cost: 3, target: 'enemyHex', desc: 'Click any enemy territory: that commander earns half income for their next 2 turns and cannot trade.' },
    bounty: { name: 'Bounty', rarity: 'uncommon', cost: 1, target: 'none', desc: 'This turn, every enemy unit you destroy pays a fifth of your income (min $2).' },
    precision: { name: 'Precision Strike', rarity: 'rare', cost: 5, target: 'precision', range: 5, desc: 'Guided bomb within 5 of your land, ignores Flak. Kills the strongest unit (2 on a 5+), or destroys a building.' },
    strategic: { name: 'Strategic Bombing', rarity: 'rare', cost: 5, target: 'infra', range: 6, desc: 'Bombers hit an enemy hex within 6 and its neighbours: their economic buildings lose a level, and that land pays nothing for 2 turns.' },
    quarry: { name: 'Quarry Blast', rarity: 'rare', cost: 3, target: 'mountain', range: 3, desc: 'Blast a mountain within 3 of your land, and the mountain behind it, down into Highlands: a 2-hex pass.' },
    spy: { name: 'Spy Ring', rarity: 'epic', cost: 3, target: 'enemyHand', desc: 'Click any enemy territory: steal a random card that commander has earned (a tactic or a unit, never their starting cards).' },
    bonds: { name: 'War Bonds', rarity: 'rare', cost: 0, target: 'none', desc: 'Gain $1 for every 2 hexes you own.' },
    blitz: { name: 'Blitz Doctrine', rarity: 'rare', cost: 3, target: 'none', desc: 'This turn: all units +1 move, fresh units may act.' },
    drop_rare: { name: 'Supply Drop', rarity: 'rare', cost: 0, target: 'none', desc: 'Spin the reel for a crate (60% Standard · 32% Gilded · 8% Mythic), then keep 1 of 3 cards.' },
    emp: { name: 'EMP Burst', rarity: 'epic', cost: 4, target: 'area', range: 5, desc: 'Enemy units in a 1-hex radius are frozen for their next turn.' },
    drop_epic: { name: 'Supply Drop', rarity: 'epic', cost: 0, target: 'none', desc: 'Spin the reel for a crate (15% Standard · 55% Gilded · 30% Mythic), then keep 1 of 3 cards.' },
    buster: { name: 'Bunker Buster', rarity: 'epic', cost: 6, target: 'buster', range: 5, desc: 'Enemy hex within 5 of your land: knocks 2 levels off its Bunker, FOB, Flak or Mines (HQ to ★ at most) and kills up to 2 units.' },
    carpet: { name: 'Carpet Bombing', rarity: 'epic', cost: 7, target: 'area', range: 4, desc: 'Bomb a hex and its neighbours: each enemy unit there has a 50% chance to be destroyed.' },
    orbital: { name: 'Orbital Strike', rarity: 'epic', cost: 8, target: 'orbital', range: 6, desc: 'Erase every enemy unit on one hex within 6 of your land. Ignores Flak.' },
    nuke: { name: 'Tactical Nuke', rarity: 'legendary', cost: 10, target: 'nuke', range: 6, desc: 'Erase everything in a 1-hex radius. Leaves a fallout zone for 4 rounds.' },
    drop_legendary: { name: 'Supply Drop', rarity: 'legendary', cost: 0, target: 'none', desc: 'Spin the reel for a crate (35% Gilded · 65% Mythic), then keep 1 of 3 cards.' },
    mutiny: { name: 'Mutiny', rarity: 'legendary', cost: 6, target: 'mutiny', desc: 'An enemy stack (≤3) bordering your land defects to you.' },
    tsar: { name: 'Tsar Bomba', rarity: 'mythic', cost: 14, target: 'tsar', range: 7, desc: 'Erase everything in a 9-hex blast. Fallout for 5 rounds. HQs survive; their troops do not.' },
    regime: { name: 'Regime Change', rarity: 'mythic', cost: 10, target: 'regime', range: 4, desc: 'An enemy hex within 4 and their land around it flip to you (not HQs). Their troops there join you.' },
    aegis: { name: 'Aegis Protocol', rarity: 'mythic', cost: 8, target: 'none', desc: 'Until your next turn: your land gets +3 Mult on defence and is immune to enemy tactics.' },
  };

  // structures are the economy/base layer, separate from the unit deck
  const STRUCTS = {
    hq: { name: 'HQ', cost: 8, desc: 'Your capital. Lose it and you are out. Fortify: +3 garrison Chips and +1 Mult per level.' },
    fob: { name: 'FOB', cost: 8, desc: 'Forward base: deploy point and supply source. +1 Mult defence per level.' },
    warehouse: { name: 'Warehouse', cost: 6, desc: '+$2 per turn per level. Next to a Resource node, Refinery or Port it stockpiles more: +$3 per level.' },
    refinery: { name: 'Refinery', cost: 6, desc: '+$1 per turn per level (+$3 per level on a Resource node or oil rig).' },
    depot: { name: 'Depot', cost: 4, desc: 'Logistics hub: your units starting their turn nearby get +1 move. Range = level.' },
    port: { name: 'Port', cost: 5, desc: 'Coast only. Launch ships into the adjacent sea. Supply source for sea lanes.' },
    bridge: { name: 'Bridge', cost: 6, desc: 'Span a 1-hex sea gap between two shores. Land units cross; ships cannot pass.' },
    bunker: { name: 'Bunker', cost: 4, desc: 'Strongpoint with its own garrison: +3 Chips per level even when empty, so enemies must attack it. +2 Mult defence (+1 per extra level). ★★+ also gives your neighbouring hexes +1 Mult. Digs in against big attacks: +40% of the attacker chip lead (up to 4 per level). ★★★ Citadel: 14 garrison Chips, +5 Mult, +2 Mult to neighbours, and holds 60% of the lead (up to 20). Destroyed if an enemy captures it.' },
    mine: { name: 'Sea Mine', cost: 4, desc: 'A minefield on one of your sea hexes: the naval Bunker. +3 Chips per level even when empty, so enemy ships must fight their way through instead of sailing past. +2 Mult defence (+1 per extra level). Cleared if an enemy captures the hex.' },
    flak: { name: 'Flak', cost: 5, desc: 'Blocks enemy air tactics nearby (range = level). +2 Mult vs air.' },
  };
  const BUILD_ORDER = ['hq', 'fob', 'warehouse', 'refinery', 'depot', 'port', 'bridge', 'bunker', 'mine', 'flak'];
  // structures can be stacked up to level 3 by building the same thing on the same hex
  const UPGRADABLE = ['hq', 'fob', 'warehouse', 'refinery', 'depot', 'bunker', 'mine', 'flak'];
  const MAX_SLVL = 3;
  const MAX_STRUCTS = 3; // different buildings per hex
  const STRUCT_PRIORITY = ['hq', 'fob', 'port', 'bridge', 'warehouse', 'refinery', 'depot', 'bunker', 'mine', 'flak'];
  const structsOf = t => (t && t.structs) || (t && t.struct ? [t.struct] : []);
  const getS = (t, type) => structsOf(t).find(x => x.type === type) || null;
  const slvlOf = st => (st && st.lvl) || 1;
  function syncStructs(t) {
    const l = structsOf(t).filter(Boolean);
    t.structs = l;
    t.struct = l.slice().sort((a, b) => STRUCT_PRIORITY.indexOf(a.type) - STRUCT_PRIORITY.indexOf(b.type))[0] || null;
  }
  function addStruct(t, st) { t.structs = structsOf(t).concat([st]); syncStructs(t); }
  function removeStruct(t, st) { t.structs = structsOf(t).filter(x => x !== st); syncStructs(t); }

  const FACTIONS = {
    iron: { name: 'Iron Covenant', perk: 'Steel Wall', desc: '+2 defence Chips per unit when defending.', starter: 'bulwark', glyph: 'shield' },
    volt: { name: 'Volt Syndicate', perk: 'Overclock', desc: 'Air units get +1 move. Hornets cost $1 less.', starter: 'hornet', glyph: 'bolt' },
    ashen: { name: 'Ashen Nomads', perk: 'Looters', desc: 'Earn $2 for every enemy hex you capture. Skitters cost $1 less.', starter: 'skitter', glyph: 'skull' },
    verdant: { name: 'Verdant Host', perk: 'Deep Roots', desc: 'Structures cost $2 less. Start with a Bunker by your HQ.', starter: 'thumper', glyph: 'leaf' },
    null: { name: 'Null Order', perk: 'Loaded Dice', desc: 'Your combat rolls of 1 and 2 count as 3.', starter: 'lancer', glyph: 'eye' },
  };

  const DIFFICULTY = {
    easy: { name: 'Easy', income: 0.75 },
    medium: { name: 'Medium', income: 0.9 },
    hard: { name: 'Hard', income: 1.1 },
    impossible: { name: 'Impossible', income: 1.5 },
  };
  const POI = {
    ruins: { name: 'Ruins', desc: 'First unit to arrive loots $4–10.' },
    cache: { name: 'Supply Cache', desc: 'First unit to arrive finds a tactic card: usually common or uncommon, sometimes rare, epic or even legendary.' },
    village: { name: 'Village', desc: 'Neutral town with a militia garrison (strength varies). Conquer it for +$2 per turn.' },
    fort: { name: 'Old Fort', desc: 'Garrisoned ruin with a Bunker (★ to ★★★). Take it and the bunker is yours.' },
    relic: { name: 'Ancient Relic', desc: '+$3 per turn while you hold it.' },
    silo: { name: 'Superweapon Silo', desc: 'World War only. Heavily garrisoned (★★ Bunker). Hold it for 3 of your turns in a row and it hands you a Mythic card.' },
  };
  const GARRISONED = ['village', 'fort', 'silo'];
  // a world event rolls at the start of most rounds (from round 3) and lasts the whole round
  const WEATHER = {
    storm: { name: 'Storm Front', icon: '⛈', desc: 'Aircraft are grounded this round.' },
    seas: { name: 'Rough Seas', icon: '🌊', desc: 'Ships stay in port this round.' },
    blizzard: { name: 'Blizzard', icon: '❄', desc: 'Every unit has 1 less move this round (minimum 1).' },
    goldrush: { name: 'Gold Rush', icon: '💰', desc: 'Resource nodes, oil rigs and fishing grounds pay double this round.' },
    armsfair: { name: 'Arms Fair', icon: '🛒', desc: 'All units cost $1 less this round.' },
    shortage: { name: 'Supply Shortage', icon: '📦', desc: 'Buildings cost $2 more this round.' },
    fervour: { name: 'War Fervour', icon: '🔥', desc: 'Every attack gets +1 Mult this round.' },
    clear: { name: 'Clear Skies', icon: '☀', desc: 'Everyone sees 2 hexes further this round (fog of war).' },
  };
  const COLORS = ['#ff4f5e', '#36c9ff', '#ffc53d', '#59f08a', '#c27dff', '#ff8ad0', '#ff9a3c', '#e9edf2'];
  const MAX_STACK = 5, GRUNT_STACK = 10;
  // a hex holds 5 units, or up to 10 when every unit on it is a Grunt
  const typeOf = u => typeof u === 'string' ? u : u.type;
  const stackFits = (occ, add) => { const all = occ.concat(add); return all.length <= (all.every(u => typeOf(u) === 'grunt') ? GRUNT_STACK : MAX_STACK); };
  const CLASS_NAME = { inf: 'Infantry', veh: 'Vehicle', air: 'Air', art: 'Artillery', sea: 'Naval' };

  function cardDef(id) { return UNITS[id] ? { ...UNITS[id], id, kind: 'unit' } : TACTICS[id] ? { ...TACTICS[id], id, kind: 'tactic' } : null; }

  // ───────────────────────── map generation ─────────────────────────
  // Every map picks a layout archetype, warps it with noise, then trims the board to the
  // coastline plus a band of sea, so the outline is different every game.
  const ARCHETYPES = ['continent', 'twin', 'archipelago', 'inland', 'crescent', 'pangaea', 'ocean'];
  function generateMap(opts) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const seed = (opts.seed + attempt * 7919) >>> 0;
      const m = tryMap(seed, opts.nPlayers, opts.size || 'medium', opts.archetype);
      if (m) { m.seed = seed; return m; }
    }
    throw new Error('map generation failed');
  }

  function tryMap(seed, nP, size, forceArch) {
    const rng = mulberry32(seed);
    const noise = makeNoise(seed % 100000), noise2 = makeNoise((seed * 3 + 17) % 100000), warpN = makeNoise((seed * 7 + 5) % 100000);
    const arch = forceArch || ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)];
    const sizeMul = { small: 0.7, medium: 1, large: 1.8, huge: 2.6, colossal: 3.8 }[size] || 1;
    const tempN = makeNoise((seed * 11 + 3) % 100000);
    const landTarget = Math.round((70 + nP * 38) * sizeMul);
    const landFrac = arch === 'ocean' ? 0.24 : arch === 'archipelago' ? 0.36 : arch === 'pangaea' ? 0.55 : 0.45;
    const total = landTarget / landFrac;
    let aspect = 1 + rng() * 0.7; if (rng() < 0.3) aspect = 1 / aspect;
    const cols = Math.max(10, Math.round(Math.sqrt(total * aspect * 1.15)));
    const rows = Math.max(10, Math.round(total / cols));
    const blobs = [];
    const R = (a, b) => a + rng() * (b - a);
    if (arch === 'continent') blobs.push([R(-.1, .1), R(-.1, .1), 0.75]);
    if (arch === 'pangaea') { blobs.push([0, 0, 0.9]); blobs.push([R(-.5, .5), R(-.5, .5), 0.5]); }
    if (arch === 'twin') { const a = rng() * Math.PI; blobs.push([Math.cos(a) * .5, Math.sin(a) * .5, 0.52], [-Math.cos(a) * .5, -Math.sin(a) * .5, 0.52]); }
    if (arch === 'archipelago') {
      // islands on a jittered grid so they stay apart
      const g = nP <= 3 ? 3 : 4, cells = [];
      for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) cells.push([(i + 0.5) / g * 1.7 - 0.85 + R(-.08, .08), (j + 0.5) / g * 1.7 - 0.85 + R(-.08, .08)]);
      cells.sort(() => rng() - 0.5).slice(0, Math.max(nP + 2, Math.round(cells.length * 0.75))).forEach(([x, y]) => blobs.push([x, y, R(.17, .24)]));
    }
    if (arch === 'ocean') {
      // open ocean: a scatter of small islands, one per commander plus a few spares, far apart
      const want = nP * 2 + 3;
      for (let tries = 0; blobs.length < want && tries < 600; tries++) {
        const x = R(-.82, .82), y = R(-.82, .82), r = R(.1, .15);
        if (blobs.every(([bx, by, br]) => Math.hypot(x - bx, y - by) > r + br + 0.1)) blobs.push([x, y, r]);
      }
    }
    if (arch === 'crescent') { const a0 = rng() * Math.PI * 2; for (let i = 0; i < 6; i++) { const a = a0 + i * 0.75; blobs.push([Math.cos(a) * .55, Math.sin(a) * .55, 0.36]); } }
    const mask = (x, y) => {
      if (arch === 'inland') { const d = Math.hypot(x, y); return Math.max(0, 1 - Math.abs(d - 0.58) / 0.38); }
      let m = 0; for (const [bx, by, br] of blobs) m = Math.max(m, 1 - Math.hypot(x - bx, y - by) / br);
      return Math.max(0, m);
    };
    const ox = rng() * 100, oy = rng() * 100;
    const cells = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const r = row - Math.floor(rows / 2), q = col - Math.floor(cols / 2) - Math.floor(r / 2);
      const nx = (col - cols / 2) / (cols / 2), ny = (row - rows / 2) / (rows / 2);
      const px = Math.sqrt(3) * (q + r / 2), py = 1.5 * r;
      const wa = arch === 'archipelago' || arch === 'ocean' ? 0.3 : 0.7;
      const wx = nx + (warpN(px * 0.07 + ox, py * 0.07, 2) - 0.5) * wa, wy = ny + (warpN(px * 0.07, py * 0.07 + oy, 2) - 0.5) * wa;
      const nw = arch === 'ocean' ? 0.22 : arch === 'archipelago' ? 0.3 : 0.6;
      let e = mask(wx, wy) * 0.9 + noise(px * 0.15 + ox, py * 0.15 + oy, 4) * nw;
      const edge = Math.max(Math.abs(nx), Math.abs(ny));
      if (edge > 0.7) e -= (edge - 0.7) * 4;
      cells.push({ q, r, px, py, e });
    }
    // auto threshold: exactly landTarget hexes of land
    const sorted = cells.map(c => c.e).sort((a, b) => b - a);
    const thr = sorted[Math.min(sorted.length - 1, landTarget)];
    const landCells = cells.filter(c => c.e > thr);
    const le = landCells.map(c => c.e).sort((a, b) => b - a);
    const mThr = le[Math.floor(le.length * 0.07)], hThr = le[Math.floor(le.length * 0.2)];
    const tiles = {};
    // biomes: temperature runs warm at the equator (middle rows) and cold toward the edges
    const maxPy = Math.max(...landCells.map(c => Math.abs(c.py))) || 1;
    const lowE = le[Math.floor(le.length * 0.85)];
    const elev = {};
    for (const c of landCells) {
      const ridge = 1 - Math.abs(noise2(c.px * 0.11 + oy, c.py * 0.11 + ox, 2) * 2 - 1);
      const moist = noise2(c.px * 0.1 + 40, c.py * 0.1 + 40, 2);
      const temp = 1 - Math.abs(c.py) / maxPy * 0.85 + (tempN(c.px * 0.045, c.py * 0.045, 2) - 0.5) * 0.7;
      let t = 'plains';
      if (c.e > mThr || (ridge > 0.96 && c.e > hThr)) t = 'mountain';
      else if (c.e > hThr) t = 'hills';
      else if (temp < 0.3) t = 'tundra';
      else if (moist > 0.66 && c.e < lowE) t = 'swamp';
      else if (temp > 0.62 && moist < 0.36 && c.e > hThr * 0.86) t = 'canyon';
      else if (temp > 0.7 && moist < 0.44) t = 'desert';
      else if (temp > 0.62 && moist > 0.58) t = 'jungle';
      else if (moist > 0.56) t = 'forest';
      tiles[key(c.q, c.r)] = { q: c.q, r: c.r, t, owner: null, struct: null, res: false, contam: 0, smoke: null };
      elev[key(c.q, c.r)] = c.e;
    }
    // sea: everything within 2 hexes of land
    for (const k of Object.keys(tiles)) for (const a of area(k, 2)) {
      if (tiles[a]) continue;
      const [q, r] = parse(a);
      tiles[a] = { q, r, t: 'water', owner: null, struct: null, res: false, contam: 0, smoke: null };
    }
    for (const k in tiles) if (tiles[k].t === 'water') tiles[k].deep = !neighbors(k).some(n => tiles[n] && tiles[n].t !== 'water');
    const isLand = k => tiles[k] && TERRAIN[tiles[k].t].land;
    const compOf = {}, comps = [];
    for (const k in tiles) {
      if (!isLand(k) || compOf[k] !== undefined) continue;
      const c = [k]; compOf[k] = comps.length;
      for (let i = 0; i < c.length; i++) for (const n of neighbors(c[i])) if (isLand(n) && compOf[n] === undefined) { compOf[n] = comps.length; c.push(n); }
      comps.push(c);
    }
    const land = Object.keys(tiles).filter(isLand);
    const minComp = Math.max(14, Math.floor(land.length / (nP * 2.2)));
    const cands = land.filter(k => comps[compOf[k]].length >= minComp && !['hills', 'swamp', 'tundra', 'jungle', 'canyon'].includes(tiles[k].t) && neighbors(k).filter(isLand).length >= 4);
    if (cands.length < nP * 3) return null;
    // farthest-point sampling for fair spawns
    const spawns = [cands[Math.floor(rng() * cands.length)]];
    while (spawns.length < nP) {
      let best = null, bd = -1;
      for (const k of cands) { const d = Math.min(...spawns.map(s => dist(s, k))); if (d > bd) { bd = d; best = k; } }
      if (bd < 5) return null;
      spawns.push(best);
    }
    if (nP > 1) { let best = spawns[0], bd = -1; for (const k of cands) { const d = Math.min(...spawns.slice(1).map(s => dist(s, k))); if (d > bd) { bd = d; best = k; } } spawns[0] = best; }
    for (const s of spawns) if (area(s, 4).filter(isLand).length < 16) return null;
    for (const s of spawns) {
      tiles[s].t = 'plains';
      for (const n of neighbors(s)) if (tiles[n] && ['mountain', 'swamp'].includes(tiles[n].t)) tiles[n].t = tiles[n].t === 'mountain' ? 'hills' : 'plains';
    }
    const nearSpawn = (k, r) => spawns.some(s => dist(s, k) <= r);
    // mountain spurs: short ridges of highlands branching off the ranges
    {
      const peaks = Object.keys(tiles).filter(k => tiles[k].t === 'mountain' && neighbors(k).some(n => tiles[n] && TERRAIN[tiles[n].t].land && tiles[n].t !== 'mountain'));
      const nSpurs = Math.round(peaks.length / 5);
      for (let s = 0; s < nSpurs && peaks.length; s++) {
        let cur = peaks[Math.floor(rng() * peaks.length)]; const dir = DIRS[Math.floor(rng() * 6)], len = 2 + Math.floor(rng() * 3);
        for (let i = 0; i < len; i++) {
          const [q, r] = parse(cur); const d = rng() < 0.25 ? DIRS[Math.floor(rng() * 6)] : dir; cur = key(q + d[0], r + d[1]);
          const t = tiles[cur]; if (!t || !TERRAIN[t.t].land || nearSpawn(cur, 3)) break;
          if (t.t !== 'mountain') t.t = i === 0 && rng() < 0.35 ? 'mountain' : 'hills';
        }
      }
    }
    // lakes: a few small inland lakes in the lowlands (rivers can drain into them)
    {
      const lowland = Object.keys(tiles).filter(k => isLand(k) && tiles[k].t !== 'mountain' && !nearSpawn(k, 4) && area(k, 2).every(a => !tiles[a] || tiles[a].t !== 'water'))
        .sort((a, b) => (elev[a] || 0) - (elev[b] || 0));
      const nLakes = Math.min(4, Math.round(Object.keys(tiles).filter(isLand).length / 140 + rng()));
      const lakes = [];
      for (const c of lowland.slice(0, Math.max(1, Math.floor(lowland.length * 0.35))).sort(() => rng() - 0.5)) {
        if (lakes.length >= nLakes) break;
        if (lakes.some(l => dist(l, c) < 8)) continue;
        const size = 2 + Math.floor(rng() * 4), body = [c];
        for (let i = 0; i < body.length && body.length < size; i++) for (const n of neighbors(body[i])) if (body.length < size && isLand(n) && tiles[n].t !== 'mountain' && !nearSpawn(n, 4) && !body.includes(n) && rng() < 0.6) body.push(n);
        for (const k of body) { tiles[k].t = 'water'; tiles[k].deep = false; tiles[k].lake = true; delete tiles[k].res; }
        lakes.push(c);
      }
    }
    // rivers: spring up in the highlands and wind downhill to the sea or a lake; later rivers join earlier ones as tributaries
    {
      const landK = Object.keys(tiles).filter(isLand);
      const want = Math.max(2, Math.round(landK.length / 45));
      const springs = landK.filter(k => tiles[k].t !== 'mountain' && (tiles[k].t === 'hills' || neighbors(k).some(n => tiles[n] && tiles[n].t === 'mountain')))
        .sort((a, b) => (elev[b] || 0) - (elev[a] || 0) + (rng() - 0.5) * 0.08);
      const heads = [];
      for (const src of springs) {
        if (heads.length >= want) break;
        if (tiles[src].river || heads.some(h => dist(h, src) < 4)) continue;
        const path = [src], seen = new Set([src]); let cur = src, mouth = null;
        for (let step = 0; step < 45 && !mouth; step++) {
          const nb = neighbors(cur).filter(n => tiles[n] && !seen.has(n) && tiles[n].t !== 'mountain');
          const sea = nb.find(n => tiles[n].t === 'water'); if (sea) { mouth = sea; break; }
          const join = nb.find(n => tiles[n].river); if (join && path.length >= 2) { mouth = join; break; }
          if (!nb.length) break;
          nb.sort((a, b) => (elev[a] || 0) - (elev[b] || 0));
          const next = nb[rng() < 0.2 && nb[1] ? 1 : 0];
          if ((elev[next] || 0) > (elev[cur] || 0) + 0.06) break;   // no way downhill: the spring dries up
          path.push(next); seen.add(next); cur = next;
        }
        if (!mouth || path.length < 3) continue;
        heads.push(src);
        path.forEach((k, i) => { tiles[k].river = true; tiles[k].flow = path[i + 1] || mouth; });
      }
    }
    const landNow = Object.keys(tiles).filter(isLand);
    const want = Math.round(landNow.length * 0.06);
    const shuffled = landNow.slice().sort(() => rng() - 0.5);
    let placed = 0;
    for (const k of shuffled) {
      if (placed >= want) break;
      if (spawns.some(s => dist(s, k) < 3)) continue;
      if (neighbors(k).some(n => tiles[n] && tiles[n].res)) continue;
      tiles[k].res = true; placed++;
    }
    // offshore oil rigs on shallow water: worth claiming with ships
    const shallow = Object.keys(tiles).filter(k => tiles[k].t === 'water' && !tiles[k].deep).sort(() => rng() - 0.5);
    let rigs = 0;
    for (const k of shallow) {
      if (rigs >= Math.max(3, Math.round(shallow.length * (arch === 'ocean' ? 0.13 : 0.09)))) break;
      if (spawns.some(s => dist(s, k) < 3) || neighbors(k).some(n => tiles[n] && tiles[n].res)) continue;
      tiles[k].res = true; rigs++;
    }
    // fishing grounds: shoals in shallow water (+$1 each while you hold them)
    const anyWater = Object.keys(tiles).filter(k => tiles[k].t === 'water' && !tiles[k].res).sort(() => rng() - 0.5);
    let fish = 0;
    for (const k of anyWater) {
      if (fish >= Math.max(4, Math.round(anyWater.length * 0.07))) break;
      if (tiles[k].deep && rng() < 0.6) continue;
      if (neighbors(k).some(n => tiles[n] && (tiles[n].fish || (tiles[n].res && tiles[n].t === 'water')))) continue;
      tiles[k].fish = true; fish++;
    }
    // points of interest: loot to grab, neutral strongholds to conquer, relics to hold
    const free = landNow.filter(k => !tiles[k].res && spawns.every(sp => dist(sp, k) >= 3)).sort(() => rng() - 0.5);
    const want2 = { ruins: 0.035, cache: 0.025, village: 0.03, fort: 0.015 };
    let fi = 0;
    for (const [poi, frac] of Object.entries(want2)) {
      const n = Math.max(1, Math.round(landNow.length * frac));
      for (let i = 0; i < n && fi < free.length; fi++) {
        const k = free[fi];
        if (neighbors(k).some(nb => tiles[nb] && tiles[nb].poi)) continue;
        tiles[k].poi = poi; i++;
        if (poi === 'village') tiles[k].gar = 3 + Math.floor(rng() * 7);                 // militia 3–9 chips
        if (poi === 'fort') { tiles[k].gar = 3 + Math.floor(rng() * 6); tiles[k].structs = [{ type: 'bunker', owner: null, lvl: 1 + Math.floor(rng() * 3) }]; tiles[k].struct = tiles[k].structs[0]; }
      }
    }
    // treasure islands: small landmasses away from the HQs hold loot and relics, so it pays to sail
    const isles = [], seen = new Set(), landSet = new Set(landNow);
    for (const k of landNow) {
      if (seen.has(k)) continue;
      const comp = [k]; seen.add(k);
      for (let i = 0; i < comp.length; i++) for (const n of neighbors(comp[i])) if (landSet.has(n) && !seen.has(n)) { seen.add(n); comp.push(n); }
      if (comp.length <= Math.max(10, Math.floor(landNow.length / 18)) && !spawns.some(sp => comp.includes(sp))) isles.push(comp);
    }
    let relicIsles = 0;
    isles.sort(() => rng() - 0.5).forEach((comp, i) => {
      const spots = comp.filter(k => tiles[k].t !== 'mountain' && !tiles[k].res).sort(() => rng() - 0.5);
      for (const k of spots) delete tiles[k].poi;
      const loot = i % 3 === 0 ? ['relic', 'cache'] : i % 3 === 1 ? ['ruins', 'cache'] : ['ruins', 'village'];
      if (comp.length < 5) loot.length = 1;
      loot.forEach((poi, j) => { const k = spots[j * 2] || spots[j]; if (k && !tiles[k].poi) { tiles[k].poi = poi; if (poi === 'village') tiles[k].gar = 3 + Math.floor(rng() * 7); if (poi === 'relic') relicIsles++; } });
    });
    // relics sit far from everyone's HQ (fewer on the mainland when islands already carry some)
    const relics = Math.max(relicIsles ? 0 : 1, Math.round(nP / 2) - relicIsles);
    const farthest = landNow.filter(k => !tiles[k].poi && !tiles[k].res).map(k => [k, Math.min(...spawns.map(sp => dist(sp, k)))]).sort((a, b) => b[1] - a[1]);
    for (let i = 0, placedR = 0; i < farthest.length && placedR < relics; i++) { const k = farthest[i][0]; if (neighbors(k).some(nb => tiles[nb] && tiles[nb].poi === 'relic')) continue; tiles[k].poi = 'relic'; placedR++; }
    let cx = 0, cy = 0; for (const k of landNow) { cx += tiles[k].q; cy += tiles[k].r; }
    const centre = key(Math.round(cx / landNow.length), Math.round(cy / landNow.length));
    let beacon = null, bd = 1e9;
    for (const k of landNow) { const d = dist(k, centre); if (d < bd && !spawns.includes(k)) { bd = d; beacon = k; } }
    tiles[beacon].t = 'plains'; tiles[beacon].res = false; delete tiles[beacon].poi; tiles[beacon].structs = []; tiles[beacon].struct = null;
    // towns, forts, relics and the beacon sit on dry ground beside the river, not in it
    for (const k in tiles) if (tiles[k].river && (tiles[k].poi || k === beacon)) delete tiles[k].river;
    return { tiles, spawns, beacon, landCount: landNow.length, arch };
  }

  // ───────────────────────── game setup ─────────────────────────
  const DRAFT_ROUNDS = 3;
  const DRAFT_ODDS = { common: 22, uncommon: 36, rare: 26, epic: 13, legendary: 3, mythic: 0 };

  function createGame(settings, roster) {
    settings = { ...settings };
    const ww = settings.mode === 'worldwar';
    // World War: a colossal map, a war economy and superweapon silos (always with world events)
    if (ww) { settings.mapSize = 'colossal'; settings.events = 'on'; settings.conquestPct = 45; }
    const teams = settings.teams === 'on';
    if (teams) { const used = roster.filter(p => p.team).length; roster = roster.map((p, i) => ({ ...p, team: used ? (p.team || 1) : 1 + (i % 2) })); if (new Set(roster.map(p => p.team)).size < 2) settings.teams = 'off'; }
    const seed = settings.seed ? hashStr(String(settings.seed)) : (Math.random() * 1e9) >>> 0;
    const shuffled = roster.slice().sort(() => Math.random() - 0.5);
    const map = generateMap({ size: settings.mapSize, seed, nPlayers: roster.length, archetype: ARCHETYPES.includes(settings.mapType) ? settings.mapType : null });
    const pickSpawns = settings.spawns === 'pick' && roster.length > 1;
    const state = {
      v: 0, phase: pickSpawns ? 'spawn' : 'draft', settings: { ...settings }, seed: map.seed,
      map: { arch: map.arch, tiles: map.tiles, beacon: settings.mode === 'koth' ? map.beacon : null, landCount: map.landCount },
      players: [], units: {}, nextId: 1,
      turn: { idx: 0, round: 1, stage: 'choose', offer: [], rerolls: 0, crate: null, income: 0, deadline: 0 },
      draft: { rounds: DRAFT_ROUNDS, offers: {}, step: {}, picked: {} },
      nP: roster.length,
      log: [], winner: null, trade: null,
    };
    // teammates get spawns close to each other
    let spawnOrder = map.spawns.slice();
    if (settings.teams === 'on' && !pickSpawns) {
      const left = map.spawns.slice(), byTeam = {}; spawnOrder = [];
      for (const p of shuffled) (byTeam[p.team] = byTeam[p.team] || []).push(p);
      const assigned = {};
      for (const tm of Object.keys(byTeam)) {
        // seed each team on the free spawn farthest from the other teams' seeds, then fill with the nearest
        const others = Object.values(assigned).flat();
        left.sort((a, b) => (others.length ? Math.min(...others.map(o => dist(b, o))) - Math.min(...others.map(o => dist(a, o))) : 0));
        const first = left.shift(); assigned[tm] = [first];
        while (assigned[tm].length < byTeam[tm].length && left.length) { left.sort((a, b) => dist(a, first) - dist(b, first)); assigned[tm].push(left.shift()); }
      }
      const cursor = {}; spawnOrder = shuffled.map(p => assigned[p.team][cursor[p.team] = (cursor[p.team] || 0) + 1, cursor[p.team] - 1]);
    }
    shuffled.forEach((p, i) => {
      const hq = pickSpawns ? null : spawnOrder[i];
      const pl = {
        id: p.id, name: p.name, color: p.color, faction: p.faction, bot: !!p.bot, diff: p.bot ? (DIFFICULTY[p.diff] ? p.diff : 'medium') : null,
        cash: ww ? 20 : 6, arsenal: ['grunt'], levels: {}, tactics: [], alive: true, hq, koth: 0, blitz: false, local: !!p.local, team: settings.teams === 'on' ? p.team : undefined,
        stats: { captured: 0, kills: 0, lost: 0, crates: 0 },
      };
      const starter = FACTIONS[p.faction] ? FACTIONS[p.faction].starter : null;
      if (starter && !pl.arsenal.includes(starter)) pl.arsenal.push(starter);
      pl.tactics.push({ uid: state.nextId++, id: 'drop_rare' });
      state.players.push(pl);
      if (hq) placeHQ(state, pl, hq);
    });
    // teams: teammates are locked into a permanent alliance (shared vision, no friendly fire, shared victory)
    if (settings.teams === 'on') { state.allies = []; for (const a of state.players) for (const b of state.players) if (a.id < b.id && a.team === b.team) state.allies.push({ a: a.id, b: b.id, since: 0, team: true }); }
    if (ww) placeSilos(state, map.spawns);
    if (pickSpawns) {
      // players choose their HQ one at a time; whoever moves last in turn order picks first
      const minDist = Math.max(4, Math.round(Math.min(...map.spawns.flatMap((a, i) => map.spawns.slice(i + 1).map(b => dist(a, b)))) * 0.6));
      const isL = k => state.map.tiles[k] && TERRAIN[state.map.tiles[k].t].land;
      const cands = Object.keys(state.map.tiles).filter(k => {
        const t = state.map.tiles[k];
        return ['plains', 'forest', 'desert'].includes(t.t) && !t.poi && !t.res && k !== map.beacon && neighbors(k).filter(isL).length >= 4 && area(k, 4).filter(isL).length >= 16;
      });
      for (const k of map.spawns) if (!cands.includes(k)) cands.push(k);
      state.spawn = { order: state.players.map(p => p.id).reverse(), i: 0, cands, minDist, fallback: map.spawns.slice() };
      pushLog(state, 'Sector ' + (state.seed % 9000 + 1000) + ' (' + map.arch + ') revealed. Commanders, choose your HQ locations!');
      return { state, events: [{ e: 'spawnTurn', pid: state.spawn.order[0] }] };
    }
    return { state, events: startDraft(state) };
  }
  // World War: superweapon silos sit in the no-man's-land between the HQs
  function placeSilos(state, spawns) {
    const tiles = state.map.tiles, n = Math.max(3, Math.floor(state.players.length / 2) + 1), out = [];
    const cands = Object.keys(tiles).filter(k => { const t = tiles[k]; return isLandTile(t) && t.t !== 'mountain' && !t.poi && !t.res && !t.owner && !structsOf(t).length; })
      .map(k => ({ k, d: Math.min(...spawns.map(sp => dist(sp, k))) })).filter(c => c.d >= 4).sort((a, b) => b.d - a.d);
    for (const c of cands) {
      if (out.length >= n) break;
      if (out.some(o => dist(o, c.k) < 7)) continue;
      out.push(c.k);
    }
    for (const k of out) { const t = tiles[k]; t.poi = 'silo'; delete t.river; t.gar = 10; t.structs = [{ type: 'bunker', owner: null, lvl: 2 }]; t.struct = t.structs[0]; }
    state.map.silos = out;
  }
  function placeHQ(state, pl, hq) {
    pl.hq = hq;
    // only commanders who start on a small island get an Ark (so nobody is stranded)
    { const isL = k => state.map.tiles[k] && isLandTile(state.map.tiles[k]) && state.map.tiles[k].t !== 'mountain';
      const seen = new Set([hq]), q = [hq];
      for (let i = 0; i < q.length && q.length < 400; i++) for (const n of neighbors(q[i])) if (isL(n) && !seen.has(n)) { seen.add(n); q.push(n); }
      const land = Object.values(state.map.tiles).filter(t => isLandTile(t) && t.t !== 'mountain').length;
      if ((state.map.arch === 'ocean' || q.length < Math.max(30, land / (Math.max(2, state.nP || state.players.length) * 1.4))) && !pl.arsenal.includes('ark')) pl.arsenal.push('ark'); }
    const t = state.map.tiles[hq];
    t.owner = pl.id; delete t.poi; delete t.river; addStruct(t, { type: 'hq', owner: pl.id, lvl: 1 });   // an HQ stands on dry land
    for (const n of neighbors(hq)) { const nt = state.map.tiles[n]; if (nt && TERRAIN[nt.t].land && !nt.owner && !GARRISONED.includes(nt.poi)) nt.owner = pl.id; }
    if (pl.faction === 'verdant') {
      const spot = neighbors(hq).find(n => state.map.tiles[n] && state.map.tiles[n].owner === pl.id && !structsOf(state.map.tiles[n]).length);
      if (spot) addStruct(state.map.tiles[spot], { type: 'bunker', owner: pl.id, lvl: 1 });
    }
    // World War: a bigger opening territory and a starting army, so the huge map gets going fast
    if (state.settings.mode === 'worldwar') {
      for (const k of area(hq, 2)) { const nt = state.map.tiles[k]; if (nt && isLandTile(nt) && nt.t !== 'mountain' && !nt.owner && !GARRISONED.includes(nt.poi)) nt.owner = pl.id; }
      const starter = FACTIONS[pl.faction] && FACTIONS[pl.faction].starter;
      for (let j = 0; j < 2; j++) addUnit(state, pl.id, 'grunt', hq, false);
      if (starter && !isSea(starter)) addUnit(state, pl.id, starter, hq, false);
    }
    // ocean maps: every commander starts with a Port so the navy matters from turn one
    if (state.map.arch === 'ocean') {
      const spot = neighbors(hq).find(k => state.map.tiles[k] && state.map.tiles[k].owner === pl.id && isLandTile(state.map.tiles[k]) && isCoastal(state, k) && structsOf(state.map.tiles[k]).length < MAX_STRUCTS);
      // an inland HQ gets its Port on the nearest free coast instead (and that hex)
      const far = spot || area(hq, 3).filter(k => { const t = state.map.tiles[k]; return t && isLandTile(t) && t.t !== 'mountain' && (!t.owner || t.owner === pl.id) && !t.poi && !structsOf(t).length && isCoastal(state, k); }).sort((a, b) => dist(a, hq) - dist(b, hq))[0];
      if (far) { state.map.tiles[far].owner = pl.id; addStruct(state.map.tiles[far], { type: 'port', owner: pl.id, lvl: 1 }); }
    }
    for (let j = 0; j < 2; j++) addUnit(state, pl.id, 'grunt', hq, false);
  }
  function startDraft(state) {
    state.phase = 'draft';
    pushLog(state, 'Sector ' + (state.seed % 9000 + 1000) + ' (' + state.map.arch + ') deployed. ' + state.players.length + ' commanders — opening draft!');
    for (const p of state.players) { state.draft.offers[p.id] = drawCards(state, p, 3, DRAFT_ODDS, Math.random); state.draft.step[p.id] = 0; }
    return [{ e: 'draft', round: 1 }];
  }
  // HQ hexes the current picker may still choose
  function spawnChoices(s) {
    if (!s.spawn) return [];
    const taken = s.players.filter(p => p.hq).map(p => p.hq);
    return s.spawn.cands.filter(k => taken.every(h => dist(h, k) >= s.spawn.minDist));
  }
  function spawnPick(s, p, a, ev) {
    const sp = s.spawn;
    if (sp.order[sp.i] !== p.id) return { ok: false, err: 'Wait for your turn to pick', events: [] };
    let hex = a.hex;
    const ok = spawnChoices(s);
    if (a.auto || !ok.includes(hex)) {
      if (!a.auto) return { ok: false, err: 'Pick a highlighted hex — too close to another HQ or bad ground', events: [] };
      hex = ok[0] || sp.fallback.find(k => s.players.every(o => o.hq !== k && (!o.hq || dist(o.hq, k) >= 3)));
    }
    placeHQ(s, p, hex);
    ev.push({ e: 'spawnPicked', pid: p.id, hex });
    pushLog(s, '🏳 ' + p.name + ' set up their HQ.');
    sp.i++;
    if (sp.i >= sp.order.length) { s.spawn = null; return { ok: true, events: ev.concat(startDraft(s)) }; }
    ev.push({ e: 'spawnTurn', pid: sp.order[sp.i] });
    return { ok: true, events: ev };
  }

  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  function addUnit(state, owner, type, hex, fresh) {
    const u = { id: state.nextId++, owner, type, hex, moved: false, fresh: !!fresh, stun: 0, mvBonus: 0 };
    state.units[u.id] = u;
    return u;
  }

  // ───────────────────────── queries ─────────────────────────
  const player = (s, id) => s.players.find(p => p.id === id);
  const current = s => s.players[s.turn.idx];
  function buildIndex(s) {
    const idx = {};
    for (const id in s.units) { const u = s.units[id]; (idx[u.hex] || (idx[u.hex] = [])).push(u); }
    return idx;
  }
  const isWater = t => !!t && t.t === 'water' && !t.bridge;
  const isLandTile = t => !!t && (TERRAIN[t.t].land || !!t.bridge);
  const isSea = type => !!UNITS[type] && UNITS[type].cls === 'sea';
  const isCoastal = (s, k) => neighbors(k).some(n => isWater(s.map.tiles[n]));
  function levelOf(s, u) { const p = player(s, u.owner); return (p && p.levels && p.levels[u.type]) || 0; }
  function unitAtk(s, u) { const d = UNITS[u.type]; return d.atk + (d.atk ? levelOf(s, u) : 0); }
  function unitDef(s, u) { return UNITS[u.type].def + levelOf(s, u); }
  function unitCost(p, type) { let c = UNITS[type].cost - (p && p.wx === 'armsfair' ? 1 : 0); if (p && p.faction === 'volt' && type === 'hornet') c--; if (p && p.faction === 'ashen' && type === 'skitter') c--; return Math.max(1, c); }
  const STRUCT_RAMP = 2;   // +$ per earlier purchase of the same structure type
  function structCost(p, type, lvl) {
    let c = STRUCTS[type].cost + (type === 'hq' ? 0 : STRUCT_RAMP * ((p.built && p.built[type]) || 0) + (p.wx === 'shortage' ? 2 : 0));
    if (lvl === 2) c = Math.round(c * 1.5); else if (lvl >= 3) c = Math.round(c * 2.25);
    if (p.faction === 'verdant') c = Math.max(1, c - 2);
    return c;
  }
  // what building `type` on hex k costs right now (a fresh build, or the next upgrade)
  function buildCost(s, p, type, k) {
    const t = k && s.map.tiles[k];
    const st = t && getS(t, type);
    return structCost(p, type, st ? slvlOf(st) + 1 : 1);
  }
  function canAct(s, u) { const p = player(s, u.owner); return !u.moved && !u.stun && (!u.fresh || (p && p.blitz) || UNITS[u.type].ability === 'blitzer'); }
  function moveAllow(s, u) {
    const p = player(s, u.owner), d = UNITS[u.type];
    let m = d.mv + (u.mvBonus || 0) + (p && p.blitz ? 1 : 0) + (s.settings && s.settings.mode === 'worldwar' ? 1 : 0);
    if (p && p.faction === 'volt' && d.cls === 'air') m += 1;
    const w = s.weather && s.weather.id;
    if (w === 'storm' && d.cls === 'air') return 0;
    if (w === 'seas' && d.cls === 'sea') return 0;
    if (w === 'blizzard') m = Math.max(1, m - 1);
    return m;
  }
  function ownedTiles(s, pid) { const o = []; for (const k in s.map.tiles) if (s.map.tiles[k].owner === pid) o.push(k); return o; }
  function ownedLand(s, pid) { const o = []; for (const k in s.map.tiles) { const t = s.map.tiles[k]; if (t.owner === pid && isLandTile(t)) o.push(k); } return o; }
  // emergency muster: while your HQ is under siege, your own land next to it becomes a deploy point
  function musterHexes(s, pid) {
    const p = player(s, pid); if (!p || !p.hq || !s.map.tiles[p.hq]) return [];
    const h = getS(s.map.tiles[p.hq], 'hq'); if (!h || h.owner !== pid || !h.siege) return [];
    return neighbors(p.hq).filter(n => { const t = s.map.tiles[n]; return t && t.owner === pid && isLandTile(t) && t.t !== 'mountain'; });
  }
  function spawnPoints(s, pid) {
    const out = []; let sup = null;
    for (const k in s.map.tiles) {
      const t = s.map.tiles[k]; if (t.owner !== pid) continue;
      const h = getS(t, 'hq'), f = getS(t, 'fob');
      if ((h && h.owner === pid && !h.siege) || (f && f.owner === pid && !f.lock && (sup || (sup = supplySet(s, pid))).has(k))) out.push(k);
    }
    for (const k of musterHexes(s, pid)) if (!out.includes(k)) out.push(k);
    return out;
  }
  function supplySet(s, pid) {
    const src = [];
    for (const k in s.map.tiles) { const t = s.map.tiles[k]; if (t.owner === pid && structsOf(t).some(x => ['hq', 'port'].includes(x.type) && x.owner === pid && !x.siege)) src.push(k); }
    const seen = new Set(src), q = src.slice();
    for (let i = 0; i < q.length; i++) for (const n of neighbors(q[i])) {
      const t = s.map.tiles[n];
      if (t && t.owner === pid && !seen.has(n)) { seen.add(n); q.push(n); }
    }
    return seen;
  }
  // why `struct` can't go on hex k (null = it can), ignoring cash
  function buildError(s, pid, struct, k, sup) {
    const tiles = s.map.tiles, t = tiles[k];
    sup = sup || supplySet(s, pid);
    if (!t) return 'No such hex';
    if (struct === 'bridge') {
      if (!isWater(t)) return 'Bridges span sea hexes';
      if (structsOf(t).length) return 'Already built';
      if (Object.values(s.units).some(u => u.hex === k)) return 'Hex is occupied';
      const shores = neighbors(k).filter(n => tiles[n] && TERRAIN[tiles[n].t].land);
      const spans = shores.some(a => shores.some(b => dist(a, b) >= 2));
      if (!spans) return 'Needs land on opposite sides (a 1-hex gap)';
      if (!shores.some(n => tiles[n].owner === pid && sup.has(n))) return 'One shore must be your supplied land';
      return null;
    }
    if (t.owner !== pid) return 'Build on your own territory';
    if (struct === 'hq') { const h = getS(t, 'hq'); return h && h.owner === pid && !h.siege ? (slvlOf(h) >= MAX_SLVL ? 'HQ is fully fortified' : null) : 'Fortify your HQ hex'; }
    if (getS(t, 'hq')) return 'The HQ hex holds only the HQ (fortify it instead)';
    const ex = getS(t, struct);
    if (ex) {
      if (!UPGRADABLE.includes(struct)) return 'Already built here';
      if (slvlOf(ex) >= MAX_SLVL) return 'Already max level';
      return sup.has(k) ? null : 'Hex is cut off from supply';
    }
    if (getS(t, 'bridge')) return 'Nothing else fits on a bridge';
    if (structsOf(t).length >= MAX_STRUCTS) return 'Hex is full (max ' + MAX_STRUCTS + ' buildings)';
    if (t.contam) return 'Fallout zone';
    if (!sup.has(k)) return 'Hex is cut off from supply';
    if (struct === 'mine') return isWater(t) && !t.bridge ? null : 'Mines go in your own sea';
    if (isWater(t)) return struct === 'refinery' && t.res ? null : 'That goes on land';
    if (struct === 'port' && !isCoastal(s, k)) return 'Ports must touch the sea';
    if (struct === 'fob' && area(k, 2).some(a => tiles[a] && structsOf(tiles[a]).some(x => ['hq', 'fob'].includes(x.type)))) return 'Too close to another base';
    return null;
  }
  function buildHexes(s, pid, struct) {
    const sup = supplySet(s, pid), out = [];
    for (const k in s.map.tiles) if (!buildError(s, pid, struct, k, sup)) out.push(k);
    return out;
  }
  // land units at HQ/FOB, ships in the sea next to a Port
  function deployHexes(s, pid, type, idx) {
    idx = idx || buildIndex(s);
    if (!isSea(type)) {
      const pts = spawnPoints(s, pid).filter(k => stackFits(idx[k] || [], [type]));
      // aircraft can also be deployed straight onto a carrier with room
      if (UNITS[type].cls === 'air') for (const k in idx) { const occ = idx[k]; if (occ[0].owner === pid && isWater(s.map.tiles[k]) && airCap(occ) > occ.filter(isAirU).length && stackFits(occ, [type])) pts.push(k); }
      return pts;
    }
    const out = new Set(), sup = supplySet(s, pid);
    for (const k in s.map.tiles) {
      const t = s.map.tiles[k];
      // ships launch from a Port; transports can also launch from a coastal HQ or FOB
      let pt = getS(t, 'port');
      if (!pt && UNITS[type].ability === 'transport') pt = getS(t, 'hq') || getS(t, 'fob');
      if (t.owner !== pid || !pt || pt.owner !== pid || pt.lock || pt.siege) continue;
      if (pt.type === 'fob' && !sup.has(k)) continue;
      for (const n of neighbors(k)) {
        const w = s.map.tiles[n]; if (!isWater(w)) continue;
        const occ = idx[n] || [];
        if (stackFits(occ, [type]) && !(occ.length && occ[0].owner !== pid)) out.add(n);
      }
    }
    return [...out];
  }
  function computeIncome(s, pid) {
    const sup = supplySet(s, pid);
    let hexes = 0, sea = 0, cut = 0, ruined = 0, res = 0, ref = 0, ware = 0, ports = 0, poi = 0, fish = 0, river = 0; const portHexes = [];
    for (const k in s.map.tiles) {
      const t = s.map.tiles[k]; if (t.owner !== pid) continue;
      if (!sup.has(k)) { cut++; continue; }
      if (t.ruin) { ruined++; continue; }   // bombed out: no income until it's rebuilt
      if (isWater(t)) sea++; else { hexes++; if (t.river) river++; }
      if (t.res) res++;
      if (t.fish) fish++;
      if (t.poi === 'village') poi += 2; else if (t.poi === 'relic') poi += 3;
      for (const st of structsOf(t)) {
        if (st.type === 'refinery') ref += (t.res ? 3 : 1) * slvlOf(st);
        if (st.type === 'warehouse') ware += (t.res || neighbors(k).some(n => { const nt = s.map.tiles[n]; return nt && nt.owner === pid && (nt.res || structsOf(nt).some(x => x.type === 'refinery' || x.type === 'port')); }) ? 3 : 2) * slvlOf(st);
        if (st.type === 'port' && st.owner === pid) { ports++; portHexes.push(k); }
      }
    }
    // buildings pay in full up to $8, then at half rate up to $24, then a quarter: farming eco alone can't run away
    const econ = ref + ware, built = econ <= 8 ? econ : econ <= 24 ? 8 + Math.floor((econ - 8) / 2) : 16 + Math.floor((econ - 24) / 4);
    const taper = built - econ, trade = ware; let taper_ = 0;
    // shipping lanes: each Port earns $1 per 4 of your sea hexes connected to it (up to $5)
    let lanes = 0;
    for (const ph of portHexes) {
      const seenW = new Set(), q = neighbors(ph).filter(n => { const w = s.map.tiles[n]; return w && isWater(w) && w.owner === pid; });
      q.forEach(n => seenW.add(n));
      for (let i = 0; i < q.length && seenW.size < 40; i++) for (const n of neighbors(q[i])) { const w = s.map.tiles[n]; if (w && isWater(w) && w.owner === pid && !seenW.has(n)) { seenW.add(n); q.push(n); } }
      lanes += Math.min(5, Math.floor(seenW.size / 4));
    }
    const rush = s.weather && s.weather.id === 'goldrush' ? 2 : 1;
    const base = 3, fromHex = Math.floor(hexes / 3), fromSea = Math.floor(sea / 4), fromRes = res * 2 * rush;
    fish *= rush;
    const fromRiver = Math.floor(river / 3);
    let total = base + fromHex + fromSea + fromRes + ref + ware + taper + poi + fish + lanes + fromRiver;
    const p = player(s, pid), d = p && p.bot && DIFFICULTY[p.diff];
    // alliances that have held for 2+ rounds pay a dividend; a traitor's economy takes a 40% hit
    let pact = 0;
    for (const x of s.allies || []) if ((x.a === pid || x.b === pid) && !x.ending && !x.team && s.turn && s.turn.round - (x.since || s.turn.round) >= 2) pact += Math.min(4, 2 + Math.floor((s.turn.round - x.since - 2) / 3));
    total += pact;
    // war chest: past $50 a turn, every extra dollar is worth two-thirds (keeps a runaway economy in check)
    const over = total > 50 ? -Math.floor((total - 50) / 3) : 0;
    total += over; taper_ = over;
    if (s.settings && s.settings.mode === 'worldwar') total = Math.round(total * 1.25);   // war economy
    const traitor = p && p.traitor ? -Math.ceil(total * 0.4) : 0;
    total += traitor;
    const bonus = d ? Math.round(total * d.income) - total : 0;
    total += bonus;
    return { total, base, fromHex, fromSea, fromRes, ref, trade, ware, taper, cap: taper_, poi, fish, lanes, fromRiver, river, pact, traitor, bonus, hexes, sea, cut, ruined, res };
  }
  function nearOwned(s, pid, k, r) {
    for (const a of area(k, r)) { const t = s.map.tiles[a]; if (t && t.owner === pid) return true; }
    return false;
  }
  function flakCovered(s, pid, k) {
    for (const a of area(k, MAX_SLVL)) { const f = getS(s.map.tiles[a], 'flak'); if (f && f.owner !== pid && dist(a, k) <= slvlOf(f)) return true; }
    return false;
  }

  // ───────────────────────── movement ─────────────────────────
  // kinds: start | move | pass | capture | attack | board
  // a stack containing ships moves as a fleet; land units riding along are cargo
  function movers(units) { return units.some(u => isSea(u.type)) ? units.filter(u => isSea(u.type)) : units; }
  function cargoCap(units) { return units.filter(u => UNITS[u.type].ability === 'transport').length * 3; }
  // carriers hold aircraft (4 each); aircraft are not counted against transport space
  function airCap(units) { return units.filter(u => UNITS[u.type].ability === 'carrier').length * 4; }
  const isAirU = u => UNITS[u.type].cls === 'air';
  function ridersOf(units, fleet) {
    const own = units.filter(u => !isSea(u.type));
    return own.filter(u => !isAirU(u)).slice(0, cargoCap(fleet)).concat(own.filter(isAirU).slice(0, airCap(fleet)));
  }
  function reachable(s, pid, unitIds, from, idx) {
    idx = idx || buildIndex(s);
    const all = unitIds.map(id => s.units[id]).filter(Boolean);
    const out = {};
    if (!all.length) return out;
    const units = movers(all);
    const p = player(s, pid);
    const navy = units.every(u => isSea(u.type));
    const allAir = units.every(u => UNITS[u.type].cls === 'air');
    const allHover = units.every(u => UNITS[u.type].cls === 'air' || UNITS[u.type].ability === 'hover');
    const strafe = !navy && units.every(u => UNITS[u.type].ability === 'strafe');   // gunships fly deep over enemy land (without seizing it)
    const pathfind = units.every(u => UNITS[u.type].ability === 'pathfinder');
    const canFight = units.some(u => UNITS[u.type].atk > 0);
    const mv = Math.min(...units.map(u => moveAllow(s, u)));
    out[from] = { c: 0, prev: null, kind: 'start' };
    const open = [from];
    const set = (n, c, prev, kind) => { if (!out[n] || out[n].c > c) { out[n] = { c, prev, kind }; if (!open.includes(n)) open.push(n); } };
    while (open.length) {
      open.sort((a, b) => out[a].c - out[b].c);
      const cur = open.shift(), cn = out[cur];
      const expand = cn.kind === 'start' || cn.kind === 'move' || cn.kind === 'pass' || (cn.kind === 'capture' && (strafe || navy));
      if (!expand) continue;
      for (const n of neighbors(cur)) {
        const t = s.map.tiles[n]; if (!t) continue;
        const occ = idx[n] || [];
        if ((t.owner && isAlly(s, pid, t.owner)) || (occ.length && isAlly(s, pid, occ[0].owner))) continue;   // allied ground is off limits
        const enemy = occ.length && occ[0].owner !== pid;
        const c = cn.c + 1;
        if (navy) {
          // ships: sail open water; strike enemies on adjacent coasts
          if (!isWater(t)) { if (enemy && canFight && c <= mv && isLandTile(t)) set(n, c, cur, 'attack'); continue; }
          if (c > mv) continue;
          const mined = getS(t, 'mine'); const enemyMine = mined && mined.owner && mined.owner !== pid && t.owner === mined.owner && !isAlly(s, pid, mined.owner);
          if (enemy || enemyMine) { if (canFight) set(n, c, cur, 'attack'); continue; }
          const room = stackFits(occ, all);
          set(n, c, cur, t.owner !== pid ? (room ? 'capture' : 'pass') : (room ? 'move' : 'pass'));
          continue;
        }
        if (isWater(t) && !allHover) {
          if (c > mv) continue;
          if (enemy) { if (canFight) set(n, c, cur, 'attack'); continue; }   // shore guns vs ships
          if (occ.length) {
            const aboard = occ.filter(u => !isSea(u.type) && !isAirU(u)).length;
            if (cargoCap(occ) >= aboard + units.length && stackFits(occ, units)) set(n, c, cur, 'board');
          }
          continue;
        }
        if (t.t === 'mountain' && !allAir) continue;
        // aircraft can land on one of your carriers
        if (allAir && isWater(t) && occ.length && occ[0].owner === pid && airCap(occ) >= occ.filter(isAirU).length + units.length && stackFits(occ, units)) { if (cn.c + 1 <= mv) set(n, cn.c + 1, cur, 'board'); continue; }
        const step = (!allAir && !pathfind && (TERRAIN[t.t].moveCost || (t.river ? 2 : 0))) || 1;   // rivers must be forded
        const cc = cn.c + step;
        if (cc > mv && !(cn.c === 0 && mv > 0)) continue;   // slow units can always crawl one hex
        const land = isLandTile(t);
        let kind;
        if (enemy) { if (!canFight) continue; kind = 'attack'; }
        else if (land && !t.owner && GARRISONED.includes(t.poi)) { if (!canFight) continue; kind = 'attack'; }
        else if (land && t.owner && t.owner !== pid) { const h = getS(t, 'hq'), bk = getS(t, 'bunker'); kind = (h && h.owner === t.owner) || (bk && bk.owner === t.owner) ? (canFight ? 'attack' : null) : 'capture'; }
        else kind = land && !t.contam && stackFits(occ, units) ? 'move' : 'pass';
        if (!kind || (kind === 'capture' && t.contam)) continue;
        set(n, cc, cur, kind);
      }
    }
    return out;
  }
  function pathTo(reach, k) { const p = []; let c = k; while (c) { p.unshift(c); c = reach[c].prev; } return p; }

  function hasLOS(s, a, b) {
    const l = line(a, b);
    for (let i = 1; i < l.length - 1; i++) { const t = s.map.tiles[l[i]]; if (t && t.t === 'mountain') return false; }
    return true;
  }
  function rangedTargets(s, pid, unitIds, from, idx) {
    idx = idx || buildIndex(s);
    const units = unitIds.map(id => s.units[id]).filter(Boolean);
    if (!units.length || !units.every(u => UNITS[u.type].range)) return [];
    const range = Math.min(...units.map(u => UNITS[u.type].range || 0));
    const orbital = units.every(u => UNITS[u.type].ability === 'orbital');
    const sam = units.some(u => UNITS[u.type].ability === 'sam');   // SAM batteries only engage aircraft
    const out = [];
    for (const k of area(from, range)) {
      if (k === from) continue;
      const occ = idx[k];
      if ((!occ || !occ.length) && !sam && isEnemyInfra(s, pid, k) && (orbital || hasLOS(s, from, k))) { out.push(k); continue; }   // shell undefended buildings
      if (!occ || !occ.length || occ[0].owner === pid || isAlly(s, pid, occ[0].owner)) continue;
      if (occ.every(u => UNITS[u.type].ability === 'stealth')) continue;
      if (sam && !occ.some(u => UNITS[u.type].cls === 'air' && UNITS[u.type].ability !== 'stealth')) continue;
      if (!orbital && !sam && !hasLOS(s, from, k)) continue;
      out.push(k);
    }
    return out;
  }

  // ───────────────────────── combat ─────────────────────────
  function combatCalc(s, pid, units, stages, target, ranged, idx) {
    idx = idx || buildIndex(s);
    stages = [].concat(stages);
    const t = s.map.tiles[target];
    const defenders = (idx[target] || []).filter(u => u.owner !== pid);
    const defPid = defenders.length ? defenders[0].owner : t.owner;
    const dp = player(s, defPid), ap = player(s, pid);
    const att = { pid, chips: 0, mult: 0, bonuses: [] }, def = { pid: defPid, chips: 0, mult: 0, bonuses: [] };
    const has = (list, cls) => list.some(u => UNITS[u.type].cls === cls);
    for (const u of units) att.chips += unitAtk(s, u);
    const lv = units.reduce((a, u) => a + (UNITS[u.type].atk ? levelOf(s, u) : 0), 0);
    if (lv) att.bonuses.push({ label: 'Veteran ★', chips: lv, note: true });
    const hunters = units.filter(u => UNITS[u.type].ability === 'hunter').length;
    if (hunters && has(defenders, 'veh')) { att.chips += 3 * hunters; att.bonuses.push({ label: 'Tank Hunter', chips: 3 * hunters }); }
    const torps = units.filter(u => UNITS[u.type].ability === 'torpedo').length;
    if (torps && has(defenders, 'sea')) { att.chips += 4 * torps; att.bonuses.push({ label: 'Torpedoes', chips: 4 * torps }); }
    if (!ranged && isLandTile(t)) {
      const inFight = new Set(units.map(u => u.id));
      const guns = side => { let n = 0; for (const nb of neighbors(target)) { const w = s.map.tiles[nb]; if (!w || !isWater(w)) continue; for (const u of idx[nb] || []) if (u.owner === side && isSea(u.type) && UNITS[u.type].atk > 0 && UNITS[u.type].ability !== 'transport' && !inFight.has(u.id) && !u.stun) n++; } return Math.min(3, n); };
      const ga = guns(pid); if (ga) { att.chips += 2 * ga; att.bonuses.push({ label: 'Naval Gunfire', chips: 2 * ga }); }
      if (defPid) { const gd = guns(defPid); if (gd) { def.chips += 2 * gd; def.bonuses.push({ label: 'Coastal Fleet', chips: 2 * gd }); } }
    }
    const aaA = units.reduce((n, u) => n + (UNITS[u.type].aa || 0), 0);
    if (aaA && has(defenders, 'air')) { att.chips += aaA; att.bonuses.push({ label: 'Anti-Air', chips: aaA }); }
    const sap = units.filter(u => UNITS[u.type].ability === 'sapper').length;
    if (!ranged && sap && structsOf(t).some(x => x.type !== 'bridge')) { att.chips += 3 * sap; att.bonuses.push({ label: 'Demolitions', chips: 3 * sap }); }
    if (s.weather && s.weather.id === 'fervour') { att.mult += 1; att.bonuses.push({ label: 'War Fervour', mult: 1 }); }
    if (ap && ap.vengeance && ap.vengeance.vs === defPid) { att.mult += 2; att.bonuses.push({ label: 'Vengeance', mult: 2 }); }
    if (!ranged && ap && ap.rally) { att.mult += ap.rally; att.bonuses.push({ label: 'Rally', mult: ap.rally }); }
    if (!ranged && units.some(u => UNITS[u.type].ability === 'strafe') && !defenders.some(u => ['air', 'sea'].includes(UNITS[u.type].cls)) && isLandTile(t)) { att.mult += 2; att.bonuses.push({ label: 'Strafing Run', mult: 2 }); }
    if (!ranged && TERRAIN[t.t] && TERRAIN[t.t].bog && !units.every(u => UNITS[u.type].cls === 'air')) { att.mult -= 1; att.bonuses.push({ label: 'Bogged Down', mult: -1 }); }
    if (!ranged) {
      const classes = new Set(units.filter(u => UNITS[u.type].atk > 0).map(u => UNITS[u.type].cls));
      const ca = Math.min(3, classes.size - 1);
      if (ca > 0) { att.mult += ca; att.bonuses.push({ label: 'Combined Arms ×' + classes.size, mult: ca }); }
      const multi = new Set(units.map(u => u.hex)).size;
      const ids = new Set(units.map(u => u.id));
      let flank = 0;
      for (const n of neighbors(target)) {
        if (stages.includes(n)) continue;
        const occ = idx[n]; if (occ && occ.some(u => u.owner === pid && !ids.has(u.id) && !isSea(u.type))) flank++;
      }
      flank = Math.min(2, flank);
      if (flank) { att.mult += flank; att.bonuses.push({ label: 'Flanking', mult: flank }); }
      if (stages.length > 1) { const pin = Math.min(2, stages.length - 1); att.mult += pin; att.bonuses.push({ label: 'Pincer ×' + stages.length, mult: pin }); }
      if (structsOf(t).some(x => ['hq', 'fob', 'bunker'].includes(x.type)) && units.some(u => ['siege', 'titan'].includes(UNITS[u.type].ability))) { att.mult += 2; att.bonuses.push({ label: 'Siege Breaker', mult: 2 }); }
      if (isLandTile(t) && units.every(u => isSea(u.type))) { att.mult -= 1; att.bonuses.push({ label: 'Shore Assault', mult: -1 }); }
      void multi;
    } else {
      const st = s.map.tiles[stages[0]];
      if (st && st.t === 'hills') { att.mult += 1; att.bonuses.push({ label: 'High Ground', mult: 1 }); }
    }
    for (const u of defenders) def.chips += unitDef(s, u);
    const dlv = defenders.reduce((a, u) => a + levelOf(s, u), 0);
    if (dlv) def.bonuses.push({ label: 'Veteran ★', chips: dlv, note: true });
    if (dp && dp.faction === 'iron' && defenders.length) { def.chips += 2 * defenders.length; def.bonuses.push({ label: 'Steel Wall', chips: 2 * defenders.length }); }
    const aaD = defenders.reduce((n, u) => n + (UNITS[u.type].aa || 0), 0);
    if (aaD && has(units, 'air')) { def.chips += aaD; def.bonuses.push({ label: 'Anti-Air', chips: aaD }); }
    if (!t.owner && GARRISONED.includes(t.poi) && !defenders.length) {
      const g = t.gar || (t.poi === 'village' ? 6 : 5);
      def.chips += g; def.bonuses.push({ label: t.poi === 'village' ? 'Village Militia' : t.poi === 'silo' ? 'Silo Guard' : 'Fort Garrison', chips: g });
      if (t.poi === 'village') { const m = g >= 7 ? 2 : 1; def.mult += m; def.bonuses.push({ label: 'Barricades', mult: m }); }
    }
    const dHunt = defenders.filter(u => UNITS[u.type].ability === 'hunter').length;
    if (dHunt && has(units, 'veh')) { def.chips += 3 * dHunt; def.bonuses.push({ label: 'Tank Hunter', chips: 3 * dHunt }); }
    const hq = getS(t, 'hq');
    if (hq && hq.owner === defPid && !hq.siege) { const L = slvlOf(hq); def.chips += 3 * L; def.bonuses.push({ label: 'HQ Garrison' + (L > 1 ? ' ' + '★'.repeat(L) : ''), chips: 3 * L }); def.mult += 1 + L; def.bonuses.push({ label: 'Fortified HQ', mult: 1 + L }); }
    if (t.river && isLandTile(t) && !units.every(u => UNITS[u.type].cls === 'air')) { def.mult += 1; def.bonuses.push({ label: 'River Crossing', mult: 1 }); }
    const tm = isWater(t) || t.bridge ? 0 : (TERRAIN[t.t].defMult || 0);
    if (tm) { def.mult += tm; def.bonuses.push({ label: TERRAIN[t.t].name, mult: tm }); }
    const bk = getS(t, 'bunker'), fb = getS(t, 'fob');
    if (bk && bk.owner === defPid) {
      // ★★★ is a Citadel: a much bigger garrison and thicker walls
      const L = slvlOf(bk), m = L >= 3 ? 5 : 1 + L, g = L >= 3 ? 14 : 3 * L;
      def.chips += g; def.bonuses.push({ label: (L >= 3 ? 'Citadel Garrison' : 'Bunker Garrison') + (L > 1 ? ' ' + '★'.repeat(L) : ''), chips: g });
      def.mult += m; def.bonuses.push({ label: (L >= 3 ? 'Citadel' : 'Bunker') + (L > 1 ? ' ' + '★'.repeat(L) : ''), mult: m });
    } else if (defPid && t.owner === defPid && isLandTile(t)) {
      let line = 0;
      for (const n of neighbors(target)) { const nb = s.map.tiles[n], b2 = nb && getS(nb, 'bunker'); if (b2 && b2.owner === defPid && nb.owner === defPid && slvlOf(b2) >= 2) line = Math.max(line, slvlOf(b2) >= 3 ? 2 : 1); }
      if (line) { def.mult += line; def.bonuses.push({ label: 'Bunker Line', mult: line }); }
    }
    const mn = getS(t, 'mine');
    if (mn && mn.owner === defPid && defPid && isWater(t) && !units.every(u => UNITS[u.type].cls === 'air')) {
      const L = slvlOf(mn), m = 1 + L;
      def.chips += 3 * L; def.bonuses.push({ label: 'Minefield' + (L > 1 ? ' ' + '★'.repeat(L) : ''), chips: 3 * L });
      def.mult += m; def.bonuses.push({ label: 'Mines' + (L > 1 ? ' ' + '★'.repeat(L) : ''), mult: m });
    }
    if (fb && fb.owner === defPid) { const m = slvlOf(fb); def.mult += m; def.bonuses.push({ label: 'FOB Walls' + (m > 1 ? ' ' + '★'.repeat(m) : ''), mult: m }); }
    if (t.smoke && t.smoke === defPid) { def.mult += 2; def.bonuses.push({ label: 'Smoke Screen', mult: 2 }); }
    if (dp && dp.shield && t.owner === defPid) { def.mult += 3; def.bonuses.push({ label: 'Aegis Protocol', mult: 3 }); }
    // allies cover each other: a hex bordering an ally's land holds a little harder
    if (defPid && (s.allies || []).length && isLandTile(t) && neighbors(target).some(n => { const nb = s.map.tiles[n]; return nb && nb.owner && nb.owner !== defPid && isAlly(s, defPid, nb.owner); })) { def.mult += 1; def.bonuses.push({ label: 'Allied Support', mult: 1 }); }
    const aegis = Math.min(2, defenders.filter(u => UNITS[u.type].ability === 'aegis').length);
    if (aegis) { def.mult += aegis; def.bonuses.push({ label: 'Aegis', mult: aegis }); }
    if (has(units, 'air') && getS(t, 'flak') && getS(t, 'flak').owner === defPid) { def.mult += 2; def.bonuses.push({ label: 'Flak Battery', mult: 2 }); }
    { const bk2 = !ranged && getS(t, 'bunker');
      if (bk2 && bk2.owner === defPid && defPid && att.chips > def.chips) {
        const L2 = slvlOf(bk2), hold = Math.min(L2 >= 3 ? 20 : 4 * L2, Math.round((att.chips - def.chips) * (L2 >= 3 ? 0.6 : 0.4)));
        if (hold > 0) { def.chips += hold; def.bonuses.push({ label: 'Hold the Line', chips: hold }); }
      } }
    const aNull = ap && ap.faction === 'null', dNull = dp && dp.faction === 'null';
    let wins = 0;
    for (let a = 1; a <= 6; a++) for (let d = 1; d <= 6; d++) {
      const ra = aNull && a <= 2 ? 3 : a, rd = dNull && d <= 2 ? 3 : d;
      if (att.chips * Math.max(1, ra + att.mult) > def.chips * Math.max(1, rd + def.mult)) wins++;
    }
    return { att, def, defenders, winProb: wins / 36, aNull, dNull };
  }
  function rollDie(rng) { return 1 + Math.floor(rng() * 6); }
  const weakest = arr => arr.slice().sort((a, b) => UNITS[a.type].cost - UNITS[b.type].cost)[0];
  function canHold(tile, u) { return isWater(tile) ? isSea(u.type) : isLandTile(tile) && !isSea(u.type); }

  // groups: [{ units, stage, from }] — one group is a normal attack, several is a pincer
  function resolveAssault(s, pid, groups, target, rng, ev) {
    const idx = buildIndex(s);
    const units = groups.flatMap(g => g.units);
    const stages = groups.map(g => g.stage);
    const calc = combatCalc(s, pid, units, stages, target, false, idx);
    const tile = s.map.tiles[target];
    const defenders = calc.defenders, defPid = calc.def.pid;
    let ra = rollDie(rng), rd = rollDie(rng); const rawA = ra, rawD = rd;
    if (calc.aNull && ra <= 2) ra = 3;
    if (calc.dNull && rd <= 2) rd = 3;
    const aScore = calc.att.chips * Math.max(1, ra + calc.att.mult), dScore = calc.def.chips * Math.max(1, rd + calc.def.mult);
    const crush = calc.winProb >= 1;   // every possible roll wins: the defenders are simply crushed
    const attWin = crush || aScore > dScore;
    const killed = [], pyrrhic = [];
    if (attWin) {
      killed.push(...defenders);
      if (!crush && dScore >= 0.6 * aScore && units.length > 1 && !units.some(u => ['juggernaut', 'titan', 'medic'].includes(UNITS[u.type].ability))) pyrrhic.push(weakest(units));
    } else {
      killed.push(...units);
      if (aScore >= 0.6 * dScore && defenders.length > 1 && !defenders.some(u => ['juggernaut', 'titan', 'medic'].includes(UNITS[u.type].ability))) pyrrhic.push(weakest(defenders));
    }
    tallyLosses(s, pid, defPid, killed.concat(pyrrhic));
    { const apr = player(s, pid); if (apr) apr.rally = 0; }
    ev.push({
      e: 'combat', ranged: false, from: stages[0], stages, to: target,
      att: { ...calc.att, roll: ra, raw: rawA, score: aScore, units: units.map(u => u.type) },
      def: { ...calc.def, roll: rd, raw: rawD, score: dScore, units: defenders.map(u => u.type) },
      attWin, crush, killed: killed.map(u => u.id), pyrrhic: pyrrhic.map(u => u.id), winProb: calc.winProb,
    });
    const ap = player(s, pid), dp = player(s, defPid);
    const survivors = units.filter(u => s.units[u.id]);
    if (attWin) {
      const fit = survivors.filter(u => canHold(tile, u)).sort((a, b) => UNITS[b.type].cost - UNITS[a.type].cost);
      const holders = fit.slice(0, stackFits([], fit) ? GRUNT_STACK : MAX_STACK);
      if (holders.length) {
        holders.forEach(u => { u.hex = target; });
        const hqs = getS(tile, 'hq'), hqTaken = hqs && hqs.owner === defPid && !hqs.siege;
        captureTile(s, target, pid);
        ev.push({ e: 'advance', pid, units: holders.map(u => u.id), from: stages[0], to: target });
        if (hqTaken && dp) {
          ev.push({ e: 'siege', pid, victim: defPid, hex: target }); addMood(s, defPid, pid, -25);
          pushLog(s, '🔥 ' + (ap ? ap.name : '?') + ' is besieging ' + dp.name + "'s HQ! Retake it within a turn or fall.");
        }
      }
    }
    // everyone who didn't advance goes back to where they started
    for (const g of groups) for (const u of g.units) if (s.units[u.id] && u.hex !== target) u.hex = g.from;
    pushLog(s, '⚔ ' + (ap ? ap.name : '?') + (groups.length > 1 ? ' launched a ' + groups.length + '-way assault on ' : ' attacked ') + (dp ? dp.name : 'a garrison') + ' — ' + aScore + ' vs ' + dScore + (crush ? ' · OBLITERATED' : attWin ? ' · WIN' : ' · REPELLED'));
    return attWin;
  }
  function resolveFire(s, pid, units, from, target, rng, ev) {
    const calc = combatCalc(s, pid, units, from, target, true);
    const defenders = calc.defenders, defPid = calc.def.pid;
    let ra = rollDie(rng), rd = rollDie(rng); const rawA = ra, rawD = rd;
    if (calc.aNull && ra <= 2) ra = 3;
    if (calc.dNull && rd <= 2) rd = 3;
    const aScore = calc.att.chips * Math.max(1, ra + calc.att.mult), dScore = calc.def.chips * Math.max(1, rd + calc.def.mult);
    const crush = calc.winProb >= 1;
    const attWin = crush || aScore > dScore, killed = [];
    if (attWin) {
      const sam = units.some(u => UNITS[u.type].ability === 'sam');
      const pool = defenders.filter(u => UNITS[u.type].ability !== 'stealth' && (!sam || UNITS[u.type].cls === 'air'));
      const n = aScore >= 2 * dScore ? 2 : 1;
      for (let i = 0; i < n && pool.length; i++) killed.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
    units.forEach(u => u.moved = true);
    tallyLosses(s, pid, defPid, killed);
    ev.push({
      e: 'combat', ranged: true, from, stages: [from], to: target,
      att: { ...calc.att, roll: ra, raw: rawA, score: aScore, units: units.map(u => u.type) },
      def: { ...calc.def, roll: rd, raw: rawD, score: dScore, units: defenders.map(u => u.type) },
      attWin, crush, killed: killed.map(u => u.id), pyrrhic: [], winProb: calc.winProb,
    });
    const ap = player(s, pid), dp = player(s, defPid);
    pushLog(s, '💥 ' + (ap ? ap.name : '?') + ' shelled ' + (dp ? dp.name : '?') + ' — ' + aScore + ' vs ' + dScore + (attWin ? ' · HIT' : ' · MISS'));
  }
  // ── moods: how every commander feels about every other (-100..100). Bots use them for pacts and grudges ──
  function moodOf(s, a, b) { return (s.moods && s.moods[a] && s.moods[a][b]) || 0; }
  function addMood(s, a, b, d) {
    if (!a || !b || a === b || s._preview) return;
    s.moods = s.moods || {}; const m = s.moods[a] = s.moods[a] || {};
    m[b] = Math.max(-100, Math.min(100, Math.round((m[b] || 0) + d)));
  }
  // rough strength: land, army value and income
  function threatOf(s, pid) {
    let land = 0, army = 0;
    for (const k in s.map.tiles) if (s.map.tiles[k].owner === pid && isLandTile(s.map.tiles[k])) land++;
    for (const id in s.units) { const u = s.units[id]; if (u.owner === pid) army += UNITS[u.type].cost; }
    return land + army / 2 + computeIncome(s, pid).total;
  }
  function tallyLosses(s, pid, defPid, dead) {
    if (defPid) addMood(s, defPid, pid, -6 - 3 * dead.filter(u => u.owner === defPid).length);
    const ap = player(s, pid), dp = player(s, defPid);
    for (const u of dead) {
      const killer = u.owner === pid ? dp : ap;
      if (killer && killer.bounty) killer.cash += killer.bounty === true ? 2 : killer.bounty;
      const owner = player(s, u.owner); if (owner) owner.stats.lost++;
      const other = u.owner === pid ? dp : ap; if (other) other.stats.kills++;
      delete s.units[u.id];
    }
  }

  // ── economic warfare: strikes and shelling can wreck an enemy's buildings, not just their troops ──
  const ECON = ['warehouse', 'refinery', 'depot', 'port'];
  const ECON_VALUE = { warehouse: 4, refinery: 4, port: 5, depot: 2 };
  function econOf(s, k) { const t = s.map.tiles[k]; return t ? structsOf(t).filter(st => ECON.includes(st.type) && st.owner && st.owner === t.owner) : []; }
  function infraValue(s, k) { return econOf(s, k).reduce((v, st) => v + ECON_VALUE[st.type] * slvlOf(st), 0); }
  // knock levels off the most valuable buildings on a hex (a ★ building, or a Port, is destroyed). Returns what was hit
  function damageInfra(s, k, levels, destroy) {
    const t = s.map.tiles[k], hits = [];
    for (let i = 0; i < levels; i++) {
      const st = econOf(s, k).sort((a, b) => ECON_VALUE[b.type] * slvlOf(b) - ECON_VALUE[a.type] * slvlOf(a))[0]; if (!st) break;
      const from = slvlOf(st);
      if (destroy || from <= 1 || st.type === 'port') { removeStruct(t, st); hits.push({ type: st.type, from, to: 0 }); }
      else { st.lvl = from - 1; hits.push({ type: st.type, from, to: from - 1 }); }
      if (destroy) break;
    }
    return hits;
  }
  const isEnemyInfra = (s, pid, k) => { const t = s.map.tiles[k]; return !!t && t.owner && t.owner !== pid && !isAlly(s, pid, t.owner) && econOf(s, k).length > 0; };
  function captureTile(s, k, pid) {
    const t = s.map.tiles[k];
    if (!t || t.t === 'mountain' || t.owner === pid) return false;
    if (t.owner) addMood(s, t.owner, pid, -2);
    const cp = player(s, pid);
    if (cp && cp.faction === 'ashen' && t.owner && t.owner !== pid) { cp.cash += 2; cp.loot = (cp.loot || 0) + 2; }
    t.owner = pid;
    t.smoke = null;
    // an enemy commander's bunker is blown up when its hex falls (neutral forts still hand theirs over)
    const razed = structsOf(t).filter(st => (st.type === 'bunker' || st.type === 'mine') && st.owner && st.owner !== pid);
    if (razed.length) {
      t.structs = structsOf(t).filter(st => !razed.includes(st));
      (s._razed = s._razed || []).push(k);
      pushLog(s, '💥 ' + (cp ? cp.name : '?') + ' destroyed a Bunker.');
    }
    for (const st of structsOf(t)) {
      if (st.type === 'hq') { if (st.owner === pid) delete st.siege; else st.siege = { by: pid }; continue; }
      if (st.owner !== pid && (st.type === 'fob' || st.type === 'port')) st.lock = 1;
      st.owner = pid;
    }
    syncStructs(t);
    const p = player(s, pid); if (p) p.stats.captured++;
    return true;
  }

  function eliminate(s, loser, by, ev) {
    const lp = player(s, loser); if (!lp || !lp.alive) return;
    lp.alive = false; lp.tactics = []; lp.cash = 0;
    const hexes = [];
    for (const k in s.map.tiles) {
      const t = s.map.tiles[k];
      for (const st of structsOf(t).slice()) if (st.type === 'hq' && st.owner === loser) removeStruct(t, st);
      if (t.owner === loser) {
        const heart = by && dist(k, lp.hq) <= 2;
        if (heart) { t.owner = by; for (const st of structsOf(t)) st.owner = by; }
        else {
          // outside the heartland the empire collapses: land goes neutral, buildings are wrecked (bridges stay, unowned)
          t.owner = null; t.structs = structsOf(t).filter(st => st.type === 'bridge'); for (const st of t.structs) st.owner = null;
          if (t.bridge) t.owner = null;
        }
        syncStructs(t); hexes.push(k);
      }
    }
    const dead = [];
    for (const id in s.units) if (s.units[id].owner === loser) { dead.push(+id); delete s.units[id]; }
    const bp = player(s, by);
    if (bp) bp.cash += 10;
    if (s.trade && (s.trade.from === loser || s.trade.to === loser)) s.trade = null;
    const taken = hexes.filter(k => s.map.tiles[k].owner === by);
    ev.push({ e: 'eliminate', pid: loser, by, hexes, taken, units: dead, hq: lp.hq });
    pushLog(s, '☠ ' + lp.name + ' has fallen' + (bp ? ' to ' + bp.name + ' (+$10 plunder, ' + taken.length + ' heartland hexes)' : '') + '. The rest of their empire collapses into neutral land.');
  }

  // ───────────────────────── cards, crates & the draft ─────────────────────────
  function heldLegendaries(s) {
    const held = new Set();
    for (const pl of s.players) if (pl.alive) { pl.arsenal.forEach(a => held.add(a)); pl.tactics.forEach(c => held.add(c.id)); }
    if (s.turn.crate) s.turn.crate.cards.forEach(id => held.add(id));
    return held;
  }
  // draw n distinct cards: roll a rarity from `odds`, then a card of that rarity
  function drawCards(s, p, n, odds, rng, noDrops) {
    const held = heldLegendaries(s);
    const pools = {};
    for (const r of RARITY_ORDER) pools[r] = [];
    for (const id in UNITS) {
      if (['legendary', 'mythic'].includes(UNITS[id].rarity) && held.has(id)) continue;
      if (p.arsenal.includes(id) && (p.levels[id] || 0) >= MAX_LEVEL) continue;
      pools[UNITS[id].rarity].push(id);
    }
    for (const id in TACTICS) {
      if (noDrops && id.startsWith('drop_')) continue;
      if (!(['legendary', 'mythic'].includes(TACTICS[id].rarity) && id !== 'drop_legendary' && held.has(id))) pools[TACTICS[id].rarity].push(id);
    }
    const out = [];
    for (let i = 0; i < n; i++) {
      const avail = RARITY_ORDER.filter(r => pools[r].some(id => !out.includes(id)) && (odds[r] || 0) > 0);
      if (!avail.length) break;
      const tot = avail.reduce((a, r) => a + odds[r], 0);
      let x = rng() * tot, rar = avail[0];
      for (const r of avail) { x -= odds[r]; if (x <= 0) { rar = r; break; } }
      const pool = pools[rar].filter(id => !out.includes(id));
      out.push(pool[Math.floor(rng() * pool.length)]);
    }
    return out;
  }
  function rollTier(dropId, rng) {
    const o = DROP_TIERS[dropId] || DROP_TIERS.drop_rare, x = rng() * 100;
    return x < o.mythic ? 'mythic' : x < o.mythic + o.gilded ? 'gilded' : 'standard';
  }
  function openCrate(s, p, tier, rng, ev, source) {
    const cards = drawCards(s, p, 3, CRATES[tier].odds, rng, true);
    p.stats.crates++;
    s.turn.crate = { tier, cards, source };
    s.turn.stage = 'crate';
    ev.push({ e: 'crate', pid: p.id, tier, source, best: cards.map(id => cardDef(id).rarity).sort((a, b) => RARITY_ORDER.indexOf(b) - RARITY_ORDER.indexOf(a))[0] });
  }
  // give a card to a player: units join the deck (or level up), tactics go to the hand
  function grantCard(s, p, id, replace, ev) {
    const d = cardDef(id);
    if (d.kind === 'tactic') { p.tactics.push({ uid: s.nextId++, id }); ev.push({ e: 'card', pid: p.id, id, rarity: d.rarity, kind: 'tactic' }); return null; }
    if (p.arsenal.includes(id)) {
      const lv = (p.levels[id] || 0);
      if (lv >= MAX_LEVEL) { p.cash += 4; ev.push({ e: 'card', pid: p.id, id, rarity: d.rarity, kind: 'unit', refund: 4 }); return null; }
      p.levels[id] = lv + 1;
      ev.push({ e: 'card', pid: p.id, id, rarity: d.rarity, kind: 'unit', level: lv + 1 });
      return null;
    }
    if (p.arsenal.length >= DECK_MAX) {
      if (!replace || !p.arsenal.includes(replace)) return 'Your deck is full (' + DECK_MAX + ') — pick a card to replace';
      p.arsenal.splice(p.arsenal.indexOf(replace), 1);
      delete p.levels[replace];
    }
    p.arsenal.push(id);
    ev.push({ e: 'card', pid: p.id, id, rarity: d.rarity, kind: 'unit', replaced: replace && !p.arsenal.includes(replace) ? replace : null });
    return null;
  }
  function draftPick(s, p, a, ev, rng) {
    const fail = err => ({ ok: false, err, events: [] });
    const d = s.draft;
    if (d.picked[p.id]) return fail('Waiting for the others');
    const offer = d.offers[p.id] || [];
    const id = offer[a.idx]; if (!id) return fail('No such card');
    const err = grantCard(s, p, id, a.replace, ev); if (err) return fail(err);
    d.step[p.id] = (d.step[p.id] || 0) + 1;
    ev.push({ e: 'draftPick', pid: p.id, round: d.step[p.id] });
    if (d.step[p.id] >= d.rounds) { d.picked[p.id] = true; d.offers[p.id] = []; }
    else { d.offers[p.id] = drawCards(s, p, 3, DRAFT_ODDS, rng); ev.push({ e: 'draft', pid: p.id, round: d.step[p.id] + 1 }); }
    if (s.players.every(pl => !pl.alive || d.picked[pl.id])) {
      s.phase = 'play'; s.draft = null;
      recordHistory(s);
      pushLog(s, 'Draft complete. The war begins!');
      ev.push({ e: 'draftDone' });
      startTurn(s, ev, rng);
    }
    return { ok: true, events: ev };
  }

  // ───────────────────────── turn flow ─────────────────────────
  function startTurn(s, ev, rng, preview) {
    if (s.phase !== 'play') return;
    const p = current(s);
    if (!p.alive) return endTurn(s, ev, rng);
    p.blitz = false; p.bounty = false; p.rally = 0; p.shield = false; p.wx = s.weather ? s.weather.id : null;
    if (!preview) expirePacts(s, ev);
    if (!preview && (s.allies || []).some(x => x.ending === p.id)) {
      for (const x of s.allies.filter(x => x.ending === p.id)) {
        const o = player(s, x.a === p.id ? x.b : x.a);
        // betrayal: 3 turns of a crippled economy, no new pacts, and the betrayed side fights you with +2 Mult
        p.traitor = 3; o.vengeance = { vs: p.id, turns: 3 };
        for (const q of s.players) if (q.id !== p.id) addMood(s, q.id, p.id, q.id === o.id ? -80 : -25);
        ev.push({ e: 'ally', status: 'broken', from: p.id, to: o.id });
        pushLog(s, '💔 ' + p.name + ' broke the alliance with ' + o.name + '. Traitor for 3 turns: -40% income, and ' + o.name + ' gets +2 Mult against them.');
      }
      s.allies = s.allies.filter(x => x.ending !== p.id);
    }
    for (const id in s.units) {
      const u = s.units[id]; if (u.owner !== p.id) continue;
      u.moved = false; u.fresh = false; u.mvBonus = 0;
      if (u.stun > 0) { u.moved = true; u.stun--; }
    }
    for (const k in s.map.tiles) { const t = s.map.tiles[k]; if (t.smoke === p.id) t.smoke = null; if (t.ruin && t.owner === p.id && !preview) { t.ruin--; if (!t.ruin) delete t.ruin; } }
    const depots = Object.keys(s.map.tiles).filter(k => { const t = s.map.tiles[k], d = getS(t, 'depot'); return t.owner === p.id && d && d.owner === p.id; });
    if (depots.length) for (const id in s.units) { const u = s.units[id]; if (u.owner === p.id && depots.some(d => dist(d, u.hex) <= slvlOf(getS(s.map.tiles[d], 'depot')))) u.mvBonus = 1; }
    // structures captured last turn come online; sieges this player started now resolve
    for (const k in s.map.tiles) {
      const t = s.map.tiles[k];
      for (const st of structsOf(t)) if (st.lock && st.owner === p.id) delete st.lock;
      const h = getS(t, 'hq');
      // the blueprint preview must not resolve sieges: it would paint the victim's whole empire in your colour
      if (h && h.siege && h.siege.by === p.id && !preview) {
        const holding = t.owner === p.id && Object.values(s.units).some(u => u.hex === k && u.owner === p.id);
        if (holding) { const victim = h.owner; eliminate(s, victim, p.id, ev); }
        else { delete h.siege; if (t.owner === p.id) t.owner = h.owner; ev.push({ e: 'siegeBroken', pid: h.owner, hex: k }); pushLog(s, '🛡 The siege of ' + (player(s, h.owner) || {}).name + "'s HQ collapsed."); }
      }
    }
    checkWin(s, ev);
    if (s.phase !== 'play') return;
    if (s.map.beacon) {
      if (s.map.tiles[s.map.beacon].owner === p.id) { p.koth++; if (p.koth >= 3) return declareWin(s, p.id, 'held the Beacon for 3 turns', ev); }
      else p.koth = 0;
    }
    // resupply pick gets 20s of its own on top; the full action clock restarts once you've chosen
    s.turn.deadline = s.settings.timer ? Date.now() + s.settings.timer * 1000 + (s.turn.round === 1 ? 0 : 20000) : 0;
    s.turn.income = computeIncome(s, p.id).total;
    if (p.traitor && !preview) { p.traitor--; if (p.traitor <= 0) delete p.traitor; }
    if (!preview && s.moods && s.moods[p.id]) {
      // grudges fade slowly; standing alliances warm up
      const m = s.moods[p.id]; for (const k in m) m[k] = Math.round(m[k] * 0.93);
      for (const x of s.allies || []) if (x.a === p.id || x.b === p.id) addMood(s, p.id, x.a === p.id ? x.b : x.a, 3);
    }
    if (p.vengeance && !preview) { p.vengeance.turns--; if (p.vengeance.turns <= 0) delete p.vengeance; }
    // superweapon silos: three turns in a row and the silo hands over a Mythic card
    if (!preview && s.map.silos) {
      p.silo = p.silo || {};
      for (const k of s.map.silos) {
        if (s.map.tiles[k].owner !== p.id) { delete p.silo[k]; continue; }
        p.silo[k] = (p.silo[k] || 0) + 1;
        if (p.silo[k] >= 3) {
          p.silo[k] = 0;
          const held = heldLegendaries(s), pool = Object.keys(TACTICS).filter(id => TACTICS[id].rarity === 'mythic' && !held.has(id));
          const id = (pool.length ? pool : Object.keys(TACTICS).filter(id => TACTICS[id].rarity === 'legendary' && !id.startsWith('drop_')))[Math.floor((rng || Math.random)() * (pool.length || 1))];
          if (id) { p.tactics.push({ uid: s.nextId++, id }); ev.push({ e: 'silo', pid: p.id, hex: k, card: id }); pushLog(s, '🚀 ' + p.name + ' armed a superweapon silo: ' + TACTICS[id].name + '!'); }
        }
      }
    }
    if (p.embargo) {
      s.turn.income = Math.floor(s.turn.income / 2); p.embargo = (p.embargo === true ? 1 : p.embargo) - 1; if (p.embargo <= 0) delete p.embargo;
      ev.push({ e: 'embargoHit', pid: p.id, left: p.embargo || 0 }); pushLog(s, '⛔ ' + p.name + "'s income is halved by an embargo" + (p.embargo ? ' (1 more turn).' : '.'));
    }
    s.turn.rerolls = 0; s.turn.crate = null;
    ev.push({ e: 'turn', pid: p.id, round: s.turn.round });
    if (s.turn.round === 1) {
      // everyone just drafted 3 cards: round 1 pays full income with no resupply pick
      p.cash += s.turn.income; s.turn.offer = []; s.turn.stage = 'act';
      ev.push({ e: 'income', pid: p.id, amount: s.turn.income, hq: p.hq });
    } else {
      s.turn.stage = 'choose';
      s.turn.offer = drawCards(s, p, 3, TURN_ODDS, rng);
    }
  }

  function endTurn(s, ev, rng) {
    if (s.phase !== 'play') return;
    const n = s.players.length;
    let guard = 0;
    s.turn.crate = null; s.turn.offer = [];
    do {
      s.turn.idx = (s.turn.idx + 1) % n;
      if (s.turn.idx === 0) {
        s.turn.round++;
        for (const k in s.map.tiles) { const t = s.map.tiles[k]; if (t.contam > 0) t.contam--; }
        recordHistory(s);
        rollWeather(s, ev, rng);
        if (s.settings.maxRounds && s.turn.round > s.settings.maxRounds) {
          if (s.settings.teams === 'on') {
            const by = {}; for (const p of s.players.filter(p => p.alive)) by[p.team] = (by[p.team] || 0) + ownedLand(s, p.id).length;
            const tm = Object.keys(by).sort((a, b) => by[b] - by[a])[0], mates = s.players.filter(p => p.alive && String(p.team) === tm);
            declareWin(s, mates[0].id, 'and their team held the most territory when time ran out', ev); s.winner.pids = mates.map(p => p.id); return;
          }
          const best = s.players.filter(p => p.alive).map(p => [p, ownedLand(s, p.id).length]).sort((a, b) => b[1] - a[1])[0];
          return declareWin(s, best[0].id, 'held the most territory when time ran out', ev);
        }
      }
    } while (!s.players[s.turn.idx].alive && ++guard < n * 2);
    startTurn(s, ev, rng);
  }

  function recordHistory(s) {
    const c = {}, inc = {}, army = {}, kills = {};
    for (const p of s.players) { c[p.id] = 0; army[p.id] = 0; kills[p.id] = p.stats.kills; inc[p.id] = p.alive ? computeIncome(s, p.id).total : 0; }
    for (const k in s.map.tiles) { const t = s.map.tiles[k]; if (t.owner && c[t.owner] !== undefined && isLandTile(t)) c[t.owner]++; }
    for (const id in s.units) { const u = s.units[id]; if (army[u.owner] !== undefined) army[u.owner] += UNITS[u.type].cost; }
    s.history = s.history || []; s.history.push({ r: s.turn.round, c, inc, army, kills });
  }
  // end-of-game data: where the fighting happened, where land changed hands, money earned, the biggest battle
  function trackStats(s, events) {
    const heat = s.heat = s.heat || {}, flips = s.flips = s.flips || {};
    const bump = (m, k, n = 1) => { if (k) m[k] = (m[k] || 0) + n; };
    for (const e of events) {
      if (e.e === 'combat') {
        bump(heat, e.to, 1 + (e.killed || []).length + (e.pyrrhic || []).length);
        const size = (e.att.chips || 0) + (e.def.chips || 0);
        if (!s.bigBattle || size > s.bigBattle.size) s.bigBattle = { size, to: e.to, round: s.turn.round, att: e.att.pid, def: e.def.pid || null, attWin: e.attWin, killed: (e.killed || []).length + (e.pyrrhic || []).length };
      } else if (e.e === 'tactic' && e.target) bump(heat, e.target, 2);
      else if (e.e === 'move') for (const k of e.captures || []) bump(flips, k);
      else if (e.e === 'annex') for (const k of e.hexes || []) bump(flips, k);
      else if (e.e === 'income') { const p = player(s, e.pid); if (p) p.stats.earned = (p.stats.earned || 0) + (e.amount || 0); }
    }
  }
  function rollWeather(s, ev, rng) {
    s.weather = null;
    if (s.settings.events === 'off' || s.turn.round < 3 || rng() < 0.35) { for (const p of s.players) p.wx = null; return; }
    const ids = Object.keys(WEATHER).filter(id => id !== 'clear' || s.settings.fog === 'on');
    const id = ids[Math.floor(rng() * ids.length)];
    s.weather = { id, round: s.turn.round };
    for (const p of s.players) p.wx = id;
    ev.push({ e: 'weather', id });
    pushLog(s, WEATHER[id].icon + ' ' + WEATHER[id].name + ': ' + WEATHER[id].desc);
  }
  // ── alliances: pacts of non-aggression with shared vision and a shared victory ──
  function isAlly(s, a, b) { return !!(a && b && a !== b && (s.allies || []).some(x => (x.a === a && x.b === b) || (x.a === b && x.b === a))); }
  function allyOffer(s, p, a, ev) {
    const to = player(s, a.to);
    if (!to || !to.alive || to.id === p.id) return { ok: false, err: 'Pick a rival', events: [] };
    if (isAlly(s, p.id, to.id)) return { ok: false, err: 'Already allied', events: [] };
    if (s.allyOffer) return { ok: false, err: 'An alliance offer is already on the table', events: [] };
    if (s.settings.teams === 'on') return { ok: false, err: 'Teams are locked in this game', events: [] };
    if (p.traitor) return { ok: false, err: 'Nobody trusts a traitor (' + p.traitor + ' more turn' + (p.traitor > 1 ? 's' : '') + ')', events: [] };
    s.allyOffer = { from: p.id, to: to.id };
    ev.push({ e: 'ally', status: 'offer', from: p.id, to: to.id });
    return { ok: true, events: ev };
  }
  function allyReply(s, p, a, ev) {
    const o = s.allyOffer; if (!o || o.to !== p.id) return { ok: false, err: 'No alliance offer for you', events: [] };
    s.allyOffer = null;
    if (a.accept) {
      s.allies = (s.allies || []).concat([{ a: o.from, b: o.to, since: s.turn.round, until: s.turn.round + PACT_ROUNDS, renew: {} }]);
      addMood(s, o.from, o.to, 25); addMood(s, o.to, o.from, 25);
      ev.push({ e: 'ally', status: 'formed', from: o.from, to: o.to });
      pushLog(s, '🤝 ' + player(s, o.from).name + ' and ' + p.name + ' formed an alliance.');
      checkWin(s, ev);
    } else ev.push({ e: 'ally', status: 'declined', from: o.from, to: o.to });
    return { ok: true, events: ev };
  }
  // pacts run for 5 rounds; in the last 2, both sides can renew for another 5. If either doesn't, it lapses peacefully
  const PACT_ROUNDS = 5;
  function allyRenew(s, p, a, ev) {
    const x = (s.allies || []).find(x => (x.a === p.id && x.b === a.with) || (x.b === p.id && x.a === a.with));
    if (!x || x.team || !x.until) return { ok: false, err: 'Not allied', events: [] };
    if (x.ending) return { ok: false, err: 'This alliance is breaking up', events: [] };
    if (x.until - s.turn.round > 2) return { ok: false, err: 'You can renew in the last 2 rounds of the pact', events: [] };
    x.renew = x.renew || {}; if (x.renew[p.id]) return { ok: false, err: 'Already renewed — waiting for your ally', events: [] };
    x.renew[p.id] = s.turn.round;
    const o = player(s, a.with);
    if (x.renew[a.with]) {
      x.until += PACT_ROUNDS; x.renew = {};
      addMood(s, p.id, a.with, 10); addMood(s, a.with, p.id, 10);
      ev.push({ e: 'ally', status: 'renewed', from: p.id, to: a.with });
      pushLog(s, '🤝 ' + p.name + ' and ' + o.name + ' renewed their alliance until round ' + x.until + '.');
    } else ev.push({ e: 'ally', status: 'renewing', from: p.id, to: a.with });
    return { ok: true, events: ev };
  }
  function expirePacts(s, ev) {
    if (!(s.allies || []).length) return;
    const gone = s.allies.filter(x => !x.team && x.until && s.turn.round >= x.until && !x.ending);
    if (!gone.length) return;
    s.allies = s.allies.filter(x => !gone.includes(x));
    for (const x of gone) {
      ev.push({ e: 'ally', status: 'expired', from: x.a, to: x.b });
      pushLog(s, '🕊 The alliance between ' + player(s, x.a).name + ' and ' + player(s, x.b).name + ' ran out (not renewed).');
    }
  }
  function allyBreak(s, p, a, ev) {
    const x = (s.allies || []).find(x => (x.a === p.id && x.b === a.with) || (x.b === p.id && x.a === a.with));
    if (!x) return { ok: false, err: 'Not allied', events: [] };
    if (x.ending) return { ok: false, err: 'Already breaking up', events: [] };
    if (x.team) return { ok: false, err: 'Teammates cannot break their alliance', events: [] };
    x.ending = p.id;
    ev.push({ e: 'ally', status: 'breaking', from: p.id, to: a.with });
    pushLog(s, '🗡 ' + p.name + ' is breaking the alliance with ' + player(s, a.with).name + '. It ends at the start of their next turn.');
    return { ok: true, events: ev };
  }
  function declareWin(s, pid, reason, ev) {
    recordHistory(s);
    s.phase = 'over'; s.winner = { pid, reason };
    const p = player(s, pid);
    ev.push({ e: 'win', pid, reason });
    pushLog(s, '🏆 ' + (p ? p.name : '?') + ' ' + reason + '!');
  }
  function checkWin(s, ev) {
    if (s.phase !== 'play') return;
    const alive = s.players.filter(p => p.alive);
    if (alive.length === 1) return declareWin(s, alive[0].id, 'is the last commander standing', ev);
    // everyone left standing is allied with everyone else: they win together
    if (alive.length > 1 && alive.every(a => alive.every(b => a === b || isAlly(s, a.id, b.id)))) {
      declareWin(s, alive[0].id, s.settings.teams === 'on' ? 'and their team won the war' : 'and allies won the war together', ev);
      s.winner.pids = alive.map(p => p.id);
      return;
    }
    if (s.settings.mode === 'conquest' || s.settings.mode === 'worldwar') {
      const need = conquestTarget(s);
      if (s.settings.teams === 'on') {
        const byTeam = {}; for (const p of alive) byTeam[p.team] = (byTeam[p.team] || 0) + ownedLand(s, p.id).length;
        for (const tm in byTeam) if (byTeam[tm] >= need) { const mates = alive.filter(p => String(p.team) === tm); declareWin(s, mates[0].id, 'and their team conquered ' + need + ' hexes', ev); s.winner.pids = mates.map(p => p.id); return; }
      } else {
        for (const p of alive) if (ownedLand(s, p.id).length >= need) return declareWin(s, p.id, 'conquered ' + need + ' hexes', ev);
        // allies who are all allied with each other count their land together, and win together
        for (const p of alive) {
          const bloc = [p];
          for (const q of alive) if (q !== p && bloc.every(b => isAlly(s, b.id, q.id))) bloc.push(q);
          if (bloc.length < 2) continue;
          const land = bloc.reduce((n, b) => n + ownedLand(s, b.id).length, 0);
          if (land >= need) { declareWin(s, p.id, 'and their allies conquered ' + need + ' hexes together', ev); s.winner.pids = bloc.map(b => b.id); return; }
        }
      }
    }
  }
  function conquestTarget(s) { return Math.ceil(s.map.landCount * (s.settings.conquestPct || 60) / 100); }
  // rerolls cost a quarter of this turn's income (min $2), and each one costs that much more again
  function rerollCost(s) { return Math.max(2, Math.ceil((s.turn.income || 0) * 0.25)) * (1 + (s.turn.rerolls || 0)); }
  // bounty pays a fifth of your income per kill (min $2)
  function bountyValue(s, p) { return Math.max(2, Math.round(computeIncome(s, p.id).total * 0.2)); }
  function pushLog(s, text) { s.log.push(text); if (s.log.length > 40) s.log.shift(); }

  // ───────────────────────── tactics targeting ─────────────────────────
  function tacticTargets(s, pid, id, from) {
    const out = tacticTargetsRaw(s, pid, id, from), def = TACTICS[id];
    if (!def || ['none', 'ownHex', 'ownStack', 'spawn'].includes(def.target)) return out;
    const shielded = s.players.filter(q => q.shield && q.id !== pid).map(q => q.id);
    if (!(s.allies || []).length && !shielded.length) return out;
    const idx = buildIndex(s);
    // Aegis Protocol: nothing a tactic touches may belong to a shielded commander
    const touches = k => { const t = s.map.tiles[k]; return t && (shielded.includes(t.owner) || (idx[k] || []).some(u => shielded.includes(u.owner))); };
    const foot = k => def.target === 'tsar' ? tsarArea(s, k) : ['area', 'nuke'].includes(def.target) ? area(k, 1) : def.target === 'regime' ? area(k, 1) : [k];
    return out.filter(k => !isAlly(s, pid, s.map.tiles[k] && s.map.tiles[k].owner) && !(idx[k] || []).some(u => isAlly(s, pid, u.owner)) && (!shielded.length || (def.target === 'enemyHand' ? !shielded.includes(s.map.tiles[k].owner) : !foot(k).some(touches))));
  }
  // units a Spy Ring can steal: anything in the deck except the starting cards
  function stealableUnits(o) { const st = FACTIONS[o.faction] && FACTIONS[o.faction].starter; return o.arsenal.filter(id => id !== 'grunt' && id !== st && id !== 'ark'); }
  // the Tsar Bomba footprint: a hex, its ring, and one more hex east and west (9 hexes)
  function tsarArea(s, k) { const [q, r] = parse(k); return area(k, 1).concat([key(q + 2, r), key(q - 2, r)]).filter(a => s.map.tiles[a]); }
  function tacticTargetsRaw(s, pid, id, from) {
    const def = TACTICS[id]; if (!def) return [];
    const idx = buildIndex(s), out = [], tiles = s.map.tiles;
    switch (def.target) {
      case 'none': return [];
      case 'ownHex': for (const k in tiles) if (tiles[k].owner === pid && isLandTile(tiles[k])) out.push(k); return out;
      case 'ownStack': for (const k in idx) if (idx[k][0].owner === pid && !idx[k].some(u => u.stun)) out.push(k); return out;
      case 'spawn': return spawnPoints(s, pid).filter(k => stackFits(idx[k] || [], ['grunt']));
      case 'enemyUnits': for (const k in tiles) {
        const occ = idx[k] || [];
        if (!(occ.length ? occ[0].owner !== pid && !isAlly(s, pid, occ[0].owner) : isEnemyInfra(s, pid, k))) continue;   // troops, or undefended buildings
        if (nearOwned(s, pid, k, def.range) && !flakCovered(s, pid, k)) out.push(k);
      } return out;
      case 'precision': for (const k in tiles) {
        const occ = idx[k] || [];
        if (!(occ.length ? occ[0].owner !== pid && !isAlly(s, pid, occ[0].owner) && occ.some(u => UNITS[u.type].ability !== 'stealth') : isEnemyInfra(s, pid, k))) continue;
        if (nearOwned(s, pid, k, def.range)) out.push(k);
      } return out;
      case 'infra': for (const k in tiles) { const t = tiles[k]; if (t.owner && t.owner !== pid && !isAlly(s, pid, t.owner) && isLandTile(t) && nearOwned(s, pid, k, def.range) && !flakCovered(s, pid, k)) out.push(k); } return out;
      case 'buster': for (const k in tiles) {
        const t = tiles[k], o = t.owner || ((idx[k] || [])[0] || {}).owner; if (!o || o === pid || isAlly(s, pid, o) || !nearOwned(s, pid, k, def.range) || flakCovered(s, pid, k)) continue;
        if ((idx[k] || []).length || structsOf(t).some(x => ['bunker', 'fob', 'flak', 'mine', 'hq'].includes(x.type) && x.owner === o)) out.push(k);
      } return out;
      case 'heli':
        if (!from) { for (const k in idx) if (idx[k][0].owner === pid && idx[k].some(u => canAct(s, u) && !isSea(u.type))) out.push(k); return out; }
        {
          const ms = (idx[from] || []).filter(u => u.owner === pid && canAct(s, u) && !isSea(u.type));
          for (const k of area(from, def.range)) {
            const t = tiles[k]; if (!isLandTile(t) || k === from || t.contam) continue;
            if ((idx[k] || []).length) continue;
            if (getS(t, 'hq') || (!t.owner && GARRISONED.includes(t.poi)) || (t.owner && t.owner !== pid && getS(t, 'bunker') && getS(t, 'bunker').owner === t.owner)) continue;
            if (t.owner !== pid && flakCovered(s, pid, k)) continue;
            if (!stackFits([], ms)) continue;
            out.push(k);
          }
          return out;
        }
      case 'enemyHex': { for (const k in tiles) { const o = tiles[k].owner; if (o && o !== pid && isLandTile(tiles[k])) { const op = player(s, o); if (op && op.alive && !op.embargo) out.push(k); } } return out; }
      case 'orbital': for (const k in idx) if (idx[k][0].owner !== pid && !getS(tiles[k], 'hq') && nearOwned(s, pid, k, def.range) && idx[k].some(u => UNITS[u.type].ability !== 'stealth')) out.push(k); return out;
      case 'enemyStruct': for (const k in tiles) { const t = tiles[k]; if (structsOf(t).some(x => x.type !== 'hq' && x.owner !== pid) && nearOwned(s, pid, k, def.range)) out.push(k); } return out;
      case 'area': for (const k in tiles) if (nearOwned(s, pid, k, def.range) && !flakCovered(s, pid, k)) out.push(k); return out;
      case 'nuke':
        for (const k in tiles) {
          if (!nearOwned(s, pid, k, def.range) || flakCovered(s, pid, k)) continue;
          if (area(k, 1).some(a => getS(tiles[a], 'hq'))) continue;
          out.push(k);
        }
        return out;
      case 'mountain': for (const k in tiles) if (tiles[k].t === 'mountain' && nearOwned(s, pid, k, def.range)) out.push(k); return out;
      case 'enemyHand': { for (const k in tiles) { const o = tiles[k].owner; if (o && o !== pid && isLandTile(tiles[k])) { const op = player(s, o); if (op && op.alive && ((op.tacticCount ?? op.tactics.length) || stealableUnits(op).length)) out.push(k); } } return out; }   // players only see a rival's hand size
      case 'tsar': for (const k in tiles) if (nearOwned(s, pid, k, def.range) && !flakCovered(s, pid, k)) out.push(k); return out;
      case 'regime':
        for (const k in tiles) {
          const t = tiles[k], o = t.owner; if (!o || o === pid || !isLandTile(t) || getS(t, 'hq')) continue;
          const op = player(s, o); if (op && op.alive && nearOwned(s, pid, k, def.range)) out.push(k);
        }
        return out;
      case 'mutiny':
        for (const k in idx) {
          const occ = idx[k]; if (occ[0].owner === pid || occ.length > 3) continue;
          const t = tiles[k]; if (getS(t, 'hq')) continue;
          if (neighbors(k).some(n => tiles[n] && tiles[n].owner === pid)) out.push(k);
        }
        return out;
    }
    return out;
  }

  // ───────────────────────── actions ─────────────────────────
  function applyAction(s, pid, a, rng) {
    rng = rng || Math.random;
    s._razed = null;
    const r = applyActionInner(s, pid, a, rng);
    if (s._razed) { if (r.ok) for (const k of s._razed) r.events.push({ e: 'razed', pid, hex: k }); s._razed = null; }
    if (r.ok && !s._preview) trackStats(s, r.events);
    if (r.ok && s.phase === 'play') {
      drown(s, r.events);
      if (['move', 'assault', 'fire', 'tactic', 'deploy', 'build'].includes(a.a)) annex(s, pid, r.events);
      checkWin(s, r.events);
    }
    return r;
  }
  // encirclement: small land pockets fully surrounded by your territory flip to you
  function annex(s, pid, ev) {
    const tiles = s.map.tiles, idx = buildIndex(s), seen = new Set(), flipped = [];
    for (const k in tiles) {
      const t = tiles[k];
      if (seen.has(k) || !isLandTile(t) || t.owner === pid) continue;
      const comp = [k]; seen.add(k);
      let enclosed = true;
      for (let i = 0; i < comp.length; i++) for (const n of neighbors(comp[i])) {
        const nt = tiles[n];
        if (!nt) { enclosed = false; continue; }
        if (nt.t === 'mountain') continue;
        if (isWater(nt)) { enclosed = false; continue; }
        if (nt.owner === pid) continue;
        if (!seen.has(n)) { seen.add(n); comp.push(n); }
      }
      if (!enclosed || comp.length > 10) continue;
      if (comp.some(c => (idx[c] || []).some(u => u.owner !== pid))) continue;
      if (comp.some(c => isAlly(s, pid, tiles[c].owner))) continue;
      if (comp.some(c => structsOf(tiles[c]).some(x => ['hq', 'fob', 'port'].includes(x.type) || (x.type === 'bunker' && x.owner && x.owner === tiles[c].owner)) || (!tiles[c].owner && GARRISONED.includes(tiles[c].poi)))) continue;
      for (const c of comp) if (captureTile(s, c, pid)) flipped.push(c);
    }
    // sea encirclement: a pocket of 12 or fewer water hexes walled in by your coast and your own sea flips to you
    for (const k in tiles) {
      const t = tiles[k];
      if (seen.has(k) || !isWater(t) || t.owner === pid) continue;
      const comp = [k]; seen.add(k);
      let enclosed = true;
      for (let i = 0; i < comp.length && enclosed; i++) for (const n of neighbors(comp[i])) {
        const nt = tiles[n];
        if (!nt) { enclosed = false; break; }
        if (nt.t === 'mountain' || nt.owner === pid) continue;
        if (!isWater(nt)) { enclosed = false; break; }
        if (!seen.has(n)) { seen.add(n); comp.push(n); }
      }
      if (!enclosed || comp.length > 12) continue;
      if (comp.some(c => (idx[c] || []).some(u => u.owner !== pid))) continue;
      for (const c of comp) if (tiles[c].owner !== pid) { tiles[c].owner = pid; flipped.push(c); }
    }
    if (flipped.length) {
      ev.push({ e: 'annex', pid, hexes: flipped });
      const p = player(s, pid);
      pushLog(s, '⭕ ' + (p ? p.name : '?') + ' encircled and annexed ' + flipped.length + ' hex' + (flipped.length > 1 ? 'es' : '') + '.');
    }
  }
  // land units left on open water without a transport are lost at sea
  function drown(s, ev) {
    const idx = buildIndex(s), dead = [];
    for (const k in idx) {
      if (!isWater(s.map.tiles[k])) continue;
      const riders = idx[k].filter(u => !isSea(u.type) && UNITS[u.type].cls !== 'air' && UNITS[u.type].ability !== 'hover');
      // aircraft parked at sea with no carrier left under them ditch too
      const fliers = idx[k].filter(u => UNITS[u.type].cls === 'air');
      riders.slice(cargoCap(idx[k])).concat(fliers.slice(airCap(idx[k]))).forEach(u => { dead.push(u.id); delete s.units[u.id]; const o = player(s, u.owner); if (o) o.stats.lost++; });
    }
    if (dead.length) { ev.push({ e: 'drown', units: dead }); pushLog(s, '🌊 ' + dead.length + ' unit' + (dead.length > 1 ? 's' : '') + ' lost at sea.'); }
  }

  function validGroup(s, pid, g, to, idx) {
    const units = (g.units || []).map(id => s.units[id]);
    if (!units.length || units.some(u => !u || u.owner !== pid || u.hex !== g.from)) return { err: 'Invalid units' };
    if (units.some(u => !canAct(s, u))) return { err: 'Some units cannot act this turn' };
    const reach = reachable(s, pid, g.units, g.from, idx);
    const dest = reach[to];
    if (!dest || dest.kind === 'start' || dest.kind === 'pass') return { err: 'Cannot reach that hex' };
    return { units, reach, dest, path: pathTo(reach, to) };
  }
  // supply caches hold a tactic: common 40%, uncommon 35%, rare 18%, epic 6%, legendary 1%
  function cacheCard(rng) {
    const odds = [['common', 40], ['uncommon', 35], ['rare', 18], ['epic', 6], ['legendary', 1]];
    let x = rng() * 100, rar = 'common'; for (const [r, w] of odds) { if (x < w) { rar = r; break; } x -= w; }
    let pool = Object.keys(TACTICS).filter(id => TACTICS[id].rarity === rar && !id.startsWith('drop_'));
    if (!pool.length) pool = Object.keys(TACTICS).filter(id => TACTICS[id].rarity === 'rare' && !id.startsWith('drop_'));
    return pool[Math.floor(rng() * pool.length)];
  }
  // ruins and caches are looted by the first unit to pass through
  function lootPath(s, pid, path, ev, rng) {
    const p = player(s, pid); if (!p || s._preview) return;
    for (const k of path.slice(1)) {
      const t = s.map.tiles[k];
      if (!t || !(t.poi === 'ruins' || t.poi === 'cache')) continue;
      if (t.poi === 'ruins') { const amt = 4 + Math.floor(rng() * 7); p.cash += amt; ev.push({ e: 'loot', pid, hex: k, poi: 'ruins', amount: amt }); pushLog(s, '🏺 ' + p.name + ' looted ruins: +$' + amt + '.'); }
      else { const id = cacheCard(rng); p.tactics.push({ uid: s.nextId++, id }); ev.push({ e: 'loot', pid, hex: k, poi: 'cache', card: id }); pushLog(s, '📦 ' + p.name + ' found a supply cache.'); }
      delete t.poi;
    }
  }
  function pathCaptures(s, pid, path, units, idx) {
    const navy = units.every(u => isSea(u.type)), out = [];
    // aircraft can't hold ground they fly over: only the hex they land on is taken
    if (units.every(u => UNITS[u.type].cls === 'air')) return out;
    for (const k of path.slice(1, -1)) {
      const t = s.map.tiles[k];
      if (t.owner === pid || (idx[k] || []).length) continue;
      { const bk = getS(t, 'bunker'); if (bk && bk.owner === t.owner && t.owner) continue; }   // garrisoned bunkers aren't seized in passing
      if (navy ? isWater(t) : isLandTile(t)) { if (captureTile(s, k, pid)) out.push(k); }
    }
    return out;
  }

  function applyActionInner(s, pid, a, rng) {
    const ev = [];
    const fail = err => ({ ok: false, err, events: [] });
    const p = player(s, pid);
    if (!p || !p.alive) return fail('You are not in this game');
    if (s.phase === 'spawn') return a.a === 'spawnPick' ? spawnPick(s, p, a, ev) : fail('Choose your HQ location first');
    if (s.phase === 'draft') return a.a === 'draftPick' ? draftPick(s, p, a, ev, rng) : fail('Finish the opening draft first');
    if (s.phase !== 'play') return fail('Game is not running');
    if (a.a === 'tradeReply') return tradeReply(s, p, a, ev);
    if (a.a === 'allyReply') return allyReply(s, p, a, ev);
    if (current(s).id !== pid) return fail('Not your turn');
    const tiles = s.map.tiles;
    const stage = s.turn.stage;
    if (a.a === 'trade') return tradeOffer(s, p, a, ev);
    if (a.a === 'allyOffer') return allyOffer(s, p, a, ev);
    if (a.a === 'allyBreak') return allyBreak(s, p, a, ev);
    if (a.a === 'allyRenew') return allyRenew(s, p, a, ev);
    if (a.a === 'tradeCancel') { if (s.trade && s.trade.from === pid) { s.trade = null; ev.push({ e: 'trade', status: 'cancelled', from: pid }); } return { ok: true, events: ev }; }

    if (a.a === 'choose') {
      if (stage !== 'choose') return fail('Already chose');
      if (s.settings.timer) s.turn.deadline = Date.now() + s.settings.timer * 1000;
      if (a.pick === 'income') {
        p.cash += s.turn.income;
        ev.push({ e: 'income', pid, amount: s.turn.income, hq: p.hq });
        pushLog(s, p.name + ' collected $' + s.turn.income + '.');
      } else {
        const id = s.turn.offer[a.idx]; if (!id) return fail('No such card');
        const err = grantCard(s, p, id, a.replace, ev); if (err) return fail(err);
        const half = Math.floor(s.turn.income / 2);
        p.cash += half;
        if (half) ev.push({ e: 'income', pid, amount: half, hq: p.hq });
        const d = cardDef(id);
        pushLog(s, p.name + ' drafted ' + (d.kind === 'unit' || RARITY_ORDER.indexOf(d.rarity) >= 3 ? d.name : 'a ' + RARITY[d.rarity].name + ' tactic') + (RARITY_ORDER.indexOf(d.rarity) >= 3 ? ' ★' : '') + '.');
      }
      s.turn.offer = []; s.turn.stage = 'act';
      return { ok: true, events: ev };
    }
    if (a.a === 'reroll') {
      if (stage !== 'choose') return fail('Too late to reroll');
      const cost = rerollCost(s);
      if (p.cash < cost) return fail('Need $' + cost);
      p.cash -= cost; s.turn.rerolls++;
      s.turn.offer = drawCards(s, p, 3, TURN_ODDS, rng);
      ev.push({ e: 'reroll', pid, cost });
      return { ok: true, events: ev };
    }
    if (a.a === 'pick' || a.a === 'scrap') {
      if (stage !== 'crate' || !s.turn.crate) return fail('No crate open');
      const crate = s.turn.crate;
      if (a.a === 'pick') {
        const id = crate.cards[a.idx]; if (!id) return fail('No such card');
        const err = grantCard(s, p, id, a.replace, ev); if (err) return fail(err);
        const d = cardDef(id);
        pushLog(s, p.name + ' pulled ' + (d.kind === 'unit' || RARITY_ORDER.indexOf(d.rarity) >= 3 ? d.name : 'a ' + RARITY[d.rarity].name + ' tactic') + ' from a ' + CRATES[crate.tier].name + (RARITY_ORDER.indexOf(d.rarity) >= 3 ? ' ★' : '') + '.');
      } else {
        p.cash += SCRAP_VALUE;
        ev.push({ e: 'scrap', pid, amount: SCRAP_VALUE, hq: p.hq });
      }
      s.turn.crate = null; s.turn.stage = 'act';
      return { ok: true, events: ev };
    }
    if (a.a === 'end') {
      if (s.trade) { ev.push({ e: 'trade', status: 'expired', ...s.trade }); s.trade = null; }
      if (stage === 'choose') { p.cash += s.turn.income; ev.push({ e: 'income', pid, amount: s.turn.income, hq: p.hq }); }
      if (stage === 'crate') { p.cash += SCRAP_VALUE; s.turn.crate = null; }
      ev.push({ e: 'endturn', pid });
      endTurn(s, ev, rng);
      return { ok: true, events: ev };
    }
    if (stage !== 'act') return fail(stage === 'crate' ? 'Open your crate first' : 'Pick from your resupply first');
    if (a.a === 'deploy') {
      if (!p.arsenal.includes(a.unit)) return fail('Unit not in your deck');
      if (!tiles[a.hex] || !deployHexes(s, pid, a.unit).includes(a.hex)) return fail(isSea(a.unit) ? 'Ships launch into the sea next to your Port' : 'Deploy at your HQ or a FOB (with room)');
      const cost = unitCost(p, a.unit);
      if (p.cash < cost) return fail('Need $' + cost);
      p.cash -= cost;
      // troops mustered next to a besieged HQ can strike back straight away
      const muster = !isSea(a.unit) && musterHexes(s, pid).includes(a.hex);
      const u = addUnit(s, pid, a.unit, a.hex, !muster);
      // a ship launched into the sea claims the water it lands on, just like sailing through it
      const claimed = isSea(a.unit) && isWater(tiles[a.hex]) && tiles[a.hex].owner !== pid;
      if (claimed) { tiles[a.hex].owner = pid; p.stats.captured++; }
      ev.push({ e: 'deploy', pid, unit: { ...u }, hex: a.hex, claimed, muster });
      return { ok: true, events: ev };
    }
    if (a.a === 'build') {
      if (!STRUCTS[a.struct]) return fail('Unknown structure');
      const err = buildError(s, pid, a.struct, a.hex); if (err) return fail(err);
      const cost = buildCost(s, p, a.struct, a.hex);
      if (p.cash < cost) return fail('Need $' + cost);
      p.cash -= cost;
      p.built = p.built || {}; p.built[a.struct] = (p.built[a.struct] || 0) + 1;
      const t = tiles[a.hex];
      const ex = getS(t, a.struct);
      if (ex) {
        ex.lvl = slvlOf(ex) + 1;
        ev.push({ e: 'build', pid, struct: a.struct, hex: a.hex, lvl: ex.lvl });
        pushLog(s, p.name + ' upgraded a ' + STRUCTS[a.struct].name + ' to ' + '★'.repeat(ex.lvl) + '.');
        return { ok: true, events: ev };
      }
      addStruct(t, a.struct === 'fob' ? { type: 'fob', owner: pid, lvl: 1, lock: 1 } : { type: a.struct, owner: pid, lvl: 1 });
      if (a.struct === 'bridge') { t.bridge = true; t.owner = pid; }
      ev.push({ e: 'build', pid, struct: a.struct, hex: a.hex, lvl: 1, lock: a.struct === 'fob' ? 1 : 0 });
      return { ok: true, events: ev };
    }
    if (a.a === 'move' || a.a === 'assault') {
      const idx = buildIndex(s);
      const groups = a.a === 'move' ? [{ from: a.from, units: a.units }] : (a.groups || []);
      if (!groups.length || groups.length > 6) return fail('Pick some units');
      const seenU = new Set();
      const checked = [];
      // fog of war: the client planned on what it could see. If hidden rivers, troops or borders get in the way,
      // follow the intended path as far as it really goes: stop short, or run into the hidden enemy (an ambush)
      if (a.a === 'move' && s.settings.fog === 'on' && Array.isArray(a.path) && a.path.length > 1 && a.path.length < 40 && validGroup(s, pid, groups[0], a.to, idx).err) {
        const reach = reachable(s, pid, a.units || [], a.from, idx);
        let stop = null, prev = a.from;
        for (const k of a.path.slice(1)) {
          if (typeof k !== 'string' || dist(prev, k) !== 1) break;
          const r = reach[k]; if (!r) break;
          if (r.kind === 'attack') { stop = k; break; }
          if (r.kind !== 'pass' && r.kind !== 'start') stop = k;
          prev = k;
        }
        if (!stop) return fail('Something hidden in the fog blocks the way');
        const ambush = reach[stop].kind === 'attack';
        a = { ...a, to: stop };
        ev.push({ e: 'fogstop', pid, hex: stop, ambush });
        if (ambush) pushLog(s, '🌫 ' + p.name + ' ran into hidden enemies in the fog!');
      }
      for (const g of groups) {
        if ((g.units || []).some(id => seenU.has(id))) return fail('Duplicate units');
        (g.units || []).forEach(id => seenU.add(id));
        const v = validGroup(s, pid, g, a.to, idx); if (v.err) return fail(v.err);
        checked.push({ ...v, from: g.from });
      }
      const attack = checked.some(c => c.dest.kind === 'attack');
      if (groups.length > 1 && !checked.every(c => c.dest.kind === 'attack')) return fail('Multi-hex orders are for attacks');
      if (attack) {
        const ag = [];
        for (const c of checked) {
          const fleet = movers(c.units);
          const caps = pathCaptures(s, pid, c.path, fleet, idx);
          const stageK = c.path[c.path.length - 2];
          fleet.forEach(u => { u.moved = true; u.hex = stageK; });
          ev.push({ e: 'move', pid, units: fleet.map(u => u.id), path: c.path.slice(0, -1), captures: caps });
          lootPath(s, pid, c.path.slice(0, -1), ev, rng);
          ag.push({ units: fleet, stage: stageK, from: c.from });
        }
        resolveAssault(s, pid, ag, a.to, rng, ev);
      } else {
        const c = checked[0];
        const fleet = movers(c.units);
        let cargo = [];
        if (fleet.some(u => isSea(u.type))) cargo = ridersOf((idx[c.from] || []).filter(u => u.owner === pid), fleet);
        const caps = pathCaptures(s, pid, c.path, fleet, idx);
        fleet.forEach(u => { u.moved = true; u.hex = a.to; });
        cargo.forEach(u => { u.hex = a.to; });
        const t = tiles[a.to];
        const navy = fleet.every(u => isSea(u.type));
        if (c.dest.kind !== 'board' && (navy ? isWater(t) : isLandTile(t)) && captureTile(s, a.to, pid)) caps.push(a.to);
        ev.push({ e: 'move', pid, units: fleet.concat(cargo).map(u => u.id), path: c.path, captures: caps });
        lootPath(s, pid, c.path, ev, rng);
      }
      return { ok: true, events: ev };
    }
    if (a.a === 'fire') {
      const units = (a.units || []).map(id => s.units[id]);
      if (!units.length || units.some(u => !u || u.owner !== pid || u.hex !== a.from || !canAct(s, u))) return fail('Invalid units');
      if (!rangedTargets(s, pid, a.units, a.from).includes(a.to)) return fail('Target out of range or blocked');
      if (!Object.values(s.units).some(u => u.hex === a.to)) {
        // shelling an undefended building: each salvo knocks a level off it
        const infra = damageInfra(s, a.to, 1);
        units.forEach(u => u.moved = true);
        ev.push({ e: 'shell', pid, from: a.from, to: a.to, infra, structs: structsOf(tiles[a.to]), units: units.map(u => u.type) });
        pushLog(s, '💥 ' + p.name + ' shelled ' + (player(s, tiles[a.to].owner) || {}).name + "'s infrastructure.");
        return { ok: true, events: ev };
      }
      resolveFire(s, pid, units, a.from, a.to, rng, ev);
      return { ok: true, events: ev };
    }
    if (a.a === 'tactic') {
      const ci = p.tactics.findIndex(c => c.uid === a.uid);
      if (ci < 0) return fail('Card not in hand');
      const id = p.tactics[ci].id, def = TACTICS[id];
      if (p.cash < def.cost) return fail('Need $' + def.cost);
      const r = useTactic(s, p, id, a, rng, ev);
      if (r) return fail(r);
      p.cash -= def.cost;
      const still = p.tactics.findIndex(c => c.uid === a.uid);
      if (still >= 0) p.tactics.splice(still, 1);
      return { ok: true, events: ev };
    }
    return fail('Unknown action');
  }

  function useTactic(s, p, id, a, rng, ev) {
    const def = TACTICS[id], pid = p.id, tiles = s.map.tiles;
    if (def.target !== 'none' && def.target !== 'heli' && !tacticTargets(s, pid, id).includes(a.target)) return 'Invalid target';
    const base = { e: 'tactic', pid, id, target: a.target };
    const kill = (u) => { const o = player(s, u.owner); if (o) o.stats.lost++; if (u.owner !== pid) { p.stats.kills++; if (p.bounty) p.cash += p.bounty === true ? 2 : p.bounty; } delete s.units[u.id]; };
    switch (id) {
      case 'bonds': { const n = Math.floor(ownedLand(s, pid).length / 2); p.cash += n; ev.push({ ...base, amount: n }); break; }
      case 'blitz': p.blitz = true; ev.push(base); break;
      case 'rally': p.rally = (p.rally || 0) + 2; ev.push(base); break;
      case 'bounty': p.bounty = bountyValue(s, p); ev.push({ ...base, amount: p.bounty }); break;
      case 'fortify': {
        const t = tiles[a.target], bk = getS(t, 'bunker'), hq = getS(t, 'hq');
        // on the HQ hex the card fortifies the HQ itself (nothing else is built there)
        if (hq && hq.owner === pid) { if (slvlOf(hq) >= MAX_SLVL) return 'Your HQ is already fully fortified'; hq.lvl = slvlOf(hq) + 1; ev.push({ ...base, lvl: hq.lvl }); break; }
        if (bk) { if (slvlOf(bk) >= MAX_SLVL) return 'That Bunker is already ★★★'; bk.lvl = slvlOf(bk) + 1; }
        else { if (structsOf(t).length >= MAX_STRUCTS || getS(t, 'bridge') || !isLandTile(t)) return 'No room for a Bunker there'; addStruct(t, { type: 'bunker', owner: pid, lvl: 1 }); }
        ev.push({ ...base, lvl: slvlOf(getS(t, 'bunker')) }); break;
      }
      case 'embargo': { const o = player(s, tiles[a.target].owner); o.embargo = 2; if (s.trade && (s.trade.from === o.id || s.trade.to === o.id)) s.trade = null; ev.push({ ...base, victim: o.id }); pushLog(s, '⛔ ' + p.name + ' placed ' + o.name + ' under embargo.'); break; }
      case 'orbital': {
        const kills = Object.values(s.units).filter(u => u.hex === a.target && u.owner !== pid && UNITS[u.type].ability !== 'stealth');
        kills.forEach(kill);
        ev.push({ ...base, kills: kills.map(u => u.id) }); pushLog(s, '🛰 ' + p.name + ' called an orbital strike: ' + kills.length + ' destroyed.'); break;
      }
      case 'drop_rare': case 'drop_epic': case 'drop_legendary':
        ev.push(base); p.tactics.splice(p.tactics.findIndex(c => c.uid === a.uid), 1);
        openCrate(s, p, rollTier(id, rng), rng, ev, id);
        pushLog(s, p.name + ' called in a ' + RARITY[def.rarity].name + ' Supply Drop.');
        break;
      case 'smoke': tiles[a.target].smoke = pid; ev.push(base); break;
      case 'march': {
        const us = Object.values(s.units).filter(u => u.hex === a.target && u.owner === pid);
        us.forEach(u => { u.moved = false; u.fresh = false; u.mvBonus = 2; });
        ev.push(base); break;
      }
      case 'conscript': {
        const here = buildIndex(s)[a.target] || [], made = [];
        for (let i = 0; i < 2 && stackFits(here, Array(i + 1).fill('grunt')); i++) made.push({ ...addUnit(s, pid, 'grunt', a.target, true) });
        ev.push({ ...base, units: made }); break;
      }
      case 'airstrike': {
        if (!Object.values(s.units).some(u => u.hex === a.target)) {
          const roll = rollDie(rng), infra = damageInfra(s, a.target, roll >= 4 ? 2 : 1);
          ev.push({ ...base, roll, kills: [], infra, structs: structsOf(tiles[a.target]) });
          pushLog(s, '✈ ' + p.name + ' bombed ' + (player(s, tiles[a.target].owner) || {}).name + "'s infrastructure."); break;
        }
        const occ = Object.values(s.units).filter(u => u.hex === a.target && UNITS[u.type].ability !== 'stealth');
        const roll = rollDie(rng), n = Math.min(occ.length, roll <= 2 ? 1 : roll <= 5 ? 2 : 3);
        const pool = occ.slice(), kills = [];
        for (let i = 0; i < n; i++) kills.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
        kills.forEach(kill);
        ev.push({ ...base, roll, kills: kills.map(u => u.id) });
        pushLog(s, '✈ ' + p.name + ' called an airstrike: ' + kills.length + ' destroyed.');
        break;
      }
      case 'gunrun': {
        if (!Object.values(s.units).some(u => u.hex === a.target)) {
          const infra = damageInfra(s, a.target, 1);
          ev.push({ ...base, roll: 6, kills: [], infra, structs: structsOf(tiles[a.target]) });
          pushLog(s, '✈ ' + p.name + ' strafed ' + (player(s, tiles[a.target].owner) || {}).name + "'s infrastructure."); break;
        }
        const occ = Object.values(s.units).filter(u => u.hex === a.target && u.owner !== pid && UNITS[u.type].ability !== 'stealth');
        const roll = rollDie(rng), kills = roll >= 3 && occ.length ? [occ[Math.floor(rng() * occ.length)]] : [];
        kills.forEach(kill);
        ev.push({ ...base, roll, kills: kills.map(u => u.id) });
        pushLog(s, '✈ ' + p.name + ' called a gun run: ' + (kills.length ? '1 destroyed.' : 'missed.'));
        break;
      }
      case 'precision': {
        if (!Object.values(s.units).some(u => u.hex === a.target)) {
          const infra = damageInfra(s, a.target, 1, true);
          ev.push({ ...base, roll: 6, kills: [], infra, structs: structsOf(tiles[a.target]) });
          pushLog(s, '🎯 ' + p.name + ' destroyed a ' + (infra[0] ? STRUCTS[infra[0].type].name : 'building') + '.'); break;
        }
        const occ = Object.values(s.units).filter(u => u.hex === a.target && u.owner !== pid && UNITS[u.type].ability !== 'stealth').sort((x, y) => UNITS[y.type].cost - UNITS[x.type].cost);
        const roll = rollDie(rng), kills = occ.slice(0, roll >= 5 ? 2 : 1);
        kills.forEach(kill);
        ev.push({ ...base, roll, kills: kills.map(u => u.id) });
        pushLog(s, '🎯 ' + p.name + ' called a precision strike: ' + kills.length + ' destroyed.');
        break;
      }
      case 'strategic': {
        // carpet the area: buildings lose a level, and the enemy land there pays nothing for 2 turns
        const hexes = [];
        for (const k of area(a.target, 1)) {
          const t = tiles[k]; if (!t || !t.owner || t.owner === pid || isAlly(s, pid, t.owner) || !isLandTile(t)) continue;
          const infra = damageInfra(s, k, 1);
          t.ruin = 2;
          hexes.push({ k, infra, structs: structsOf(t) });
        }
        ev.push({ ...base, hexes });
        pushLog(s, '💣 ' + p.name + ' sent the bombers over ' + (player(s, tiles[a.target].owner) || {}).name + ': ' + hexes.length + ' hexes bombed out.');
        break;
      }
      case 'buster': {
        const t = tiles[a.target]; let hit = 0;
        for (const st of structsOf(t).slice()) {
          if (!['bunker', 'fob', 'flak', 'mine', 'hq'].includes(st.type) || st.owner === pid) continue;
          const L = slvlOf(st);
          if (st.type === 'hq') { if (L > 1) { st.lvl = Math.max(1, L - 2); hit++; } continue; }
          if (L > 2) st.lvl = L - 2; else removeStruct(t, st);
          hit++;
        }
        const occ = Object.values(s.units).filter(u => u.hex === a.target && u.owner !== pid && UNITS[u.type].ability !== 'stealth');
        const kills = []; const pool = occ.slice(); for (let i = 0; i < 2 && pool.length; i++) kills.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
        kills.forEach(kill);
        ev.push({ ...base, kills: kills.map(u => u.id), hit, structs: JSON.parse(JSON.stringify(structsOf(t))) });
        pushLog(s, '💣 ' + p.name + ' dropped a bunker buster: ' + hit + ' fortification' + (hit === 1 ? '' : 's') + ' wrecked, ' + kills.length + ' destroyed.');
        break;
      }
      case 'carpet': {
        const ar = area(a.target, 1), kills = [];
        for (const u of Object.values(s.units)) if (ar.includes(u.hex) && u.owner !== pid && UNITS[u.type].ability !== 'stealth' && rng() < 0.5) kills.push(u);
        kills.forEach(kill);
        ev.push({ ...base, area: ar, kills: kills.map(u => u.id) });
        pushLog(s, '💣 ' + p.name + ' carpet-bombed: ' + kills.length + ' destroyed.');
        break;
      }
      case 'heli': {
        if (!a.from) return 'Pick a stack';
        if (!tacticTargets(s, pid, 'heli', a.from).includes(a.target)) return 'Invalid landing zone';
        const us = Object.values(s.units).filter(u => u.hex === a.from && u.owner === pid && canAct(s, u) && !isSea(u.type));
        if (!us.length) return 'No units ready';
        us.forEach(u => { u.hex = a.target; u.moved = true; });
        const cap = captureTile(s, a.target, pid);
        ev.push({ ...base, from: a.from, units: us.map(u => u.id), captured: cap });
        pushLog(s, '🚁 ' + p.name + ' heli-dropped ' + us.length + ' units.');
        break;
      }
      case 'sabotage': {
        const t = tiles[a.target];
        const victimS = structsOf(t).filter(x => x.type !== 'hq' && x.owner !== pid).sort((x, y) => STRUCT_PRIORITY.indexOf(x.type) - STRUCT_PRIORITY.indexOf(y.type))[0];
        const st = victimS.type;
        if (slvlOf(victimS) > 1) { victimS.lvl--; ev.push({ ...base, struct: st, lvl: victimS.lvl }); pushLog(s, '🧨 ' + p.name + ' damaged a ' + STRUCTS[st].name + '.'); break; }
        removeStruct(t, victimS);
        if (st === 'bridge') { t.bridge = false; t.owner = null; }
        ev.push({ ...base, struct: st }); pushLog(s, '🧨 ' + p.name + ' sabotaged a ' + STRUCTS[st].name + '.'); break;
      }
      case 'emp': {
        const hit = [];
        for (const k of area(a.target, 1)) for (const u of Object.values(s.units)) if (u.hex === k && u.owner !== pid) { u.stun = 1; hit.push(u.id); }
        ev.push({ ...base, units: hit }); pushLog(s, '⚡ ' + p.name + ' fired an EMP: ' + hit.length + ' units frozen.'); break;
      }
      case 'nuke': {
        const ar = area(a.target, 1).filter(k => tiles[k]), dead = [];
        for (const u of Object.values(s.units)) if (ar.includes(u.hex)) { dead.push(u.id); kill(u); }
        for (const k of ar) { const t = tiles[k]; t.owner = null; t.structs = []; t.struct = null; t.smoke = null; if (t.bridge) t.bridge = false; if (isLandTile(t)) t.contam = 4; }
        ev.push({ ...base, area: ar, units: dead }); pushLog(s, '☢ ' + p.name + ' launched a TACTICAL NUKE.'); break;
      }
      case 'quarry': {
        // two mountains come down: the target, plus the neighbouring mountain that best extends the pass (away from your land)
        tiles[a.target].t = 'hills';
        const mine = k => nearOwned(s, pid, k, 1);
        const next = neighbors(a.target).filter(n => tiles[n] && tiles[n].t === 'mountain').sort((x, y) => (mine(x) ? 1 : 0) - (mine(y) ? 1 : 0) || neighbors(y).filter(m => tiles[m] && tiles[m].t === 'mountain').length - neighbors(x).filter(m => tiles[m] && tiles[m].t === 'mountain').length)[0];
        if (next) tiles[next].t = 'hills';
        ev.push({ ...base, also: next || null }); pushLog(s, '⛏ ' + p.name + ' blasted a pass through the mountains.'); break;
      }
      case 'spy': {
        // steal one random card the rival has earned: a tactic from their hand, or a unit from their deck.
        // Starting cards (Grunts, their faction unit, an Ark) can't be taken, and a unit only comes if your deck has room
        const o = player(s, tiles[a.target].owner);
        const units = o ? stealableUnits(o).filter(id => p.arsenal.includes(id) || p.arsenal.length < DECK_MAX) : [];
        const pool = o ? o.tactics.map(c => ({ c })).concat(units.map(id => ({ id }))) : [];
        if (!pool.length) return 'They have no cards you can steal';
        const pick = pool[Math.floor(rng() * pool.length)];
        let card;
        if (pick.c) { o.tactics.splice(o.tactics.indexOf(pick.c), 1); p.tactics.push(pick.c); card = pick.c.id; }
        else {
          card = pick.id; o.arsenal = o.arsenal.filter(x => x !== card); delete o.levels[card];
          if (p.arsenal.includes(card)) p.levels[card] = Math.min(MAX_LEVEL, (p.levels[card] || 0) + 1); else p.arsenal.push(card);
        }
        ev.push({ ...base, from: o.id, card, unit: !pick.c }); pushLog(s, '🕵 ' + p.name + ' stole a card from ' + o.name + '.'); break;
      }
      case 'tsar': {
        const ar = tsarArea(s, a.target), dead = [];
        for (const u of Object.values(s.units)) if (ar.includes(u.hex)) { dead.push(u.id); kill(u); }
        for (const k of ar) {
          const t = tiles[k], hq = getS(t, 'hq');
          if (hq) { hq.lvl = 1; t.structs = [hq]; t.struct = hq; continue; }   // HQs are bunkered deep enough to survive
          t.owner = null; t.structs = []; t.struct = null; t.smoke = null; if (t.bridge) t.bridge = false; if (isLandTile(t)) t.contam = 5;
        }
        ev.push({ ...base, area: ar, units: dead }); pushLog(s, '☢ ' + p.name + ' detonated the TSAR BOMBA.'); break;
      }
      case 'regime': {
        const o = tiles[a.target].owner, flipped = [], turned = [];
        for (const k of area(a.target, 1)) {
          const t = tiles[k]; if (!t || t.owner !== o || getS(t, 'hq')) continue;
          for (const u of Object.values(s.units)) if (u.hex === k && u.owner === o) { u.owner = pid; u.moved = true; u.fresh = false; turned.push(u.id); }
          if (captureTile(s, k, pid)) flipped.push(k);
        }
        ev.push({ ...base, victim: o, hexes: flipped, units: turned });
        pushLog(s, '🏛 ' + p.name + ' staged a regime change: ' + flipped.length + ' hexes and ' + turned.length + ' units switched sides.');
        addMood(s, o, pid, -40); break;
      }
      case 'aegis': p.shield = true; ev.push(base); pushLog(s, '🛡 ' + p.name + ' raised the Aegis Protocol.'); break;
      case 'mutiny': {
        const us = Object.values(s.units).filter(u => u.hex === a.target);
        us.forEach(u => { u.owner = pid; u.moved = true; u.fresh = false; });
        tiles[a.target].owner = null; captureTile(s, a.target, pid);
        ev.push({ ...base, units: us.map(u => u.id) }); pushLog(s, '🏴 ' + p.name + ' incited a mutiny: ' + us.length + ' units defected.'); break;
      }
      default: return 'Unknown tactic';
    }
    return null;
  }

  // ───────────────────────── trading ─────────────────────────
  function tradeOffer(s, p, a, ev) {
    const fail = err => ({ ok: false, err, events: [] });
    if (s.trade) return fail('You already have an offer on the table');
    const to = player(s, a.to);
    if (!to || !to.alive || to.id === p.id) return fail('Pick another living commander');
    if (p.embargo || to.embargo) return fail((p.embargo ? 'You are' : to.name + ' is') + ' under embargo: no trading');
    const give = { cash: Math.max(0, a.give && a.give.cash | 0), cards: (a.give && a.give.cards || []).filter(uid => p.tactics.some(c => c.uid === uid)) };
    const get = { cash: Math.max(0, a.get && a.get.cash | 0) };
    if (!give.cash && !give.cards.length && !get.cash) return fail('Empty offer');
    if (give.cash > p.cash) return fail('You only have $' + p.cash);
    s.trade = { id: s.nextId++, from: p.id, to: to.id, give, get, cardIds: give.cards.map(uid => p.tactics.find(c => c.uid === uid).id) };
    ev.push({ e: 'trade', status: 'offered', ...s.trade });
    pushLog(s, '🤝 ' + p.name + ' offered ' + to.name + ' a trade.');
    return { ok: true, events: ev };
  }
  function tradeReply(s, p, a, ev) {
    const fail = err => ({ ok: false, err, events: [] });
    const t = s.trade;
    if (!t || t.to !== p.id) return fail('No offer for you');
    const from = player(s, t.from);
    s.trade = null;
    if (!a.accept) { ev.push({ e: 'trade', status: 'declined', ...t }); pushLog(s, '✋ ' + p.name + ' declined.'); return { ok: true, events: ev }; }
    if (from.cash < t.give.cash || p.cash < t.get.cash || t.give.cards.some(uid => !from.tactics.some(c => c.uid === uid))) { ev.push({ e: 'trade', status: 'failed', ...t }); return { ok: true, events: ev }; }
    from.cash -= t.give.cash; p.cash += t.give.cash;
    p.cash -= t.get.cash; from.cash += t.get.cash;
    for (const uid of t.give.cards) { const i = from.tactics.findIndex(c => c.uid === uid); p.tactics.push(from.tactics.splice(i, 1)[0]); }
    ev.push({ e: 'trade', status: 'accepted', ...t });
    pushLog(s, '🤝 ' + from.name + ' and ' + p.name + ' made a deal.'); addMood(s, from.id, p.id, 8); addMood(s, p.id, from.id, 8);
    return { ok: true, events: ev };
  }

  // planning: the state when this player's turn starts (income paid, crate resolved)
  function simulateTurnStart(s, pid, takeIncome) {
    const c = JSON.parse(JSON.stringify(s));
    c._preview = true;
    c.turn.idx = c.players.findIndex(p => p.id === pid);
    const p = player(c, pid);
    if (!p || !p.alive || c.phase !== 'play') return c;
    c.trade = null;
    startTurn(c, [], () => 0.5, true);
    if (c.phase !== 'play' || current(c).id !== pid) return c;
    if (c.turn.stage === 'choose') { if (takeIncome) p.cash += c.turn.income; c.turn.stage = 'act'; }
    c.turn.crate = null; c.turn.offer = [];
    return c;
  }

  // fog of war: what a commander (and their allies) can currently see
  function visionOf(s, pid) {
    const vis = new Set(), side = new Set([pid]);
    for (const p of s.players) if (isAlly(s, pid, p.id)) side.add(p.id);
    const extra = s.weather && s.weather.id === 'clear' ? 2 : 0;
    for (const k in s.map.tiles) if (side.has(s.map.tiles[k].owner)) for (const a of area(k, 1 + extra)) vis.add(a);
    for (const id in s.units) {
      const u = s.units[id]; if (!side.has(u.owner)) continue;
      const d = UNITS[u.type], r = 2 + (d.cls === 'air' ? 1 : 0) + (d.ability === 'orbital' ? 2 : 0) + extra;
      for (const a of area(u.hex, r)) vis.add(a);
    }
    return vis;
  }
  // what a client may see
  function view(s, pid, mem) {
    const c = JSON.parse(JSON.stringify(s));
    if (c.phase !== 'over') { delete c.heat; delete c.flips; delete c.bigBattle; }
    delete c.botMem;   // bot plans stay secret   // end-of-game report data stays secret until the end
    const pl = pid && c.players.find(p => p.id === pid);
    if (s.settings.fog === 'on' && pl && pl.alive && c.phase === 'play') {
      // real fog of war: unexplored hexes are unknown; explored-but-unseen hexes show what you last saw
      mem = mem || { explored: new Set(), seen: {} };
      const vis = visionOf(s, pid);
      for (const k of vis) { const t0 = s.map.tiles[k]; if (!t0) continue; mem.explored.add(k); mem.seen[k] = { owner: t0.owner, structs: JSON.parse(JSON.stringify(structsOf(t0))), poi: t0.poi, gar: t0.gar }; }
      for (const id in c.units) { const u = c.units[id]; if (u.owner !== pid && !isAlly(s, pid, u.owner) && !vis.has(u.hex)) delete c.units[id]; }
      for (const k in c.map.tiles) {
        if (vis.has(k)) continue;
        const t = c.map.tiles[k], real = s.map.tiles[k], hq = getS(real, 'hq');
        if (mem.explored.has(k)) {
          t.fog = 1;
          const m = mem.seen[k]; if (m) { t.owner = m.owner; t.structs = m.structs; t.poi = m.poi; t.gar = m.gar; if (!m.poi) delete t.poi; }
        } else {
          t.fog = 2;
          t.owner = hq ? real.owner : null; t.structs = hq ? [JSON.parse(JSON.stringify(hq))] : [];
          delete t.poi; delete t.gar; delete t.fish; delete t.river; delete t.flow; t.res = false; t.contam = 0; t.smoke = null; t.bridge = false;
        }
        t.struct = (t.structs || []).find(x => x.type === 'hq') || (t.structs || [])[0] || null;
      }
      c.fogOn = true;
    }
    for (const p of c.players) { p.tacticCount = p.tactics.length; if (p.id !== pid) p.tactics = []; }
    if (c.trade && c.trade.to !== pid && c.trade.from !== pid) c.trade = { from: c.trade.from, to: c.trade.to, hidden: true };
    const cur = c.players[c.turn.idx];
    if (c.turn.crate && (!cur || cur.id !== pid)) c.turn.crate = { tier: c.turn.crate.tier, hidden: true, cards: [] };
    if (!cur || cur.id !== pid) { c.turn.offerCount = (c.turn.offer || []).length; c.turn.offer = []; }
    if (c.draft) { const mine = c.draft.offers[pid]; c.draft.offers = mine ? { [pid]: mine } : {}; }
    return c;
  }

  return {
    DIRS, key, parse, dist, neighbors, area, line, mulberry32, hashStr,
    POI, WEATHER, isAlly, recordHistory, RARITY, RARITY_ORDER, CRATES, DROP_TIERS, SCRAP_VALUE, DECK_MAX, MAX_LEVEL, TERRAIN, DIFFICULTY, UNITS, TACTICS, STRUCTS, BUILD_ORDER, UPGRADABLE, MAX_SLVL, FACTIONS, COLORS, MAX_STACK, GRUNT_STACK, stackFits, CLASS_NAME, cardDef,
    ECON, infraValue, econOf, generateMap, createGame, applyAction, spawnChoices, visionOf, startTurn, endTurn, simulateTurnStart, view, drawCards,
    player, current, buildIndex, canAct, moveAllow, ownedTiles, ownedLand, spawnPoints, musterHexes, supplySet, computeIncome, levelOf, unitAtk, unitDef,
    tsarArea, moodOf, addMood, threatOf, rerollCost, bountyValue, reachable, pathTo, rangedTargets, deployHexes, buildHexes, buildError, isSea, isWater, isCoastal, movers, combatCalc, tacticTargets, unitCost, structCost, buildCost, structsOf, MAX_STRUCTS, conquestTarget, isLandTile, flakCovered,
  };
});
