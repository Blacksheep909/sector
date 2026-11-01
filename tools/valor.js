#!/usr/bin/env node
// Give a player Valor from the terminal, on a running server (local or hosted).
//
//   SECTOR_DEV_KEY=yourkey node tools/valor.js <name | handle | profile id> <amount> [--host http://localhost:3000]
//   SECTOR_DEV_KEY=yourkey node tools/valor.js --list [search]          (find a player first)
//
// It talks to the server's dev API, so the server must have been started with the same SECTOR_DEV_KEY. The host defaults
// to SECTOR_HOST or http://localhost:3000. Several players matching the name: it lists them and changes nothing; run it
// again with the handle or the profile id. The player sees the new balance the next time their profile refreshes.
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const host = (opt('--host') || process.env.SECTOR_HOST || 'http://localhost:3000').replace(/\/$/, '');
const key = process.env.SECTOR_DEV_KEY;
const die = m => { console.error(m); process.exit(1); };
if (!key) die('Set SECTOR_DEV_KEY to the key the server was started with.');

async function api(route, body) {
  let r;
  try { r = await fetch(host + '/dev/api/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-dev-key': key }, body: JSON.stringify(body || {}) }); }
  catch (e) { die('Could not reach ' + host + ' (' + e.message + ')'); }
  if (r.status === 404 && route !== 'grant') die('That server has no dev API: start it with SECTOR_DEV_KEY set.');
  if (r.status === 401) die('Wrong SECTOR_DEV_KEY for ' + host + '.');
  const j = await r.json().catch(() => ({}));
  if (!r.ok) die((j && j.err) || ('HTTP ' + r.status));
  return j;
}
const row = p => `${(p.name || '(no name)').padEnd(20)} handle ${String(p.refCode || '-').padEnd(8)} id ${p.id.slice(0, 12)}…  ${String(p.coins).padStart(7)} Valor  ${p.games} wars`;

(async () => {
  if (args[0] === '--list') {
    const { profiles } = await api('profiles', { q: args[1] || '' });
    if (!profiles.length) return console.log('No players match.');
    for (const p of profiles) console.log(row(p));
    return;
  }
  const [who, amt] = args;
  const n = Math.floor(Number(amt));
  if (!who || !Number.isFinite(n) || n <= 0) die('Usage: node tools/valor.js <name | handle | profile id> <amount>   (or --list [search])');
  const { profiles } = await api('profiles', { q: who });
  // an exact handle, id or name beats a partial name match
  const lw = who.toLowerCase();
  const exact = profiles.filter(p => p.id === who || (p.refCode || '').toLowerCase() === lw || (p.name || '').toLowerCase() === lw);
  const pick = exact.length === 1 ? exact : profiles;
  if (!pick.length) die('No player matches "' + who + '". Try: node tools/valor.js --list');
  if (pick.length > 1) { console.log('Several players match "' + who + '"; run again with a handle or id:'); for (const p of pick) console.log('  ' + row(p)); process.exit(2); }
  const p = pick[0];
  const r = await api('grant', { profile: p.id, coins: n });
  console.log(`Gave ${n} Valor to ${p.name || p.id}: ${p.coins} → ${r.coins}`);
})();
