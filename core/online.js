// Tabel player_characters di database ini TIDAK punya kolom Char_Online,
// jadi status online ditentukan lewat query SA-MP (daftar pemain di server).
// Hasil di-cache singkat dan dibatasi waktunya supaya tidak membuat tombol/command Discord
// melewati batas 3 detik (error "Unknown interaction").
const norm = (s) => String(s ?? '').toLowerCase();
const TTL_MS = 5000;
const MAX_WAIT_MS = 2500;

let cache = { at: 0, snap: null };
let inflight = null;

async function fetchSnapshot() {
    try {
        const { querySamp } = require('./monitoring-core');
        const res = await querySamp();
        if (!res?.ok) return { ok: false, names: new Set(), count: 0 };
        const players = res.data?.players ?? [];
        return {
            ok: true,
            names: new Set(players.map((p) => norm(p.name))),
            count: Number(res.data?.online) || 0,
            listKnown: players.length > 0,
        };
    } catch {
        return { ok: false, names: new Set(), count: 0 };
    }
}

async function snapshot() {
    if (cache.snap && Date.now() - cache.at < TTL_MS) return cache.snap;
    inflight ??= fetchSnapshot().then((snap) => {
        cache = { at: Date.now(), snap };
        inflight = null;
        return snap;
    });
    const timeout = new Promise((resolve) => setTimeout(() => resolve({ ok: false, names: new Set(), count: 0 }), MAX_WAIT_MS));
    return Promise.race([inflight, timeout]);
}

// true jika salah satu nama sedang online.
// SA-MP tidak mengirim daftar nama bila pemain > 100: dianggap online (aman) selama ada pemain.
async function anyOnline(names) {
    const snap = await snapshot();
    if (!snap.ok) return false;
    if (!snap.listKnown) return snap.count > 0;
    return [].concat(names).some((n) => snap.names.has(norm(n)));
}

const isOnline = (name) => anyOnline([name]);

module.exports = { isOnline, anyOnline, snapshot };
