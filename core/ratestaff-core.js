const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const def = require('../defines');
const db = require('./query');
const { log } = require('../functions');

const cfg = {
    logChannelId: '',
    leaderRoleIds: [],
    alertRoleId: '',
    alertMaxStars: 2,
    cooldownHours: 24,
    minReviews: 3,
    table: 'player_characters',
    columns: { id: 'pID', name: 'Char_Name', adminName: 'Char_AdminName', level: 'Char_Admin' },
    adminLevelNames: {},
    color: '#F1C40F',
    leaderboardPosition: 'top',
    leaderboardSize: 10,
    ...(def.ratestaff ?? {}),
};
cfg.columns = {
    id: 'pID',
    name: 'Char_Name',
    adminName: 'Char_AdminName',
    level: 'Char_Admin',
    ...(def.ratestaff?.columns ?? {}),
};

const STATE_FILE = path.join(__dirname, '..', 'data', 'ratestaff-state.json');
const DRAFT_TTL = 15 * 60 * 1000;
const pending = new Map();
const drafts = new Map();

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

function load() {
    try {
        const d = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        return Array.isArray(d.entries) ? d : { entries: [] };
    } catch {
        return { entries: [] };
    }
}
const save = (d) => fs.writeFileSync(STATE_FILE, JSON.stringify(d, null, 2));

let staffCache = { time: 0, list: [] };
async function getStaff() {
    if (Date.now() - staffCache.time < 2 * 60 * 1000 && staffCache.list.length) return staffCache.list;
    const c = cfg.columns;
    const rows = await q(
        'SELECT ?? AS id, ?? AS charName, ?? AS adminName, ?? AS level FROM ?? WHERE ?? > 0 ORDER BY ?? ASC',
        [c.id, c.name, c.adminName, c.level, cfg.table, c.level, c.adminName],
    );
    const list = rows.map((r) => ({
        id: String(r.id),
        charName: String(r.charName ?? ''),
        name: r.adminName && r.adminName !== 'None' ? String(r.adminName) : String(r.charName ?? ''),
        level: r.level,
    }));
    staffCache = { time: Date.now(), list };
    return list;
}

function isLeader(interaction) {
    const id = interaction.user.id;
    if ([].concat(def.users?.ownerId ?? []).includes(id)) return true;
    if ([].concat(def.users?.developers ?? []).includes(id)) return true;
    const roles = interaction.member?.roles?.cache;
    return !!roles && cfg.leaderRoleIds.some((r) => roles.has(r));
}

const stars = (n) => '⭐'.repeat(Math.round(n)) + '▫️'.repeat(5 - Math.round(n));
const levelName = (lvl) => cfg.adminLevelNames[lvl] ?? `Level ${lvl}`;
const cut = (t, max) => {
    const s = String(t);
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
};
const clean = (v) => String(v ?? '').replace(/`/g, "'");

function statsFor(staffId, entries = load().entries) {
    const list = entries.filter((e) => e.staffId === String(staffId));
    const count = list.length;
    const avg = count ? list.reduce((s, e) => s + e.stars, 0) / count : 0;
    const dist = [0, 0, 0, 0, 0, 0];
    for (const e of list) dist[e.stars]++;
    return { list, count, avg, dist };
}

function cooldownLeft(userId, staffId) {
    const limit = cfg.cooldownHours * 3600 * 1000;
    const last = load()
        .entries.filter((e) => e.raterId === userId && e.staffId === String(staffId))
        .reduce((m, e) => Math.max(m, e.timestamp), 0);
    const left = last + limit - Date.now();
    return left > 0 ? left : 0;
}

function reviewEmbed(entry, staffStats) {
    const embed = new EmbedBuilder()
        .setTitle('⭐ RATING STAFF BARU')
        .setDescription(
            [
                `## ${clean(entry.staffName)}`,
                `### ${stars(entry.stars)}  **${entry.stars} / 5**`,
                '',
                entry.reason ? `> ${cut(entry.reason, 900).replace(/\n/g, '\n> ')}` : '> *Tidak ada alasan tertulis.*',
            ].join('\n'),
        )
        .addFields(
            { name: '👤 Dari', value: entry.anonymous ? '🕶️ Anonim' : `<@${entry.raterId}>`, inline: true },
            { name: '🎮 Karakter Staff', value: `\`${clean(entry.charName)}\``, inline: true },
            {
                name: '📊 Rata-rata Sekarang',
                value: `**${staffStats.avg.toFixed(2)}** dari ${staffStats.count} ulasan`,
                inline: true,
            },
        )
        .setColor(entry.stars <= cfg.alertMaxStars ? '#E74C3C' : cfg.color)
        .setFooter({ text: `Expensive Roleplay • Rate Staff • ID ${entry.id}`, iconURL: def.icon?.thumbnail })
        .setTimestamp(entry.timestamp);
    if (def.icon?.thumbnail) embed.setThumbnail(def.icon.thumbnail);
    return embed;
}

async function submit(client, interaction, draft) {
    const data = load();
    const entry = {
        id: data.entries.length + 1,
        staffId: draft.staff.id,
        staffName: draft.staff.name,
        charName: draft.staff.charName,
        stars: draft.stars,
        reason: draft.reason,
        anonymous: draft.anonymous,
        raterId: interaction.user.id,
        raterTag: interaction.user.tag,
        timestamp: Date.now(),
    };
    data.entries.push(entry);
    save(data);

    let logged = false;
    if (cfg.logChannelId) {
        try {
            const channel = await client.channels.fetch(cfg.logChannelId);
            const low = entry.stars <= cfg.alertMaxStars && cfg.alertRoleId;
            await channel.send({
                content: low
                    ? `🚨 <@&${cfg.alertRoleId}> ada ulasan bintang rendah untuk **${clean(entry.staffName)}**.`
                    : undefined,
                embeds: [reviewEmbed(entry, statsFor(entry.staffId, data.entries))],
                allowedMentions: { roles: low ? [cfg.alertRoleId] : [], users: [] },
            });
            logged = true;
        } catch (err) {
            log(`Rate Staff: gagal mengirim ke channel log (${cfg.logChannelId}): ${err.message}`, 'warn');
        }
    } else {
        log('Rate Staff: logChannelId belum diisi, ulasan hanya disimpan.', 'warn');
    }
    scheduleRefresh(client);
    return { entry, logged };
}

async function rankStaff(limit = cfg.leaderboardSize) {
    const { entries } = load();
    let staff = [];
    try {
        staff = await getStaff();
    } catch {}

    const byStaff = new Map();
    for (const e of entries) {
        const cur = byStaff.get(e.staffId) ?? { id: e.staffId, name: e.staffName, sum: 0, count: 0 };
        cur.sum += e.stars;
        cur.count++;
        const live = staff.find((x) => x.id === e.staffId);
        if (live) {
            cur.name = live.name;
            cur.level = live.level;
        }
        byStaff.set(e.staffId, cur);
    }
    return {
        total: entries.length,
        ranked: [...byStaff.values()]
            .filter((x) => x.count >= cfg.minReviews)
            .map((x) => ({ ...x, avg: x.sum / x.count }))
            .sort((a, b) => b.avg - a.avg || b.count - a.count)
            .slice(0, limit),
    };
}

const MEDALS = ['🥇', '🥈', '🥉'];

async function leaderboardEmbed() {
    const { ranked, total } = await rankStaff();
    const now = Math.floor(Date.now() / 1000);
    const body = ranked.length
        ? ranked
              .map((x, i) =>
                  [
                      `### ${MEDALS[i] ?? `\`#${i + 1}\``} **${clean(x.name)}**`,
                      `> ${stars(x.avg)}  **${x.avg.toFixed(2)} / 5**  •  💬 ${x.count} ulasan`,
                  ].join('\n'),
              )
              .join('\n')
        : `### Belum ada peringkat\nStaff akan muncul di sini setelah menerima minimal **${cfg.minReviews} ulasan**.`;

    const embed = new EmbedBuilder()
        .setTitle('🏆  TOP STAFF — RATING PEMAIN')
        .setDescription(`${body}\n\n📊 Total **${total}** ulasan  •  🔄 Diperbarui <t:${now}:R>`)
        .setColor(cfg.color);
    return embed;
}

function panelEmbed() {
    const embed = new EmbedBuilder()
        .setTitle('⭐  RATE STAFF — EXPENSIVE ROLEPLAY')
        .setDescription(
            [
                '## Bagaimana pelayanan staff kami?',
                'Penilaianmu membantu kami menjaga kualitas pelayanan di **Expensive Roleplay**.',
                '',
                '### 📌 Cara Menilai',
                '**1.** Klik tombol **⭐ Rate Staff** di bawah.',
                '**2.** Pilih **staff** yang ingin kamu nilai.',
                '**3.** Pilih **bintang 1 – 5** dan tulis alasan (boleh dikosongkan).',
                '**4.** Periksa pratinjau, lalu tekan **Kirim**.',
                '',
                '### ⚠️ Ketentuan',
                `• Satu staff hanya bisa dinilai **1x per ${cfg.cooldownHours} jam** oleh orang yang sama.`,
                '• Nilailah dengan **jujur dan sopan**. Ulasan palsu atau spam bisa dikenai sanksi.',
                '• Kamu bisa memilih **kirim anonim**. Namamu disembunyikan dari tampilan, namun tetap tercatat untuk pimpinan jika terjadi penyalahgunaan.',
                '',
                '**Terima kasih sudah ikut membangun kota yang lebih baik!** 💛',
            ].join('\n'),
        )
        .setColor('#F1C40F')
        .setFooter({ text: '© 2026 Expensive Roleplay • All Rights Reserved.', iconURL: def.icon?.thumbnail })
        .setTimestamp();
    if (def.icon?.thumbnail) embed.setThumbnail(def.icon.thumbnail);
    return embed;
}

async function panelPayload() {
    const board = await leaderboardEmbed();
    const panel = panelEmbed();
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('button-ratestaff')
            .setLabel('Rate Staff')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⭐'),
    );
    return {
        embeds: cfg.leaderboardPosition === 'bottom' ? [panel, board] : [board, panel],
        components: [row],
    };
}

async function refreshPanel(client) {
    const ref = load().panel;
    if (!ref?.channelId || !ref?.messageId) return false;
    try {
        const channel = await client.channels.fetch(ref.channelId);
        const message = await channel.messages.fetch(ref.messageId);
        await message.edit(await panelPayload());
        return true;
    } catch (err) {
        log(`Rate Staff: gagal memperbarui panel: ${err.message}`, 'warn');
        if (err.code === 10008 || err.code === 10003) {
            const data = load();
            delete data.panel;
            save(data);
        }
        return false;
    }
}

let refreshTimer = null;
function scheduleRefresh(client, delay = 3000) {
    if (refreshTimer) return;
    refreshTimer = setTimeout(() => {
        refreshTimer = null;
        refreshPanel(client);
    }, delay);
}

async function postPanel(channel) {
    const data = load();
    const old = data.panel;
    const msg = await channel.send(await panelPayload());
    data.panel = { channelId: channel.id, messageId: msg.id };
    save(data);
    if (old?.messageId) {
        try {
            await (await channel.client.channels.fetch(old.channelId)).messages.delete(old.messageId);
        } catch {}
    }
    return msg;
}

module.exports = {
    cfg,
    pending,
    drafts,
    DRAFT_TTL,
    getStaff,
    isLeader,
    stars,
    levelName,
    cut,
    clean,
    load,
    statsFor,
    cooldownLeft,
    reviewEmbed,
    submit,
    rankStaff,
    leaderboardEmbed,
    panelEmbed,
    panelPayload,
    refreshPanel,
    scheduleRefresh,
    postPanel,
};
