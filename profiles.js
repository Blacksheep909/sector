/* SECTOR — player profiles: coins, owned skins, loadouts, objectives and referrals.
   The server is the only thing that changes them, so a player can't give themselves coins from the browser.
   Today a profile is tied to a device (a random id + secret kept by the browser); accounts will sign in to the same records. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('./shared/cosmetics'), E = require('./shared/engine');

const REF_COINS = 250, WELCOME_COINS = 100, RECRUITER_AT = 3;

function createProfiles(file, opts = {}) {
  let db = {};
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  let timer = null;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(db)); fs.renameSync(file + '.tmp', file); }
      catch (e) { console.log('[profiles] save failed: ' + e.message); }
    }, 400);
  };
  const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  // Founder skins go to profiles made before this date (SECTOR_OG_UNTIL=2027-03-01, say). Unset: nobody gets them yet
  const ogUntil = opts.ogUntil ? Date.parse(opts.ogUntil) : 0, startValor = Math.max(0, opts.startValor | 0);
  const newCode = () => { let c; do c = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6); while (Object.values(db).some(q => q.refCode === c)); return c; };
  function roll(p) {
    const d = C.dayKey(), w = C.weekKey();
    if (!p.day || p.day.key !== d) p.day = { key: d, stats: {}, done: [] };
    if (!p.week || p.week.key !== w) p.week = { key: w, stats: {}, done: [] };
    if (!p.earned || p.earned.day !== d) p.earned = { day: d, amount: 0 };
  }
  // find or create a profile. A wrong secret for a known id gets nothing (that's someone else's profile)
  function open(id, secret, name, ref) {
    if (typeof id !== 'string' || !/^[a-f0-9]{24,64}$/.test(id) || typeof secret !== 'string' || secret.length < 16 || secret.length > 128) return null;
    let p = db[id];
    // the browser's own key, or one handed to another device when it signed in to this commander's account
    if (p && p.secret !== hash(secret) && !(p.devices || []).includes(hash(secret))) return null;
    if (!p) {
      p = db[id] = { id, secret: hash(secret), created: Date.now(), coins: 0, owned: [], equipped: {}, cards: {}, total: {}, refCode: newCode(), referredBy: null, refPaid: false, recruits: 0 };
      if (ref) { const r = Object.values(db).find(q => q.refCode === String(ref).toUpperCase().slice(0, 8) && q.id !== id); if (r) p.referredBy = r.id; }
      if (ogUntil && Date.now() <= ogUntil) p.owned.push('t-founder', 'n-founder');
    }
    // a starting grant of Valor (opts.startValor): once per commander, new or already made
    if (startValor && !p.startValor) { p.coins += startValor; p.startValor = startValor; }
    if (name) p.name = String(name).slice(0, 16);
    roll(p); save();
    return p;
  }
  const objList = (list, period) => list.map(o => ({ id: o.id, text: o.text, need: o.need, coins: o.coins, have: Math.min(o.need, period.stats[o.stat] || 0), done: period.done.includes(o.id) }));
  // what the player's own client gets to see (never the secret, never anyone else's)
  function view(p) {
    roll(p);
    const store = C.dailyStore();
    return {
      name: p.name || null, handle: p.refCode, total: p.total || {}, factions: C.factionsOf(p), links: linksView(p), coins: p.coins, scenarios: p.scenarios || [], owned: p.owned, equipped: p.equipped, cards: p.cards, refCode: p.refCode, recruits: p.recruits, earnedToday: p.earned.amount, daySoft: C.DAY_SOFT,
      daily: objList(C.dailyObjectives(), p.day), weekly: objList(C.weeklyObjectives(), p.week), weeklyCrate: !!p.week.crate, freeCrates: p.freeCrates || 0,
      store: { day: store.day, items: store.items, endsIn: C.msToNextDay() },
    };
  }
  // anything can be bought: at its price from today's store, or at three times that any other day (C.priceOf).
  // Card versions also come out of crates
  function buy(p, itemId) {
    const it = C.ITEMS[itemId];
    if (!it || it.buy === false) return 'That can’t be bought';
    if (p.owned.includes(itemId)) return 'Already yours';
    const price = C.priceOf(itemId);
    if (p.coins < price) return 'Need ' + price.toLocaleString() + ' Valor';
    p.coins -= price; p.owned.push(itemId); save();
    return null;
  }
  function equip(p, slot, itemId) {
    if (slot === 'card') {
      const it = C.ITEMS[itemId];
      if (!it || it.slot !== 'card' || !p.owned.includes(itemId)) return 'Not yours';
      if (p.cards[it.card] === it.variant) delete p.cards[it.card]; else p.cards[it.card] = it.variant;   // equipping it again takes it off
      save(); return null;
    }
    if (!C.SLOTS[slot]) return 'No such slot';
    if (!itemId) { delete p.equipped[slot]; save(); return null; }
    const it = C.ITEMS[itemId];
    if (!it || it.slot !== slot || !p.owned.includes(itemId)) return 'Not yours';
    p.equipped[slot] = itemId; save();
    return null;
  }
  // a finished match: coins (with diminishing returns over the day), stats and objectives
  function finishGame(p, r) {
    roll(p);
    const m = C.matchCoins(r), match = C.diminish(m.base, p.earned.amount);
    p.earned.amount += match; p.coins += match;
    const out = { match, base: m.base, why: m.why || null, objectives: [] };
    if (r.rounds < 6) { save(); return out; }
    const add = { games: 1, wins: r.won ? 1 : 0, kills: r.kills || 0, captured: r.captured || 0, crates: r.crates || 0 };
    for (const k in add) { p.day.stats[k] = (p.day.stats[k] || 0) + add[k]; p.week.stats[k] = (p.week.stats[k] || 0) + add[k]; p.total[k] = (p.total[k] || 0) + add[k]; }
    for (const [list, period] of [[C.dailyObjectives(), p.day], [C.weeklyObjectives(), p.week]])
      for (const o of list) if (!period.done.includes(o.id) && (period.stats[o.stat] || 0) >= o.need) { period.done.push(o.id); p.coins += o.coins; out.objectives.push({ text: o.text, coins: o.coins }); }
    // every weekly order done: a Field Crate, once a week, kept unopened until they open it in the Store
    if (!p.week.crate && C.weeklyObjectives().every(o => p.week.done.includes(o.id))) { p.week.crate = true; p.freeCrates = (p.freeCrates || 0) + 1; out.crate = 'field'; }
    save();
    return out;
  }
  // open a crate: pay, roll, keep it (or take a refund on a duplicate)
  // free: open one of the Field Crates earned from weekly orders instead of paying
  function openBox(p, boxId, free) {
    const B = C.BOXES[boxId]; if (!B) return { err: 'No such crate' };
    if (free) { if (boxId !== 'field' || !(p.freeCrates > 0)) return { err: 'No free crate to open' }; }
    else if (p.coins < B.price) return { err: 'Need ' + B.price + ' Valor' };
    const r = C.rollBox(boxId, p.owned);
    if (free) p.freeCrates--; else p.coins -= B.price;
    if (r.dup) p.coins += r.refund; else p.owned.push(r.item);
    p.crates = (p.crates || 0) + 1; save();
    return r;
  }
  // missions: the first completion of each pays its reward
  function scenarioDone(p, id, reward) {
    p.scenarios = p.scenarios || [];
    const first = !p.scenarios.includes(id);
    if (first) { p.scenarios.push(id); p.coins += reward || 0; save(); }
    return { first, valor: first ? reward || 0 : 0 };
  }
  // dev servers only (SECTOR_DEV=1): coins for testing the store
  function grant(p, n) { p.coins += Math.max(0, n | 0); save(); }
  // dev panel: look profiles up, and hand out coins or skins
  function list(q, n = 50) {
    q = String(q || '').toLowerCase();
    return Object.values(db).filter(p => !q || p.id.startsWith(q) || (p.name || '').toLowerCase().includes(q) || (p.refCode || '').toLowerCase() === q)
      .sort((a, b) => b.created - a.created).slice(0, n)
      .map(p => ({ id: p.id, name: p.name || null, coins: p.coins, owned: p.owned.length, recruits: p.recruits || 0, created: p.created, games: (p.total || {}).games || 0, wins: (p.total || {}).wins || 0, refCode: p.refCode }));
  }
  // a commander's public card: what anyone may see by clicking their name (never coins, skins owned or secrets)
  function publicView(handle) {
    const p = Object.values(db).find(q => q.refCode && q.refCode === String(handle).toUpperCase()); if (!p) return null;
    roll(p);
    const t = p.total || {}, w = p.week.stats || {};
    return {
      handle: p.refCode, name: p.name || 'Commander', since: p.created, equipped: { banner: p.equipped.banner || null, territory: p.equipped.territory || null, border: p.equipped.border || null, trim: p.equipped.trim || null },
      stats: { games: t.games || 0, wins: t.wins || 0, kills: t.kills || 0, captured: t.captured || 0 }, week: { games: w.games || 0, wins: w.wins || 0, kills: w.kills || 0 },
      missions: (p.scenarios || []).length, recruits: p.recruits || 0, skins: p.owned.length,
    };
  }
  // leaderboard: most wins this week (or ever), kills breaking ties. Cached briefly: it walks every profile
  const boards = {};
  function leaderboard(period = 'week', n = 10) {
    const b = boards[period]; if (b && Date.now() - b.at < 20000) return b.rows;
    const wk = C.weekKey();
    const rows = Object.values(db).map(p => {
      const st = period === 'all' ? p.total || {} : (p.week && p.week.key === wk ? p.week.stats : {}) || {};
      return { handle: p.refCode, name: p.name || 'Commander', banner: p.equipped.banner || null, wins: st.wins || 0, kills: st.kills || 0, games: st.games || 0 };
    }).filter(r => r.games > 0).sort((a, b) => b.wins - a.wins || b.kills - a.kills || b.games - a.games).slice(0, n);
    boards[period] = { at: Date.now(), rows };
    return rows;
  }
  // unlock a faction with Valor
  function buyFaction(p, id) {
    if (!E.FACTIONS[id]) return 'No such faction';
    const own = C.factionsOf(p); if (own.includes(id)) return 'Already yours';
    if (p.coins < C.FACTION_PRICE) return 'Need ' + C.FACTION_PRICE + ' Valor';
    p.coins -= C.FACTION_PRICE; p.factions = [...own, id]; save();
    return null;
  }
  // ── accounts: a commander linked to a Google or Discord login, so it can be signed in to from anywhere ──
  const maskEmail = e => e ? String(e).replace(/^(.)(.*)(@.*)$/, (m, a, b, c) => a + '•'.repeat(Math.min(6, b.length)) + c) : null;
  const linksView = p => Object.fromEntries(Object.entries(p.links || {}).map(([k, v]) => [k, { name: v.name || null, email: maskEmail(v.email) }]));
  const byLink = (provider, uid) => Object.values(db).find(q => q.links && q.links[provider] && q.links[provider].id === String(uid));
  // a login comes back from Google or Discord: if that login already has a commander, that's the one you get;
  // otherwise it's attached to the commander you're playing now (so nothing you've earned is lost)
  function linkAccount(cur, provider, info) {
    const uid = String(info.id), other = byLink(provider, uid);
    const rec = { id: uid, name: info.name ? String(info.name).slice(0, 40) : null, email: info.email ? String(info.email).slice(0, 80) : null, at: Date.now() };
    if (other) { other.links[provider] = rec; save(); return { profile: other, switched: !cur || other.id !== cur.id }; }
    if (!cur) return null;
    cur.links = cur.links || {}; cur.links[provider] = rec;
    const referral = payReferral(cur); save();
    return { profile: cur, switched: false, referral };
  }
  // a recruit (joined with a friend's link) who makes an account pays both sides, once. Each Google or Discord login
  // belongs to one commander, so every payout needs a real account of its own
  function payReferral(p) {
    if (!p.referredBy || p.refPaid) return 0;
    const ref = db[p.referredBy];
    p.refPaid = true; p.coins += WELCOME_COINS;
    if (ref) { ref.coins += REF_COINS; ref.recruits = (ref.recruits || 0) + 1; if (ref.recruits >= RECRUITER_AT && !ref.owned.includes('n-recruiter')) ref.owned.push('n-recruiter'); }
    return WELCOME_COINS;
  }
  // a key for one more device (a browser that just signed in); the commander's other keys keep working
  function addDevice(p) { const s = crypto.randomBytes(24).toString('hex'); p.devices = (p.devices || []).concat(hash(s)).slice(-20); save(); return s; }
  function unlink(p, provider) { if (p.links && p.links[provider]) { delete p.links[provider]; save(); } }
  function rename(p, name) { if (!name) return; p.name = String(name).slice(0, 16); save(); }
  function giveItem(p, item) { if (!C.ITEMS[item]) return 'No such item'; if (!p.owned.includes(item)) p.owned.push(item); save(); return null; }
  function totals() { const all = Object.values(db); return { profiles: all.length, coins: all.reduce((a, p) => a + p.coins, 0), owned: all.reduce((a, p) => a + p.owned.length, 0), games: all.reduce((a, p) => a + ((p.total || {}).games || 0), 0) }; }
  return { open, view, buy, equip, openBox, finishGame, scenarioDone, grant, list, giveItem, totals, publicView, leaderboard, rename, buyFaction, linkAccount, addDevice, unlink, get: id => db[id] };
}
module.exports = { createProfiles, REF_COINS, WELCOME_COINS };
