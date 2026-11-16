const fs = require('fs');
const path = require('path');
const {
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
} = require('discord.js');
const def = require('../defines');
const { log } = require('../functions');

const cfg = def.dutyreport ?? {};
const MIN_MINUTES = cfg.minDutyMinutes ?? 160;
const REQUIRE_PROOF = cfg.requireProof ?? true;
const UTC_OFFSET = cfg.utcOffsetHours ?? 7;
const DRAFT_TTL = 10 * 60 * 1000;
const REPORT_COOLDOWN = 30 * 1000;
const MAX_IMAGES = 4;

const STATE_FILE = path.join(__dirname, '..', 'data', 'dutyreport-state.json');
let state = { threads: {}, reports: {}, counters: {}, lastRank: {} };
try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state = {
        threads: s.threads ?? {},
        reports: s.reports ?? {},
        counters: s.counters ?? {},
        lastRank: s.lastRank ?? {},
    };
} catch {}

function save() {
    try {
        const tmp = STATE_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(state));
        fs.renameSync(tmp, STATE_FILE);
    } catch (e) {
        log(`Gagal menyimpan dutyreport-state.json: ${e.message}`, 'err');
    }
}
const getReport = (messageId) => state.reports[messageId];

const drafts = new Map();
const lastReport = new Map();
setInterval(() => {
    for (const [k, v] of drafts) if (v.expires < Date.now()) drafts.delete(k);
}, 60 * 1000).unref();

const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const pad = (n) => String(n).padStart(4, '0');
const isImageName = (n) => /\.(png|jpe?g|gif|webp)$/i.test(n ?? '');

function parseDuration(input) {
    const s = String(input).toLowerCase().trim();
    let total = null;
    let m = s.match(/^(\d{1,2}):(\d{1,2})$/);
    if (m) total = +m[1] * 60 + +m[2];
    else {
        const h = s.match(/(\d+(?:[.,]\d+)?)\s*(?:jam|j|h|hr|hrs|hours?)/);
        const mi = s.match(/(\d+)\s*(?:menit|mnt|min|minutes?|m)\b/);
        if (h || mi) {
            total = (h ? Math.round(parseFloat(h[1].replace(',', '.')) * 60) : 0) + (mi ? +mi[1] : 0);
            if (h && !mi) {
                const tail = s.match(/(?:jam|j|h|hr|hrs|hours?)\s*(\d+)\s*$/);
                if (tail) total += +tail[1];
            }
        }
    }
    return total && total > 0 && total <= 24 * 60 ? total : null;
}

function fmtDur(min) {
    const h = Math.floor(min / 60),
        m = min % 60;
    return [h ? `${h} jam` : '', m ? `${m} menit` : ''].filter(Boolean).join(' ') || '0 menit';
}

const monthOf = (tsSec) => {
    const d = new Date((tsSec + UTC_OFFSET * 3600) * 1000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
};

function monthStats(userId, y, m) {
    let minutes = 0,
        count = 0;
    for (const r of Object.values(state.reports)) {
        if (userId && r.userId !== userId) continue;
        const mo = monthOf(r.ts);
        if (mo.y === y && mo.m === m) {
            minutes += r.minutes;
            count++;
        }
    }
    return { minutes, count };
}

const extraManagerIds = () => [...(def.users?.ownerId ?? []), ...(def.users?.developers ?? [])];
const reporterRoleIds = () =>
    (cfg.roleIds?.length ? cfg.roleIds : [def.bugreport?.adminRoleId, def.bugreport?.developerRoleId]).filter(Boolean);

const isManager = (member) =>
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    extraManagerIds().includes(member.id) ||
    [...(cfg.managerRoleIds ?? []), ...(cfg.izinDutyRoleIds ?? [])].some((id) => member.roles.cache.has(id));
const canReport = (member) => isManager(member) || reporterRoleIds().some((id) => member.roles.cache.has(id));
const canManage = (member, report) => isManager(member) || member.id === report.userId;

async function getForum(guild) {
    if (cfg.forumChannelId) {
        const c =
            guild.channels.cache.get(cfg.forumChannelId) ??
            (await guild.channels.fetch(cfg.forumChannelId).catch(() => null));
        if (c?.type === ChannelType.GuildForum) return c;
        throw new Error(
            `Channel forum duty (${cfg.forumChannelId}) tidak ditemukan atau bukan forum. Periksa def.dutyreport.forumChannelId.`,
        );
    }
    const forums = guild.channels.cache.filter((c) => c.type === ChannelType.GuildForum);
    const f =
        forums.find((c) => c.name.toLowerCase().includes('duty-staff')) ??
        forums.find((c) => c.name.toLowerCase().includes('duty'));
    if (!f)
        throw new Error('Forum duty tidak ditemukan. Isi def.dutyreport.forumChannelId dengan ID forum #duty-staff.');
    return f;
}

const cleanName = (member) => {
    const n = member.displayName ?? member.user.username;
    return (n.includes('|') ? n.split('|').pop() : n).trim() || member.user.username;
};

const threadLocks = new Map();
function getUserThread(guild, forum, member) {
    const key = member.id;
    if (threadLocks.has(key)) return threadLocks.get(key);
    const p = resolveThread(guild, forum, member).finally(() => threadLocks.delete(key));
    threadLocks.set(key, p);
    return p;
}

async function resolveThread(guild, forum, member) {
    const userId = member.id;
    const fetchThread = (id) => guild.channels.fetch(id).catch(() => null);

    for (const id of [cfg.threadOverrides?.[userId], state.threads[userId]]) {
        if (!id) continue;
        const t = await fetchThread(id);
        if (t?.isThread() && t.parentId === forum.id) return t;
    }

    const owned = [];
    const active = await forum.threads.fetchActive().catch(() => null);
    if (active) owned.push(...active.threads.filter((t) => t.ownerId === userId).values());
    if (!owned.length) {
        const arch = await forum.threads.fetchArchived({ type: 'public', fetchAll: true }).catch(() => null);
        if (arch) owned.push(...arch.threads.filter((t) => t.ownerId === userId).values());
    }
    if (owned.length) {
        const t = owned.find((x) => /^duty/i.test(x.name)) ?? owned[0];
        state.threads[userId] = t.id;
        save();
        return t;
    }

    const t = await forum.threads.create({
        name: cut(`DUTY ${cleanName(member).toUpperCase()}`, 100),
        message: {
            content: `🛡️ Thread laporan duty milik <@${userId}>.\nSemua laporan duty ${cleanName(member)} dikumpulkan di sini.`,
            allowedMentions: { parse: [] },
        },
        reason: `Thread duty untuk ${member.user.tag}`,
    });
    state.threads[userId] = t.id;
    save();
    log(`Thread duty dibuat untuk ${member.user.tag} (${t.id})`, 'info');
    return t;
}

function buildEmbed(r) {
    const below = r.minutes < MIN_MINUTES;
    const embed = new EmbedBuilder()
        .setTitle(`🛡️ Laporan Duty #${pad(r.num)}`)
        .setDescription(`**🛠️ Aktivitas**\n${cut(r.activity, 3500)}`)
        .setColor(r.approvedBy ? 'Green' : below ? 'Orange' : 'Blue')
        .addFields(
            { name: '👤 Nama DC', value: `<@${r.userId}>`, inline: true },
            { name: '🎖️ Pangkat', value: cut(r.rank, 100), inline: true },
            {
                name: '⏱️ Durasi Duty',
                value: fmtDur(r.minutes) + (below ? `\n⚠️ Di bawah minimal ${fmtDur(MIN_MINUTES)}` : ' ✅'),
                inline: true,
            },
        );
    if (r.note) embed.addFields({ name: '📝 Catatan', value: cut(r.note, 1024) });
    if (r.failedLinks?.length)
        embed.addFields({ name: '📎 Bukti (gagal diunggah ulang)', value: cut(r.failedLinks.join('\n'), 1024) });
    embed.addFields(
        {
            name: '📌 Status',
            value: r.approvedBy ? `✅ Disetujui oleh <@${r.approvedBy}>` : '⏳ Menunggu review',
            inline: true,
        },
        { name: '🕒 Dilaporkan', value: `<t:${r.ts}:F>`, inline: true },
    );
    embed.setFooter({ text: `Laporan #${pad(r.num)}${r.edited ? ' • diedit' : ''}` });

    const imgs = r.images ?? (r.image ? [r.image] : []);
    if (!imgs.length) return [embed];
    const galleryUrl = r.guildId ? `https://discord.com/channels/${r.guildId}/${r.threadId}` : null;
    embed.setImage(`attachment://${imgs[0]}`);
    if (!galleryUrl) return [embed];
    embed.setURL(galleryUrl);
    return [embed, ...imgs.slice(1).map((n) => new EmbedBuilder().setURL(galleryUrl).setImage(`attachment://${n}`))];
}

function reportComponents(r) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('duty-edit')
                .setLabel('Edit')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('✏️'),
            new ButtonBuilder()
                .setCustomId('duty-delete')
                .setLabel('Hapus')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️'),
            new ButtonBuilder()
                .setCustomId('duty-approve')
                .setLabel(r.approvedBy ? 'Batalkan Persetujuan' : 'Setujui')
                .setStyle(r.approvedBy ? ButtonStyle.Secondary : ButtonStyle.Success)
                .setEmoji(r.approvedBy ? '↩️' : '✅'),
        ),
    ];
}

const render = (r) => ({ embeds: buildEmbed(r), components: reportComponents(r) });

async function createReport(interaction, draft) {
    const guild = interaction.guild;
    const member = interaction.member;
    const forum = await getForum(guild);
    const thread = await getUserThread(guild, forum, member);
    if (thread.archived) await thread.setArchived(false).catch(() => {});

    const num = (state.counters[member.id] = (state.counters[member.id] ?? 0) + 1);

    const files = [];
    const failedLinks = [];
    for (const [i, f] of draft.files.entries()) {
        try {
            const res = await fetch(f.url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buf = Buffer.from(await res.arrayBuffer());
            const ext = (f.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? 'png').toLowerCase();
            files.push(new AttachmentBuilder(buf, { name: `duty-${pad(num)}-${i + 1}.${ext}` }));
        } catch (e) {
            log(`Gagal mengunduh bukti ${f.name}: ${e.message}`, 'warn');
            failedLinks.push(f.url);
        }
    }

    const report = {
        userId: member.id,
        num,
        rank: draft.rank,
        minutes: draft.minutes,
        activity: draft.activity,
        note: draft.note || '',
        images: files
            .filter((a) => isImageName(a.name))
            .map((a) => a.name)
            .slice(0, MAX_IMAGES),
        failedLinks,
        ts: Math.floor(Date.now() / 1000),
        edited: false,
        approvedBy: null,
        threadId: thread.id,
        guildId: guild.id,
    };

    const msg = await thread.send({ ...render(report), files, allowedMentions: { parse: [] } });

    state.reports[msg.id] = report;
    state.lastRank[member.id] = draft.rank;
    save();
    lastReport.set(member.id, Date.now());
    return { msg, thread, num, report };
}

module.exports = {
    cfg,
    MIN_MINUTES,
    REQUIRE_PROOF,
    DRAFT_TTL,
    REPORT_COOLDOWN,
    MAX_IMAGES,
    state,
    save,
    getReport,
    drafts,
    lastReport,
    cut,
    pad,
    isImageName,
    parseDuration,
    fmtDur,
    monthOf,
    monthStats,
    isManager,
    canReport,
    canManage,
    getForum,
    getUserThread,
    buildEmbed,
    reportComponents,
    render,
    createReport,
};
