const fs = require('fs');
const path = require('path');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    LabelBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    FileUploadBuilder,
    AttachmentBuilder,
    MessageFlags,
} = require('discord.js');

const def = require('../defines');
const { log } = require('../functions');

const DEFAULTS = {
    open: true,
    maxImages: 4,
    draftMinutes: 15,
    allowSelfApprove: false,
    claimBenefitChannelId: 'YOUR_DISCORD_ID',
    logChannelId: 'YOUR_DISCORD_ID',
    channels: {
        vip: 'YOUR_DISCORD_ID',
        ladies: 'YOUR_DISCORD_ID',
        faction: 'YOUR_DISCORD_ID',
        streamer: 'YOUR_DISCORD_ID',
        workshop: 'YOUR_DISCORD_ID',
    },
    roles: {},
};

const cfg = { ...DEFAULTS, ...(def.req ?? {}) };
cfg.channels = { ...DEFAULTS.channels, ...(def.req?.channels ?? {}) };

const STAFF = 'YOUR_DISCORD_ID';
const ADMIN_VIP = 'YOUR_DISCORD_ID';
const APPROVER = 'YOUR_DISCORD_ID';
const LADIES_MGR = 'YOUR_DISCORD_ID';

const IMG_RE = /\.(png|jpe?g|gif|webp)$/i;

const FILE = (label, description) => ({ id: 'bukti', kind: 'file', label, description });

const TYPES = {
    vip: {
        short: 'Daftarkan VIP (Nexus / Cyber / Quantum)',
        key: 'vip',
        title: '💎 REQUEST VIP',
        emoji: '💎',
        color: 0x8b5cf6,
        button: 'Request VIP',
        tags: [ADMIN_VIP],
        approvers: [APPROVER],
        intro: 'Ajukan **VIP** milikmu agar role VIP dipasang oleh admin.',
        grantNote: 'Role VIP sesuai pilihanmu (Nexus / Cyber / Quantum)',
        fields: [
            {
                id: 'karakter',
                kind: 'text',
                label: 'Nama Karakter',
                embedLabel: '**🧑 Nama Karakter**',
                placeholder: 'Contoh: Samuel_Zah',
                min: 3,
                max: 40,
            },
            {
                id: 'vip',
                kind: 'select',
                label: 'Nama VIP',
                embedLabel: '**💎 Nama VIP**',
                placeholder: 'Pilih jenis VIP...',
                options: [
                    { value: 'nexus', label: 'Nexus', roleId: 'YOUR_DISCORD_ID' },
                    { value: 'cyber', label: 'Cyber', roleId: 'YOUR_DISCORD_ID' },
                    { value: 'quantum', label: 'Quantum', roleId: 'YOUR_DISCORD_ID' },
                ],
            },
            {
                id: 'expired',
                kind: 'text',
                label: 'Masa Kadaluwarsa',
                embedLabel: '**⏳ Masa Kadaluwarsa**',
                placeholder: 'Contoh: 30 hari / 25 November 2026',
                min: 2,
                max: 60,
            },
            FILE('Screenshot / Stats VIP', 'Wajib minimal 1 gambar sebagai bukti.'),
        ],
        grant: (d) => [TYPES.vip.fields[1].options.find((o) => o.value === d.vip)?.roleId],
    },

    ladies: {
        short: 'Verifikasi Girl Expensive (Voice Oncam)',
        key: 'ladies',
        title: '🎀 REQUEST GIRL Expensive',
        emoji: '🎀',
        color: 0xec4899,
        button: 'Request Ladies',
        tags: [LADIES_MGR, STAFF],
        approvers: [APPROVER, LADIES_MGR],
        intro: 'Daftar sebagai **Girl Expensive** melalui formulir OOC & IC. Keaslian dibuktikan melalui **oncam di channel voice** bersama Management.',
        grantNote: 'Role Ladies (setelah admin memastikan keaslian via voice oncam)',
        showClaimBenefit: true,
        fields: [
            {
                id: 'ooc_nama',
                kind: 'text',
                label: 'OOC — Nama',
                embedLabel: '**👤 OOC — Nama**',
                placeholder: 'Nama asli / panggilan',
                min: 2,
                max: 40,
            },
            {
                id: 'umur',
                kind: 'text',
                label: 'OOC — Umur',
                embedLabel: '**🎂 OOC — Umur**',
                placeholder: 'Contoh: 20',
                min: 2,
                max: 2,
                validate: (v) =>
                    /^\d{2}$/.test(v) && Number(v) >= 13 ? null : 'Umur harus berupa angka (minimal 13 tahun).',
            },
            {
                id: 'askot',
                kind: 'text',
                label: 'OOC — Asal Kota',
                embedLabel: '**📍 OOC — Asal Kota**',
                placeholder: 'Contoh: Surabaya',
                min: 2,
                max: 40,
            },
            {
                id: 'ic_nama',
                kind: 'text',
                label: 'IC — Nama',
                embedLabel: '**🎭 IC — Nama**',
                placeholder: 'Contoh: Aurelia_Rose',
                min: 3,
                max: 40,
            },
            {
                id: 'rp',
                kind: 'text',
                label: 'IC — Roleplay Sebagai',
                embedLabel: '**🎬 IC — Roleplay Sebagai**',
                placeholder: 'Contoh: Penyanyi / Model / Host',
                min: 2,
                max: 60,
            },
            {
                id: 'oncam',
                kind: 'select',
                label: 'Siap Oncam?',
                embedLabel: '**📹 Siap Oncam**',
                placeholder: 'Pilih jawaban...',
                options: [
                    { value: 'ya', label: 'Ya, siap oncam' },
                    { value: 'tidak', label: 'Tidak siap oncam' },
                ],
            },
        ],
        stepSizes: [5, 1],
        oncam: true,
        grant: () => rolesFor('ladies') ?? ['YOUR_DISCORD_ID'],
    },

    faction: {
        short: 'Pengajuan Role Faction',
        key: 'faction',
        title: '💼 REQUEST FACTION',
        emoji: '💼',
        color: 0x0ea5e9,
        button: 'Request Faction',
        tags: [STAFF],
        approvers: [APPROVER],
        intro: 'Ajukan role **Faction** untuk karakter pilihanmu.',
        grantNote: 'Role Faction sesuai pilihan',
        fields: [
            {
                id: 'ucp',
                kind: 'text',
                label: 'Nama UCP',
                embedLabel: '**🪪 Nama UCP**',
                placeholder: 'Contoh: Samuelzah',
                min: 3,
                max: 40,
            },
            {
                id: 'ic',
                kind: 'text',
                label: 'Nama IC',
                embedLabel: '**🧑 Nama IC**',
                placeholder: 'Contoh: Samuel_Zah',
                min: 3,
                max: 40,
            },
            {
                id: 'faction',
                kind: 'select',
                label: 'Faction',
                embedLabel: '**🏢 Faction**',
                placeholder: 'Pilih faction...',
                options: [
                    { value: 'polisi', label: 'Polisi', roleId: 'YOUR_DISCORD_ID' },
                    { value: 'medis', label: 'Medis', roleId: 'YOUR_DISCORD_ID' },
                    { value: 'militer', label: 'Militer', roleId: 'YOUR_DISCORD_ID' },
                    { value: 'pemerintah', label: 'Pemerintah', roleId: 'YOUR_DISCORD_ID' },
                    { value: 'pedagang', label: 'Pedagang', roleId: 'YOUR_DISCORD_ID' },
                    { value: 'mekanik', label: 'Mekanik', roleId: 'YOUR_DISCORD_ID' },
                    { value: 'news', label: 'News', roleId: 'YOUR_DISCORD_ID' },
                    { value: 'apra', label: 'apra', roleId: 'YOUR_DISCORD_ID' },
                ],
            },
            {
                id: 'status',
                kind: 'text',
                label: 'Status / Jabatan',
                embedLabel: '**🎖️ Status / Jabatan**',
                placeholder: 'Contoh: HR Director / Anggota',
                min: 2,
                max: 60,
            },
            FILE('Stats SS (Wajib)', 'Wajib minimal 1 gambar sebagai bukti.'),
        ],
        grant: (d) => [TYPES.faction.fields[2].options.find((o) => o.value === d.faction)?.roleId],
    },

    streamer: {
        short: 'Role Streamer & Content Creator',
        key: 'streamer',
        title: '🎥 CONTENT CREATOR',
        emoji: '🎥',
        color: 0xf43f5e,
        button: 'Request Streamer / Creator',
        tags: [STAFF],
        approvers: [APPROVER],
        intro: 'Ajukan kualifikasi role **Streamer** & **Content Creator**.',
        grantNote: 'Role Streamer + Content Creator',
        fields: [
            {
                id: 'media',
                kind: 'select',
                label: 'Platform Media',
                embedLabel: '**📺 Platform Media**',
                placeholder: 'Pilih platform...',
                options: [
                    { value: 'TikTok', label: 'TikTok' },
                    { value: 'YouTube', label: 'YouTube' },
                    { value: 'Instagram', label: 'Instagram' },
                    { value: 'Facebook', label: 'Facebook' },
                ],
            },
            {
                id: 'link',
                kind: 'text',
                label: 'Link Profil Media',
                embedLabel: '**🔗 Link Profil Media**',
                placeholder: 'https://www.tiktok.com/@namaakun',
                min: 8,
                max: 300,
                normalize: (v) => (/^(www\.|[a-z0-9-]+\.(com|tv|be|co)\b)/i.test(v) ? `https://${v}` : v),
                validate: (v) =>
                    /^https?:\/\/\S+$/i.test(v) ? null : 'Link akun harus berupa URL yang valid (diawali https://).',
            },
            {
                id: 'preview',
                kind: 'text',
                label: 'Preview Penonton Max',
                embedLabel: '**👁️ Preview Penonton Max**',
                placeholder: 'Rata-rata / penonton terbanyak, contoh: 150',
                min: 1,
                max: 40,
            },
            {
                id: 'kategori',
                kind: 'text',
                label: 'Kategori Konten',
                embedLabel: '**🎮 Kategori Konten**',
                placeholder: 'Contoh: Gaming / Roleplay',
                min: 2,
                max: 60,
            },
            FILE('Bukti Follower', 'Wajib minimal 1 gambar sebagai bukti.'),
        ],
        grant: () => rolesFor('streamer') ?? ['YOUR_DISCORD_ID', 'YOUR_DISCORD_ID'],
    },

    workshop: {
        short: 'Registrasi Workshop Resmi',
        key: 'workshop',
        title: '🔧 REQUEST WORKSHOP',
        emoji: '🔧',
        color: 0xf59e0b,
        button: 'Request Workshop',
        tags: [STAFF],
        approvers: [APPROVER],
        intro: 'Ajukan pendaftaran **Workshop** resmi server.',
        grantNote: null,
        fields: [
            {
                id: 'karakter',
                kind: 'text',
                label: 'Nama Karakter',
                embedLabel: '**🧑 Nama Karakter**',
                placeholder: 'Contoh: Samuel_Zah',
                min: 3,
                max: 40,
            },
            {
                id: 'workshop',
                kind: 'text',
                label: 'Nama Workshop',
                embedLabel: '**🔧 Nama Workshop**',
                placeholder: 'Nama workshop yang diajukan',
                min: 2,
                max: 60,
            },
            {
                id: 'note',
                kind: 'paragraph',
                label: 'Catatan Tambahan',
                embedLabel: '**📝 Catatan Tambahan**',
                placeholder: 'Keterangan tambahan jika ada',
                max: 500,
                optional: true,
            },
            FILE('Screenshot', 'Wajib minimal 1 gambar sebagai bukti.'),
        ],
        grant: () => rolesFor('workshop') ?? [],
    },
};

function rolesFor(type) {
    const o = cfg.roles?.[type];
    return Array.isArray(o) ? o.filter(Boolean) : null;
}

const fileField = (t) => t.fields.find((f) => f.kind === 'file');

function stepsOf(t) {
    const sizes = t.stepSizes ?? [t.fields.length];
    const out = [];
    let i = 0;
    for (const n of sizes) {
        out.push(t.fields.slice(i, i + n));
        i += n;
    }
    return out;
}

const approverRoleIds = (t) => [...new Set([...(cfg.approverRoleIds ?? []), ...(t?.approvers ?? [])])].filter(Boolean);
const approverUserIds = () => [...[].concat(def.users?.ownerId ?? []), ...[].concat(def.users?.developers ?? [])];

const STATE_FILE = path.join(__dirname, '..', 'data', 'req-state.json');
let state = { counter: 0, requests: {} };

try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state = { counter: s.counter ?? 0, requests: s.requests ?? {} };
} catch {}

function save() {
    try {
        const tmp = STATE_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
        fs.renameSync(tmp, STATE_FILE);
    } catch (e) {
        log(`Gagal menyimpan req-state.json: ${e.message}`, 'err');
    }
}

const drafts = new Map();
const draftKey = (userId, type) => `${userId}:${type}`;
const DRAFT_TTL = () => cfg.draftMinutes * 60 * 1000;
setInterval(() => {
    const n = Date.now();
    for (const [k, d] of drafts) if (d.expires < n) drafts.delete(k);
}, 60 * 1000).unref?.();

const pad = (n) => String(n).padStart(4, '0');
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
const nowSec = () => Math.floor(Date.now() / 1000);
const getReq = (num) => state.requests[String(num)];
const getType = (key) => TYPES[key];
const NO_MENTIONS = { parse: [] };
const eph = (content, extra = {}) => ({ content, flags: MessageFlags.Ephemeral, ...extra });
const roleMentions = (ids) => ids.map((id) => `<@&${id}>`).join(' ');
const channelLink = (guildId, channelId) => `https://discord.com/channels/${guildId}/${channelId}`;
const messageLink = (r) =>
    r.guildId && r.channelId && r.messageId ? `${channelLink(r.guildId, r.channelId)}/${r.messageId}` : null;

const say = (interaction, content, extra = {}) => {
    if (interaction.deferred && !interaction.replied) return interaction.editReply({ content, ...extra });
    if (interaction.replied || interaction.deferred) return interaction.followUp(eph(content, extra));
    return interaction.reply(eph(content, extra));
};

const safe = (fn) => async (client, interaction) => {
    try {
        await fn(client, interaction);
    } catch (err) {
        log(err.stack ?? String(err), 'err');
        const msg =
            '### **❌ TERJADI KESALAHAN**\n> Sistem sedang mengalami kendala saat memproses permintaan Anda. Silakan coba beberapa saat lagi.';
        await say(interaction, msg, { components: [] }).catch(() => {});
    }
};

const isApprover = (member, t) =>
    !!member &&
    (approverUserIds().includes(member.id) || approverRoleIds(t).some((id) => member.roles?.cache?.has(id)));

const pendingFor = (userId, type) =>
    Object.values(state.requests).find((r) => r.userId === userId && r.type === type && r.status === 'pending');

const STATUS = {
    pending: { label: '⏳ **Menunggu Persetujuan**', color: 0xf59e0b },
    approved: { label: '✅ **Disetujui**', color: 0x22c55e },
    rejected: { label: '❌ **Ditolak**', color: 0xef4444 },
    cancelled: { label: '🚫 **Dibatalkan Pemohon**', color: 0x6b7280 },
};

function displayValue(f, raw) {
    if (f.kind === 'select') return f.options.find((o) => o.value === raw)?.label ?? raw;
    return raw;
}

function buildEmbeds(r) {
    const t = TYPES[r.type];
    const st = STATUS[r.status] ?? STATUS.pending;
    const e = new EmbedBuilder()
        .setTitle(`${t.title} #${pad(r.num)}`)
        .setColor(r.status === 'pending' ? t.color : st.color)
        .addFields({ name: '**💬 Pengaju**', value: `<@${r.userId}>`, inline: true });

    for (const f of t.fields) {
        if (f.kind === 'file') continue;
        const raw = r.data?.[f.id];
        if (raw === undefined || raw === '') continue;
        e.addFields({
            name: f.embedLabel ?? `**${f.label}**`,
            value: cut(displayValue(f, raw), 1024) || '-',
            inline: f.kind !== 'paragraph',
        });
    }

    e.addFields(
        ...(fileField(t) ? [{ name: '**🖼️ Lampiran Bukti**', value: `${r.images.length} File`, inline: true }] : []),
        { name: '**📌 Status**', value: st.label, inline: true },
        { name: '**🕒 Waktu Pengajuan**', value: `<t:${r.createdAt}:F>`, inline: true },
    );

    if (r.oncamNote && r.status === 'pending') {
        e.addFields({
            name: '**📹 Panggilan Voice Oncam**',
            value: cut(`Oleh <@${r.oncamBy}> <t:${r.oncamAt}:R>\n${r.oncamNote}`, 1024),
        });
    }
    if (r.status === 'approved') {
        e.addFields({ name: '**👮 Diproses Oleh**', value: `<@${r.decidedBy}>`, inline: true });
        if (r.grantedRoleIds?.length)
            e.addFields({ name: '**🎭 Role Diberikan**', value: roleMentions(r.grantedRoleIds), inline: true });
        if (r.roleError)
            e.addFields({
                name: '**⚠️ Kendala Role**',
                value: cut(`${r.roleError}\nLakukan pemberian role secara manual.`, 1024),
            });
        if (t.showClaimBenefit && cfg.claimBenefitChannelId)
            e.addFields({ name: '**🎁 Klaim Benefit**', value: `<#${cfg.claimBenefitChannelId}>` });
    }
    if (r.status === 'rejected') {
        e.addFields(
            { name: '**👮 Diproses Oleh**', value: `<@${r.decidedBy}>`, inline: true },
            { name: '**💬 Alasan Penolakan**', value: cut(r.rejectReason || '-', 1024) },
        );
    }
    e.setFooter({ text: `Expensive Roleplay • ${t.title} #${pad(r.num)}` });

    if (!r.images.length) return [e];
    e.setImage(`attachment://${r.images[0]}`);
    if (!r.guildId) return [e];
    const gallery = channelLink(r.guildId, r.channelId);
    e.setURL(gallery);
    return [e, ...r.images.slice(1).map((n) => new EmbedBuilder().setURL(gallery).setImage(`attachment://${n}`))];
}

function buildComponents(r) {
    if (r.status !== 'pending') return [];
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`req-approve:${r.num}`)
                .setLabel('Setujui')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId(`req-reject:${r.num}`)
                .setLabel('Tolak')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌'),
            ...(TYPES[r.type].oncam
                ? [
                      new ButtonBuilder()
                          .setCustomId(`req-oncam:${r.num}`)
                          .setLabel('Panggil Oncam')
                          .setStyle(ButtonStyle.Primary)
                          .setEmoji('📹'),
                  ]
                : []),
            new ButtonBuilder()
                .setCustomId(`req-cancel:${r.num}`)
                .setLabel('Batalkan')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🚫'),
        ),
    ];
}

const render = (r) => ({ embeds: buildEmbeds(r), components: buildComponents(r) });

async function refreshMessage(client, r) {
    try {
        const ch = await client.channels.fetch(r.channelId);
        const msg = await ch.messages.fetch(r.messageId);
        await msg.edit({ ...render(r), allowedMentions: NO_MENTIONS });
        return true;
    } catch (e) {
        log(`Gagal memperbarui pesan request #${pad(r.num)}: ${e.message}`, 'warn');
        return false;
    }
}

async function dmUser(client, r, title, lines, color) {
    try {
        const user = await client.users.fetch(r.userId);
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(color)
            .setDescription(lines.join('\n'))
            .setFooter({ text: 'Expensive Roleplay • Request Services' });
        await user.send({ embeds: [embed] });
    } catch {}
}

async function sendLog(client, payload) {
    if (!cfg.logChannelId) return;
    try {
        const ch = await client.channels.fetch(cfg.logChannelId);
        await ch.send({ allowedMentions: NO_MENTIONS, ...payload });
    } catch (e) {
        log(`Gagal menulis log request: ${e.message}`, 'warn');
    }
}

async function logDecision(client, r, by) {
    const t = TYPES[r.type];
    const st = STATUS[r.status];
    const link = messageLink(r);
    const e = new EmbedBuilder()
        .setTitle(`${st.label} — ${t.title} #${pad(r.num)}`)
        .setColor(st.color)
        .addFields(
            { name: '**💬 Pemohon**', value: `<@${r.userId}>`, inline: true },
            { name: '**👮 Diproses Oleh**', value: `<@${by}>`, inline: true },
        )
        .setTimestamp();
    if (r.status === 'approved')
        e.addFields({
            name: '**🎭 Role**',
            value: r.grantedRoleIds?.length
                ? roleMentions(r.grantedRoleIds)
                : r.roleError
                  ? `⚠️ ${cut(r.roleError, 300)}`
                  : '_Tidak Ada Role_',
        });
    if (r.status === 'rejected') e.addFields({ name: '**💬 Alasan**', value: cut(r.rejectReason || '-', 1024) });
    if (link) e.addFields({ name: '**🔗 Tautan Berkas**', value: `[Buka Berkas](${link})` });
    await sendLog(client, { embeds: [e] });
}

function panelPayload(guild) {
    const icon = guild.iconURL?.({ dynamic: true }) ?? def.icon?.thumbnail;
    const lines = [
        '### **📮 PUSAT LAYANAN & PERMOHONAN RESMI**',
        'Gunakan panel terpadu ini untuk mengajukan permohonan role, pendaftaran, maupun verifikasi. Pilih kategori permohonan yang sesuai di bawah ini.\n',
        '**📋 PROSEDUR PENGAJUAN:**',
        '> **1️⃣** Pilih tombol jenis permohonan pada daftar pilihan.',
        '> **2️⃣** Lengkapi formulir informasi secara akurat dan valid.',
        `> **3️⃣** Sertakan **minimal 1 screenshot** sebagai bukti fisik pendukung (maksimal ${cfg.maxImages}) — *Pengecualian kategori Ladies*.`,
        '> **4️⃣** Keputusan resmi dan konfirmasi akan dikirimkan secara langsung melalui **DM**.\n',
        '**📂 KATEGORI LAYANAN:**',
        ...Object.values(TYPES).map((t) => `> ${t.emoji} **${t.button.replace(/^Request /, '')}** — ${t.short}`),
        '\n**⚠️ KETENTUAN PENGGUNAAN:**',
        '> • Pengaju hanya diizinkan memiliki **1 permohonan aktif** per kategori.',
        '> • Pembatalan berkas permohonan lama dapat dilakukan melalui tombol **Batalkan** pada pesan permohonan.',
        '> • Penetapan role disinkronkan secara otomatis setelah permohonan disetujui.',
    ];
    if (cfg.claimBenefitChannelId)
        lines.push(
            `> • Klaim benefit resmi kategori Ladies dapat diakses pada channel <#${cfg.claimBenefitChannelId}>.`,
        );

    const embed = new EmbedBuilder()
        .setTitle(`📮 ${guild.name.toUpperCase()} — REQUEST SERVICES`)
        .setThumbnail(icon)
        .setColor(0x5865f2)
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'Expensive Roleplay • Formal Request Center', iconURL: icon })
        .setTimestamp();

    const types = Object.values(TYPES);
    const rows = [
        new ActionRowBuilder().addComponents(
            ...types.map((t) =>
                new ButtonBuilder()
                    .setCustomId(`req-open:${t.key}`)
                    .setLabel(t.button.replace(/^Request /, ''))
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(t.emoji),
            ),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('req-mine')
                .setLabel('Status Request Saya')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📋'),
        ),
    ];
    return { embeds: [embed], components: rows };
}

function buildModal(type, stepIdx) {
    const t = TYPES[type];
    const steps = stepsOf(t);
    const title = steps.length > 1 ? `${t.title} (${stepIdx + 1}/${steps.length})` : t.title;
    const modal = new ModalBuilder().setCustomId(`modal-req:${type}:${stepIdx}`).setTitle(cut(title, 45));

    for (const f of steps[stepIdx]) {
        const label = new LabelBuilder().setLabel(cut(f.label, 45));
        if (f.description) label.setDescription(cut(f.description, 100));

        if (f.kind === 'text' || f.kind === 'paragraph') {
            const input = new TextInputBuilder()
                .setCustomId(f.id)
                .setStyle(f.kind === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
                .setRequired(!f.optional);
            if (f.placeholder) input.setPlaceholder(cut(f.placeholder, 100));
            if (f.min && !f.optional) input.setMinLength(f.min);
            if (f.max) input.setMaxLength(f.max);
            label.setTextInputComponent(input);
        } else if (f.kind === 'select') {
            label.setStringSelectMenuComponent(
                new StringSelectMenuBuilder()
                    .setCustomId(f.id)
                    .setPlaceholder(f.placeholder ?? 'Pilih...')
                    .setMinValues(1)
                    .setMaxValues(1)
                    .setRequired(true)
                    .addOptions(f.options.map((o) => ({ label: o.label, value: o.value }))),
            );
        } else if (f.kind === 'file') {
            label.setFileUploadComponent(
                new FileUploadBuilder().setCustomId(f.id).setMinValues(1).setMaxValues(cfg.maxImages).setRequired(true),
            );
        }
        modal.addLabelComponents(label);
    }
    return modal;
}

function readStep(type, stepIdx, interaction) {
    const t = TYPES[type];
    const data = {};
    const files = [];

    for (const f of stepsOf(t)[stepIdx]) {
        if (f.kind === 'text' || f.kind === 'paragraph') {
            let v = (interaction.fields.getTextInputValue(f.id) ?? '').replace(/\u0000/g, '').trim();
            if (f.kind === 'text') v = v.replace(/\s+/g, ' ');
            if (f.normalize) v = f.normalize(v);
            if (!v) {
                if (f.optional) continue;
                return { error: `❌ Kolom **${f.label}** wajib diisi.` };
            }
            const err = f.validate?.(v);
            if (err) return { error: `❌ ${err}` };
            data[f.id] = v;
        } else if (f.kind === 'select') {
            const v = interaction.fields.getStringSelectValues(f.id)?.[0];
            if (!v || !f.options.some((o) => o.value === v)) return { error: `❌ Pilihan **${f.label}** tidak valid.` };
            data[f.id] = v;
        } else if (f.kind === 'file') {
            const uploaded = interaction.fields.getUploadedFiles(f.id);
            for (const a of uploaded?.values() ?? []) {
                const isImage = a.contentType?.startsWith('image/') || IMG_RE.test(a.name ?? '');
                if (!isImage)
                    return {
                        error: `❌ Berkas **${a.name}** bukan format gambar yang valid. Hanya format standar (png/jpg/gif/webp) yang diizinkan.`,
                    };
                files.push({ name: a.name ?? 'image.png', url: a.url });
            }
            if (!files.length)
                return { error: '❌ Lampiran **minimal 1 screenshot** sebagai bukti verifikasi wajib diunggah.' };
        }
    }
    return { data, files: files.slice(0, cfg.maxImages) };
}

const nextRow = (type, stepIdx, label, style = ButtonStyle.Primary) =>
    new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(stepIdx === 0 ? `req-open:${type}` : `req-next:${type}:${stepIdx}`)
            .setLabel(label)
            .setStyle(style)
            .setEmoji('📝'),
    );

async function openForm(client, interaction, type) {
    const t = TYPES[type];
    if (!t) return say(interaction, '❌ Jenis permohonan tidak teridentifikasi.');
    if (!cfg.open) return say(interaction, '🔒 Sistem pengajuan permohonan sedang ditutup sementara.');

    const existing = pendingFor(interaction.user.id, type);
    if (existing) {
        const link = messageLink(existing);
        return say(
            interaction,
            `⚠️ Anda masih memiliki berkas permohonan aktif **${t.title} #${pad(existing.num)}** yang sedang diproses${link ? `: ${link}` : ''}.\nHarap tunggu proses evaluasi atau batalkan permohonan tersebut sebelum mengajukan baru.`,
        );
    }

    drafts.delete(draftKey(interaction.user.id, type));
    return interaction.showModal(buildModal(type, 0));
}

async function nextStep(client, interaction, type, stepIdx) {
    const draft = drafts.get(draftKey(interaction.user.id, type));
    if (!TYPES[type] || !draft || draft.expires < Date.now() || draft.next !== stepIdx)
        return say(
            interaction,
            '⌛ Batas waktu pengisian formulir telah habis. Silakan muat ulang pengajuan dari panel utama.',
            { components: [] },
        );
    return interaction.showModal(buildModal(type, stepIdx));
}

async function handleModal(client, interaction, type, stepIdx) {
    const t = TYPES[type];
    if (!t) return say(interaction, '❌ Jenis permohonan tidak teridentifikasi.');
    if (!cfg.open) return say(interaction, '🔒 Sistem pengajuan permohonan sedang ditutup sementara.');

    const steps = stepsOf(t);
    const key = draftKey(interaction.user.id, type);
    const last = stepIdx === steps.length - 1;

    if (last) await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const res = readStep(type, stepIdx, interaction);
    if (res.error) {
        const retry =
            stepIdx === 0 || drafts.get(key)
                ? nextRow(type, stepIdx, 'Isi Ulang Formulir', ButtonStyle.Secondary)
                : null;
        return say(
            interaction,
            `${res.error}\nSilakan periksa kembali isian formulir Anda.`,
            retry ? { components: [retry] } : {},
        );
    }

    let draft;
    if (stepIdx === 0) {
        draft = { data: {}, files: [], next: 0 };
    } else {
        draft = drafts.get(key);
        if (!draft || draft.expires < Date.now() || draft.next !== stepIdx)
            return say(
                interaction,
                '⌛ Batas waktu pengisian formulir telah habis. Silakan muat ulang pengajuan dari panel utama.',
                { components: [] },
            );
    }
    Object.assign(draft.data, res.data);
    draft.files.push(...res.files);
    draft.expires = Date.now() + DRAFT_TTL();

    if (!last) {
        draft.next = stepIdx + 1;
        drafts.set(key, draft);
        return say(
            interaction,
            [
                `✅ **Tahap ${stepIdx + 1} dari ${steps.length} berhasil disimpan.**`,
                `Tekan tombol di bawah untuk melanjutkan ke tahap ${stepIdx + 2} (Batas waktu: ${cfg.draftMinutes} menit).`,
            ].join('\n'),
            { components: [nextRow(type, stepIdx + 1, `Lanjut ke Tahap ${stepIdx + 2}`)] },
        );
    }

    drafts.delete(key);
    return submitRequest(client, interaction, type, draft.data, draft.files);
}

const submitLocks = new Set();

async function submitRequest(client, interaction, type, data, files) {
    const t = TYPES[type];
    const lockKey = draftKey(interaction.user.id, type);

    const existing = pendingFor(interaction.user.id, type);
    if (existing)
        return say(interaction, `⚠️ Anda masih memiliki berkas permohonan aktif **${t.title} #${pad(existing.num)}**.`);
    if (submitLocks.has(lockKey)) return say(interaction, '⏳ Permohonan Anda sedang dalam proses pengiriman.');
    submitLocks.add(lockKey);

    try {
        const channelId = cfg.channels?.[type] ?? interaction.channelId;
        let channel = null;
        let why = null;
        try {
            channel = await client.channels.fetch(channelId);
        } catch (e) {
            why =
                e.code === 10003
                    ? 'Identifikasi channel tidak valid.'
                    : e.code === 50001
                      ? 'Akses sistem terhalang (Missing Access). Periksa izin View Channel pada bot.'
                      : (e.message ?? 'Kesalahan sistem tidak diketahui');
        }
        if (channel && !channel.isTextBased?.()) why = 'Target channel bukan merupakan channel teks standar.';
        if (channel && !why && channel.guildId && channel.guildId !== interaction.guildId)
            why = 'Target channel tidak berada di server ini.';
        if (channel && !why && channel.permissionsFor && client.user) {
            const need = {
                ViewChannel: 'View Channel',
                SendMessages: 'Send Messages',
                EmbedLinks: 'Embed Links',
                AttachFiles: 'Attach Files',
            };
            const perms = channel.permissionsFor(client.user);
            const missing = perms
                ? Object.entries(need)
                      .filter(([f]) => !perms.has(f))
                      .map(([, n]) => n)
                : [];
            if (missing.length) why = `Izin bot tidak mencukupi: **${missing.join(', ')}**.`;
        }
        if (!channel || why) {
            log(`Channel request ${type} (${channelId}) tidak dapat digunakan: ${why?.replace(/\*\*/g, '')}`, 'err');
            return say(
                interaction,
                `❌ Channel tujuan permohonan <#${channelId}> (\`${channelId}\`) tidak dapat diproses.\n> ${why ?? 'Tidak ditemukan.'}\nHarap hubungi Developer.`,
            );
        }

        const num = state.counter + 1;

        const attachments = [];
        for (const [i, f] of files.entries()) {
            try {
                const res = await fetch(f.url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const buf = Buffer.from(await res.arrayBuffer());
                const ext = (f.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? 'png').toLowerCase();
                attachments.push(
                    new AttachmentBuilder(buf, {
                        name: `req-${pad(num)}-${i + 1}.${IMG_RE.test(`.${ext}`) ? ext : 'png'}`,
                    }),
                );
            } catch (e) {
                log(`Gagal mengunduh lampiran ${f.name}: ${e.message}`, 'warn');
            }
        }
        if (fileField(t) && !attachments.length)
            return say(interaction, '❌ Gagal memproses lampiran bukti fisik. Harap kirimkan ulang permohonan Anda.');

        const r = {
            num,
            type,
            userId: interaction.user.id,
            data,
            images: attachments.map((a) => a.name),
            status: 'pending',
            createdAt: nowSec(),
            guildId: interaction.guildId,
            channelId: channel.id,
            messageId: null,
            decidedBy: null,
            decidedAt: null,
            rejectReason: null,
            grantedRoleIds: [],
            roleError: null,
        };

        const tags = t.tags.filter(Boolean);
        const msg = await channel.send({
            content: `${tags.length ? `${roleMentions(tags)} ` : ''}🔔 Permohonan Resmi **${t.title}** Baru oleh <@${r.userId}>`,
            ...render(r),
            files: attachments,
            allowedMentions: { roles: tags, users: [] },
        });

        r.messageId = msg.id;
        state.counter = num;
        state.requests[String(num)] = r;
        save();
        log(`Request ${t.title} #${pad(num)} dari ${interaction.user.tag}`, 'info');

        await sendLog(client, {
            content: `📥 Berkas Pengajuan **${t.title} #${pad(num)}** oleh <@${r.userId}> — ${messageLink(r)}`,
            embeds: buildEmbeds({ ...r, status: 'pending' }),
            files: attachments,
        });

        return say(
            interaction,
            [
                `✅ **Permohonan ${t.title} #${pad(num)} berhasil terkirim!**`,
                `> Berkas permohonan Anda akan ditinjau oleh Management. Keputusan akhir akan dikirimkan langsung melalui **DM**.`,
                `> Tautan Berkas: ${messageLink(r)}`,
            ].join('\n'),
            { components: [] },
        );
    } finally {
        submitLocks.delete(lockKey);
    }
}

const roleErrorText = (e) =>
    e?.code === 50013
        ? 'Akses bot tidak memadai (Manage Roles) atau hirarki role bot berada di bawah role target.'
        : `Gagal memperbarui penetapan role (${e?.message ?? 'Kesalahan tidak diketahui'}).`;

function guardDecision(interaction, r) {
    if (!r) return '❌ Data permohonan tidak ditemukan.';
    const t = TYPES[r.type];
    if (!t) return '❌ Jenis permohonan tidak teridentifikasi.';
    if (!isApprover(interaction.member, t))
        return `🔒 **Akses Khusus Management.** Hanya pihak berwenang ${roleMentions(approverRoleIds(t))} yang dapat memproses berkas ini.`;
    if (r.status !== 'pending')
        return `ℹ️ Berkas permohonan ini telah selesai diproses (${STATUS[r.status]?.label ?? r.status}).`;
    if (r.userId === interaction.user.id && !cfg.allowSelfApprove)
        return '🚫 Anda tidak diizinkan memproses berkas permohonan milik Anda sendiri. Gunakan opsi **Batalkan** untuk menarik permohonan.';
    return null;
}

async function approve(client, interaction, num) {
    const r = getReq(num);
    const block = guardDecision(interaction, r);
    if (block) return say(interaction, block, { allowedMentions: NO_MENTIONS });
    const t = TYPES[r.type];

    await interaction.deferUpdate();

    r.status = 'approved';
    r.decidedBy = interaction.user.id;
    r.decidedAt = nowSec();
    save();

    const roleIds = [...new Set(t.grant(r.data).filter(Boolean))];
    if (roleIds.length) {
        const member = await interaction.guild.members.fetch(r.userId).catch(() => null);
        if (!member) {
            r.roleError = 'Pengaju tidak ditemukan di server.';
        } else {
            try {
                await member.roles.add(
                    roleIds,
                    `Request ${t.title} #${pad(r.num)} disetujui oleh ${interaction.user.tag}`,
                );
                r.grantedRoleIds = roleIds;
            } catch (e) {
                r.roleError = roleErrorText(e);
                log(`Gagal memberi role request #${pad(r.num)}: ${e.message}`, 'err');
            }
        }
        save();
    }

    await interaction.editReply({ ...render(r), allowedMentions: NO_MENTIONS });
    await logDecision(client, r, interaction.user.id);
    log(`Request ${t.title} #${pad(r.num)} disetujui oleh ${interaction.user.tag}`, 'info');
    if (r.roleError)
        await interaction
            .followUp(eph(`⚠️ Permohonan disetujui, namun kendala terjadi: ${r.roleError}`))
            .catch(() => {});

    const lines = [`Permohonan **${t.title} #${pad(r.num)}** Anda telah resmi **Disetujui** oleh <@${r.decidedBy}>.`];
    if (r.grantedRoleIds.length) lines.push(`🎭 Penetapan Role: ${roleMentions(r.grantedRoleIds)}`);
    if (t.showClaimBenefit && cfg.claimBenefitChannelId)
        lines.push(`🎁 Prosedur klaim benefit dapat dilakukan pada channel <#${cfg.claimBenefitChannelId}>`);
    await dmUser(client, r, '✅ PERMOHONAN DISETUJUI', lines, STATUS.approved.color);
}

async function startReject(client, interaction, num) {
    const r = getReq(num);
    const block = guardDecision(interaction, r);
    if (block) return say(interaction, block, { allowedMentions: NO_MENTIONS });
    return interaction.showModal(
        new ModalBuilder()
            .setCustomId(`modal-req-reject:${num}`)
            .setTitle(cut(`Penolakan ${TYPES[r.type].title} #${pad(num)}`, 45))
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Alasan Penolakan Resmi')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('req-reject-reason')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Tuliskan alasan penolakan secara jelas dan fungsional...')
                            .setMinLength(3)
                            .setMaxLength(300)
                            .setRequired(true),
                    ),
            ),
    );
}

async function reject(client, interaction, num, reason) {
    const r = getReq(num);
    const block = guardDecision(interaction, r);
    if (block) return say(interaction, block, { allowedMentions: NO_MENTIONS });
    const t = TYPES[r.type];

    r.status = 'rejected';
    r.decidedBy = interaction.user.id;
    r.decidedAt = nowSec();
    r.rejectReason = reason;
    save();

    await refreshMessage(client, r);
    await logDecision(client, r, interaction.user.id);
    await say(interaction, `❌ Permohonan **${t.title} #${pad(r.num)}** telah resmi ditolak.`);
    log(`Request ${t.title} #${pad(r.num)} ditolak oleh ${interaction.user.tag}`, 'info');

    await dmUser(
        client,
        r,
        '❌ PERMOHONAN DITOLAK',
        [
            `Permohonan **${t.title} #${pad(r.num)}** Anda **Ditolak** oleh <@${r.decidedBy}>.`,
            `💬 Alasan: ${cut(reason, 300)}`,
            'Anda diizinkan untuk mengajukan permohonan kembali setelah menyempurnakan data pendukung.',
        ],
        STATUS.rejected.color,
    );
}

async function cancel(client, interaction, num) {
    const r = getReq(num);
    if (!r) return say(interaction, '❌ Data permohonan tidak ditemukan.');
    if (r.userId !== interaction.user.id)
        return say(interaction, '🔒 Hanya pemohon asli yang memiliki otoritas untuk membatalkan berkas ini.');
    if (r.status !== 'pending')
        return say(interaction, 'ℹ️ Berkas permohonan telah diproses dan tidak dapat dibatalkan.');

    r.status = 'cancelled';
    r.decidedAt = nowSec();
    save();
    await interaction.update({ ...render(r), allowedMentions: NO_MENTIONS });
    await logDecision(client, r, interaction.user.id);
}

async function startOncam(client, interaction, num) {
    const r = getReq(num);
    const block = guardDecision(interaction, r);
    if (block) return say(interaction, block, { allowedMentions: NO_MENTIONS });
    if (!TYPES[r.type].oncam)
        return say(interaction, 'ℹ️ Kategori permohonan ini tidak membutuhkan verifikasi voice oncam.');

    const note = new TextInputBuilder()
        .setCustomId('req-oncam-note')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Contoh: Harap memasuki channel voice Verifikasi Management sekarang untuk verifikasi.')
        .setMinLength(3)
        .setMaxLength(300)
        .setRequired(true);
    if (r.oncamNote) note.setValue(r.oncamNote);
    return interaction.showModal(
        new ModalBuilder()
            .setCustomId(`modal-req-oncam:${num}`)
            .setTitle(cut(`Panggilan Voice #${pad(num)}`, 45))
            .addLabelComponents(
                new LabelBuilder().setLabel('Instruksi Verifikasi untuk Pemohon').setTextInputComponent(note),
            ),
    );
}

async function callOncam(client, interaction, num, text) {
    const r = getReq(num);
    const block = guardDecision(interaction, r);
    if (block) return say(interaction, block, { allowedMentions: NO_MENTIONS });
    const t = TYPES[r.type];

    r.oncamNote = text;
    r.oncamBy = interaction.user.id;
    r.oncamAt = nowSec();
    save();
    await refreshMessage(client, r);

    const link = messageLink(r);
    try {
        const ch = await client.channels.fetch(r.channelId);
        await ch.send({
            content: `📹 <@${r.userId}> Anda dipanggil untuk melakukan **Verifikasi Voice Oncam** oleh Management <@${interaction.user.id}>.\n> ${cut(text, 300)}${link ? `\n${link}` : ''}`,
            allowedMentions: { users: [r.userId] },
        });
    } catch (e) {
        log(`Gagal mengirim panggilan oncam #${pad(r.num)}: ${e.message}`, 'warn');
    }
    await dmUser(
        client,
        r,
        '📹 VERIFIKASI VOICE ONCAM',
        [
            `Permohonan **${t.title} #${pad(r.num)}** Anda memerlukan verifikasi voice secara langsung.`,
            `📝 Instruksi Management (<@${interaction.user.id}>): ${cut(text, 300)}`,
        ],
        t.color,
    );
    await say(interaction, `✅ Panggilan verifikasi voice untuk berkas **#${pad(r.num)}** telah dikirimkan.`);
}

async function showMine(client, interaction) {
    const mine = Object.values(state.requests)
        .filter((r) => r.userId === interaction.user.id)
        .sort((a, b) => b.num - a.num)
        .slice(0, 10);
    const e = new EmbedBuilder().setTitle('📋 STATUS PERMOHONAN SAYA').setColor(0x5865f2);
    if (!mine.length)
        return say(interaction, '', {
            embeds: [e.setDescription('Anda belum memiliki riwayat pengajuan permohonan.')],
        });
    e.setDescription(
        mine
            .map((r) => {
                const t = TYPES[r.type];
                const link = messageLink(r);
                return `**#${pad(r.num)}** — ${t?.title ?? r.type} — ${STATUS[r.status]?.label ?? r.status} — <t:${r.createdAt}:d>${link ? ` — [Buka Berkas](${link})` : ''}`;
            })
            .join('\n'),
    );
    return say(interaction, '', { embeds: [e] });
}

module.exports = {
    cfg,
    state,
    save,
    TYPES,
    STATUS,
    drafts,
    getReq,
    getType,
    stepsOf,
    pad,
    cut,
    say,
    safe,
    isApprover,
    pendingFor,
    approverRoleIds,
    buildEmbeds,
    buildComponents,
    render,
    panelPayload,
    buildModal,
    readStep,
    openForm,
    nextStep,
    handleModal,
    submitRequest,
    approve,
    startReject,
    reject,
    cancel,
    startOncam,
    callOncam,
    showMine,
    fileField,
};
