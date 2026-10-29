/* SECTOR — host dashboard: the small window the exe opens. Talks to the server's /host API (this PC only). */
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const api = (p, post) => fetch(p, post ? { method: 'POST', headers: { 'X-Sector-Host': '1' } } : { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
  const fmtUp = ms => { const m = Math.floor(ms / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm'; };
  let info = null, misses = 0, stopArm = 0, gone = false;

  function render() {
    const h = info;
    const phase = !h.inGame ? 'Lobby open' : h.phase === 'play' ? 'War in progress · round ' + h.round : h.phase === 'over' ? 'Game over' : h.phase === 'spawn' ? 'Choosing HQs' : 'Opening draft';
    $('#hpStatus').innerHTML = `<i class="dot"></i> Online · v${esc(h.version)} · ${phase} · up ${fmtUp(h.uptime)}`;
    $('#hpAddrs').innerHTML = h.lan.length
      ? h.lan.map(a => `<div class="hp-addr"><code>${esc(a)}</code><button class="btn" data-copy="${esc(a)}">COPY</button></div>`).join('')
      : '<div class="sub">No network found. Connect to Wi-Fi to play with others. You can still play here against bots.</div>';
    const players = h.players || [];
    $('#hpCount').textContent = players.length ? '(' + players.length + ')' : '';
    $('#hpPlayers').innerHTML = players.length ? players.map(p => `<div class="hp-row" style="--pc:${esc(p.color)}"><span><i class="sw"></i>${esc(p.name)}</span><span class="tags">${p.host ? '<i class="gold">HOST</i>' : ''}${p.bot ? `<i>BOT · ${esc(p.diff || '')}</i>` : p.local ? '<i>LOCAL</i>' : p.connected ? `<i>${esc(p.addr || 'online')}</i>` : '<i class="off">DISCONNECTED</i>'}</span></div>`).join('')
      : '<div class="sub">Nobody yet. Press PLAY to open the game, or wait for friends to join.</div>';
    const u = h.update;
    let up;
    if (u.state === 'downloading') up = `<div class="hp-upd busy">Downloading v${esc(u.latest)}… <b>${u.pct}%</b><div class="bar"><i style="width:${u.pct}%"></i></div></div>`;
    else if (u.state === 'restarting') up = `<div class="hp-upd busy">Restarting into v${esc(u.latest)}…</div>`;
    else if (u.available) up = `<div class="hp-upd new"><b>v${esc(u.latest)} is out!</b> You have v${esc(h.version)}.${u.err ? `<div class="err">${esc(u.err)}</div>` : ''}
      ${u.canApply ? '<button class="btn green" id="hpDoUpdate">UPDATE &amp; RESTART</button>' : `<a class="btn green" href="${esc(u.page)}" target="_blank">DOWNLOAD</a>`}</div>`;
    else up = `<div class="hp-upd">${u.latest ? 'Up to date (latest is v' + esc(u.latest) + ')' : u.checked ? "Couldn't reach GitHub to check" : 'Checking…'} <button class="btn ghost" id="hpCheck">CHECK</button></div>`;
    $('#hpUpdate').innerHTML = up;
    $('#hpStop').textContent = stopArm > Date.now() ? 'CLICK AGAIN TO STOP' : 'STOP SERVER';
    $('#hpFoot').textContent = h.packaged ? 'Closing this window keeps the server up while anyone is playing. It shuts down a minute after everyone leaves.' : 'Running from source.';
    document.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { copyText(b.dataset.copy); b.textContent = 'COPIED'; setTimeout(() => { b.textContent = 'COPY'; }, 1200); });
    if ($('#hpDoUpdate')) $('#hpDoUpdate').onclick = async () => { await api('/host/update', true); poll(); };
    if ($('#hpCheck')) $('#hpCheck').onclick = async () => { await api('/host/check', true); setTimeout(poll, 1500); };
  }
  function showGone(title, sub) { gone = true; $('#hpGoneT').textContent = title; $('#hpGoneS').textContent = sub; $('#hpGone').hidden = false; }
  async function poll() {
    if (gone && !(info && info.update.state === 'restarting')) return;
    const h = await api('/host');
    if (!h) {
      if (info && info.update.state === 'restarting') { showGone('UPDATING', 'Restarting into the new version…'); return; }
      if (++misses >= 3) showGone('SERVER STOPPED', 'You can close this window.');
      return;
    }
    if (gone && info && info.update.state === 'restarting' && h.version !== info.version) { location.reload(); return; }
    misses = 0; info = h; if (!gone) render();
  }
  $('#hpPlay').onclick = () => api('/host/play', true);
  $('#hpStop').onclick = async () => {
    if (stopArm < Date.now()) { stopArm = Date.now() + 3000; if (info) render(); setTimeout(() => info && render(), 3100); return; }
    await api('/host/stop', true); showGone('SERVER STOPPED', 'You can close this window.');
  };
  poll(); setInterval(poll, 1500);
})();
