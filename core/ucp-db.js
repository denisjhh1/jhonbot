// Semua akses tabel UCP lewat file ini, supaya nama tabel/kolom cukup diatur di core/schema.js
const db = require('./query');
const { ucp: U } = require('./schema');

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

const pad = (n) => String(n).padStart(2, '0');
const nowStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const SELECT = 'SELECT ?? AS ucp, ?? AS verifycode, ?? AS DiscordID FROM ??';
const base = () => [U.ucp, U.verify, U.discord, U.table];

// -> { ucp, verifycode, DiscordID } | null
async function findByDiscord(discordId) {
    const rows = await q(`${SELECT} WHERE ?? = ? LIMIT 1`, [...base(), U.discord, String(discordId)]);
    return rows[0] ?? null;
}

// Cek nama UCP / akun Discord yang sudah terdaftar
async function findExisting(name, discordId) {
    return q(`${SELECT} WHERE ?? = ? OR ?? = ?`, [...base(), U.ucp, name, U.discord, String(discordId)]);
}

async function register(name, code, discordId) {
    const cols = [U.ucp, U.verify, U.discord];
    const vals = [name, Number(code), String(discordId)];
    if (U.password) {
        cols.push(U.password);
        vals.push('');
    }
    if (U.registerDate) {
        cols.push(U.registerDate);
        vals.push(nowStr());
    }
    if (U.lastLogin) {
        cols.push(U.lastLogin);
        vals.push(nowStr());
    }
    await q(`INSERT INTO ?? (${cols.map(() => '??').join(', ')}) VALUES (${vals.map(() => '?').join(', ')})`, [
        U.table,
        ...cols,
        ...vals,
    ]);
}

// Reset password.
// - tabel whitelists: gamemode meminta "kode recovery" saat login lalu membuat password baru
// - tabel lain (ada kolom password): kosongkan password + simpan kode baru
async function startReset(ucp, code) {
    if (U.recovery) {
        await q('UPDATE ?? SET ?? = ? WHERE ?? = ?', [U.table, U.recovery, Number(code), U.ucp, ucp]);
        return;
    }
    await q('UPDATE ?? SET ?? = ?, ?? = ? WHERE ?? = ?', [U.table, U.password, '', U.verify, Number(code), U.ucp, ucp]);
}

// verify = -1 -> sudah terverifikasi di game (tidak ada kode lagi)
const isVerified = (row) => Number(row?.verifycode) === -1;

async function getUcpByDiscord(discordId) {
    return (await findByDiscord(discordId))?.ucp ?? null;
}

module.exports = { q, findByDiscord, findExisting, register, startReset, getUcpByDiscord, isVerified };
