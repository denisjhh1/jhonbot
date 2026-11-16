const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const def = require('../defines');
const db = require('./query');
const { log } = require('../functions');

const cfg = {
    enabled: true,
    intervalMinutes: 60,
    limit: 10,
    table: 'player_characters',
    channels: {},
    ...(def.leaderboard ?? {}),
};

const COL = {
    money: {
        name: 'Char_Name',
        cash: 'Char_Money',
        bank: 'Char_BankMoney',
        level: 'Char_Level',
        admin: 'Char_Admin',
        ...(def.topmoney?.columns ?? {}),
    },
    admin: {
        name: 'Char_Name',
        adminName: 'Char_AdminName',
        level: 'Char_Admin',
        point: 'Char_AdminPoint',
        ask: 'Char_AskPoints',
        report: 'Char_ReportPoints',
        ...(def.topadmin?.columns ?? {}),
    },
    online: { name: 'Char_Name', time: 'Char_OnlineTimer', level: 'Char_Level', ...(def.toponline?.columns ?? {}) },
};
const TIME_UNIT = def.toponline?.timeUnit ?? 'seconds';
const UNIT_SECONDS = { seconds: 1, minutes: 60, hours: 3600 };
const ADMIN_LEVEL_NAMES = def.topadmin?.adminLevelNames ?? {};

const STATE_FILE = path.join(__dirname, '..', 'data', 'leaderboard-state.json');

let state = { panels: {} };
try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (s.panels && typeof s.panels === 'object') {
        state.panels = s.panels;
    } else if (s.channelId && s.messages) {
        for (const [key, messageId] of Object.entries(s.messages))
            state.panels[key] = { channelId: s.channelId, messageId };
    }
} catch {}
function save() {
    try {
        const tmp = STATE_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
        fs.renameSync(tmp, STATE_FILE);
    } catch (e) {
        log(`Gagal menyimpan leaderboard-state.json: ${e.message}`, 'err');
    }
}

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

const medals = ['🥇', '🥈', '🥉'];
const clean = (v) => String(v ?? '').replace(/`/g, "'");
const fmtMoney = (n) => `$${Number(n ?? 0).toLocaleString('id-ID')}`;
const fmtNum = (n) => Number(n ?? 0).toLocaleString('id-ID');

function formatDuration(value) {
    const total = Math.max(0, Math.floor(Number(value) || 0) * (UNIT_SECONDS[TIME_UNIT] ?? 1));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const parts = [];
    if (d) parts.push(`${d} Hari`);
    if (h || d || TIME_UNIT === 'hours') parts.push(`${h} Jam`);
    if (TIME_UNIT !== 'hours') parts.push(`${m} Menit`);
    return parts.join(' ');
}

function baseEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor('#FFD700')
        .setThumbnail(def.icon?.thumbnail ?? null)
        .setFooter({
            text: `Management Server • Diperbarui otomatis tiap ${cfg.intervalMinutes} menit`,
            iconURL: def.icon?.thumbnail,
        })
        .setTimestamp();
}

const emptyEmbed = (title, text) => baseEmbed(title, `⚠️ ${text}`);

async function buildMoney() {
    const c = COL.money;
    const total = '(COALESCE(??, 0) + COALESCE(??, 0))';
    const rows = await q(
        `SELECT ?? AS name, ?? AS cash, ?? AS bank, ?? AS level FROM ?? WHERE ${total} > 0 AND COALESCE(??, 0) = 0 ORDER BY ${total} DESC, ?? ASC LIMIT ?`,
        [c.name, c.cash, c.bank, c.level, cfg.table, c.cash, c.bank, c.admin, c.cash, c.bank, c.name, cfg.limit],
    );
    if (!rows.length) return emptyEmbed('💰 TOP HARTA', 'Belum ada data harta pemain.');
    const lines = rows.map((r, i) => {
        const rank = medals[i] ?? `\`#${i + 1}\``;
        const sum = Number(r.cash ?? 0) + Number(r.bank ?? 0);
        return `### ${rank} **${clean(r.name)}** \`[Lv. ${r.level}]\`\n> 💵 Cash: \`${fmtMoney(r.cash)}\`  •  🏦 Bank: \`${fmtMoney(r.bank)}\`\n> 💰 **Total:** \`${fmtMoney(sum)}\``;
    });
    return baseEmbed(
        `💰 TOP ${rows.length} HARTA`,
        `Diurutkan berdasarkan **Total Harta (Cash + Bank)**\n\n${lines.join('\n\n')}`,
    );
}

async function buildAdmin() {
    const c = COL.admin;
    const rows = await q(
        'SELECT ?? AS name, ?? AS adminName, ?? AS level, ?? AS point FROM ?? WHERE ?? > 0 AND COALESCE(??, 0) > 0 ORDER BY ?? DESC, ?? ASC LIMIT ?',
        [c.name, c.adminName, c.level, c.point, cfg.table, c.level, c.point, c.point, c.name, cfg.limit],
    );
    if (!rows.length) return emptyEmbed('🛡️ TOP ADMIN', 'Belum ada admin dengan point.');
    const lines = rows.map((r, i) => {
        const rank = medals[i] ?? `\`#${i + 1}\``;
        const display = r.adminName && r.adminName !== 'None' ? r.adminName : r.name;
        const lvl = ADMIN_LEVEL_NAMES[r.level] ?? `Level ${r.level}`;
        return `### ${rank} **${clean(display)}**\n> ⭐ Admin Point: \`${fmtNum(r.point)}\`\n> 📌 *Char: \`${clean(r.name)}\` • ${lvl}*`;
    });
    return baseEmbed(`🛡️ TOP ${rows.length} ADMIN`, `Diurutkan berdasarkan **Admin Point**\n\n${lines.join('\n\n')}`);
}

async function buildOnline() {
    const c = COL.online;
    const rows = await q('SELECT ?? AS name, ?? AS time, ?? AS level FROM ?? WHERE ?? > 0 ORDER BY ?? DESC LIMIT ?', [
        c.name,
        c.time,
        c.level,
        cfg.table,
        c.time,
        c.time,
        cfg.limit,
    ]);
    if (!rows.length) return emptyEmbed('👑 TOP PLAYTIME', 'Belum ada data waktu online.');
    const lines = rows.map((r, i) => {
        const rank = medals[i] ?? `\`#${i + 1}\``;
        return `### ${rank} **${clean(r.name)}** \`[Lv. ${r.level}]\`\n> ⏳ **Total Playtime:** \`${formatDuration(r.time)}\``;
    });
    return baseEmbed(`👑 TOP ${rows.length} PLAYTIME`, lines.join('\n\n'));
}

const BUILDERS = { money: buildMoney, admin: buildAdmin, online: buildOnline };
const KEYS = Object.keys(BUILDERS);

async function buildSafe(key) {
    try {
        return await BUILDERS[key]();
    } catch (e) {
        log(`Leaderboard ${key} gagal dibuat: ${e.message}`, 'err');
        return null;
    }
}

const LABEL = { money: 'Top Harta', admin: 'Top Admin', online: 'Top Online' };
const TITLE_RE = { money: /TOP.*HARTA/i, admin: /TOP.*ADMIN/i, online: /TOP.*PLAYTIME/i };
const OPTS = { allowedMentions: { parse: [] } };

const isUnknownMessage = (e) => e?.code === 10008;
const isUnknownChannel = (e) => e?.code === 10003;

const targetChannelId = (key) => cfg.channels?.[key] || state.panels[key]?.channelId || null;

async function findPanelMessages(client, channel, key) {
    const recent = await channel.messages.fetch({ limit: 50 });
    return [...recent.values()]
        .filter(
            (m) =>
                m.author?.id === client.user.id &&
                m.embeds.length === 1 &&
                /Diperbarui otomatis/i.test(m.embeds[0].footer?.text ?? '') &&
                TITLE_RE[key].test(m.embeds[0].title ?? ''),
        )
        .sort((a, b) => b.createdTimestamp - a.createdTimestamp);
}

async function removeOld(client, panel) {
    if (!panel?.channelId || !panel?.messageId) return;
    const ch = await client.channels.fetch(panel.channelId).catch(() => null);
    const msg = ch?.isTextBased() ? await ch.messages.fetch(panel.messageId).catch(() => null) : null;
    if (msg) await msg.delete().catch(() => null);
}

const cleaned = new Set();

async function syncPanel(client, key, embed) {
    const channelId = targetChannelId(key);
    if (!channelId) return false;
    const saved = state.panels[key];

    let channel;
    try {
        channel = await client.channels.fetch(channelId);
    } catch (e) {
        log(
            `Leaderboard ${LABEL[key]}: channel ${channelId} ${isUnknownChannel(e) ? 'tidak ditemukan. Cek ID-nya / jalankan /panelleaderboard lagi' : `tidak bisa diakses sementara (${e.message})`}.`,
            'warn',
        );
        return false;
    }
    if (!channel?.isTextBased())
        return (log(`Leaderboard ${LABEL[key]}: channel ${channelId} bukan channel teks.`, 'warn'), false);

    if (saved && saved.channelId !== channelId) {
        await removeOld(client, saved);
        state.panels[key] = null;
    }

    const current = state.panels[key];
    if (current?.messageId) {
        try {
            const msg = await channel.messages.fetch(current.messageId);
            await msg.edit({ embeds: [embed], ...OPTS });
            if (!cleaned.has(key)) {
                cleaned.add(key);
                const dupes = (await findPanelMessages(client, channel, key).catch(() => [])).filter(
                    (m) => m.id !== msg.id,
                );
                for (const d of dupes) await d.delete().catch(() => null);
                if (dupes.length) log(`Leaderboard ${LABEL[key]}: ${dupes.length} pesan duplikat dihapus.`, 'info');
            }
            return false;
        } catch (e) {
            if (!isUnknownMessage(e)) {
                log(
                    `Leaderboard ${LABEL[key]}: gagal memperbarui (${e.message}). Dicoba lagi pada putaran berikutnya.`,
                    'warn',
                );
                return false;
            }
            log(`Leaderboard ${LABEL[key]}: pesan panel sudah dihapus, memasang ulang.`, 'warn');
        }
    }

    let found = [];
    try {
        found = await findPanelMessages(client, channel, key);
    } catch {}
    let msg = found[0] ?? null;
    for (const d of found.slice(1)) await d.delete().catch(() => null);
    if (msg) await msg.edit({ embeds: [embed], ...OPTS });
    else msg = await channel.send({ embeds: [embed], ...OPTS });
    state.panels[key] = { channelId: channel.id, messageId: msg.id };
    cleaned.add(key);
    return true;
}

async function installPanels(client, targets) {
    if (typeof targets?.send === 'function') targets = { money: targets, admin: targets, online: targets };
    const done = [];
    for (const key of KEYS) {
        const channel = targets?.[key];
        if (!channel) continue;
        await removeOld(client, state.panels[key]);
        const embed =
            (await buildSafe(key)) ??
            emptyEmbed('Leaderboard', 'Gagal mengambil data, akan dicoba lagi pada pembaruan berikutnya.');
        const msg = await channel.send({ embeds: [embed], ...OPTS });
        state.panels[key] = { channelId: channel.id, messageId: msg.id };
        cleaned.add(key);
        done.push(key);
        save();
    }
    return done;
}

let updating = false;

async function updateAll(client) {
    if (updating) return;
    updating = true;
    try {
        let changed = false;
        for (const key of KEYS) {
            if (!targetChannelId(key)) continue;
            const embed = await buildSafe(key);
            if (!embed) continue;
            try {
                if (await syncPanel(client, key, embed)) changed = true;
            } catch (e) {
                log(`Leaderboard ${LABEL[key]} gagal: ${e.message}`, 'err');
            }
        }
        if (changed) save();
    } catch (e) {
        log(`Leaderboard update gagal: ${e.message}`, 'err');
    } finally {
        updating = false;
    }
}

let timer = null;
function start(client) {
    if (cfg.enabled === false) return log('Leaderboard otomatis dimatikan (leaderboard.enabled = false).', 'warn');
    if (timer) clearInterval(timer);
    timer = setInterval(() => updateAll(client), cfg.intervalMinutes * 60 * 1000);
    const has = KEYS.some((k) => targetChannelId(k));
    if (has) updateAll(client);
    log(
        `Leaderboard otomatis aktif: diperbarui tiap ${cfg.intervalMinutes} menit${has ? '' : ' (belum ada panel, jalankan /panelleaderboard)'}.`,
        'done',
    );
}

module.exports = { start, installPanels, updateAll, buildMoney, buildAdmin, buildOnline, config: cfg, KEYS };
