const fs = require('fs');
const path = require('path');
const { EmbedBuilder, escapeMarkdown } = require('discord.js');
const def = require('../defines');
const db = require('./query');
const { log } = require('../functions');
const moneylog = require('./moneylog-core');

const cfg = {
    enabled: true,
    channelId: 'YOUR_DISCORD_ID',
    table: 'moneylogs',
    utcOffsetHours: def.analytics?.utcOffsetHours ?? 7,
    checkSeconds: 30,
    catchUpDays: 3,
    topLimit: 0,
    perEmbed: 25,
    pageSize: 5000,
    charTable: 'player_characters',
    charNameColumn: 'Char_Name',
    charUcpColumn: 'Char_UCP',
    ...(def.incomelog ?? {}),
};

const STATE_FILE = path.join(__dirname, '..', 'data', 'incomelog-state.json');
let state = { lastDate: null };
try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (typeof s.lastDate === 'string') state.lastDate = s.lastDate;
} catch {}

function save() {
    try {
        const tmp = STATE_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(state));
        fs.renameSync(tmp, STATE_FILE);
    } catch (e) {
        log(`Gagal menyimpan incomelog-state.json: ${e.message}`, 'err');
    }
}

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

const fmtMoney = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Number(n) || 0).toLocaleString('en-US')}`;
const OFFSET_MS = () => cfg.utcOffsetHours * 3600 * 1000;
const pad = (n) => String(n).padStart(2, '0');

function dateKey(ms) {
    const d = new Date(ms + OFFSET_MS());
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function dayRange(key) {
    const [y, m, d] = key.split('-').map(Number);
    const start = (Date.UTC(y, m - 1, d) - OFFSET_MS()) / 1000;
    return { start, end: start + 86400 };
}

const addDays = (key, n) => {
    const [y, m, d] = key.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

let indexTried = false;
async function ensureIndex() {
    if (indexTried) return;
    indexTried = true;
    try {
        await q('CREATE INDEX `idx_created_at` ON ?? (`created_at`)', [cfg.table]);
    } catch {}
}

async function summarize(key) {
    await ensureIndex();
    const { start, end } = dayRange(key);
    const setRe = new RegExp(moneylog.config.setPattern, 'i');
    const map = new Map();
    let lastId = 0;

    for (;;) {
        const rows = await q(
            'SELECT `id`, `name`, `amount`, `reason` FROM ?? WHERE `created_at` >= FROM_UNIXTIME(?) AND `created_at` < FROM_UNIXTIME(?) AND `id` > ? ORDER BY `id` ASC LIMIT ?',
            [cfg.table, start, end, lastId, cfg.pageSize],
        );
        if (!rows.length) break;
        for (const r of rows) {
            lastId = r.id;
            if (setRe.test(String(r.reason ?? ''))) continue;
            const amount = Number(r.amount) || 0;
            if (!amount) continue;
            const e = map.get(r.name) ?? { name: r.name, income: 0, spent: 0, count: 0 };
            if (amount > 0) e.income += amount;
            else e.spent += -amount;
            e.count++;
            map.set(r.name, e);
        }
        if (rows.length < cfg.pageSize) break;
    }

    const list = [...map.values()].filter((e) => e.income > 0).sort((a, b) => b.income - a.income);
    const totalIncome = list.reduce((a, e) => a + e.income, 0);
    const totalSpent = [...map.values()].reduce((a, e) => a + e.spent, 0);
    return { rows: list, totalIncome, totalSpent, players: list.length };
}

const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

async function buildEmbeds(key) {
    const sum = await summarize(key);
    const { start } = dayRange(key);
    const shown = cfg.topLimit > 0 ? sum.rows.slice(0, cfg.topLimit) : sum.rows;

    let ucps = new Map();
    if (shown.length) {
        try {
            ucps = await moneylog.lookupUcps(shown.map((r) => r.name));
        } catch {}
    }

    const embeds = [];
    const head = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`Laporan Pendapatan Harian • ${key}`)
        .setDescription(`Periode <t:${start}:f> sampai <t:${start + 86400}:f>`)
        .addFields(
            { name: 'Pemain Berpendapatan', value: String(sum.players), inline: true },
            { name: 'Total Pendapatan', value: fmtMoney(sum.totalIncome), inline: true },
            { name: 'Total Pengeluaran', value: fmtMoney(sum.totalSpent), inline: true },
            {
                name: 'Rata-rata / Pemain',
                value: fmtMoney(sum.players ? Math.round(sum.totalIncome / sum.players) : 0),
                inline: true,
            },
        )
        .setFooter({ text: 'Sumber: moneylogs • "Di-set" admin tidak dihitung' })
        .setTimestamp();
    embeds.push(head);

    if (!shown.length) {
        head.addFields({ name: 'Rincian', value: 'Tidak ada pendapatan pemain tercatat pada hari ini.' });
        return embeds;
    }

    for (let i = 0; i < shown.length; i += cfg.perEmbed) {
        const chunk = shown.slice(i, i + cfg.perEmbed);
        const lines = chunk.map((r, k) => {
            const ucp = ucps.get(String(r.name).toLowerCase());
            const who = escapeMarkdown(ucp ? `${r.name}(${ucp})` : String(r.name));
            return `**${i + k + 1}.** ${cut(who, 40)}\n└ Masuk **${fmtMoney(r.income)}** • Keluar ${fmtMoney(r.spent)} • Bersih ${fmtMoney(r.income - r.spent)} • ${r.count}x`;
        });
        embeds.push(
            new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle(i === 0 ? 'Rincian Per Pemain' : null)
                .setDescription(lines.join('\n').slice(0, 4000)),
        );
    }
    return embeds;
}

async function sendReport(client, key, channelId = cfg.channelId) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) throw new Error(`channel ${channelId} tidak ditemukan atau bukan channel teks`);
    const embeds = await buildEmbeds(key);
    for (let i = 0; i < embeds.length; i += 10) {
        await channel.send({ embeds: embeds.slice(i, i + 10), allowedMentions: { parse: [] } });
    }
    return embeds.length;
}

let running = false;
let lastErrAt = 0;
async function tick(client) {
    if (running) return;
    running = true;
    try {
        const today = dateKey(Date.now());
        const yesterday = addDays(today, -1);

        if (state.lastDate === null) {
            state.lastDate = yesterday;
            save();
            log(`IncomeLog: mulai dari ${yesterday} (laporan lama tidak dikirim).`, 'info');
            return;
        }

        let next = addDays(state.lastDate, 1);
        const earliest = addDays(today, -cfg.catchUpDays);
        if (next < earliest) next = earliest;
        while (next <= yesterday) {
            await sendReport(client, next);
            state.lastDate = next;
            save();
            log(`IncomeLog: laporan ${next} terkirim.`, 'done');
            next = addDays(next, 1);
        }
    } catch (e) {
        if (Date.now() - lastErrAt > 60 * 1000) {
            lastErrAt = Date.now();
            log(`IncomeLog gagal: ${e.message ?? e}`, 'err');
        }
    } finally {
        running = false;
    }
}

let timer = null;
function start(client) {
    if (cfg.enabled === false) return log('IncomeLog dimatikan (incomelog.enabled = false).', 'warn');
    if (timer) clearInterval(timer);
    log(`IncomeLog aktif: rekap tiap pergantian hari (UTC+${cfg.utcOffsetHours}) -> channel ${cfg.channelId}.`, 'done');
    tick(client);
    timer = setInterval(() => tick(client), cfg.checkSeconds * 1000);
}

module.exports = { start, sendReport, summarize, dateKey, config: cfg };
