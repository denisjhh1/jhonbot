'use strict';
const $ = (t, a = {}, ...kids) => {
  const e = document.createElement(t);
  for (const [k, v] of Object.entries(a)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
};
const api = async (path, body) => {
  const r = await fetch('/api/' + path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'dashboard' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== 'login') { showLogin(); throw new Error('Belum login'); }
  if (!r.ok) throw new Error(j.error || 'Gagal (' + r.status + ')');
  return j;
};
const root = document.getElementById('app');
let S = null, D = { ready: false, channels: [], roles: [] };
let cur = 'bot', query = '';
const dirty = {};   // path -> nilai baru
const resetSet = new Set();
const typeLabel = { 0: 'text', 2: 'voice', 4: 'kategori', 5: 'news', 15: 'forum', 16: 'media' };

function toast(msg, bad) {
  const t = $('div', { class: 'toast' + (bad ? ' bad' : '') }, msg);
  document.body.append(t); setTimeout(() => t.remove(), bad ? 7000 : 3500);
}

function showLogin() {
  root.replaceChildren();
  const pw = $('input', { type: 'password', placeholder: 'Password dashboard', autofocus: true });
  const go = async () => { try { await api('login', { password: pw.value }); await boot(); } catch (e) { toast(e.message, true); } };
  pw.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  root.append($('div', { class: 'login' }, $('h1', {}, '🔐 Pengaturan Bot'), pw, $('p', {}, $('button', { class: 'btn pri', onclick: go }, 'Masuk'))));
}

// ----- helpers Discord -----
const options = (pick) => {
  if (pick === 'role') return D.roles.map((r) => ({ id: r.id, label: '@' + r.name }));
  if (pick === 'category') return D.channels.filter((c) => c.type === 4).map((c) => ({ id: c.id, label: '📁 ' + c.name }));
  if (pick === 'channel') return D.channels.filter((c) => c.type !== 4).map((c) => ({ id: c.id, label: '#' + c.name + (c.parent ? '  (' + c.parent + ')' : '') }));
  return [];
};
const nameOf = (pick, id) => {
  if (!D.ready || !id || pick === 'user' || !pick) return null;
  const o = options(pick).find((x) => x.id === id) || (pick === 'channel' ? options('category').find((x) => x.id === id) : null);
  return o ? o.label : false;
};
const val = (p) => (p in dirty ? dirty[p] : S.values[p]);
const setVal = (p, v, row) => { dirty[p] = v; resetSet.delete(p); row?.classList.add('dirty'); refreshSave(); };

function picker(pick, onPick) {
  const list = options(pick);
  if (!list.length) return null;
  const s = $('select', { onchange: () => { if (s.value) onPick(s.value); s.value = ''; } }, $('option', { value: '' }, 'pilih dari server…'), list.map((o) => $('option', { value: o.id }, o.label)));
  return s;
}

function control(f, row) {
  const p = f.path, v = val(p);
  switch (f.type) {
    case 'bool': {
      const c = $('input', { type: 'checkbox' }); c.checked = !!v;
      c.addEventListener('change', () => setVal(p, c.checked, row));
      return $('label', { class: 'switch' }, c, $('span', {}, 'Aktif'));
    }
    case 'number': {
      const i = $('input', { type: 'number', value: v, min: f.min, max: f.max, step: 'any' });
      i.addEventListener('input', () => setVal(p, i.value === '' ? '' : Number(i.value), row)); return i;
    }
    case 'secret': {
      const i = $('input', { type: 'password', autocomplete: 'new-password', placeholder: S.secretSet[p] ? '•••••• (tersimpan, kosongkan jika tidak diubah)' : 'belum diisi' });
      i.addEventListener('input', () => setVal(p, i.value, row)); return i;
    }
    case 'select': {
      const s = $('select', {}, f.options.map((o) => $('option', { value: o }, o))); s.value = v;
      s.addEventListener('change', () => setVal(p, s.value, row)); return s;
    }
    case 'textarea': {
      const t = $('textarea', {}, v); t.addEventListener('input', () => setVal(p, t.value, row)); return t;
    }
    case 'json': {
      const t = $('textarea', {}, JSON.stringify(v, null, 2)); const msg = $('div', { class: 'tag bad' });
      t.addEventListener('input', () => { try { setVal(p, JSON.parse(t.value), row); msg.textContent = ''; } catch { msg.textContent = 'JSON belum valid (belum disimpan)'; delete dirty[p]; refreshSave(); } });
      return $('div', {}, t, msg);
    }
    case 'strings': {
      const t = $('textarea', {}, (v || []).join('\n')); t.addEventListener('input', () => setVal(p, t.value.split('\n'), row)); return t;
    }
    case 'id': {
      const i = $('input', { type: 'text', value: v, placeholder: 'ID Discord (angka)', inputmode: 'numeric' });
      const tag = $('span', { class: 'tag' });
      const upd = () => { const n = nameOf(f.pick, i.value.trim()); tag.className = 'tag' + (n === false ? ' bad' : ''); tag.textContent = n === false ? '⚠ tidak ditemukan di server' : (n || ''); };
      i.addEventListener('input', () => { setVal(p, i.value, row); upd(); }); upd();
      const pk = f.pick && picker(f.pick, (id) => { i.value = id; setVal(p, id, row); upd(); });
      return $('div', {}, $('div', { class: 'inline' }, i, pk), tag);
    }
    case 'ids': {
      let list = [...(v || [])];
      const box = $('div', { class: 'chips' });
      const draw = () => {
        box.replaceChildren(...list.map((id) => {
          const n = nameOf(f.pick, id);
          return $('span', { class: 'chip' }, n || id, n === false ? ' ⚠' : '', $('button', { title: 'hapus', onclick: () => { list = list.filter((x) => x !== id); sync(); } }, '×'));
        }));
      };
      const sync = () => { draw(); setVal(p, [...list], row); };
      const add = (id) => { id = id.trim(); if (id && !list.includes(id)) { list.push(id); sync(); } };
      const i = $('input', { type: 'text', placeholder: 'tempel ID lalu Enter', inputmode: 'numeric' });
      i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); i.value.split(/[\s,]+/).forEach(add); i.value = ''; } });
      draw();
      return $('div', {}, box, $('div', { class: 'inline' }, i, f.pick && picker(f.pick, add)));
    }
    default: {
      const i = $('input', { type: 'text', value: v }); i.addEventListener('input', () => setVal(p, i.value, row)); return i;
    }
  }
}

function fieldRow(f) {
  const row = $('div', { class: 'row' + (f.path in dirty ? ' dirty' : '') });
  const right = [control(f, row)];
  if (S.overridden.includes(f.path) || f.path in dirty) {
    right.push($('div', {}, $('button', { class: 'btn sm', onclick: () => { resetSet.add(f.path); delete dirty[f.path]; refreshSave(); toast('Akan dikembalikan ke bawaan saat disimpan: ' + f.path); } }, '↺ kembalikan ke bawaan')));
  }
  row.append($('div', {}, $('div', { class: 'lbl' }, f.label), f.help && $('div', { class: 'help' }, f.help), $('div', { class: 'path' }, f.path)), $('div', {}, right));
  return row;
}

let saveBtn;
function refreshSave() {
  const n = Object.keys(dirty).length + resetSet.size;
  if (saveBtn) { saveBtn.disabled = !n; saveBtn.textContent = n ? `💾 Simpan (${n})` : '💾 Simpan'; }
}

async function save(restart) {
  try {
    const r = await api('save', { changes: dirty, reset: [...resetSet] });
    if (!r.ok) return toast(r.errors.join('\n'), true);
    toast('Tersimpan. Perubahan aktif setelah bot di-restart.');
    for (const k of Object.keys(dirty)) delete dirty[k];
    resetSet.clear();
    if (restart) { await api('restart', {}); toast('Bot restart… tunggu ±10 detik lalu muat ulang halaman.'); return; }
    await load();
  } catch (e) { toast(e.message, true); }
}

function tools(sec) {
  const out = $('div', { class: 'report' });
  const btns = [];
  if (sec.tools?.includes('test-db')) btns.push($('button', { class: 'btn', onclick: async () => {
    const g = (p) => val(p);
    try { const r = await api('test-db', { host: g('mysql.host'), port: g('mysql.port'), user: g('mysql.user'), password: dirty['mysql.password'] || '', database: g('mysql.database') });
      out.replaceChildren($('div', { class: 'tag' + (r.ok ? '' : ' bad') }, (r.ok ? '✅ ' : '❌ ') + r.message)); } catch (e) { toast(e.message, true); } } }, '🔌 Tes koneksi'));
  if (sec.tools?.includes('check-db')) btns.push($('button', { class: 'btn', onclick: async () => {
    try { const r = await api('check-db'); out.replaceChildren($('div', { class: 'tag' + (r.ok ? '' : ' bad') }, r.ok ? '✅ Semua tabel & kolom cocok' : '⚠ Ada yang tidak cocok (simpan & restart dulu bila baru mengubah pemetaan):'),
      $('ul', {}, r.issues.map((x) => $('li', { class: 'tag bad' }, x)), r.passed.map((x) => $('li', { class: 'tag' }, x)))); } catch (e) { toast(e.message, true); } } }, '🔍 Cek kecocokan skema'));
  return btns.length ? $('div', {}, $('div', { class: 'inline' }, btns), out) : null;
}


let PANELS = null;
const panelTarget = {}; // panelId -> {channelId, options}
function chanInput(initial, onChange, placeholder) {
  const i = $('input', { type: 'text', value: initial || '', placeholder: placeholder || 'ID channel tujuan', inputmode: 'numeric' });
  const tag = $('span', { class: 'tag' });
  const upd = () => { const n = nameOf('channel', i.value.trim()); tag.className = 'tag' + (n === false ? ' bad' : ''); tag.textContent = n === false ? '⚠ tidak ditemukan' : (n || ''); };
  i.addEventListener('input', () => { onChange(i.value.trim()); upd(); }); upd();
  const pk = picker('channel', (id) => { i.value = id; onChange(id); upd(); });
  return $('div', {}, $('div', { class: 'inline' }, i, pk), tag);
}
function panelCard(p) {
  const st = (panelTarget[p.id] ??= { channelId: p.suggestedChannel || '', options: {} });
  const extra = [];
  for (const x of p.extra || []) extra.push($('div', { class: 'help' }, x.label), chanInput(st.options[x.name], (v) => (st.options[x.name] = v), 'kosong = channel tujuan'));
  if (p.choices) {
    const s = $('select', { onchange: () => (st.options.jenis = s.value) }, $('option', { value: '' }, 'pilih jenis report…'), p.choices.map((c) => $('option', { value: c.value }, c.label)));
    s.value = st.options.jenis || ''; extra.push(s);
  }
  const btn = $('button', { class: 'btn pri', onclick: async () => {
    if (!st.channelId) return toast('Isi channel tujuan dulu.', true);
    if (p.choices && !st.options.jenis) return toast('Pilih jenis report dulu.', true);
    const n = nameOf('channel', st.channelId);
    if (!confirm(`Kirim panel "${p.label}" ke ${n || st.channelId}?\nPanel lama (kalau ada) tidak otomatis dihapus.`)) return;
    btn.disabled = true;
    try { const r = await api('panels/send', { panel: p.id, channelId: st.channelId, options: st.options }); toast((r.ok ? '✅ ' : '❌ ') + (r.message || r.error), !r.ok); }
    catch (e) { toast(e.message, true); } finally { btn.disabled = false; }
  } }, '📤 Kirim');
  return $('div', { class: 'row' },
    $('div', {}, $('div', { class: 'lbl' }, p.label), $('div', { class: 'help' }, p.desc), $('div', { class: 'path' }, '/' + p.id)),
    $('div', {}, chanInput(st.channelId, (v) => (st.channelId = v)), extra, $('p', {}, btn)));
}
function panelsView() {
  const wrap = $('div', {});
  if (!PANELS) { api('panels').then((r) => { PANELS = r.panels; render(); }).catch((e) => toast(e.message, true)); return $('div', { class: 'card' }, 'Memuat…'); }
  wrap.append($('div', { class: 'card' }, $('h3', {}, '📤 Kirim Panel'), $('p', { class: 'desc' }, 'Pilih channel tujuan lalu klik Kirim. Tampilannya sama persis dengan command /panel…. Bot harus online dan punya izin Lihat Channel, Kirim Pesan, dan Sematkan Link di channel tersebut.'),
    !D.ready ? $('span', { class: 'tag bad' }, '⚠ Bot belum online / daftar channel belum tersedia.') : null));
  for (const g of [...new Set(PANELS.map((p) => p.group))])
    wrap.append($('div', { class: 'card' }, $('h3', {}, g), PANELS.filter((p) => p.group === g).map(panelCard)));
  return wrap;
}


let AL = null; const alPick = {}; let alCat = '';
function autologView() {
  if (!AL) { api('autolog').then((r) => { AL = r; for (const x of r.rows || []) alPick[x.path] ??= x.checked; render(); }).catch((e) => toast(e.message, true)); return $('div', { class: 'card' }, 'Memuat…'); }
  if (!AL.ok) return $('div', { class: 'card' }, $('h3', {}, '🪄 Auto-setup Log'), $('span', { class: 'tag bad' }, '⚠ ' + AL.error), $('p', {}, $('button', { class: 'btn', onclick: () => { AL = null; render(); } }, 'Coba lagi')));
  const lbl = { ok: '✅ sudah benar', assign: '🔗 cocok dengan channel yang ada', filled: '➖ sudah terisi channel lain', create: '🆕 belum ada channel' };
  const rows = AL.rows.map((r) => {
    const c = $('input', { type: 'checkbox' }); c.checked = !!alPick[r.path]; c.disabled = r.status === 'ok' || (r.status === 'create' && !r.createName);
    c.addEventListener('change', () => (alPick[r.path] = c.checked));
    const detail = r.status === 'create' ? 'akan dibuat: #' + r.createName : r.match ? '#' + r.match.name : (r.currentName ? '#' + r.currentName : '');
    return $('div', { class: 'row' }, $('div', {}, $('label', { class: 'switch' }, c, $('span', { class: 'lbl' }, r.label)), $('div', { class: 'path' }, r.path)),
      $('div', {}, $('div', {}, lbl[r.status]), $('div', { class: 'help' }, detail + (r.status === 'assign' && r.currentName ? '  (sekarang: #' + r.currentName + ')' : ''))));
  });
  const cat = $('div', { class: 'inline' }, $('input', { type: 'text', value: alCat, placeholder: 'ID kategori untuk channel baru (kosong = ikut kategori logs-jail)', inputmode: 'numeric', oninput: (e) => (alCat = e.target.value.trim()) }), picker('category', (id) => { alCat = id; render(); }));
  const go = $('button', { class: 'btn pri', onclick: async () => {
    const items = AL.rows.filter((r) => alPick[r.path] && r.status !== 'ok').map((r) => ({ path: r.path, mode: r.match ? 'assign' : 'create', channelId: r.match?.id }));
    if (!items.length) return toast('Tidak ada yang dipilih.', true);
    const nNew = items.filter((i) => i.mode === 'create').length;
    if (!confirm(`Terapkan ${items.length} pengaturan?` + (nNew ? `\n${nNew} channel baru akan DIBUAT di Discord.` : ''))) return;
    go.disabled = true;
    try { const r = await api('autolog/apply', { items, categoryId: alCat }); toast(r.report.join('\n'), !r.ok); AL = null; await load(); }
    catch (e) { toast(e.message, true); } finally { go.disabled = false; }
  } }, '🪄 Terapkan yang dipilih');
  return $('div', {}, $('div', { class: 'card' }, $('h3', {}, '🪄 Auto-setup Log'), $('p', { class: 'desc' }, `Server: ${AL.guild}. Nama channel dicocokkan otomatis (mis. #logs-jail → game log jail). Channel yang belum ada bisa dibuat otomatis dengan izin disalin dari #logs-jail (privat seperti log lainnya). Bot butuh izin Manage Channels untuk membuat channel. Setelah diterapkan, klik "Simpan & restart bot".`), cat),
    $('div', { class: 'card' }, rows, $('p', {}, go, ' ', $('button', { class: 'btn', onclick: () => { AL = null; render(); } }, '↻ Muat ulang'))));
}

function security() {
  const o = $('input', { type: 'password', placeholder: 'Password lama', autocomplete: 'current-password' });
  const n = $('input', { type: 'password', placeholder: 'Password baru (min 8 karakter)', autocomplete: 'new-password' });
  return $('div', { class: 'card' }, $('h3', {}, '🔑 Keamanan'), $('p', { class: 'desc' }, 'Ganti password dashboard. Gunakan password yang kuat; dashboard bisa mengubah token & database bot.'),
    o, $('p'), n, $('p', {}, $('button', { class: 'btn pri', onclick: async () => { try { await api('password', { old: o.value, new: n.value }); toast('Password diganti'); o.value = n.value = ''; } catch (e) { toast(e.message, true); } } }, 'Ganti password'),
      ' ', $('button', { class: 'btn', onclick: async () => { await api('logout', {}); showLogin(); } }, 'Keluar')));
}

function render() {
  const q = query.toLowerCase();
  const nav = $('div', { class: 'side' }, $('h2', {}, '⚙️ Pengaturan Bot'), $('div', { class: 'bot' }, S.bot ? '🟢 ' + S.bot.tag + (D.ready ? ' · ' + D.guild : '') : '🔴 bot belum online'),
    S.sections.map((s) => $('button', { class: 'nav' + (s.id === cur && !q ? ' on' : ''), onclick: () => { cur = s.id; query = ''; render(); } }, s.icon + ' ' + s.title)),
    $('button', { class: 'nav' + (cur === 'autolog' && !q ? ' on' : ''), onclick: () => { cur = 'autolog'; query = ''; render(); } }, '🪄 Auto-setup Log'),
    $('button', { class: 'nav' + (cur === 'panel' && !q ? ' on' : ''), onclick: () => { cur = 'panel'; query = ''; render(); } }, '📤 Kirim Panel'),
    $('button', { class: 'nav' + (cur === 'sec' && !q ? ' on' : ''), onclick: () => { cur = 'sec'; query = ''; render(); } }, '🔑 Keamanan'));
  saveBtn = $('button', { class: 'btn pri', disabled: true, onclick: () => save(false) }, '💾 Simpan');
  const search = $('input', { type: 'search', placeholder: 'Cari pengaturan (mis. channel, role, donasi)…', value: query });
  search.addEventListener('input', () => { query = search.value; render(); document.querySelector('input[type=search]').focus(); const e = document.querySelector('input[type=search]'); e.setSelectionRange(e.value.length, e.value.length); });
  const bar = $('div', { class: 'bar' }, search, saveBtn, $('button', { class: 'btn', onclick: () => save(true) }, '🔄 Simpan & restart bot'));
  const notice = !D.ready ? $('div', { class: 'card' }, $('span', { class: 'tag bad' }, '⚠ ' + (D.reason || 'Daftar channel/role belum tersedia.')), ' ID tetap bisa diisi manual.') : null;

  let body;
  if (q) {
    const rows = S.sections.flatMap((s) => s.fields.filter((f) => (f.label + ' ' + f.path + ' ' + (f.help || '')).toLowerCase().includes(q)).map((f) => fieldRow(f)));
    body = $('div', { class: 'card' }, $('h3', {}, `Hasil pencarian (${rows.length})`), rows);
  } else if (cur === 'autolog') body = autologView();
  else if (cur === 'panel') body = panelsView();
  else if (cur === 'sec') body = security();
  else {
    const s = S.sections.find((x) => x.id === cur);
    let last = null; const parts = [];
    for (const f of s.fields) { if (f.group !== last) { last = f.group; if (f.group) parts.push($('div', { class: 'grp' }, f.group)); } parts.push(fieldRow(f)); }
    body = $('div', { class: 'card' }, $('h3', {}, s.icon + ' ' + s.title), s.desc && $('p', { class: 'desc' }, s.desc), tools(s), parts);
  }
  root.replaceChildren($('div', { class: 'layout' }, nav, $('div', { class: 'main' }, bar, notice, body)));
  refreshSave();
}

async function load() { S = await api('state'); D = await api('discord').catch(() => D); render(); }
async function boot() { try { await load(); } catch { showLogin(); } }
window.addEventListener('beforeunload', (e) => { if (Object.keys(dirty).length) e.preventDefault(); });
boot();
