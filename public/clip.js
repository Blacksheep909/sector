/* SECTOR — copying a link. The modern clipboard only works on https (or localhost), so a LAN game at
   http://192.168.x.x falls back to the older copy command, and failing that shows the text, selected, to copy by hand.
   copyText(text) resolves true when it's on the clipboard. */
window.copyText = async function (text) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch (e) {}
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
    document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy'); ta.remove(); if (ok) return true;
  } catch (e) {}
  // last resort: the link in a box, already selected
  let m = document.getElementById('copyBox');
  if (!m) { m = document.createElement('div'); m.id = 'copyBox'; m.className = 'modal-bg'; document.body.appendChild(m); }
  m.hidden = false; m.innerHTML = '<div class="panel copy-card"><h3>COPY THIS LINK</h3><input readonly><div class="sub">Press Ctrl+C (⌘C on a Mac), then send it to your friends.</div><button class="btn">DONE</button></div>';
  const inp = m.querySelector('input'); inp.value = text; setTimeout(() => { inp.focus(); inp.select(); }, 30);
  m.querySelector('button').onclick = () => { m.hidden = true; };
  m.onclick = e => { if (e.target === m) m.hidden = true; };
  return false;
};
