// Accounts (sign in with Google / Discord) end to end, using the offline test provider: node tools/test-accounts.js
// Starts its own server on port 3017 with SECTOR_AUTH_MOCK=1.
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const PORT = 3017, U = 'http://localhost:' + PORT, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sector-acct-'));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, SECTOR_NO_OPEN: '1', SECTOR_PLAIN: '1', SECTOR_NO_UPDATE: '1', SECTOR_DEV: '1', SECTOR_AUTH_MOCK: '1', SECTOR_START_VALOR: '0', SECTOR_SAVES: dir, SECTOR_PROFILES: path.join(dir, 'p.json') }, stdio: 'ignore' });
const until = async (f, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (f()) return true; await sleep(40); } return false; };
function client(identity, ref) {
  const ws = new WebSocket('ws://localhost:' + PORT), c = { ws, msgs: [], identity };
  ws.onmessage = e => { const m = JSON.parse(e.data); c.msgs.push(m); if (m.t === 'profile') c.profile = m.profile; };
  c.send = o => ws.send(JSON.stringify(o));
  c.last = t => [...c.msgs].reverse().find(m => m.t === t);
  c.open = new Promise(r => { ws.onopen = () => { c.send({ t: 'auth', profile: identity, ref }); r(); }; });
  return c;
}
// what the browser does: go to the provider, come back to the callback, collect the one-time code
async function signIn(c, provider, mockUser) {
  c.msgs.length = 0; c.send({ t: 'authStart', provider, mockUser });
  await until(() => c.last('authGo') || c.last('err'));
  const go = c.last('authGo'); if (!go) return { err: (c.last('err') || {}).msg };
  const r = await fetch(go.url, { redirect: 'manual' });
  const back = new URL(r.headers.get('location'), U), code = back.searchParams.get('login');
  if (!code) return { err: back.searchParams.get('loginError') };
  c.send({ t: 'authClaim', code }); await until(() => c.last('authDone'));
  return { ...c.last('authDone'), code };
}
(async () => {
  try {
    await sleep(1200);
    const idA = { id: 'a'.repeat(32), secret: 'device-a-secret-xx' }, idB = { id: 'b'.repeat(32), secret: 'device-b-secret-xx' };
    const a = client(idA); await a.open; await until(() => a.profile);
    ok(await until(() => a.msgs.some(m => m.t === 'menu' && (m.logins || []).includes('mock'))), 'the menu lists the sign-in options this server has');
    const none = await signIn(a, 'google'); ok(/isn.t set up/.test(none.err || ''), 'a provider without keys is refused');
    a.send({ t: 'devCoins' }); await until(() => a.profile.coins >= 5000);
    // link this commander to a login: progress stays where it is
    const r1 = await signIn(a, 'mock', 'alice');
    ok(r1.ok && !r1.switched && !r1.identity, 'signing in keeps your current commander (and its progress)');
    a.send({ t: 'profile' }); await until(() => a.profile.links && a.profile.links.mock);
    ok(a.profile.links.mock && a.profile.links.mock.name === 'alice' && /•/.test(a.profile.links.mock.email), 'the commander shows which login it is saved to (email masked)');
    // a second device signs in with the same login: it gets that commander
    const b = client(idB); await b.open; await until(() => b.profile);
    ok(b.profile.coins === 0, 'a new device starts as a fresh guest');
    const r2 = await signIn(b, 'mock', 'alice');
    ok(r2.ok && r2.switched && r2.identity && r2.identity.id === idA.id, 'signing in on another device hands it the saved commander');
    b.ws.close(); const b2 = client(r2.identity); await b2.open; await until(() => b2.profile);
    ok(b2.profile && b2.profile.coins >= 5000 && b2.profile.handle === a.profile.handle, 'that device now has the same Valor and commander');
    const a2 = client(idA); await a2.open; await until(() => a2.profile);
    ok(a2.profile && a2.profile.handle === a.profile.handle, 'and the first device keeps working');
    // codes are single-use, and a forged callback gets nowhere
    b2.msgs.length = 0; b2.send({ t: 'authClaim', code: r2.code }); await until(() => b2.last('authDone'));
    ok(b2.last('authDone').ok === false, 'a sign-in code only works once');
    const forged = await fetch(U + '/auth/mock/callback?state=nope&code=mock:eve', { redirect: 'manual' });
    ok(/loginError/.test(forged.headers.get('location') || ''), 'a callback without a matching sign-in is refused');
    // a different login on a fresh device: a new link, no switch
    const c = client({ id: 'c'.repeat(32), secret: 'device-c-secret-xx' }); await c.open; await until(() => c.profile);
    const r3 = await signIn(c, 'mock', 'bob'); ok(r3.ok && !r3.switched, 'a new login just saves the commander you have');
    // a recruit (joined with a friend's link) who makes an account: the welcome bonus, and the friend's recruit count
    const d = client({ id: 'd'.repeat(32), secret: 'device-d-secret-xx' }, a2.profile.handle); await d.open; await until(() => d.profile);
    const r4 = await signIn(d, 'mock', 'carol'); ok(r4.ok && r4.referral === 100, 'a recruit making an account gets the welcome bonus');
    a2.send({ t: 'profile' }); ok(await until(() => a2.profile.recruits === 1), 'and counts as the recruiter’s recruit');
    // signing out of the link (unlink) leaves the commander, minus the login
    a2.send({ t: 'authUnlink', provider: 'mock' }); await until(() => a2.profile && !(a2.profile.links || {}).mock);
    ok(!(a2.profile.links || {}).mock, 'a login can be unlinked');
  } catch (e) { console.error(e); fails++; }
  srv.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
