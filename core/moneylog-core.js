const fs = require('fs');
const path = require('path');
const { EmbedBuilder, escapeMarkdown } = require('discord.js');
const def = require('../defines');
const db = require('./query');
const { log } = require('../functions');
const { lookupUcps: findUcps } = require('./ucp-lookup');

const cfg = {
    enabled: true,
    channelId: 'YOUR_DISCORD_ID',
    table: 'moneylogs',
    pollSeconds: 5,
    minAmount: 100000,
    batchLimit: 50,
    charTable: 'player_characters',
    charNameColumn: 'Char_Name',
    charUcpColumn: 'Char_UCP',
    charMaskColumn: 'Char_MaskID',

    setPattern: 'set\\s*money|setmoney|\\bset\\b|di-?set',
    ...(def.moneylog ?? {}),
};

const STATE_FILE = path.join(__dirname, '..', 'data', 'moneylog-state.json');
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
        log(`Gagal menyimpan moneylog-state.json: ${e.message}`, 'err');
    }
}

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const fmtMoney = (n) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US')}`;

async function ensureTable() {
    await q(
        'CREATE TABLE IF NOT EXISTS ?? (' +
            '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,' +
            '`name` VARCHAR(32) NOT NULL,' +
            '`amount` BIGINT NOT NULL,' +
            '`balance` BIGINT NOT NULL DEFAULT 0,' +
            "`reason` VARCHAR(128) NOT NULL DEFAULT '-'," +
            '`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP' +
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
        [cfg.table],
    );
}

const setRe = new RegExp(cfg.setPattern, 'i');

function statusOf(row) {
    const amount = Number(row.amount);
    if (setRe.test(String(row.reason ?? ''))) return 'Di-set';
    return amount >= 0 ? 'Didapatkan' : 'Dikurangi';
}

async function lookupUcps(names) {
    try {
        return await findUcps(names, {
            charTable: cfg.charTable,
            charNameColumn: cfg.charNameColumn,
            charUcpColumn: cfg.charUcpColumn,
            ...(cfg.charMaskColumn ? { charMaskColumn: cfg.charMaskColumn } : {}),
        });
    } catch (e) {
        throttledErr(`MoneyLog: gagal mencari UCP (${e.message}). Log tetap dikirim tanpa UCP.`);
        return new Map();
    }
}

function buildEmbed(row, ucp) {
    const amount = Number(row.amount);
    const gain = amount >= 0;
    const rawName = String(row.name ?? '-');
    const player = `${rawName}(${ucp ?? '?'})`;
    return new EmbedBuilder()
        .setColor(gain ? 0x2ecc71 : 0xe74c3c)
        .setTitle(gain ? '💰 Uang Masuk' : '💸 Uang Keluar')
        .addFields(
            { name: 'Pemain', value: cut(escapeMarkdown(player), 64), inline: true },
            { name: 'Status', value: statusOf(row), inline: true },
            { name: 'Jumlah', value: `${gain ? '+' : ''}${fmtMoney(amount)}`, inline: true },
            { name: 'Saldo Setelahnya', value: fmtMoney(Number(row.balance)), inline: true },
            { name: 'Keterangan', value: cut(escapeMarkdown(String(row.reason || '-')), 200) },
        )
        .setFooter({ text: `Log #${row.id}` })
        .setTimestamp(row.ts ? new Date(Number(row.ts) * 1000) : new Date());
}

let running = false;
let lastErrAt = 0;
const throttledErr = (msg) => {
    if (Date.now() - lastErrAt < 60 * 1000) return;
    lastErrAt = Date.now();
    log(msg, 'err');
};

async function poll(client) {
    if (running) return;
    running = true;
    try {
        if (state.lastId === null) {
            const [r] = await q('SELECT COALESCE(MAX(`id`), 0) AS m FROM ??', [cfg.table]);
            state.lastId = Number(r.m);
            save();
            log(`MoneyLog: mulai dari log #${state.lastId} (log lama tidak dikirim).`, 'info');
            return;
        }

        const rows = await q(
            'SELECT `id`, `name`, `amount`, `balance`, `reason`, UNIX_TIMESTAMP(`created_at`) AS ts ' +
                'FROM ?? WHERE `id` > ? ORDER BY `id` ASC LIMIT ?',
            [cfg.table, state.lastId, cfg.batchLimit],
        );
        if (!rows.length) return;

        const channel = await client.channels.fetch(cfg.channelId).catch(() => null);
        if (!channel?.isTextBased()) {
            throttledErr(
                `MoneyLog: channel ${cfg.channelId} tidak ditemukan atau bukan channel teks. Cek moneylog.channelId.`,
            );
            return;
        }

        const visible = rows.filter((r) => Math.abs(Number(r.amount)) >= cfg.minAmount);
        const ucps = await lookupUcps(visible.map((r) => r.name));
        for (const r of visible) {
            await channel.send({
                embeds: [buildEmbed(r, ucps.get(String(r.name).toLowerCase()))],
                allowedMentions: { parse: [] },
            });
        }
        // Lewati juga baris di bawah ambang agar tidak dibaca berulang.
        state.lastId = rows[rows.length - 1].id;
        save();
    } catch (e) {
        throttledErr(`MoneyLog gagal: ${e.message ?? e}`);
    } finally {
        running = false;
    }
}

let timer = null;
async function start(client) {
    if (cfg.enabled === false) return log('MoneyLog dimatikan (moneylog.enabled = false).', 'warn');
    try {
        await ensureTable();
    } catch (e) {
        return log(
            `MoneyLog tidak aktif: gagal menyiapkan tabel ${cfg.table} (${e.message}). Buat tabelnya manual dengan SQL di panduan.`,
            'err',
        );
    }
    if (timer) clearInterval(timer);
    log(`MoneyLog aktif: cek tiap ${cfg.pollSeconds} detik -> channel ${cfg.channelId}.`, 'done');
    poll(client);
    timer = setInterval(() => poll(client), cfg.pollSeconds * 1000);
}

module.exports = { start, poll, buildEmbed, statusOf, lookupUcps, config: cfg };
