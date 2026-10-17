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
  };
  const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

  // crates come from Supply Drop cards: the reel spins a tier, then 3 cards are drawn with its odds
  const CRATES = {
    standard: { name: 'Standard Crate', odds: { common: 46, uncommon: 30, rare: 15, epic: 7, legendary: 2 } },
    gilded: { name: 'Gilded Crate', odds: { common: 8, uncommon: 30, rare: 32, epic: 22, legendary: 8 } },
    mythic: { name: 'Mythic Crate', odds: { common: 0, uncommon: 6, rare: 30, epic: 38, legendary: 26 } },
  };
  // reel odds per Supply Drop rarity (standard / gilded / mythic)
  const DROP_TIERS = { drop_rare: { standard: 60, gilded: 32, mythic: 8 }, drop_epic: { standard: 15, gilded: 55, mythic: 30 }, drop_legendary: { standard: 0, gilded: 35, mythic: 65 } };
  const TURN_ODDS = { common: 45, uncommon: 30, rare: 16, epic: 7, legendary: 2 };
  const SCRAP_VALUE = 2, DECK_MAX = 10, MAX_LEVEL = 3;

  const TERRAIN = {
    water: { name: 'Sea', land: false },
    plains: { name: 'Plains', land: true },
    forest: { name: 'Forest', land: true, defMult: 1 },
    hills: { name: 'Highlands', land: true, defMult: 2, moveCost: 2 },
    mountain: { name: 'Mountains', land: false },
  };

  // cls: inf | veh | air | art | sea
  const UNITS = {
    grunt: { name: 'Grunts', cls: 'inf', cost: 2, atk: 2, def: 2, mv: 2, rarity: 'common', desc: 'Cheap, dependable rifle squad.' },
    skitter: { name: 'Skitter', cls: 'veh', cost: 3, atk: 2, def: 1, mv: 4, rarity: 'common', desc: 'Raider buggy. Grabs land fast.' },
    thumper: { name: 'Thumper', cls: 'art', cost: 4, atk: 3, def: 1, mv: 1, range: 2, rarity: 'common', desc: 'Mortar crew. Fires 2 hexes instead of moving.' },
    barracuda: { name: 'Barracuda', cls: 'sea', cost: 4, atk: 3, def: 2, mv: 4, rarity: 'common', desc: 'Fast gunboat. Claims sea lanes, raids coasts.' },
    lancer: { name: 'Lancer', cls: 'inf', cost: 4, atk: 3, def: 2, mv: 2, rarity: 'uncommon', ability: 'hunter', desc: 'Tank Hunter: +3 Chips when fighting vehicles.' },
    warden: { name: 'Warden', cls: 'air', cost: 4, atk: 1, def: 3, mv: 3, rarity: 'uncommon', ability: 'aegis', desc: 'Shield drone. Aegis: +1 Mult when its hex defends.' },
    bulwark: { name: 'Bulwark', cls: 'veh', cost: 5, atk: 3, def: 5, mv: 3, rarity: 'uncommon', desc: 'Armoured carrier. Holds the line.' },
    hornet: { name: 'Hornet', cls: 'air', cost: 5, atk: 4, def: 1, mv: 4, rarity: 'uncommon', desc: 'Strike drone. Flies over mountains and water.' },
    mauler: { name: 'Mauler', cls: 'veh', cost: 6, atk: 5, def: 4, mv: 2, rarity: 'uncommon', desc: 'Main battle tank.' },
    ark: { name: 'Ark', cls: 'sea', cost: 4, atk: 0, def: 3, mv: 4, rarity: 'uncommon', ability: 'transport', desc: 'Transport. Carries up to 3 land units across the sea.' },
    marlin: { name: 'Marlin', cls: 'sea', cost: 7, atk: 5, def: 4, mv: 4, range: 2, rarity: 'rare', desc: 'Destroyer. Shells coasts and ships 2 hexes away.' },
    basilisk: { name: 'Basilisk', cls: 'art', cost: 8, atk: 7, def: 2, mv: 1, range: 3, rarity: 'rare', desc: 'Railgun platform. Fires 3 hexes.' },
    wraith: { name: 'Wraith', cls: 'veh', cost: 8, atk: 6, def: 3, mv: 4, rarity: 'rare', ability: 'hover', desc: 'Hover tank. Glides across water.' },
    kraken: { name: 'Kraken', cls: 'sea', cost: 8, atk: 7, def: 2, mv: 4, rarity: 'rare', ability: 'torpedo', desc: 'Submarine. Torpedoes: +4 Chips vs ships.' },
    goliath: { name: 'Goliath', cls: 'veh', cost: 9, atk: 7, def: 7, mv: 1, rarity: 'epic', ability: 'siege', desc: 'Siege walker. +2 Mult vs fortified hexes.' },
    valkyrie: { name: 'Valkyrie', cls: 'air', cost: 9, atk: 6, def: 4, mv: 5, rarity: 'epic', ability: 'strafe', desc: 'Assault VTOL. Seizes enemy hexes it flies over.' },
    bastion: { name: 'Bastion', cls: 'sea', cost: 11, atk: 8, def: 8, mv: 3, range: 3, rarity: 'epic', desc: 'Battleship. Long guns, range 3.' },
    leviathan: { name: 'Leviathan', cls: 'veh', cost: 14, atk: 12, def: 10, mv: 1, rarity: 'legendary', ability: 'juggernaut', desc: 'Land dreadnought. Never suffers pyrrhic losses.' },
    seraph: { name: 'Seraph', cls: 'air', cost: 12, atk: 9, def: 4, mv: 5, rarity: 'legendary', ability: 'strafe', desc: 'Gunship. Seizes enemy hexes it flies over.' },
    oracle: { name: 'Oracle', cls: 'art', cost: 11, atk: 8, def: 3, mv: 2, range: 4, rarity: 'legendary', ability: 'orbital', desc: 'Orbital uplink. Range 4, ignores mountains.' },
    abyssal: { name: 'Abyssal', cls: 'sea', cost: 15, atk: 12, def: 10, mv: 3, range: 4, rarity: 'legendary', ability: 'juggernaut', desc: 'Sea dreadnought. Range 4. Never suffers pyrrhic losses.' },
  };

  // target: none | ownHex | ownStack | spawn | enemyUnits | heli | enemyStruct | area | nuke | mutiny
  const TACTICS = {
    smoke: { name: 'Smoke Screen', rarity: 'common', cost: 1, target: 'ownHex', desc: 'A hex you own gets +2 Mult on defence until your next turn.' },
    march: { name: 'Forced March', rarity: 'common', cost: 1, target: 'ownStack', desc: 'Units on one hex may act again, with +2 move.' },
    conscript: { name: 'Conscription', rarity: 'common', cost: 1, target: 'spawn', desc: 'Deploy 2 free Grunts at a deploy point.' },
    airstrike: { name: 'Airstrike', rarity: 'uncommon', cost: 4, target: 'enemyUnits', range: 4, desc: 'Bomb enemy units within 4 of your land. Roll: kills 1–3.' },
    heli: { name: 'Heli Drop', rarity: 'uncommon', cost: 3, target: 'heli', range: 5, desc: 'Fly a stack up to 5 hexes onto any empty land and seize it.' },
    sabotage: { name: 'Sabotage', rarity: 'uncommon', cost: 3, target: 'enemyStruct', range: 3, desc: 'Destroy an enemy structure (or bridge) within 3 of your land.' },
    bonds: { name: 'War Bonds', rarity: 'rare', cost: 0, target: 'none', desc: 'Gain $1 for every 2 hexes you own.' },
    blitz: { name: 'Blitz Doctrine', rarity: 'rare', cost: 3, target: 'none', desc: 'This turn: all units +1 move, fresh units may act.' },
    drop_rare: { name: 'Supply Drop', rarity: 'rare', cost: 0, target: 'none', desc: 'Spin the reel for a crate (60% Standard · 32% Gilded · 8% Mythic), then keep 1 of 3 cards.' },
    emp: { name: 'EMP Burst', rarity: 'epic', cost: 4, target: 'area', range: 5, desc: 'Enemy units in a 1-hex radius are frozen for their next turn.' },
    drop_epic: { name: 'Supply Drop', rarity: 'epic', cost: 0, target: 'none', desc: 'Spin the reel for a crate (15% Standard · 55% Gilded · 30% Mythic), then keep 1 of 3 cards.' },
    carpet: { name: 'Carpet Bombing', rarity: 'epic', cost: 7, target: 'area', range: 4, desc: 'Bomb a hex and its neighbours: each enemy unit there has a 50% chance to be destroyed.' },
    nuke: { name: 'Tactical Nuke', rarity: 'legendary', cost: 10, target: 'nuke', range: 6, desc: 'Erase everything in a 1-hex radius. Leaves a fallout zone for 4 rounds.' },
    drop_legendary: { name: 'Supply Drop', rarity: 'legendary', cost: 0, target: 'none', desc: 'Spin the reel for a crate (35% Gilded · 65% Mythic), then keep 1 of 3 cards.' },
    mutiny: { name: 'Mutiny', rarity: 'legendary', cost: 6, target: 'mutiny', desc: 'An enemy stack (≤3) bordering your land defects to you.' },
  };

  // structures are the economy/base layer, separate from the unit deck
  const STRUCTS = {
    hq: { name: 'HQ', cost: 8, desc: 'Your capital. Lose it and you are out. Fortify: +3 garrison Chips and +1 Mult per level.' },
    fob: { name: 'FOB', cost: 8, desc: 'Forward base: deploy point and supply source. +1 Mult defence per level.' },
    market: { name: 'Market', cost: 7, desc: '+$3 per turn per level, +$1 more for each other Market level or Port you own (trade network).' },
    refinery: { name: 'Refinery', cost: 6, desc: '+$2 per turn per level (+$4 per level on a Resource node or oil rig).' },
    depot: { name: 'Depot', cost: 4, desc: 'Logistics hub: your units starting their turn nearby get +1 move. Range = level.' },
    port: { name: 'Port', cost: 5, desc: 'Coast only. Launch ships into the adjacent sea. Supply source for sea lanes.' },
    bridge: { name: 'Bridge', cost: 6, desc: 'Span a 1-hex sea gap between two shores. Land units cross; ships cannot pass.' },
    bunker: { name: 'Bunker', cost: 4, desc: '+2 Mult defence, +1 more per extra level.' },
    flak: { name: 'Flak', cost: 5, desc: 'Blocks enemy air tactics nearby (range = level). +2 Mult vs air.' },
  };
  const BUILD_ORDER = ['hq', 'fob', 'market', 'refinery', 'depot', 'port', 'bridge', 'bunker', 'flak'];
  // structures can be stacked up to level 3 by building the same thing on the same hex
  const UPGRADABLE = ['hq', 'fob', 'market', 'refinery', 'depot', 'bunker', 'flak'];
  const MAX_SLVL = 3;
  const MAX_STRUCTS = 3; // different buildings per hex
  const STRUCT_PRIORITY = ['hq', 'fob', 'port', 'bridge', 'market', 'refinery', 'depot', 'bunker', 'flak'];
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
    iron: { name: 'Iron Covenant', perk: 'Steel Wall', desc: '+1 defence Chip per unit when defending.', starter: 'bulwark', glyph: 'shield' },
    volt: { name: 'Volt Syndicate', perk: 'Overclock', desc: 'Vehicles and air units get +1 move.', starter: 'hornet', glyph: 'bolt' },
    ashen: { name: 'Ashen Nomads', perk: 'Raiders', desc: 'Move through and seize empty enemy hexes.', starter: 'skitter', glyph: 'skull' },
    verdant: { name: 'Verdant Host', perk: 'Deep Roots', desc: 'Structures cost $2 less. Start with a Bunker by your HQ.', starter: 'thumper', glyph: 'leaf' },
    null: { name: 'Null Order', perk: 'Loaded Dice', desc: 'Your combat rolls of 1 count as 3.', starter: 'lancer', glyph: 'eye' },
  };

  const DIFFICULTY = {
    easy: { name: 'Easy', income: 0.8 },
    medium: { name: 'Medium', income: 1 },
    hard: { name: 'Hard', income: 1.25 },
    impossible: { name: 'Impossible', income: 1.7 },
  };
  const COLORS = ['#ff4f5e', '#36c9ff', '#ffc53d', '#59f08a', '#c27dff', '#ff8ad0', '#ff9a3c', '#e9edf2'];
  const MAX_STACK = 5;
  const CLASS_NAME = { inf: 'Infantry', veh: 'Vehicle', air: 'Air', art: 'Artillery', sea: 'Naval' };

  function cardDef(id) { return UNITS[id] ? { ...UNITS[id], id, kind: 'unit' } : TACTICS[id] ? { ...TACTICS[id], id, kind: 'tactic' } : null; }

  // ───────────────────────── map generation ─────────────────────────
  // Every map picks a layout archetype, warps it with noise, then trims the board to the
  // coastline plus a band of sea, so the outline is different every game.
  const ARCHETYPES = ['continent', 'twin', 'archipelago', 'inland', 'crescent', 'pangaea'];
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
    const sizeMul = size === 'small' ? 0.75 : size === 'large' ? 1.4 : 1;
    const landTarget = Math.round((70 + nP * 38) * sizeMul);
    const landFrac = arch === 'archipelago' ? 0.36 : arch === 'pangaea' ? 0.55 : 0.45;
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
      const wa = arch === 'archipelago' ? 0.35 : 0.7;
      const wx = nx + (warpN(px * 0.07 + ox, py * 0.07, 2) - 0.5) * wa, wy = ny + (warpN(px * 0.07, py * 0.07 + oy, 2) - 0.5) * wa;
      const nw = arch === 'archipelago' ? 0.3 : 0.6;
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
    for (const c of landCells) {
      const ridge = 1 - Math.abs(noise2(c.px * 0.11 + oy, c.py * 0.11 + ox, 2) * 2 - 1);
      const moist = noise2(c.px * 0.22 + 40, c.py * 0.22 + 40, 2);
      let t = 'plains';
      if (c.e > mThr || (ridge > 0.96 && c.e > hThr)) t = 'mountain';
      else if (c.e > hThr) t = 'hills';
      else if (moist > 0.56) t = 'forest';
      tiles[key(c.q, c.r)] = { q: c.q, r: c.r, t, owner: null, struct: null, res: false, contam: 0, smoke: null };
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
    const cands = land.filter(k => comps[compOf[k]].length >= minComp && tiles[k].t !== 'hills' && neighbors(k).filter(isLand).length >= 4);
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
      for (const n of neighbors(s)) if (tiles[n] && tiles[n].t === 'mountain') tiles[n].t = 'hills';
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
      if (rigs >= Math.max(2, Math.round(shallow.length * 0.05))) break;
      if (spawns.some(s => dist(s, k) < 3) || neighbors(k).some(n => tiles[n] && tiles[n].res)) continue;
      tiles[k].res = true; rigs++;
    }
    let cx = 0, cy = 0; for (const k of landNow) { cx += tiles[k].q; cy += tiles[k].r; }
    const centre = key(Math.round(cx / landNow.length), Math.round(cy / landNow.length));
    let beacon = null, bd = 1e9;
    for (const k of landNow) { const d = dist(k, centre); if (d < bd && !spawns.includes(k)) { bd = d; beacon = k; } }
    tiles[beacon].t = 'plains'; tiles[beacon].res = false;
    return { tiles, spawns, beacon, landCount: landNow.length, arch };
  }

  // ───────────────────────── game setup ─────────────────────────
  const DRAFT_ROUNDS = 3;
  const DRAFT_ODDS = { common: 22, uncommon: 36, rare: 26, epic: 13, legendary: 3 };

  function createGame(settings, roster) {
    const seed = settings.seed ? hashStr(String(settings.seed)) : (Math.random() * 1e9) >>> 0;
    const shuffled = roster.slice().sort(() => Math.random() - 0.5);
    const map = generateMap({ size: settings.mapSize, seed, nPlayers: roster.length, archetype: ARCHETYPES.includes(settings.mapType) ? settings.mapType : null });
    const state = {
      v: 0, phase: 'draft', settings: { ...settings }, seed: map.seed,
      map: { arch: map.arch, tiles: map.tiles, beacon: settings.mode === 'koth' ? map.beacon : null, landCount: map.landCount },
      players: [], units: {}, nextId: 1,
      turn: { idx: 0, round: 1, stage: 'choose', offer: [], rerolls: 0, crate: null, income: 0, deadline: 0 },
      draft: { round: 1, rounds: DRAFT_ROUNDS, offers: {}, picked: {} },
      log: [], winner: null, trade: null,
    };
    shuffled.forEach((p, i) => {
      const hq = map.spawns[i];
      const pl = {
        id: p.id, name: p.name, color: p.color, faction: p.faction, bot: !!p.bot, diff: p.bot ? (DIFFICULTY[p.diff] ? p.diff : 'medium') : null,
        cash: 6, arsenal: ['grunt'], levels: {}, tactics: [], alive: true, hq, koth: 0, blitz: false, local: !!p.local,
        stats: { captured: 0, kills: 0, lost: 0, crates: 0 },
      };
      const starter = FACTIONS[p.faction] ? FACTIONS[p.faction].starter : null;
      if (starter && !pl.arsenal.includes(starter)) pl.arsenal.push(starter);
      pl.arsenal.push('ark');
      pl.tactics.push({ uid: state.nextId++, id: 'drop_rare' });
      state.players.push(pl);
      const t = state.map.tiles[hq];
      t.owner = p.id; addStruct(t, { type: 'hq', owner: p.id, lvl: 1 });
      for (const n of neighbors(hq)) { const nt = state.map.tiles[n]; if (nt && TERRAIN[nt.t].land && !nt.owner) nt.owner = p.id; }
      if (p.faction === 'verdant') {
        const spot = neighbors(hq).find(n => state.map.tiles[n] && state.map.tiles[n].owner === p.id && !structsOf(state.map.tiles[n]).length);
        if (spot) addStruct(state.map.tiles[spot], { type: 'bunker', owner: p.id, lvl: 1 });
      }
      for (let j = 0; j < 2; j++) addUnit(state, p.id, 'grunt', hq, false);
    });
    pushLog(state, 'Sector ' + (state.seed % 9000 + 1000) + ' (' + map.arch + ') deployed. ' + state.players.length + ' commanders — opening draft!');
    for (const p of state.players) state.draft.offers[p.id] = drawCards(state, p, 3, DRAFT_ODDS, Math.random);
    return { state, events: [{ e: 'draft', round: 1 }] };
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
  function unitCost(p, type) { return UNITS[type].cost; }
  function structCost(p, type, lvl) {
    let c = STRUCTS[type].cost;
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
  function canAct(s, u) { const p = player(s, u.owner); return !u.moved && !u.stun && (!u.fresh || (p && p.blitz)); }
  function moveAllow(s, u) {
    const p = player(s, u.owner), d = UNITS[u.type];
    let m = d.mv + (u.mvBonus || 0) + (p && p.blitz ? 1 : 0);
    if (p && p.faction === 'volt' && (d.cls === 'veh' || d.cls === 'air')) m += 1;
    return m;
  }
  function ownedTiles(s, pid) { const o = []; for (const k in s.map.tiles) if (s.map.tiles[k].owner === pid) o.push(k); return o; }
  function ownedLand(s, pid) { const o = []; for (const k in s.map.tiles) { const t = s.map.tiles[k]; if (t.owner === pid && isLandTile(t)) o.push(k); } return o; }
  function spawnPoints(s, pid) {
    const out = [];
    for (const k in s.map.tiles) {
      const t = s.map.tiles[k]; if (t.owner !== pid) continue;
      const h = getS(t, 'hq'), f = getS(t, 'fob');
      if ((h && h.owner === pid && !h.siege) || (f && f.owner === pid && !f.lock)) out.push(k);
    }
    return out;
  }
  function supplySet(s, pid) {
    const src = [];
    for (const k in s.map.tiles) { const t = s.map.tiles[k]; if (t.owner === pid && structsOf(t).some(x => ['hq', 'fob', 'port'].includes(x.type) && x.owner === pid && !x.siege)) src.push(k); }
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
    if (!isSea(type)) return spawnPoints(s, pid).filter(k => (idx[k] || []).length < MAX_STACK);
    const out = new Set();
    for (const k in s.map.tiles) {
      const t = s.map.tiles[k];
      const pt = getS(t, 'port');
      if (t.owner !== pid || !pt || pt.owner !== pid || pt.lock) continue;
      for (const n of neighbors(k)) {
        const w = s.map.tiles[n]; if (!isWater(w)) continue;
        const occ = idx[n] || [];
        if (occ.length < MAX_STACK && !(occ.length && occ[0].owner !== pid)) out.add(n);
      }
    }
    return [...out];
  }
  function computeIncome(s, pid) {
    const sup = supplySet(s, pid);
    let hexes = 0, sea = 0, cut = 0, res = 0, ref = 0, markets = 0, ports = 0;
    for (const k in s.map.tiles) {
      const t = s.map.tiles[k]; if (t.owner !== pid) continue;
      if (!sup.has(k)) { cut++; continue; }
      if (isWater(t)) sea++; else hexes++;
      if (t.res) res++;
      for (const st of structsOf(t)) {
        if (st.type === 'refinery') ref += (t.res ? 4 : 2) * slvlOf(st);
        if (st.type === 'market') markets += slvlOf(st);
        if (st.type === 'port') ports++;
      }
    }
    const trade = markets ? markets * 3 + markets * (markets - 1 + ports) : 0;
    const base = 3, fromHex = Math.floor(hexes / 3), fromSea = Math.floor(sea / 4), fromRes = res * 2;
    let total = base + fromHex + fromSea + fromRes + ref + trade;
    const p = player(s, pid), d = p && p.bot && DIFFICULTY[p.diff];
    const bonus = d ? Math.round(total * d.income) - total : 0;
    total += bonus;
    return { total, base, fromHex, fromSea, fromRes, ref, trade, bonus, hexes, sea, cut, res };
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
    const strafe = !navy && ((p && p.faction === 'ashen') || units.every(u => UNITS[u.type].ability === 'strafe'));
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
        const enemy = occ.length && occ[0].owner !== pid;
        const c = cn.c + 1;
        if (navy) {
          // ships: sail open water; strike enemies on adjacent coasts
          if (!isWater(t)) { if (enemy && canFight && c <= mv && isLandTile(t)) set(n, c, cur, 'attack'); continue; }
          if (c > mv) continue;
          if (enemy) { if (canFight) set(n, c, cur, 'attack'); continue; }
          const room = occ.length + all.length <= MAX_STACK;
          set(n, c, cur, t.owner !== pid ? (room ? 'capture' : 'pass') : (room ? 'move' : 'pass'));
          continue;
        }
        if (isWater(t) && !allHover) {
          if (c > mv) continue;
          if (enemy) { if (canFight) set(n, c, cur, 'attack'); continue; }   // shore guns vs ships
          if (occ.length) {
            const aboard = occ.filter(u => !isSea(u.type)).length;
            if (cargoCap(occ) >= aboard + units.length && occ.length + units.length <= MAX_STACK) set(n, c, cur, 'board');
          }
          continue;
        }
        if (t.t === 'mountain' && !allAir) continue;
        const step = (t.t === 'hills' && !allAir) ? 2 : 1;
        const cc = cn.c + step;
        if (cc > mv) continue;
        const land = isLandTile(t);
        let kind;
        if (enemy) { if (!canFight) continue; kind = 'attack'; }
        else if (land && t.owner && t.owner !== pid) { const h = getS(t, 'hq'); kind = h && h.owner === t.owner ? (canFight ? 'attack' : null) : 'capture'; }
        else kind = land && !t.contam && occ.length + units.length <= MAX_STACK ? 'move' : 'pass';
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
    const out = [];
    for (const k of area(from, range)) {
      if (k === from) continue;
      const occ = idx[k]; if (!occ || !occ.length || occ[0].owner === pid) continue;
      if (!orbital && !hasLOS(s, from, k)) continue;
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
    if (!ranged) {
      const classes = new Set(units.filter(u => UNITS[u.type].atk > 0).map(u => UNITS[u.type].cls));
      const ca = Math.min(3, classes.size - 1);
      if (ca > 0) { att.mult += ca; att.bonuses.push({ label: 'Combined Arms ×' + classes.size, mult: ca }); }
      const multi = new Set(units.map(u => u.hex)).size;
      const ids = new Set(units.map(u => u.id));
      let flank = 0;
      for (const n of neighbors(target)) {
        if (stages.includes(n)) continue;
        const occ = idx[n]; if (occ && occ.some(u => u.owner === pid && !ids.has(u.id))) flank++;
      }
      flank = Math.min(2, flank);
      if (flank) { att.mult += flank; att.bonuses.push({ label: 'Flanking', mult: flank }); }
      if (stages.length > 1) { const pin = Math.min(2, stages.length - 1); att.mult += pin; att.bonuses.push({ label: 'Pincer ×' + stages.length, mult: pin }); }
      if (structsOf(t).some(x => ['hq', 'fob', 'bunker'].includes(x.type)) && units.some(u => UNITS[u.type].ability === 'siege')) { att.mult += 2; att.bonuses.push({ label: 'Siege Breaker', mult: 2 }); }
      if (isLandTile(t) && units.every(u => isSea(u.type))) { att.mult -= 1; att.bonuses.push({ label: 'Shore Assault', mult: -1 }); }
      void multi;
    } else {
      const st = s.map.tiles[stages[0]];
      if (st && st.t === 'hills') { att.mult += 1; att.bonuses.push({ label: 'High Ground', mult: 1 }); }
    }
    for (const u of defenders) def.chips += unitDef(s, u);
    const dlv = defenders.reduce((a, u) => a + levelOf(s, u), 0);
    if (dlv) def.bonuses.push({ label: 'Veteran ★', chips: dlv, note: true });
    if (dp && dp.faction === 'iron' && defenders.length) { def.chips += defenders.length; def.bonuses.push({ label: 'Steel Wall', chips: defenders.length }); }
    const dHunt = defenders.filter(u => UNITS[u.type].ability === 'hunter').length;
    if (dHunt && has(units, 'veh')) { def.chips += 3 * dHunt; def.bonuses.push({ label: 'Tank Hunter', chips: 3 * dHunt }); }
    const hq = getS(t, 'hq');
    if (hq && hq.owner === defPid && !hq.siege) { const L = slvlOf(hq); def.chips += 3 * L; def.bonuses.push({ label: 'HQ Garrison' + (L > 1 ? ' ' + '★'.repeat(L) : ''), chips: 3 * L }); def.mult += 1 + L; def.bonuses.push({ label: 'Fortified HQ', mult: 1 + L }); }
    const tm = isWater(t) || t.bridge ? 0 : (TERRAIN[t.t].defMult || 0);
    if (tm) { def.mult += tm; def.bonuses.push({ label: TERRAIN[t.t].name, mult: tm }); }
    const bk = getS(t, 'bunker'), fb = getS(t, 'fob');
    if (bk && bk.owner === defPid) { const m = 1 + slvlOf(bk); def.mult += m; def.bonuses.push({ label: 'Bunker' + (slvlOf(bk) > 1 ? ' ' + '★'.repeat(slvlOf(bk)) : ''), mult: m }); }
    if (fb && fb.owner === defPid) { const m = slvlOf(fb); def.mult += m; def.bonuses.push({ label: 'FOB Walls' + (m > 1 ? ' ' + '★'.repeat(m) : ''), mult: m }); }
    if (t.smoke && t.smoke === defPid) { def.mult += 2; def.bonuses.push({ label: 'Smoke Screen', mult: 2 }); }
    const aegis = Math.min(2, defenders.filter(u => UNITS[u.type].ability === 'aegis').length);
    if (aegis) { def.mult += aegis; def.bonuses.push({ label: 'Aegis', mult: aegis }); }
    if (has(units, 'air') && getS(t, 'flak') && getS(t, 'flak').owner === defPid) { def.mult += 2; def.bonuses.push({ label: 'Flak Battery', mult: 2 }); }
    const aNull = ap && ap.faction === 'null', dNull = dp && dp.faction === 'null';
    let wins = 0;
    for (let a = 1; a <= 6; a++) for (let d = 1; d <= 6; d++) {
      const ra = aNull && a === 1 ? 3 : a, rd = dNull && d === 1 ? 3 : d;
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
    if (calc.aNull && ra === 1) ra = 3;
    if (calc.dNull && rd === 1) rd = 3;
    const aScore = calc.att.chips * Math.max(1, ra + calc.att.mult), dScore = calc.def.chips * Math.max(1, rd + calc.def.mult);
    const attWin = aScore > dScore;
    const killed = [], pyrrhic = [];
    if (attWin) {
      killed.push(...defenders);
      if (dScore >= 0.6 * aScore && units.length > 1 && !units.some(u => UNITS[u.type].ability === 'juggernaut')) pyrrhic.push(weakest(units));
    } else {
      killed.push(...units);
      if (aScore >= 0.6 * dScore && defenders.length > 1 && !defenders.some(u => UNITS[u.type].ability === 'juggernaut')) pyrrhic.push(weakest(defenders));
    }
    tallyLosses(s, pid, defPid, killed.concat(pyrrhic));
    ev.push({
      e: 'combat', ranged: false, from: stages[0], stages, to: target,
      att: { ...calc.att, roll: ra, raw: rawA, score: aScore, units: units.map(u => u.type) },
      def: { ...calc.def, roll: rd, raw: rawD, score: dScore, units: defenders.map(u => u.type) },
      attWin, killed: killed.map(u => u.id), pyrrhic: pyrrhic.map(u => u.id), winProb: calc.winProb,
    });
    const ap = player(s, pid), dp = player(s, defPid);
    const survivors = units.filter(u => s.units[u.id]);
    if (attWin) {
      const holders = survivors.filter(u => canHold(tile, u)).sort((a, b) => UNITS[b.type].cost - UNITS[a.type].cost).slice(0, MAX_STACK);
      if (holders.length) {
        holders.forEach(u => { u.hex = target; });
        const hqs = getS(tile, 'hq'), hqTaken = hqs && hqs.owner === defPid && !hqs.siege;
        captureTile(s, target, pid);
        ev.push({ e: 'advance', pid, units: holders.map(u => u.id), from: stages[0], to: target });
        if (hqTaken && dp) {
          ev.push({ e: 'siege', pid, victim: defPid, hex: target });
          pushLog(s, '🔥 ' + (ap ? ap.name : '?') + ' is besieging ' + dp.name + "'s HQ! Retake it within a turn or fall.");
        }
      }
    }
    // everyone who didn't advance goes back to where they started
    for (const g of groups) for (const u of g.units) if (s.units[u.id] && u.hex !== target) u.hex = g.from;
    pushLog(s, '⚔ ' + (ap ? ap.name : '?') + (groups.length > 1 ? ' launched a ' + groups.length + '-way assault on ' : ' attacked ') + (dp ? dp.name : 'a garrison') + ' — ' + aScore + ' vs ' + dScore + (attWin ? ' · WIN' : ' · REPELLED'));
    return attWin;
  }
  function resolveFire(s, pid, units, from, target, rng, ev) {
    const calc = combatCalc(s, pid, units, from, target, true);
    const defenders = calc.defenders, defPid = calc.def.pid;
    let ra = rollDie(rng), rd = rollDie(rng); const rawA = ra, rawD = rd;
    if (calc.aNull && ra === 1) ra = 3;
    if (calc.dNull && rd === 1) rd = 3;
    const aScore = calc.att.chips * Math.max(1, ra + calc.att.mult), dScore = calc.def.chips * Math.max(1, rd + calc.def.mult);
    const attWin = aScore > dScore, killed = [];
    if (attWin) {
      const pool = defenders.slice();
      const n = aScore >= 2 * dScore ? 2 : 1;
      for (let i = 0; i < n && pool.length; i++) killed.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
    units.forEach(u => u.moved = true);
    tallyLosses(s, pid, defPid, killed);
    ev.push({
      e: 'combat', ranged: true, from, stages: [from], to: target,
      att: { ...calc.att, roll: ra, raw: rawA, score: aScore, units: units.map(u => u.type) },
      def: { ...calc.def, roll: rd, raw: rawD, score: dScore, units: defenders.map(u => u.type) },
      attWin, killed: killed.map(u => u.id), pyrrhic: [], winProb: calc.winProb,
    });
    const ap = player(s, pid), dp = player(s, defPid);
    pushLog(s, '💥 ' + (ap ? ap.name : '?') + ' shelled ' + (dp ? dp.name : '?') + ' — ' + aScore + ' vs ' + dScore + (attWin ? ' · HIT' : ' · MISS'));
  }
  function tallyLosses(s, pid, defPid, dead) {
    const ap = player(s, pid), dp = player(s, defPid);
    for (const u of dead) {
      const owner = player(s, u.owner); if (owner) owner.stats.lost++;
      const other = u.owner === pid ? dp : ap; if (other) other.stats.kills++;
      delete s.units[u.id];
    }
  }

  function captureTile(s, k, pid) {
    const t = s.map.tiles[k];
    if (!t || t.t === 'mountain' || t.owner === pid) return false;
    t.owner = pid;
    t.smoke = null;
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
      if (t.owner === loser) { t.owner = by || null; for (const st of structsOf(t)) st.owner = by || null; syncStructs(t); hexes.push(k); }
    }
    const dead = [];
    for (const id in s.units) if (s.units[id].owner === loser) { dead.push(+id); delete s.units[id]; }
    const bp = player(s, by);
    if (bp) bp.cash += 10;
    if (s.trade && (s.trade.from === loser || s.trade.to === loser)) s.trade = null;
    ev.push({ e: 'eliminate', pid: loser, by, hexes, units: dead, hq: lp.hq });
    pushLog(s, '☠ ' + lp.name + ' has fallen' + (bp ? ' to ' + bp.name + ' (+$10 plunder)' : '') + '.');
  }

  // ───────────────────────── cards, crates & the draft ─────────────────────────
  function heldLegendaries(s) {
    const held = new Set();
    for (const pl of s.players) if (pl.alive) { pl.arsenal.forEach(a => held.add(a)); pl.tactics.forEach(c => held.add(c.id)); }
    if (s.turn.crate) s.turn.crate.cards.forEach(id => held.add(id));
    return held;
  }
  // draw n distinct cards: roll a rarity from `odds`, then a card of that rarity
  function drawCards(s, p, n, odds, rng) {
    const held = heldLegendaries(s);
    const pools = {};
    for (const r of RARITY_ORDER) pools[r] = [];
    for (const id in UNITS) {
      if (UNITS[id].rarity === 'legendary' && held.has(id)) continue;
      if (p.arsenal.includes(id) && (p.levels[id] || 0) >= MAX_LEVEL) continue;
      pools[UNITS[id].rarity].push(id);
    }
    for (const id in TACTICS) if (!(TACTICS[id].rarity === 'legendary' && id !== 'drop_legendary' && held.has(id))) pools[TACTICS[id].rarity].push(id);
    const out = [];
    for (let i = 0; i < n; i++) {
      const avail = RARITY_ORDER.filter(r => pools[r].some(id => !out.includes(id)) && odds[r] > 0);
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
    const cards = drawCards(s, p, 3, CRATES[tier].odds, rng);
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
    if (s.draft.picked[p.id]) return fail('Waiting for the others');
    const offer = s.draft.offers[p.id] || [];
    const id = offer[a.idx]; if (!id) return fail('No such card');
    const err = grantCard(s, p, id, a.replace, ev); if (err) return fail(err);
    s.draft.picked[p.id] = true;
    ev.push({ e: 'draftPick', pid: p.id, round: s.draft.round });
    if (s.players.every(pl => !pl.alive || s.draft.picked[pl.id])) {
      if (s.draft.round >= s.draft.rounds) {
        s.phase = 'play'; s.draft = null;
        pushLog(s, 'Draft complete. The war begins!');
        ev.push({ e: 'draftDone' });
        startTurn(s, ev, rng);
      } else {
        s.draft.round++; s.draft.picked = {};
        for (const pl of s.players) s.draft.offers[pl.id] = drawCards(s, pl, 3, DRAFT_ODDS, rng);
        ev.push({ e: 'draft', round: s.draft.round });
      }
    }
    return { ok: true, events: ev };
  }

  // ───────────────────────── turn flow ─────────────────────────
  function startTurn(s, ev, rng) {
    if (s.phase !== 'play') return;
    const p = current(s);
    if (!p.alive) return endTurn(s, ev, rng);
    p.blitz = false;
    for (const id in s.units) {
      const u = s.units[id]; if (u.owner !== p.id) continue;
      u.moved = false; u.fresh = false; u.mvBonus = 0;
      if (u.stun > 0) { u.moved = true; u.stun--; }
    }
    for (const k in s.map.tiles) if (s.map.tiles[k].smoke === p.id) s.map.tiles[k].smoke = null;
    const depots = Object.keys(s.map.tiles).filter(k => { const t = s.map.tiles[k], d = getS(t, 'depot'); return t.owner === p.id && d && d.owner === p.id; });
    if (depots.length) for (const id in s.units) { const u = s.units[id]; if (u.owner === p.id && depots.some(d => dist(d, u.hex) <= slvlOf(getS(s.map.tiles[d], 'depot')))) u.mvBonus = 1; }
    // structures captured last turn come online; sieges this player started now resolve
    for (const k in s.map.tiles) {
      const t = s.map.tiles[k];
      for (const st of structsOf(t)) if (st.lock && st.owner === p.id) delete st.lock;
      const h = getS(t, 'hq');
      if (h && h.siege && h.siege.by === p.id) {
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
    s.turn.deadline = s.settings.timer ? Date.now() + s.settings.timer * 1000 : 0;
    s.turn.income = computeIncome(s, p.id).total;
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
        if (s.settings.maxRounds && s.turn.round > s.settings.maxRounds) {
          const best = s.players.filter(p => p.alive).map(p => [p, ownedLand(s, p.id).length]).sort((a, b) => b[1] - a[1])[0];
          return declareWin(s, best[0].id, 'held the most territory when time ran out', ev);
        }
      }
    } while (!s.players[s.turn.idx].alive && ++guard < n * 2);
    startTurn(s, ev, rng);
  }

  function declareWin(s, pid, reason, ev) {
    s.phase = 'over'; s.winner = { pid, reason };
    const p = player(s, pid);
    ev.push({ e: 'win', pid, reason });
    pushLog(s, '🏆 ' + (p ? p.name : '?') + ' ' + reason + '!');
  }
  function checkWin(s, ev) {
    if (s.phase !== 'play') return;
    const alive = s.players.filter(p => p.alive);
    if (alive.length === 1) return declareWin(s, alive[0].id, 'is the last commander standing', ev);
    if (s.settings.mode === 'conquest') {
      const need = conquestTarget(s);
      for (const p of alive) if (ownedLand(s, p.id).length >= need) return declareWin(s, p.id, 'conquered ' + need + ' hexes', ev);
    }
  }
  function conquestTarget(s) { return Math.ceil(s.map.landCount * (s.settings.conquestPct || 60) / 100); }
  function pushLog(s, text) { s.log.push(text); if (s.log.length > 40) s.log.shift(); }

  // ───────────────────────── tactics targeting ─────────────────────────
  function tacticTargets(s, pid, id, from) {
    const def = TACTICS[id]; if (!def) return [];
    const idx = buildIndex(s), out = [], tiles = s.map.tiles;
    switch (def.target) {
      case 'none': return [];
      case 'ownHex': for (const k in tiles) if (tiles[k].owner === pid && isLandTile(tiles[k])) out.push(k); return out;
      case 'ownStack': for (const k in idx) if (idx[k][0].owner === pid && !idx[k].some(u => u.stun)) out.push(k); return out;
      case 'spawn': return spawnPoints(s, pid).filter(k => (idx[k] || []).length < MAX_STACK);
      case 'enemyUnits': for (const k in idx) if (idx[k][0].owner !== pid && nearOwned(s, pid, k, def.range) && !flakCovered(s, pid, k)) out.push(k); return out;
      case 'heli':
        if (!from) { for (const k in idx) if (idx[k][0].owner === pid && idx[k].some(u => canAct(s, u) && !isSea(u.type))) out.push(k); return out; }
        {
          const ms = (idx[from] || []).filter(u => u.owner === pid && canAct(s, u) && !isSea(u.type));
          for (const k of area(from, def.range)) {
            const t = tiles[k]; if (!isLandTile(t) || k === from || t.contam) continue;
            if ((idx[k] || []).length) continue;
            if (getS(t, 'hq')) continue;
            if (t.owner !== pid && flakCovered(s, pid, k)) continue;
            if (ms.length > MAX_STACK) continue;
            out.push(k);
          }
          return out;
        }
      case 'enemyStruct': for (const k in tiles) { const t = tiles[k]; if (structsOf(t).some(x => x.type !== 'hq' && x.owner !== pid) && nearOwned(s, pid, k, def.range)) out.push(k); } return out;
      case 'area': for (const k in tiles) if (nearOwned(s, pid, k, def.range) && !flakCovered(s, pid, k)) out.push(k); return out;
      case 'nuke':
        for (const k in tiles) {
          if (!nearOwned(s, pid, k, def.range) || flakCovered(s, pid, k)) continue;
          if (area(k, 1).some(a => getS(tiles[a], 'hq'))) continue;
          out.push(k);
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
    const r = applyActionInner(s, pid, a, rng);
    if (r.ok && s.phase === 'play') {
      drown(s, r.events);
      if (['move', 'assault', 'fire', 'tactic'].includes(a.a)) annex(s, pid, r.events);
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
      if (comp.some(c => structsOf(tiles[c]).some(x => ['hq', 'fob', 'port'].includes(x.type)))) continue;
      for (const c of comp) if (captureTile(s, c, pid)) flipped.push(c);
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
      riders.slice(cargoCap(idx[k])).forEach(u => { dead.push(u.id); delete s.units[u.id]; const o = player(s, u.owner); if (o) o.stats.lost++; });
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
  function pathCaptures(s, pid, path, units, idx) {
    const navy = units.every(u => isSea(u.type)), out = [];
    for (const k of path.slice(1, -1)) {
      const t = s.map.tiles[k];
      if (t.owner === pid || (idx[k] || []).length) continue;
      if (navy ? isWater(t) : isLandTile(t)) { if (captureTile(s, k, pid)) out.push(k); }
    }
    return out;
  }

  function applyActionInner(s, pid, a, rng) {
    const ev = [];
    const fail = err => ({ ok: false, err, events: [] });
    const p = player(s, pid);
    if (!p || !p.alive) return fail('You are not in this game');
    if (s.phase === 'draft') return a.a === 'draftPick' ? draftPick(s, p, a, ev, rng) : fail('Finish the opening draft first');
    if (s.phase !== 'play') return fail('Game is not running');
    if (a.a === 'tradeReply') return tradeReply(s, p, a, ev);
    if (current(s).id !== pid) return fail('Not your turn');
    const tiles = s.map.tiles;
    const stage = s.turn.stage;
    if (a.a === 'trade') return tradeOffer(s, p, a, ev);
    if (a.a === 'tradeCancel') { if (s.trade && s.trade.from === pid) { s.trade = null; ev.push({ e: 'trade', status: 'cancelled', from: pid }); } return { ok: true, events: ev }; }

    if (a.a === 'choose') {
      if (stage !== 'choose') return fail('Already chose');
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
      const cost = 2 + s.turn.rerolls;
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
      const u = addUnit(s, pid, a.unit, a.hex, true);
      ev.push({ e: 'deploy', pid, unit: { ...u }, hex: a.hex });
      return { ok: true, events: ev };
    }
    if (a.a === 'build') {
      if (!STRUCTS[a.struct]) return fail('Unknown structure');
      const err = buildError(s, pid, a.struct, a.hex); if (err) return fail(err);
      const cost = buildCost(s, p, a.struct, a.hex);
      if (p.cash < cost) return fail('Need $' + cost);
      p.cash -= cost;
      const t = tiles[a.hex];
      const ex = getS(t, a.struct);
      if (ex) {
        ex.lvl = slvlOf(ex) + 1;
        ev.push({ e: 'build', pid, struct: a.struct, hex: a.hex, lvl: ex.lvl });
        pushLog(s, p.name + ' upgraded a ' + STRUCTS[a.struct].name + ' to ' + '★'.repeat(ex.lvl) + '.');
        return { ok: true, events: ev };
      }
      addStruct(t, { type: a.struct, owner: pid, lvl: 1 });
      if (a.struct === 'bridge') { t.bridge = true; t.owner = pid; }
      ev.push({ e: 'build', pid, struct: a.struct, hex: a.hex, lvl: 1 });
      return { ok: true, events: ev };
    }
    if (a.a === 'move' || a.a === 'assault') {
      const idx = buildIndex(s);
      const groups = a.a === 'move' ? [{ from: a.from, units: a.units }] : (a.groups || []);
      if (!groups.length || groups.length > 6) return fail('Pick some units');
      const seenU = new Set();
      const checked = [];
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
          ag.push({ units: fleet, stage: stageK, from: c.from });
        }
        resolveAssault(s, pid, ag, a.to, rng, ev);
      } else {
        const c = checked[0];
        const fleet = movers(c.units);
        let cargo = [];
        if (fleet.some(u => isSea(u.type))) cargo = (idx[c.from] || []).filter(u => u.owner === pid && !isSea(u.type)).slice(0, cargoCap(fleet));
        const caps = pathCaptures(s, pid, c.path, fleet, idx);
        fleet.forEach(u => { u.moved = true; u.hex = a.to; });
        cargo.forEach(u => { u.hex = a.to; });
        const t = tiles[a.to];
        const navy = fleet.every(u => isSea(u.type));
        if (c.dest.kind !== 'board' && (navy ? isWater(t) : isLandTile(t)) && captureTile(s, a.to, pid)) caps.push(a.to);
        ev.push({ e: 'move', pid, units: fleet.concat(cargo).map(u => u.id), path: c.path, captures: caps });
      }
      return { ok: true, events: ev };
    }
    if (a.a === 'fire') {
      const units = (a.units || []).map(id => s.units[id]);
      if (!units.length || units.some(u => !u || u.owner !== pid || u.hex !== a.from || !canAct(s, u))) return fail('Invalid units');
      if (!rangedTargets(s, pid, a.units, a.from).includes(a.to)) return fail('Target out of range or blocked');
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
    const kill = (u) => { const o = player(s, u.owner); if (o) o.stats.lost++; if (u.owner !== pid) p.stats.kills++; delete s.units[u.id]; };
    switch (id) {
      case 'bonds': { const n = Math.floor(ownedLand(s, pid).length / 2); p.cash += n; ev.push({ ...base, amount: n }); break; }
      case 'blitz': p.blitz = true; ev.push(base); break;
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
        const room = MAX_STACK - (buildIndex(s)[a.target] || []).length, made = [];
        for (let i = 0; i < Math.min(2, room); i++) made.push({ ...addUnit(s, pid, 'grunt', a.target, true) });
        ev.push({ ...base, units: made }); break;
      }
      case 'airstrike': {
        const occ = Object.values(s.units).filter(u => u.hex === a.target);
        const roll = rollDie(rng), n = Math.min(occ.length, roll <= 2 ? 1 : roll <= 5 ? 2 : 3);
        const pool = occ.slice(), kills = [];
        for (let i = 0; i < n; i++) kills.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
        kills.forEach(kill);
        ev.push({ ...base, roll, kills: kills.map(u => u.id) });
        pushLog(s, '✈ ' + p.name + ' called an airstrike: ' + kills.length + ' destroyed.');
        break;
      }
      case 'carpet': {
        const ar = area(a.target, 1), kills = [];
        for (const u of Object.values(s.units)) if (ar.includes(u.hex) && u.owner !== pid && rng() < 0.5) kills.push(u);
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
    pushLog(s, '🤝 ' + from.name + ' and ' + p.name + ' made a deal.');
    return { ok: true, events: ev };
  }

  // planning: the state when this player's turn starts (income paid, crate resolved)
  function simulateTurnStart(s, pid, takeIncome) {
    const c = JSON.parse(JSON.stringify(s));
    c.turn.idx = c.players.findIndex(p => p.id === pid);
    const p = player(c, pid);
    if (!p || !p.alive || c.phase !== 'play') return c;
    p.blitz = false;
    if (takeIncome) p.cash += computeIncome(c, pid).total;
    for (const id in c.units) { const u = c.units[id]; if (u.owner !== pid) continue; u.moved = false; u.fresh = false; u.mvBonus = 0; if (u.stun > 0) { u.moved = true; u.stun--; } }
    c.turn.stage = 'act'; c.turn.crate = null; c.turn.offer = [];
    return c;
  }

  // what a client may see
  function view(s, pid) {
    const c = JSON.parse(JSON.stringify(s));
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
    RARITY, RARITY_ORDER, CRATES, DROP_TIERS, SCRAP_VALUE, DECK_MAX, MAX_LEVEL, TERRAIN, DIFFICULTY, UNITS, TACTICS, STRUCTS, BUILD_ORDER, UPGRADABLE, MAX_SLVL, FACTIONS, COLORS, MAX_STACK, CLASS_NAME, cardDef,
    generateMap, createGame, applyAction, startTurn, endTurn, simulateTurnStart, view, drawCards,
    player, current, buildIndex, canAct, moveAllow, ownedTiles, ownedLand, spawnPoints, supplySet, computeIncome, levelOf, unitAtk, unitDef,
    reachable, pathTo, rangedTargets, deployHexes, buildHexes, buildError, isSea, isWater, isCoastal, movers, combatCalc, tacticTargets, unitCost, structCost, buildCost, structsOf, MAX_STRUCTS, conquestTarget, isLandTile, flakCovered,
  };
});
