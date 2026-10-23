// Profiles and the coin economy: node tools/test-profiles.js
const fs = require('fs'), os = require('os'), path = require('path');
const { createProfiles } = require('../profiles'); const C = require('../shared/cosmetics');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const f = path.join(os.tmpdir(), 'sector-prof-test-' + Date.now() + '.json'), P = createProfiles(f);
const a = P.open('a'.repeat(32), 's'.repeat(20), 'A'), b = P.open('b'.repeat(32), 't'.repeat(20), 'B', a.refCode);
ok(P.open('a'.repeat(32), 'x'.repeat(20)) === null, 'a wrong secret gets nothing');
ok(P.open('bad id', 's'.repeat(20)) === null, 'malformed ids are refused');
const g = { won: true, place: 1, players: 4, rounds: 20, kills: 10, captured: 40, crates: 1, vsHumans: true };
const pays = []; for (let i = 0; i < 8; i++) pays.push(P.finishGame(a, g).match);
ok(pays.every((v, i) => !i || v < pays[i - 1]) && pays[7] > 0, 'each extra match in a day pays less, but never nothing (' + pays.join(', ') + ')');
ok(P.finishGame(a, { ...g, rounds: 3 }).match === 0, 'games under 6 rounds pay nothing');
const before = a.coins; const r = P.finishGame(b, { ...g, won: false, place: 3 });
ok(r.referral === 100 && a.recruits === 1 && a.coins === before + 250, 'a recruit\'s first game pays them 100 and the recruiter 250');
ok(P.finishGame(b, g).referral === 0, 'the referral pays once');
const off = Object.keys(C.ITEMS).find(id => C.ITEMS[id].slot === 'territory' && C.ITEMS[id].buy !== false && !C.dailyStore().items.includes(id));
ok(P.buy(a, off) === 'Not in today’s store', 'territory skins out of rotation can\'t be bought');
ok(P.buy(a, 't-founder') === 'That can’t be bought', 'Founder skins are never sold');
a.coins = 100; ok(P.buy(a, C.dailyStore().items.find(id => C.ITEMS[id].price > 100)).startsWith('Need'), 'you need the Valor');
a.coins = 5000; { const card = Object.keys(C.ITEMS).find(id => C.ITEMS[id].slot === 'card' && !C.dailyStore().items.includes(id)); ok(P.buy(a, card).startsWith('Card skins come from crates'), 'card skins out of the daily store can\'t be bought outright'); }
{ const inStore = C.dailyStore().items.find(id => C.ITEMS[id].slot === 'card'); ok(!P.buy(a, inStore) && a.owned.includes(inStore), 'a card skin in the daily store can be bought'); }
{ const before = a.coins, r = P.openBox(a, 'field'); ok(!r.err && C.ITEMS[r.item].slot === 'card' && a.owned.includes(r.item) && a.coins === before - 300, 'a Field Crate costs 300 and hands over a card skin'); }
{ let mythic = 0, n = 4000, x = 1; const rng = () => (x = (x * 16807) % 2147483647) / 2147483647; for (let i = 0; i < n; i++) if (C.rollBox('field', [], rng).rarity === 'mythic') mythic++; ok(mythic > 0 && mythic < n * 0.006, 'Mythic skins are rare from a Field Crate (' + mythic + '/' + n + ')'); }
{ const all = Object.keys(C.ITEMS).filter(id => C.ITEMS[id].slot === 'card'), r = C.rollBox('elite', all); ok(r.dup && r.refund === Math.round(C.ITEMS[r.item].price * 0.3), 'a duplicate pays back 30%'); }
{ const w = P.open('c'.repeat(32), 'u'.repeat(20), 'W'); let got = 0; for (let i = 0; i < 14; i++) got += P.finishGame(w, { ...g, won: true, kills: 20, captured: 60 }).crate === 'field';
  ok(got === 1 && w.freeCrates === 1 && P.view(w).weeklyCrate, 'finishing every weekly order earns one Field Crate a week');
  const c0 = w.coins, r = P.openBox(w, 'field', true); ok(!r.err && w.freeCrates === 0 && w.coins === c0 + (r.dup ? r.refund : 0), 'the earned crate opens free');
  ok(P.openBox(w, 'field', true).err && P.openBox(w, 'elite', true).err, 'and only once, and only as a Field Crate'); }
a.cards = {}; a.owned.push('c-grunt-foil');
ok(P.equip(a, 'territory', 't-usa') === 'Not yours', 'you can only wear what you own');
ok(!P.equip(a, 'card', 'c-grunt-foil') && a.cards.grunt === 'foil' && !P.equip(a, 'card', 'c-grunt-foil') && !a.cards.grunt, 'equipping a card version twice takes it off');
ok(C.dailyStore('2027-01-01').items.join() === C.dailyStore('2027-01-01').items.join() && C.dailyStore('2027-01-01').items.join() !== C.dailyStore('2027-01-02').items.join(), 'the store is the same for everyone each day and changes daily');
let skinned = 0; for (let i = 0; i < 2000; i++) skinned += Object.keys(C.botLoadout()).length > 0;
ok(skinned > 2000 * 0.05 && skinned < 2000 * 0.15, 'about 1 bot in 10 wears a skin: ' + Math.round(skinned / 20) + '%');
try { fs.unlinkSync(f); } catch (e) {}
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
