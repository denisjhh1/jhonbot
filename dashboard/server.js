// Website pengaturan bot (tanpa dependensi tambahan, hanya modul bawaan Node).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const def = require('../defines');
const settings = require('./settings');
const { SECTIONS, FIELDS } = require('./schema');
const { validate } = require('./validate');
const panels = require('./panels');
const autolog = require('./autolog');
const { log } = require('../functions');

const PUB = path.join(__dirname, 'public');
const AUTH_FILE = path.join(__dirname, '..', 'data', 'dashboard-auth.json');
const MAX_BODY = 256 * 1024;
const SESSION_MS = 12 * 3600 * 1000;

const sessions = new Map(); // token -> expiry
const attempts = new Map(); // ip -> {n, until}
let botClient = null;

// ---------- password ----------
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
function loadAuth() {
    try {
        return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
    } catch {
        return null;
    }
}
function saveAuth(pw) {
    const salt = crypto.randomBytes(16).toString('hex');
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ salt, hash: hashPw(pw, salt) }), { mode: 0o600 });
}
function checkPw(pw) {
    const a = loadAuth();
    if (!a || typeof pw !== 'string') return false;
    const x = Buffer.from(hashPw(pw, a.salt), 'hex');
    const y = Buffer.from(a.hash, 'hex');
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---------- util ----------
const send = (res, code, body, type = 'application/json; charset=utf-8', extra = {}) => {
    res.writeHead(code, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'",
        ...extra,
    });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const json = (res, code, obj, extra) => send(res, code, obj, undefined, extra);

const readBody = (req) =>
    new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (c) => {
            size += c.length;
            if (size > MAX_BODY) {
                reject(new Error('Body terlalu besar'));
                req.destroy();
            } else chunks.push(c);
        });
        req.on('end', () => {
            try {
                resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
            } catch {
                reject(new Error('JSON tidak valid'));
            }
        });
        req.on('error', reject);
    });

const cookieOf = (req, name) => {
    const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(req.headers.cookie ?? '');
    return m ? m[1] : null;
};
const authed = (req) => {
    const t = cookieOf(req, 'nsid');
    const exp = t && sessions.get(t);
    if (!exp) return false;
    if (exp < Date.now()) {
        sessions.delete(t);
        return false;
    }
    return true;
};
const ipOf = (req) => req.socket.remoteAddress ?? '?';

// ---------- nilai efektif ----------
function effective(fld) {
    let v;
    if (fld.path.startsWith('db.')) {
        const S = require('../core/schema');
        v = settings.getPath(S, fld.path.slice(3));
    } else v = settings.getPath(def, fld.path);
    if (v === undefined) v = fld.def;
    if (fld.type === 'secret') return '';
    if (v === undefined || v === null) {
        if (fld.type === 'ids' || fld.type === 'strings') return [];
        if (fld.type === 'bool') return false;
        return fld.type === 'json' ? (fld.def ?? []) : '';
    }
    return v;
}

function state() {
    const over = settings.readOverrides();
    const values = {};
    const secretSet = {};
    const overridden = [];
    for (const [p, fld] of FIELDS) {
        values[p] = effective(fld);
        if (fld.type === 'secret') secretSet[p] = !!settings.getPath(def, p);
        if (settings.getPath(over, p) !== undefined) overridden.push(p);
    }
    return {
        sections: SECTIONS,
        values,
        secretSet,
        overridden,
        bot: botClient?.isReady?.() ? { tag: botClient.user.tag } : null,
    };
}

// ---------- Discord ----------
async function discordInfo() {
    if (!botClient?.isReady?.()) return { ready: false, channels: [], roles: [], reason: 'Bot belum online.' };
    const gid = def.client?.guild;
    let guild = botClient.guilds.cache.get(gid);
    if (!guild && gid) guild = await botClient.guilds.fetch(gid).catch(() => null);
    if (!guild) return { ready: false, channels: [], roles: [], reason: 'Guild ID salah atau bot belum masuk server.' };
    await guild.channels.fetch().catch(() => {});
    await guild.roles.fetch().catch(() => {});
    const names = new Map(guild.channels.cache.map((c) => [c.id, c.name]));
    return {
        ready: true,
        guild: guild.name,
        channels: [...guild.channels.cache.values()]
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .map((c) => ({ id: c.id, name: c.name, type: c.type, parent: names.get(c.parentId) ?? null })),
        roles: [...guild.roles.cache.values()]
            .filter((r) => r.name !== '@everyone')
            .sort((a, b) => b.position - a.position)
            .map((r) => ({ id: r.id, name: r.name })),
    };
}

// ---------- database ----------
const qp = (conn, sql, p) => new Promise((ok, no) => conn.query(sql, p, (e, r) => (e ? no(e) : ok(r))));

async function testDb(body) {
    const mysql = require('mysql');
    const cfg = {
        host: String(body.host ?? def.mysql.host),
        port: Number(body.port ?? def.mysql.port),
        user: String(body.user ?? def.mysql.user),
        password: body.password ? String(body.password) : def.mysql.password,
        database: String(body.database ?? def.mysql.database),
        connectTimeout: 6000,
    };
    const conn = mysql.createConnection(cfg);
    try {
        await new Promise((ok, no) => conn.connect((e) => (e ? no(e) : ok())));
        const v = await qp(conn, 'SELECT VERSION() AS v', []);
        return { ok: true, message: `Terhubung ke ${cfg.host}:${cfg.port} (MySQL/MariaDB ${v[0].v})` };
    } catch (e) {
        return { ok: false, message: `${e.code ?? 'ERROR'}: ${e.sqlMessage ?? e.message}` };
    } finally {
        conn.destroy();
    }
}

// Memeriksa semua tabel/kolom yang dipetakan benar-benar ada di database
async function checkDb() {
    const db = require('../core/query');
    const S = require('../core/schema');
    const conn = { query: (s, p, cb) => db.query(s, p, cb) };
    const issues = [];
    const ok = [];
    const need = [];
    const add = (table, cols, label) => table && need.push({ table, cols: cols.filter(Boolean), label });
    add(S.ucp.table, [S.ucp.ucp, S.ucp.password, S.ucp.discord, S.ucp.verify, S.ucp.recovery, S.ucp.registerDate], 'UCP');
    add('player_characters', ['pID', 'Char_Name', 'Char_UCP', 'Char_Admin', 'Char_AdminName', 'Char_Money', 'Char_BankMoney', 'Char_Level', ...Object.values(S.jail)], 'Karakter');
    add(S.house.table, [S.house.id, S.house.owner, S.house.type, S.house.x, S.house.y], 'Rumah');
    add(S.vehicle.table, [S.vehicle.id, S.vehicle.owner, S.vehicle.model, S.vehicle.plate, S.vehicle.price, S.vehicle.rental, S.vehicle.impounded], 'Kendaraan');
    add(S.business.table, [S.business.id, S.business.name, S.business.money, S.business.owner], 'Bisnis');
    add(S.rusun.table, [S.rusun.id, S.rusun.name, S.rusun.price, S.rusun.owner], 'Rusun');
    add(S.workshop.table, [S.workshop.id, S.workshop.name, S.workshop.money, S.workshop.owner], 'Workshop');
    add(S.restaurant.table, [S.restaurant.id, S.restaurant.name, S.restaurant.money, S.restaurant.owner], 'Restoran');
    add(S.adminLog.table, [S.adminLog.cmd, S.adminLog.admin, S.adminLog.ucp, S.adminLog.target], 'Log admin');
    add(S.warnLog.table, Object.values(S.warnLog).slice(1), 'Log warning');
    add(S.family.table, [S.family.id, S.family.name, S.family.leader, S.family.money], 'Family');
    add('player_bans', ['name', 'ip', 'admin', 'reason', 'ban_date', 'ban_expire'], 'Ban');
    for (const n of need) {
        try {
            const rows = await qp(conn, 'SHOW COLUMNS FROM ??', [n.table]);
            const have = new Set(rows.map((r) => r.Field.toLowerCase()));
            const miss = n.cols.filter((c) => !have.has(String(c).toLowerCase()));
            if (miss.length) issues.push(`${n.label}: tabel \`${n.table}\` tidak punya kolom ${miss.map((m) => `\`${m}\``).join(', ')}`);
            else ok.push(`${n.label}: \`${n.table}\` OK`);
        } catch (e) {
            issues.push(`${n.label}: tabel \`${n.table}\` tidak bisa dibaca (${e.code ?? e.message})`);
        }
    }
    return { ok: !issues.length, issues, passed: ok };
}

// ---------- simpan ----------
function save(body) {
    const over = settings.readOverrides();
    const errors = [];
    const changes = body.changes ?? {};
    for (const [p, raw] of Object.entries(changes)) {
        const fld = FIELDS.get(p);
        if (!fld) {
            errors.push(`Pengaturan tidak dikenal: ${p}`);
            continue;
        }
        if (fld.type === 'secret' && raw === '') continue; // kosong = tidak diubah
        const r = validate(fld, raw);
        if (!r.ok) errors.push(r.error);
        else settings.setPath(over, p, r.value);
    }
    for (const p of body.reset ?? []) if (FIELDS.has(p)) settings.deletePath(over, p);
    if (errors.length) return { ok: false, errors };
    settings.writeOverrides(over);
    return { ok: true, saved: Object.keys(changes).length, reset: (body.reset ?? []).length };
}

// ---------- routing ----------
const FILES = { '/': 'index.html', '/app.js': 'app.js', '/app.css': 'app.css' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;

    if (req.method === 'GET' && FILES[p]) {
        const file = path.join(PUB, FILES[p]);
        return send(res, 200, fs.readFileSync(file), TYPES[path.extname(file)]);
    }
    if (!p.startsWith('/api/')) return json(res, 404, { error: 'Tidak ditemukan' });

    if (req.method === 'POST' && req.headers['x-requested-with'] !== 'dashboard')
        return json(res, 403, { error: 'Permintaan ditolak' });

    if (p === '/api/login' && req.method === 'POST') {
        const ip = ipOf(req);
        const a = attempts.get(ip) ?? { n: 0, until: 0 };
        if (a.until > Date.now()) return json(res, 429, { error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' });
        const body = await readBody(req);
        if (!checkPw(body.password)) {
            a.n++;
            if (a.n >= 5) Object.assign(a, { n: 0, until: Date.now() + 10 * 60 * 1000 });
            attempts.set(ip, a);
            return json(res, 401, { error: 'Password salah' });
        }
        attempts.delete(ip);
        const token = crypto.randomBytes(32).toString('hex');
        sessions.set(token, Date.now() + SESSION_MS);
        const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
        return json(res, 200, { ok: true }, { 'Set-Cookie': `nsid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${secure}` });
    }

    if (!authed(req)) return json(res, 401, { error: 'Belum login' });

    if (p === '/api/logout') {
        sessions.delete(cookieOf(req, 'nsid'));
        return json(res, 200, { ok: true }, { 'Set-Cookie': 'nsid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
    }
    if (p === '/api/state' && req.method === 'GET') return json(res, 200, state());
    if (p === '/api/discord' && req.method === 'GET') return json(res, 200, await discordInfo());
    if (p === '/api/save' && req.method === 'POST') return json(res, 200, save(await readBody(req)));
    if (p === '/api/test-db' && req.method === 'POST') return json(res, 200, await testDb(await readBody(req)));
    if (p === '/api/check-db' && req.method === 'GET') return json(res, 200, await checkDb());
    if (p === '/api/password' && req.method === 'POST') {
        const b = await readBody(req);
        if (!checkPw(b.old)) return json(res, 400, { error: 'Password lama salah' });
        if (typeof b.new !== 'string' || b.new.length < 8) return json(res, 400, { error: 'Password baru minimal 8 karakter' });
        saveAuth(b.new);
        return json(res, 200, { ok: true });
    }
    if (p === '/api/panels' && req.method === 'GET') return json(res, 200, { panels: panels.catalog() });
    if (p === '/api/panels/send' && req.method === 'POST') return json(res, 200, await panels.send(botClient, await readBody(req)));
    if (p === '/api/autolog' && req.method === 'GET') {
        try { return json(res, 200, { ok: true, ...(await autolog.preview(botClient)) }); }
        catch (e) { return json(res, 200, { ok: false, error: e.message }); }
    }
    if (p === '/api/autolog/apply' && req.method === 'POST') {
        try { return json(res, 200, await autolog.apply(botClient, await readBody(req), save)); }
        catch (e) { return json(res, 200, { ok: false, report: [`❌ ${e.message}`] }); }
    }
    if (p === '/api/restart' && req.method === 'POST') {
        json(res, 200, { ok: true });
        log('Dashboard: restart diminta. Bot berhenti (start.bat / pm2 akan menjalankan ulang).', 'warn');
        setTimeout(() => process.exit(0), 600);
        return;
    }
    return json(res, 404, { error: 'Tidak ditemukan' });
}

function start(client) {
    botClient = client;
    const cfg = def.dashboard ?? {};
    if (cfg.enabled === false) return;
    if (!process.env.DASHBOARD_PASSWORD && !loadAuth()) {
        const pw = crypto.randomBytes(9).toString('base64url');
        saveAuth(pw);
        console.log('\n==============================================');
        console.log(' DASHBOARD: password awal dibuat (catat, hanya tampil sekali):');
        console.log(`   ${pw}`);
        console.log(' Ganti lewat menu "Keamanan" di dashboard.');
        console.log('==============================================\n');
    }
    if (process.env.DASHBOARD_PASSWORD) saveAuth(process.env.DASHBOARD_PASSWORD);

    const server = http.createServer((req, res) => {
        handle(req, res).catch((e) => json(res, 500, { error: e.message }));
    });
    server.on('error', (e) => log(`Dashboard gagal start: ${e.message}`, 'err'));
    server.listen(Number(cfg.port) || 3000, cfg.host || '127.0.0.1', () =>
        log(`Dashboard aktif di http://${cfg.host === '127.0.0.1' ? 'localhost' : cfg.host}:${cfg.port}`, 'done'),
    );
    setInterval(() => {
        for (const [t, e] of sessions) if (e < Date.now()) sessions.delete(t);
    }, 600000).unref();
}

module.exports = { start, save, state, checkDb };
