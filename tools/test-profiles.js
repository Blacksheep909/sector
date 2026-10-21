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
a.coins = 100; ok(P.buy(a, 'c-titan-blackout').startsWith('Need'), 'you need the coins');
a.coins = 5000; ok(!P.buy(a, 'c-grunt-foil') && a.owned.includes('c-grunt-foil'), 'any card version can be bought from the locker');
ok(P.equip(a, 'territory', 't-usa') === 'Not yours', 'you can only wear what you own');
ok(!P.equip(a, 'card', 'c-grunt-foil') && a.cards.grunt === 'foil' && !P.equip(a, 'card', 'c-grunt-foil') && !a.cards.grunt, 'equipping a card version twice takes it off');
ok(C.dailyStore('2027-01-01').items.join() === C.dailyStore('2027-01-01').items.join() && C.dailyStore('2027-01-01').items.join() !== C.dailyStore('2027-01-02').items.join(), 'the store is the same for everyone each day and changes daily');
let skinned = 0; for (let i = 0; i < 2000; i++) skinned += Object.keys(C.botLoadout()).length > 0;
ok(skinned > 2000 * 0.05 && skinned < 2000 * 0.15, 'about 1 bot in 10 wears a skin: ' + Math.round(skinned / 20) + '%');
try { fs.unlinkSync(f); } catch (e) {}
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
