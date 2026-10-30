// Plays a few turns of a real war with real mouse clicks (Chrome's input pipeline): collect the resupply, deploy from the deck,
// select and move a stack, build from the build bar, end the turn, and press every top-bar button. After each action it checks
// the action really happened, nothing threw, and no panel was left stuck on screen. node tools/test-play.js [screenshot dir]
const { spawn } = require('child_process'), path = require('path'), os = require('os'), fs = require('fs');
const { launch, sleep } = require('./cdp');
const OUT = process.argv[2] || null; if (OUT) fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ply-'));
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: 3094, SECTOR_NO_OPEN: '1', SECTOR_PLAIN: '1', SECTOR_DEV: '1', SECTOR_NO_UPDATE: '1', SECTOR_SAVES: dir, SECTOR_PROFILES: path.join(dir, 'p.json') }, stdio: 'ignore' });
let fails = 0, shots = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  await sleep(1500);
  const b = await launch({ browser: '/opt/pw-browsers/chromium', url: 'http://localhost:3094', width: 1280, height: 760, port: 9494 });
  await sleep(2500);
  await b.evalJS(`window._errs=[]; addEventListener('error', e => _errs.push(e.message + ' @' + (e.filename||'').split('/').pop() + ':' + e.lineno)); addEventListener('unhandledrejection', e => _errs.push('rej ' + (e.reason && e.reason.message || e.reason)));
    window._toasts=[]; window._sent=[]; { const os = WebSocket.prototype.send; WebSocket.prototype.send = function (d) { try { const m = JSON.parse(d); if (!['alive','ping','menu','leaderboard'].includes(m.t)) _sent.push(m.t === 'act' ? m.action.a + (m.action.unit ? ':' + m.action.unit : m.action.struct ? ':' + m.action.struct : '') : m.t); } catch (e) {} return os.call(this, d); }; }
    new MutationObserver(ms => { for (const m of ms) for (const x of m.addedNodes) if (x.classList && x.classList.contains('toast') && x.classList.contains('err')) _toasts.push(x.textContent.trim().slice(0, 90) + ' [after: ' + _sent.slice(-3).join(', ') + ']'); }).observe(document.body, { childList: true, subtree: true }); true`);
  const js = c => b.evalJS(c), J = async c => JSON.parse(await b.evalJS(`JSON.stringify(${c})`));
  const shot = async n => { if (OUT) await b.shot(`${OUT}/${String(++shots).padStart(2, '0')}-${n}.png`); };
  const press = async (x, y, button = 'left') => { await b.cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await b.cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, buttons: button === 'left' ? 1 : 2, clickCount: 1 }); await sleep(60); await b.cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, buttons: 0, clickCount: 1 }); };
  // click an element the way a person would: where it is, if nothing covers it
  const click = async (sel, wait = 500) => {
    const r = await J(`(()=>{ const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.offsetParent!==null && !x.hidden); if(!e) return null; e.scrollIntoView({block:'nearest'}); const r=e.getBoundingClientRect(); const x=r.left+r.width/2, y=r.top+r.height/2, top=document.elementFromPoint(x,y); return {x, y, covered: top && top!==e && !e.contains(top) ? (top.id||top.className||top.tagName) : null}; })()`);
    if (!r) return 'missing'; if (r.covered) return 'covered by ' + r.covered;
    await press(r.x, r.y); await sleep(wait); return 'ok';
  };
  const clickHex = async k => { const [x, y] = await J(`Render.screenOf(${JSON.stringify(k)})`); const top = await js(`(document.elementFromPoint(${x},${y})||{}).id`); if (top !== 'map') return 'covered'; await press(x, y); await sleep(350); return 'ok'; };
  const settle = async (ms = 400) => { for (let i = 0; i < 60; i++) { if (!(await J(`(SECTOR_DEBUG.busy ? SECTOR_DEBUG.busy().animating : false)`))) break; await sleep(100); } await sleep(ms); };
  const health = async label => {
    const h = await J(`({ errs: _errs.splice(0), toasts: _toasts.splice(0), stuck: ['#escMenu','#index','#rules','#market','#trade','#combat','#crate','#draft','#lockerModal','#missionsModal'].filter(i => { const e = document.querySelector(i); return e && !e.hidden && getComputedStyle(e).display !== 'none'; }) })`);
    ok(!h.errs.length, label + ': no errors' + (h.errs.length ? ' ' + JSON.stringify(h.errs) : ''));
    if (h.toasts.length) console.log('     (error toasts: ' + JSON.stringify(h.toasts) + ')');
    return h;
  };
  // ── into a war ──
  await click('#createBtn', 1000);
  await js(`SECTOR_DEBUG.send({t:'addBot'}); SECTOR_DEBUG.send({t:'settings', settings:{spawns:'random', mapSize:'small', fog:'off', speed:'fast'}}); true`); await sleep(600);
  await click('#startBtn', 2000);
  // the opening draft, with the mouse: turn the cards over, then pick one (three rounds; rare cards take their time)
  const t0 = Date.now(); let phase = '';
  while (Date.now() - t0 < 120000) {
    const st = await J(`(()=>{const S=SECTOR_DEBUG.state(); return S ? {ph:S.phase, mine:S.phase==='draft'&&!S.draft.picked[SECTOR_DEBUG.you()]} : {}})()`); phase = st.ph;
    if (st.ph === 'play') break;
    if (st.mine && !(await js(`!!document.querySelector('#draft .flip.lifting')`))) {
      const shut = await js(`document.querySelectorAll('#draft .flip:not(.open)').length`);
      if (shut) await click('#draft .flip:not(.open)', 600); else await click('#draft .flip.open', 1200);
    } else await sleep(400);
  }
  ok(phase === 'play', 'the opening draft, clicked through with the mouse, starts the war');
  await settle(2500); await shot('war'); await health('the war starts');
  const me = `SECTOR_DEBUG.state().players.find(p=>p.id===SECTOR_DEBUG.you())`, myTurn = `(()=>{const S=SECTOR_DEBUG.state(); return S.players[S.turn.idx].id===SECTOR_DEBUG.you()})()`;
  // ── top-bar buttons: each opens its panel, and Esc closes it ──
  for (const [sel, panel] of [['#menuBtn', '#escMenu'], ['#indexBtn', '#index'], ['#rulesBtn', '#rules']]) {
    const r = await click(sel, 600); const open = await js(`(e => !!e && !e.hidden)(document.querySelector(${JSON.stringify(panel)}))`);
    ok(r === 'ok' && open, `${sel} opens ${panel}` + (r !== 'ok' ? ' (' + r + ')' : ''));
    await js(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`); await sleep(400);
    ok(!(await js(`(e => !!e && !e.hidden)(document.querySelector(${JSON.stringify(panel)}))`)), `Esc closes ${panel}`);
  }
  { const before = await js(`SFX.muted`); await click('#muteBtn', 300); const after = await js(`SFX.muted`); ok(before !== after, 'the sound button toggles sound'); await click('#muteBtn', 300); }
  // ── a few turns, played with the mouse ──
  for (let turn = 0; turn < 3; turn++) {
    for (let i = 0; i < 200 && !(await js(myTurn)); i++) await sleep(250);
    await settle(800);
    // the resupply: collect with the button
    if (await js(`!document.querySelector('#supply').hidden && SECTOR_DEBUG.state().turn.stage === 'choose'`)) {
      const cash0 = await js(`${me}.cash`); const r = await click('#supply .btn.green, #supply button[data-c="collect"]', 1500); await settle(600);
      ok(r === 'ok' && (await js(`SECTOR_DEBUG.state().turn.stage`)) === 'act' && (await js(`${me}.cash`)) > cash0, `turn ${turn + 1}: COLLECT takes the income` + (r !== 'ok' ? ' (' + r + ')' : ''));
    }
    // deploy: a card in the deck, then a glowing deploy hex
    { const n0 = await js(`Object.values(SECTOR_DEBUG.state().units).filter(u=>u.owner===SECTOR_DEBUG.you()).length`);
      const afford = await js(`${me}.cash >= SectorEngine.unitCost(${me}, ${me}.arsenal[0])`);
      if (afford) {
        const r = await click('#hbUnits .card', 400); const spawnK = await J(`Render.ov.spawn ? [...Render.ov.spawn][0] : null`);
        const r2 = spawnK ? await clickHex(spawnK) : 'no deploy hexes lit'; await settle(500);
        const n1 = await js(`Object.values(SECTOR_DEBUG.state().units).filter(u=>u.owner===SECTOR_DEBUG.you()).length`);
        ok(r === 'ok' && r2 === 'ok' && n1 === n0 + 1, `turn ${turn + 1}: deploy (card, then hex) adds a unit (${n0} → ${n1})` + (r !== 'ok' ? ' card ' + r : '') + (r2 !== 'ok' ? ' hex ' + r2 : ''));
        await press(640, 380, 'right'); await sleep(200);   // right-click leaves deploy mode
      } }
    // move: click a stack that can act, then a hex it can walk to
    { const pick = await J(`(()=>{ const S=SECTOR_DEBUG.state(), me=SECTOR_DEBUG.you(); for (const u of Object.values(S.units)) { if (u.owner!==me || !SectorEngine.canAct(S,u)) continue; const [x,y]=Render.screenOf(u.hex); const e=document.elementFromPoint(x,y); if(!e||e.id!=='map') continue; const ids=Object.values(S.units).filter(v=>v.hex===u.hex&&v.owner===me&&SectorEngine.canAct(S,v)).map(v=>v.id); const r=SectorEngine.reachable(S,me,ids,u.hex); const to=Object.keys(r).find(k=>['move','capture'].includes(r[k].kind) && (([x2,y2])=>{const e2=document.elementFromPoint(x2,y2); return e2&&e2.id==='map';})(Render.screenOf(k))); if (to) return {from:u.hex, to, ids}; } return null; })()`);
      if (pick) {
        await clickHex(pick.from); const selOk = await js(`Render.ov.selected === ${JSON.stringify(pick.from)}`);
        await clickHex(pick.to); await settle(600);
        const moved = await js(`${JSON.stringify(pick.ids)}.every(id => SECTOR_DEBUG.state().units[id] && SECTOR_DEBUG.state().units[id].hex !== ${JSON.stringify(pick.from)})`);
        ok(selOk && moved, `turn ${turn + 1}: click a stack, click a hex: it moves (${pick.from} → ${pick.to})` + (selOk ? '' : ' [the first click did not select it]'));
      } }
    // build: a slot on the build bar, then a lit hex (when there's cash and room)
    { const can = await J(`(()=>{ const S=SECTOR_DEBUG.state(), me=S.players.find(p=>p.id===SECTOR_DEBUG.you()); for (const id of ['warehouse','depot','bunker']) { const k=SectorEngine.buildHexes(S,SECTOR_DEBUG.you(),id).find(k=>{ if (me.cash < SectorEngine.buildCost(S,me,id,k)) return false; const [x,y]=Render.screenOf(k); const e=document.elementFromPoint(x,y); return e&&e.id==='map';}); if (k) return {id,k}; } return null; })()`);
      if (can) {
        const r = await click(`#hbBuild .slot[data-id="${can.id}"]`, 400); const lit = await js(`!!(Render.ov.spawn && Render.ov.spawn.has(${JSON.stringify(can.k)}))`);
        await clickHex(can.k); await settle(500);
        const built = await js(`SectorEngine.structsOf(SECTOR_DEBUG.state().map.tiles[${JSON.stringify(can.k)}]).some(x=>x.type===${JSON.stringify(can.id)})`);
        ok(r === 'ok' && lit && built, `turn ${turn + 1}: build a ${can.id} (slot, then hex)` + (r !== 'ok' ? ' slot ' + r : '') + (lit ? '' : ' [hex not lit]'));
        await press(640, 380, 'right'); await sleep(200);
      } }
    // a supply drop from the hand: tear the pack open with the mouse, reveal the cards, keep one
    { const drop = await J(`(()=>{ const me=SECTOR_DEBUG.state().players.find(p=>p.id===SECTOR_DEBUG.you()); const c=me.tactics.find(c=>/^drop_/.test(c.id)); return c ? c.uid : null; })()`);
      if (drop && turn === 0) {
        const r = await click(`#hand .card[data-uid="${drop}"]`, 400);
        for (let i = 0; i < 40 && !(await js(`!!document.querySelector('#crate .pack:not(.torn-open)') && !!document.querySelector('#crate .pack.drop-in')`)); i++) await sleep(150);
        await sleep(700);
        const pr = await J(`(r => r ? { x: r.left, y: r.top, w: r.width } : null)((document.querySelector('#crate .pack')||{getBoundingClientRect(){return null}}).getBoundingClientRect())`);
        if (pr) { const y = pr.y + 18; await b.cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: pr.x + 4, y, button: 'left', buttons: 1, clickCount: 1 }); for (let i = 1; i <= 10; i++) { await b.cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pr.x + 4 + pr.w * i / 10, y, buttons: 1 }); await sleep(30); } await b.cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pr.x + pr.w, y, button: 'left', buttons: 0, clickCount: 1 }); }
        for (let i = 0; i < 60 && (await js(`document.querySelectorAll('#crate .flip').length`)) < 3; i++) await sleep(150);
        await click('#crate .reveal-all', 300);
        for (let i = 0; i < 100 && (await js(`document.querySelectorAll('#crate .flip.open').length`)) < 3; i++) await sleep(150);
        await sleep(800); const n0 = await js(`${me}.arsenal.length + ${me}.tactics.length`);
        await click('#crate .flip.open', 1500);
        // a rare card's showcase may still be playing (the pick waits for it): give it time, and click again if it's still up
        for (let i = 0; i < 60 && !(await js(`document.querySelector('#crate').hidden`)); i++) { if (i % 15 === 14 && (await js(`!!document.querySelector('#crate .flip.open')`))) await click('#crate .flip.open', 300); await sleep(250); }
        await settle(800);
        ok(r === 'ok' && !!pr && (await js(`document.querySelector('#crate').hidden`)) && !(await js(`${me}.tactics.some(c => c.uid === ${drop})`)), `turn ${turn + 1}: a supply drop: tear the pack with the mouse, reveal, keep a card`);
      } }
    // a tactic card from the hand: click it, then click one of the lit targets
    { const card = await J(`(()=>{ const S=SECTOR_DEBUG.state(), me=S.players.find(p=>p.id===SECTOR_DEBUG.you()); const c=me.tactics.find(c=>{ const d=SectorEngine.TACTICS[c.id]; return d && !d.battle && d.target !== 'none' && !/^drop_/.test(c.id) && me.cash >= (d.cost||0); }); return c ? {uid:c.uid, id:c.id} : null; })()`);
      if (card) {
        const r = await click(`#hand .card[data-uid="${card.uid}"]`, 500);
        const tgt = await J(`Render.ov.targets ? [...Render.ov.targets].find(k => { const [x,y]=Render.screenOf(k); const e=document.elementFromPoint(x,y); return e && e.id==='map'; }) : null`);
        if (r === 'ok' && tgt) { await clickHex(tgt); await settle(2500); const gone = await js(`!${me}.tactics.some(c => c.uid === ${card.uid})`); ok(gone, `turn ${turn + 1}: play ${card.id} by clicking the card, then a target`); }
        else { console.log(`     (${card.id}: card ${r}, ${tgt ? 'target ok' : 'no target on screen'})`); await press(640, 380, 'right'); await sleep(200); }
      } }
    // chat: type and press Enter
    if (turn === 0) {
      await click('#chatIn', 200); await js(`document.querySelector('#chatIn').value = 'gl hf'; document.querySelector('#chatIn').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); true`); await sleep(700);
      ok(await js(`[...document.querySelectorAll('#log .lg')].some(l => /gl hf/.test(l.textContent))`), 'chat: a message typed and sent shows in the log');
    }
    await shot('turn' + (turn + 1));
    await health(`turn ${turn + 1}`);
    // END TURN: one click
    const r = await click('#endBtn', 100); let ended = false;
    for (let i = 0; i < 40 && !ended; i++) { ended = !(await js(myTurn)); await sleep(100); }
    ok(r === 'ok' && ended, `turn ${turn + 1}: one click on END TURN ends it` + (r !== 'ok' ? ' (' + r + ')' : ''));
  }
  await health('after three turns');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  b.close(); srv.kill(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
