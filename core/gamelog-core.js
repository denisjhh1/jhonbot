const fs = require('fs');
const path = require('path');
const { EmbedBuilder, escapeMarkdown } = require('discord.js');
const def = require('../defines');
const db = require('./query');
const { log } = require('../functions');
const { lookupUcps: findUcps } = require('./ucp-lookup');

const cfg = {
    enabled: true,
    table: 'gamelogs',
    pollSeconds: 5,
    batchLimit: 50,
    charTable: 'player_characters',
    charNameColumn: 'Char_Name',
    charUcpColumn: 'Char_UCP',
    channels: {
        jail: 'YOUR_DISCORD_ID',
        ban: 'YOUR_DISCORD_ID',
        unban: 'YOUR_DISCORD_ID',
        setbank: 'YOUR_DISCORD_ID',
        transfer: 'YOUR_DISCORD_ID',
        kill: 'YOUR_DISCORD_ID',
        giveweap: 'YOUR_DISCORD_ID',
        unjail: 'YOUR_DISCORD_ID',
        default: 'YOUR_DISCORD_ID',
    },
    ...(def.gamelog ?? {}),
};
cfg.channels = { ...cfg.channels, ...(def.gamelog?.channels ?? {}) };

const channelFor = (type) => cfg.channels[type] || cfg.channels.default || null;

const STATE_FILE = path.join(__dirname, '..', 'data', 'gamelog-state.json');
let state = { lastId: null };
try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (Number.isFinite(s.lastId)) state.lastId = s.lastId;
} catch {}

function save() {
    try {
        const tmp = STATE_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(state));
        fs.renameSync(tmp, STATE_FILE);
    } catch (e) {
        log(`Gagal menyimpan gamelog-state.json: ${e.message}`, 'err');
    }
}

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

let lastErrAt = 0;
const throttledErr = (msg) => {
    if (Date.now() - lastErrAt < 60 * 1000) return;
    lastErrAt = Date.now();
    log(msg, 'err');
};

const cut = (s, n) => {
    s = String(s ?? '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
};
const esc = (s) => escapeMarkdown(String(s ?? '-'));
const fmtMoney = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Number(n) || 0).toLocaleString('en-US')}`;

async function ensureTable() {
    await q(
        'CREATE TABLE IF NOT EXISTS ?? (' +
            '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,' +
            '`type` VARCHAR(16) NOT NULL,' +
            "`actor` VARCHAR(64) NOT NULL DEFAULT '-'," +
            "`target` VARCHAR(64) NOT NULL DEFAULT '-'," +
            '`amount` BIGINT NOT NULL DEFAULT 0,' +
            '`amount2` BIGINT NOT NULL DEFAULT 0,' +
            "`info` VARCHAR(64) NOT NULL DEFAULT ''," +
            "`reason` VARCHAR(128) NOT NULL DEFAULT '-'," +
            '`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP' +
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
        [cfg.table],
    );
}

async function enqueue({ type, actor = '-', target = '-', amount = 0, amount2 = 0, info = '', reason = '-' }) {
    try {
        await ensureTable();
        await q(
            'INSERT INTO ?? (`type`, `actor`, `target`, `amount`, `amount2`, `info`, `reason`) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [cfg.table, type, cut(actor, 64), cut(target, 64), amount, amount2, cut(info, 64), cut(reason, 128)],
        );
    } catch (e) {
        throttledErr(`GameLog: gagal menulis log ${type} (${e.message})`);
    }
}

async function lookupUcps(names) {
    try {
        return await findUcps(names, {
            charTable: cfg.charTable,
            charNameColumn: cfg.charNameColumn,
            charUcpColumn: cfg.charUcpColumn,
        });
    } catch (e) {
        throttledErr(`GameLog: gagal mencari UCP (${e.message}). Log tetap dikirim tanpa UCP.`);
        return new Map();
    }
}

const who = (name, ucps) => {
    const n = String(name ?? '-');
    const u = ucps.get(n.toLowerCase());
    return esc(u ? `${n}(${u})` : n);
};

const TITLES = {
    jail: 'Jail',
    ban: 'Ban',
    unban: 'Unban',
    setbank: 'Set Bank Money',
    transfer: 'Transfer Bank',
    kill: 'Pembunuhan',
    giveweap: 'Give Weapon',
    unjail: 'Unjail',
    asset: 'Cek Aset Pemain',
};

function buildEmbed(row, ucps = new Map()) {
    const amount = Number(row.amount) || 0;
    const amount2 = Number(row.amount2) || 0;
    const ts = row.ts ? Number(row.ts) : Math.floor(Date.now() / 1000);
    const reason = esc(cut(row.reason || '-', 200));
    const info = String(row.info ?? '');
    const e = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setFooter({ text: `Log #${row.id}` })
        .setTimestamp(new Date(ts * 1000));
    let title = TITLES[row.type] ?? String(row.type);
    let fields;

    switch (row.type) {
        case 'jail':
            fields = [
                { name: 'Pemain', value: who(row.target, ucps), inline: true },
                { name: 'Admin', value: who(row.actor, ucps), inline: true },
                { name: 'Durasi', value: `${amount} menit`, inline: true },
                { name: 'Denda', value: amount2 > 0 ? fmtMoney(amount2) : 'Tanpa denda', inline: true },
                { name: 'Sumber', value: esc(info || 'Game'), inline: true },
                { name: 'Alasan', value: reason },
            ];
            break;
        case 'ban':
        case 'unban': {
            const kind = info || 'Karakter';
            title = `${TITLES[row.type]} ${kind}`;
            fields = [
                {
                    name: kind === 'UCP' ? 'Akun UCP' : 'Karakter',
                    value: kind === 'UCP' ? esc(row.target) : who(row.target, ucps),
                    inline: true,
                },
                { name: 'Admin', value: who(row.actor, ucps), inline: true },
                { name: 'Tipe', value: esc(kind), inline: true },
            ];
            if (row.type === 'ban')
                fields.push({ name: 'Durasi', value: amount > 0 ? `${amount} hari` : 'Permanent', inline: true });
            fields.push({ name: row.type === 'ban' ? 'Alasan' : 'Keterangan', value: reason });
            break;
        }
        case 'setbank':
            fields = [
                { name: 'Pemain', value: who(row.target, ucps), inline: true },
                { name: 'Admin', value: who(row.actor, ucps), inline: true },
                { name: 'Saldo Sebelumnya', value: fmtMoney(amount2), inline: true },
                { name: 'Saldo Baru', value: fmtMoney(amount), inline: true },
            ];
            break;
        case 'transfer':
            fields = [
                { name: 'Pengirim', value: who(row.actor, ucps), inline: true },
                { name: 'Penerima', value: who(row.target, ucps), inline: true },
                { name: 'Jumlah', value: fmtMoney(amount), inline: true },
                { name: 'Metode', value: esc(info || 'Bank'), inline: true },
                { name: 'Saldo Pengirim Setelahnya', value: fmtMoney(amount2), inline: true },
            ];
            break;
        case 'kill':
            fields = [
                { name: 'Pembunuh', value: who(row.actor, ucps), inline: true },
                { name: 'Korban', value: who(row.target, ucps), inline: true },
                { name: 'Senjata', value: esc(info || '-'), inline: true },
                {
                    name: 'Total Damage',
                    value: amount > 0 ? `${(amount / 10).toFixed(1)} (${amount2} hit)` : 'Tidak tercatat',
                    inline: true,
                },
                { name: 'Bagian Tubuh (hit terakhir)', value: esc(row.reason || '-'), inline: true },
                { name: 'Waktu', value: `<t:${ts}:F>`, inline: true },
            ];
            break;
        case 'giveweap':
            fields = [
                { name: 'Admin', value: who(row.actor, ucps), inline: true },
                { name: 'Penerima', value: who(row.target, ucps), inline: true },
                { name: 'Senjata', value: esc(info || '-'), inline: true },
                { name: 'Ammo', value: String(amount), inline: true },
            ];
            if (amount2 > 1) fields.push({ name: 'Jumlah Pemain', value: String(amount2), inline: true });
            if (row.reason && row.reason !== '-') fields.push({ name: 'Keterangan', value: reason });
            break;
        case 'unjail':
            fields = [
                { name: 'Pemain', value: who(row.target, ucps), inline: true },
                { name: 'Admin', value: who(row.actor, ucps), inline: true },
                { name: 'Sumber', value: esc(info || 'Game'), inline: true },
                { name: 'Keterangan', value: reason },
            ];
            break;
        case 'asset':
            fields = [
                { name: 'Dicek Oleh', value: who(row.actor, ucps), inline: true },
                { name: 'Pemilik Aset', value: who(row.target, ucps), inline: true },
                { name: 'Sumber', value: esc(info || 'Panel Aset'), inline: true },
                { name: 'Keterangan', value: reason },
            ];
            break;
        default:
            fields = [
                { name: 'Pelaku', value: who(row.actor, ucps), inline: true },
                { name: 'Target', value: who(row.target, ucps), inline: true },
                { name: 'Keterangan', value: reason },
            ];
    }
    return e.setTitle(title).addFields(fields);
}

let running = false;
async function poll(client) {
    if (running) return;
    running = true;
    try {
        // Ambil ID tertinggi yang benar-benar ada di database saat ini.
        const [maxRow] = await q('SELECT COALESCE(MAX(`id`), 0) AS m FROM ??', [cfg.table]);
        const maxId = Number(maxRow?.m) || 0;

        if (state.lastId === null) {
            state.lastId = maxId;
            save();
            log(`GameLog: mulai dari log #${state.lastId} (log lama tidak dikirim).`, 'info');
            return;
        }

        // Jika tabel gamelogs pernah di-reset/dibuat ulang, AUTO_INCREMENT bisa
        // kembali kecil sedangkan state lokal masih menyimpan ID lama (mis. 1499).
        // Sinkronkan cursor ke MAX(id) saat ini agar log berikutnya tidak terlewat.
        if (maxId < state.lastId) {
            const previousId = state.lastId;
            state.lastId = maxId;
            save();
            log(
                `GameLog: mendeteksi ID database mundur (${previousId} -> ${maxId}); cursor disinkronkan agar log baru terbaca.`,
                'warn',
            );
        }

        const rows = await q(
            'SELECT `id`, `type`, `actor`, `target`, `amount`, `amount2`, `info`, `reason`, UNIX_TIMESTAMP(`created_at`) AS ts ' +
                'FROM ?? WHERE `id` > ? ORDER BY `id` ASC LIMIT ?',
            [cfg.table, state.lastId, cfg.batchLimit],
        );
        if (!rows.length) return;

        const ucps = await lookupUcps(rows.flatMap((r) => [r.actor, r.target]));

        let i = 0;
        while (i < rows.length) {
            const chId = channelFor(rows[i].type);
            let j = i;
            while (j < rows.length && j - i < 10 && channelFor(rows[j].type) === chId) j++;
            const chunk = rows.slice(i, j);

            const channel = chId ? await client.channels.fetch(chId).catch(() => null) : null;
            if (channel?.isTextBased()) {
                await channel.send({
                    embeds: chunk.map((r) => buildEmbed(r, ucps)),
                    allowedMentions: { parse: [] },
                });
            } else {
                throttledErr(
                    `GameLog: channel untuk tipe "${chunk[0].type}" (${chId ?? 'belum diatur'}) tidak ditemukan. ${chunk.length} log dilewati.`,
                );
            }
            state.lastId = chunk[chunk.length - 1].id;
            save();
            i = j;
        }
    } catch (e) {
        throttledErr(`GameLog gagal: ${e.message ?? e}`);
    } finally {
        running = false;
    }
}

let timer = null;
async function start(client) {
    if (cfg.enabled === false) return log('GameLog dimatikan (gamelog.enabled = false).', 'warn');
    try {
        await ensureTable();
    } catch (e) {
        return log(`GameLog tidak aktif: gagal menyiapkan tabel ${cfg.table} (${e.message}).`, 'err');
    }
    if (timer) clearInterval(timer);
    log(`GameLog aktif: cek tiap ${cfg.pollSeconds} detik.`, 'done');
    poll(client);
    timer = setInterval(() => poll(client), cfg.pollSeconds * 1000);
}

module.exports = { start, poll, enqueue, buildEmbed, config: cfg };
