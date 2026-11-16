// Penyimpanan pengaturan dari dashboard: data/settings.json (hanya nilai yang DIUBAH).
// defines.js memanggil apply(base) -> base digabung dengan settings.json (+ env var).
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'settings.json');

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function deepMerge(a, b) {
    const out = { ...(a ?? {}) };
    for (const [k, v] of Object.entries(b ?? {})) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : v;
    }
    return out;
}

function getPath(obj, p) {
    return p.split('.').reduce((o, k) => (o === undefined || o === null ? undefined : o[k]), obj);
}

function setPath(obj, p, value) {
    const keys = p.split('.');
    let o = obj;
    for (const k of keys.slice(0, -1)) {
        if (!isObj(o[k])) o[k] = {};
        o = o[k];
    }
    o[keys[keys.length - 1]] = value;
}

function deletePath(obj, p) {
    const keys = p.split('.');
    const chain = [obj];
    let o = obj;
    for (const k of keys.slice(0, -1)) {
        if (!isObj(o?.[k])) return;
        o = o[k];
        chain.push(o);
    }
    delete o[keys[keys.length - 1]];
    // bersihkan objek kosong
    for (let i = keys.length - 2; i >= 0; i--) {
        if (Object.keys(chain[i + 1]).length === 0) delete chain[i][keys[i]];
        else break;
    }
}

function readOverrides() {
    try {
        const v = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        return isObj(v) ? v : {};
    } catch {
        return {};
    }
}

function writeOverrides(obj) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    try {
        if (fs.existsSync(FILE)) fs.copyFileSync(FILE, FILE + '.bak');
    } catch {}
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, FILE);
}

// Variabel lingkungan (opsional) untuk rahasia: lebih aman daripada menyimpan di file.
const ENV_MAP = {
    DISCORD_TOKEN: 'client.token',
    MYSQL_PASSWORD: 'mysql.password',
    MYSQL_HOST: 'mysql.host',
    MYSQL_USER: 'mysql.user',
    MYSQL_DATABASE: 'mysql.database',
    GEMINI_API_KEY: 'ai.apiKey',
};

function apply(base) {
    const over = readOverrides();
    // Versi lama menyimpan db.ucp.table = 'player_ucp'. Gamemode ini memakai tabel `whitelists`,
    // jadi override lama itu diabaikan (nilai baru bisa diatur lagi dari dashboard).
    if (over?.db?.ucp?.table === 'player_ucp') delete over.db.ucp.table;
    const merged = deepMerge(base, over);
    for (const [env, p] of Object.entries(ENV_MAP)) {
        if (process.env[env]) setPath(merged, p, process.env[env]);
    }
    if (process.env.MYSQL_PORT) setPath(merged, 'mysql.port', Number(process.env.MYSQL_PORT));
    return merged;
}

module.exports = { FILE, apply, deepMerge, getPath, setPath, deletePath, readOverrides, writeOverrides, ENV_MAP };
