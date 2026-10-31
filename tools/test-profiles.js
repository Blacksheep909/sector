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
ok(P.finishGame(a, { ...g, minutes: 3 }).match === 0, 'games under 5 minutes pay nothing');
ok(P.finishGame(a, { ...g, minutes: 20, kills: 9 }).match === 0, 'fewer than 10 kills pays nothing');
{ const before = a.total.games || 0, l = P.finishGame(a, { ...g, minutes: 12, kills: 14, left: true, won: false, place: 4 });
  ok(l.match > 0 && (a.total.games || 0) === before, 'leaving mid-war pays for what you did, but is not a finished game'); }
{ const before = a.coins; P.finishGame(b, { ...g, won: false, place: 3 }); ok(a.recruits === 0 && a.coins === before, 'a recruit playing a game pays no referral'); P.finishGame(b, g);
  const r = P.linkAccount(b, 'google', { id: 'g-b' }); ok(r.referral === 100 && a.recruits === 1 && a.coins === before + 250, 'a recruit making an account pays them 100 and the recruiter 250');
  P.unlink(b, 'google'); ok(!P.linkAccount(b, 'discord', { id: 'd-b' }).referral && a.recruits === 1, 'the referral pays once'); }
ok(!P.linkAccount(a, 'google', { id: 'g-a' }).referral, 'no referral without a recruit link');
const off = Object.keys(C.ITEMS).find(id => C.ITEMS[id].slot === 'territory' && C.ITEMS[id].buy !== false && !C.dailyStore().items.includes(id));
a.coins = C.ITEMS[off].price * 3 - 1; ok(P.buy(a, off).startsWith('Need'), 'out of rotation it costs 3× its shop price');
a.coins = C.ITEMS[off].price * 3; ok(!P.buy(a, off) && a.coins === 0 && a.owned.includes(off), 'and you can buy it at that price any day');
{ const flags = Object.values(C.ITEMS).filter(i => i.country); ok(flags.length >= 20 && flags.every(i => i.price === flags[0].price), 'every country flag costs the same (' + flags[0].price + ')'); }
ok(P.buy(a, 't-founder') === 'That can’t be bought', 'Founder skins are never sold');
a.coins = 100; ok(P.buy(a, C.dailyStore().items.find(id => C.ITEMS[id].price > 100)).startsWith('Need'), 'you need the Valor');
a.coins = 5000; { const card = Object.keys(C.ITEMS).find(id => C.ITEMS[id].slot === 'card' && !C.dailyStore().items.includes(id)), before = a.coins; ok(/daily store and crates/.test(P.buy(a, card) || '') && a.coins === before && !a.owned.includes(card), 'card skins out of the daily store can\'t be bought (only from the store or crates)'); }
{ const g2 = createProfiles(f + '.g', { startValor: 30000 }), n = g2.open('e'.repeat(32), 'grant-secret-xxxxxxxx'); ok(n.coins === 30000, 'the starting grant'); n.coins = 10; ok(g2.open('e'.repeat(32), 'grant-secret-xxxxxxxx').coins === 10, 'is given once per commander'); try { fs.unlinkSync(f + '.g'); } catch (e) {} }
{ const inStore = C.dailyStore().items.find(id => C.ITEMS[id].slot === 'card'); ok(!P.buy(a, inStore) && a.owned.includes(inStore), 'a card skin in the daily store can be bought'); }
{ const before = a.coins, r = P.openBox(a, 'field'); ok(!r.err && C.ITEMS[r.item].slot === 'card' && a.owned.includes(r.item) && a.coins === before - 300, 'a Field Crate costs 300 and hands over a card skin'); }
{ let mythic = 0, n = 4000, x = 1; const rng = () => (x = (x * 16807) % 2147483647) / 2147483647; for (let i = 0; i < n; i++) if (C.rollBox('field', [], rng).rarity === 'mythic') mythic++; ok(mythic > 0 && mythic < n * 0.006, 'Mythic skins are rare from a Field Crate (' + mythic + '/' + n + ')'); }
{ const all = Object.keys(C.ITEMS).filter(id => C.ITEMS[id].slot === 'card'), r = C.rollBox('elite', all); ok(r.dup && r.refund === Math.round(C.ITEMS[r.item].price * 0.3), 'a duplicate pays back 30%'); }
{ const w = P.open('c'.repeat(32), 'u'.repeat(20), 'W'); let got = 0; for (let i = 0; i < 14; i++) got += P.finishGame(w, { ...g, won: true, kills: 20, captured: 60 }).crate === 'field';
  ok(got === 1 && w.freeCrates === 1 && P.view(w).weeklyCrate, 'finishing every weekly order earns one Field Crate a week');
  const c0 = w.coins, r = P.openBox(w, 'field', true); ok(!r.err && w.freeCrates === 0 && w.coins === c0 + (r.dup ? r.refund : 0), 'the earned crate opens free');
  ok(P.openBox(w, 'field', true).err && P.openBox(w, 'elite', true).err, 'and only once, and only as a Field Crate'); }
{ const f = P.open('d'.repeat(32), 'v'.repeat(20), 'F'); ok(P.view(f).factions.join() === C.FACTION_START, 'a new commander starts with one faction');
  f.coins = 100; ok(P.buyFaction(f, 'volt').startsWith('Need'), 'unlocking a faction costs Valor');
  f.coins = C.FACTION_PRICE; ok(!P.buyFaction(f, 'volt') && f.coins === 0 && P.view(f).factions.includes('volt'), 'unlocking pays ' + C.FACTION_PRICE + ' and adds it');
  ok(P.buyFaction(f, 'volt') === 'Already yours' && P.buyFaction(f, C.FACTION_START) === 'Already yours', 'nothing is bought twice'); }
{ const m = P.open('e'.repeat(32), 'w'.repeat(20), 'M'), c0 = m.coins; const r1 = P.scenarioDone(m, 'basic', 100), r2 = P.scenarioDone(m, 'basic', 100);
  ok(r1.first && r1.valor === 100 && !r2.first && r2.valor === 0 && m.coins === c0 + 100, 'a mission pays its Valor on the first clear only'); }
a.cards = {}; a.owned.push('c-grunt-foil');
ok(P.equip(a, 'territory', Object.keys(C.ITEMS).find(id => C.ITEMS[id].slot === 'territory' && !a.owned.includes(id))) === 'Not yours', 'you can only wear what you own');
ok(!P.equip(a, 'card', 'c-grunt-foil') && a.cards.grunt === 'foil' && !P.equip(a, 'card', 'c-grunt-foil') && !a.cards.grunt, 'equipping a card version twice takes it off');
ok(C.dailyStore('2027-01-01').items.join() === C.dailyStore('2027-01-01').items.join() && C.dailyStore('2027-01-01').items.join() !== C.dailyStore('2027-01-02').items.join(), 'the store is the same for everyone each day and changes daily');
let skinned = 0; for (let i = 0; i < 2000; i++) skinned += Object.keys(C.botLoadout()).length > 0;
ok(skinned > 2000 * 0.05 && skinned < 2000 * 0.15, 'about 1 bot in 10 wears a skin: ' + Math.round(skinned / 20) + '%');
try { fs.unlinkSync(f); } catch (e) {}
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
