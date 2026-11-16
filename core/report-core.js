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
    ModalBuilder,
    LabelBuilder,
    TextInputBuilder,
    TextInputStyle,
    FileUploadBuilder,
    StringSelectMenuBuilder,
    MessageFlags,
} = require('discord.js');
const def = require('../defines');
const { log } = require('../functions');
const analytics = require('./analytics-core');

const DEFAULTS = {
    categoryId: 'YOUR_DISCORD_ID',
    logChannelId: 'YOUR_DISCORD_ID',
    adminRoleId: 'YOUR_DISCORD_ID',
    extraStaffRoleIds: { admin: [], player: [], faction: [], bug: [] },
    maxOpenPerUser: 2,
    cooldownSeconds: 60,
    reporterCanInvite: false,
    factions: [
        { key: 'pemerintah', name: 'Pemerintah Expensive', emoji: '🏛️' },
        { key: 'kepolisian', name: 'Kepolisian Kota Expensive', emoji: '👮' },
        { key: 'militer', name: 'Militer Expensive', emoji: '🪖' },
        { key: 'medis', name: 'Medis Kota Los Santos', emoji: '⛑️' },
        { key: 'news', name: 'News Expensive', emoji: '📰' },
        { key: 'bengkel', name: 'Bengkel Expensive', emoji: '🔧' },
        { key: 'restaurant', name: 'Restaurant Expensive', emoji: '🍽️' },
        { key: 'OPM', name: 'Organisasi Papua Expensive', emoji: '☠️' },
        { key: 'Apra', name: 'Apra Expensive', emoji: '☠️' },
    ],
};
const cfg = { ...DEFAULTS, ...(def.report ?? {}) };

const DRAFT_TTL = 10 * 60 * 1000;
const TOPIC_RE = /^report:([a-z]+):(\d+)/;

const STATE_FILE = path.join(__dirname, '..', 'data', 'report-state.json');
let state = { counters: {} };
try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state.counters ??= {};
} catch {}
const saveState = () => {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (e) {
        log(`Gagal menyimpan report-state.json: ${e.message}`, 'warn');
    }
};

const pad = (n) => String(n).padStart(4, '0');
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const slug = (s) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 20) || 'player';
const STAFF_ONLY = '🔒 **Khusus Tim Admin.**\nTombol ini hanya bisa dipakai oleh staff.';
const factionOf = (key) => cfg.factions.find((f) => f.key === key);

const drafts = new Map();
setInterval(() => {
    for (const [k, v] of drafts) if (v.expires < Date.now()) drafts.delete(k);
}, 60 * 1000).unref();

const lastCreated = new Map();

let queue = Promise.resolve();
const enqueue = (fn) => (queue = queue.then(fn, fn));

const safe = (fn) => async (client, interaction) => {
    try {
        await fn(client, interaction);
    } catch (err) {
        log(err.stack ?? String(err), 'err');
        const msg = {
            content:
                '### ❌ Terjadi Kesalahan\n> Sistem report sedang bermasalah. Silakan coba lagi sebentar lagi atau hubungi staff.',
            flags: MessageFlags.Ephemeral,
        };
        if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
        else await interaction.reply(msg).catch(() => {});
    }
};

const TYPES = {
    admin: {
        label: 'Report Admin',
        emoji: '🛡️',
        prefix: 'admin',
        color: 'Red',
        buttonStyle: ButtonStyle.Danger,
        panelTitle: 'Report Admin',
        tagline: 'Staff yang adil adalah fondasi kota yang sehat.',
        when: [
            'Penyalahgunaan wewenang atau jabatan',
            'Sikap berat sebelah / tidak profesional',
            'Pelanggaran aturan yang dilakukan oleh staff',
        ],
        intro: 'Merasa ada **admin/staff** yang menyalahgunakan wewenang, bersikap tidak adil, atau melanggar aturan? Laporkan di sini agar bisa ditindaklanjuti.',
        fields: [
            { id: 'target', label: 'Nama Admin yang Dilaporkan', ph: 'Nama karakter / UCP admin', min: 3, max: 60 },
            { id: 'time', label: 'Waktu Kejadian', ph: 'Contoh: 12 Okt 2026, sekitar jam 20.30 WIB', min: 3, max: 80 },
            {
                id: 'story',
                label: 'Kronologi Kejadian',
                long: true,
                ph: 'Jelaskan apa yang terjadi secara runtut dan jelas.',
                min: 20,
                max: 1500,
            },
            { kind: 'files', id: 'files', label: 'Bukti (Screenshot / Video)', desc: 'Maksimal 5 file.' },
        ],
        summarize: (v) => ({
            headline: `Admin: ${v.target}`,
            body: v.story,
            extra: [{ name: '🕒 Waktu Kejadian', value: cut(v.time, 1024) }],
        }),
    },
    player: {
        label: 'Report Player',
        emoji: '🚫',
        prefix: 'player',
        color: 'Orange',
        buttonStyle: ButtonStyle.Primary,
        panelTitle: 'Report Player',
        tagline: 'Jaga roleplay tetap seru dan adil untuk semua warga.',
        when: ['RDM dan VDM', 'Metagaming dan powergaming', 'Pelanggaran aturan server lainnya'],
        intro: 'Menemukan pemain yang melanggar aturan server (RDM, VDM, metagaming, powergaming, dan sejenisnya)? Laporkan di sini lengkap dengan buktinya.',
        fields: [
            { id: 'target', label: 'Nama Karakter Pelaku', ph: 'Contoh: Nama_Karakter', min: 3, max: 60 },
            { id: 'time', label: 'Waktu Kejadian', ph: 'Contoh: 12 Okt 2026, sekitar jam 20.30 WIB', min: 3, max: 80 },
            {
                id: 'story',
                label: 'Kronologi Kejadian',
                long: true,
                ph: 'Jelaskan pelanggaran yang terjadi dan aturan yang dilanggar.',
                min: 20,
                max: 1500,
            },
            { kind: 'files', id: 'files', label: 'Bukti (Screenshot / Video)', desc: 'Maksimal 5 file.' },
        ],
        summarize: (v) => ({
            headline: `Pelaku: ${v.target}`,
            body: v.story,
            extra: [{ name: '🕒 Waktu Kejadian', value: cut(v.time, 1024) }],
        }),
    },
    faction: {
        label: 'Report Faction',
        emoji: '🏢',
        prefix: 'faction',
        color: 'Blue',
        buttonStyle: ButtonStyle.Success,
        panelTitle: 'Report Faction',
        tagline: 'Setiap faction punya tanggung jawab kepada warga kota.',
        when: [
            'Penyalahgunaan jabatan di dalam faction',
            'Pelayanan buruk atau tidak profesional',
            'Kebijakan internal yang merugikan warga',
        ],
        intro: 'Ada masalah dengan sebuah **faction** atau anggotanya (penyalahgunaan jabatan, pelayanan buruk, dan sejenisnya)? Laporkan di sini.',
        fields: [
            { kind: 'faction', id: 'faction', label: 'Faction yang Dilaporkan' },
            {
                id: 'target',
                label: 'Nama Anggota / Leader yang Dilaporkan',
                ph: 'Nama karakter yang bersangkutan',
                min: 3,
                max: 60,
            },
            { id: 'time', label: 'Waktu Kejadian', ph: 'Contoh: 12 Okt 2026, sekitar jam 20.30 WIB', min: 3, max: 80 },
            {
                id: 'story',
                label: 'Kronologi Kejadian',
                long: true,
                ph: 'Jelaskan masalah yang terjadi secara runtut dan jelas.',
                min: 20,
                max: 1500,
            },
            { kind: 'files', id: 'files', label: 'Bukti (Screenshot / Video)', desc: 'Maksimal 5 file.' },
        ],
        summarize: (v) => {
            const f = factionOf(v.faction);
            return {
                headline: `${f ? `${f.emoji} ${f.name}` : v.faction} — ${v.target}`,
                body: v.story,
                extra: [{ name: '🕒 Waktu Kejadian', value: cut(v.time, 1024) }],
            };
        },
    },
    bug: {
        label: 'Report Bug',
        emoji: '🐞',
        prefix: 'bug',
        color: 'Yellow',
        buttonStyle: ButtonStyle.Secondary,
        panelTitle: 'Bug Report',
        tagline: 'Satu laporan darimu bisa membuat kota lebih stabil.',
        when: [
            'Glitch, error, atau fitur yang tidak berfungsi',
            'Item, uang, atau kendaraan hilang karena bug',
            'Kejadian yang tidak sesuai dengan yang seharusnya',
        ],
        extraRule: '• **Dilarang bug abuse.** Memanfaatkan bug demi keuntungan pribadi akan dikenai sanksi',
        intro: 'Menemukan *bug*, *glitch*, atau *error* di kota? Bantu tim kami menciptakan pengalaman bermain yang lebih stabil dengan melaporkannya secara detail.',
        fields: [
            { id: 'title', label: 'Judul Bug', ph: 'Contoh: Tidak bisa masuk rumah setelah respawn', min: 5, max: 100 },
            {
                id: 'desc',
                label: 'Deskripsi Bug',
                long: true,
                ph: 'Jelaskan apa yang terjadi dan apa yang seharusnya terjadi.',
                min: 15,
                max: 1500,
            },
            {
                id: 'steps',
                label: 'Langkah Menemukan Bug (opsional)',
                long: true,
                ph: '1. Pergi ke ...\n2. Tekan ...\n3. Bug muncul',
                max: 1000,
                required: false,
            },
            { kind: 'files', id: 'files', label: 'Screenshot / Bukti (opsional)', desc: 'Maksimal 5 file.' },
        ],
        summarize: (v) => ({
            headline: v.title,
            body: v.desc,
            extra: v.steps ? [{ name: '🔁 Langkah Menemukan Bug', value: cut(v.steps, 1024) }] : [],
        }),
    },
};

function panelPayload(typeKey, guild) {
    const t = TYPES[typeKey];
    const description = [
        `## ${t.emoji}  ${t.label.toUpperCase()}`,
        `*${t.tagline}*`,
        '',
        t.intro,
        '',
        '### 📋 Kapan Perlu Melapor?',
        ...t.when.map((x) => `> • ${x}`),
        '',
        '### 🚀 Cara Melapor',
        `**1️⃣**  Klik tombol **${t.emoji} Buat ${t.label}** di bawah`,
        '**2️⃣**  Isi formulir dan lampirkan bukti',
        '**3️⃣**  Periksa pratinjau, lalu klik **Kirim Laporan**',
        '**4️⃣**  Bot membuka **channel privat** khusus laporanmu',
        '**5️⃣**  Pantau perkembangannya lewat **DM** dari bot',
        '',
        '### 🔒 Privasi Terjaga',
        '> Hanya **Tim Admin** dan **kamu** yang bisa melihat laporan beserta lampirannya.',
        '',
        '### ⚠️ Ketentuan',
        '• Laporan palsu, spam, atau main-main dapat dikenai sanksi',
        '• Jangan menyebarkan isi laporan di channel publik',
        '• Bukti yang jelas (screenshot / video) mempercepat proses',
        ...(t.extraRule ? [t.extraRule] : []),
    ].join('\n');

    const embed = new EmbedBuilder()
        .setAuthor({ name: `${guild.name.toUpperCase()} • REPORT CENTER`, iconURL: def.icon?.thumbnail })
        .setThumbnail(def.icon?.thumbnail ?? null)
        .setDescription(description)
        .setColor(t.color)
        .setFooter({ text: '© 2026 Expensive Roleplay • All Rights Reserved.', iconURL: def.icon?.thumbnail })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`report-open:${typeKey}`)
            .setLabel(`Buat ${t.label}`)
            .setStyle(t.buttonStyle)
            .setEmoji(t.emoji),
    );
    return { embeds: [embed], components: [row] };
}

function buildModal(typeKey) {
    const t = TYPES[typeKey];
    const modal = new ModalBuilder().setCustomId(`report-modal:${typeKey}`).setTitle(t.label);

    for (const f of t.fields) {
        const label = new LabelBuilder().setLabel(f.label);
        if (f.desc) label.setDescription(f.desc);

        if (f.kind === 'files') {
            label.setFileUploadComponent(
                new FileUploadBuilder().setCustomId(f.id).setMinValues(0).setMaxValues(5).setRequired(false),
            );
        } else if (f.kind === 'faction') {
            label.setStringSelectMenuComponent(
                new StringSelectMenuBuilder()
                    .setCustomId(f.id)
                    .setPlaceholder('Pilih faction...')
                    .setRequired(true)
                    .addOptions(cfg.factions.map((x) => ({ label: x.name, value: x.key, emoji: x.emoji }))),
            );
        } else {
            const input = new TextInputBuilder()
                .setCustomId(f.id)
                .setStyle(f.long ? TextInputStyle.Paragraph : TextInputStyle.Short)
                .setMaxLength(f.max)
                .setRequired(f.required !== false);
            if (f.ph) input.setPlaceholder(f.ph);
            if (f.min && f.required !== false) input.setMinLength(f.min);
            label.setTextInputComponent(input);
        }
        modal.addLabelComponents(label);
    }
    return modal;
}

function readModal(interaction, typeKey) {
    const t = TYPES[typeKey];
    const values = {};
    const files = [];

    for (const f of t.fields) {
        if (f.kind === 'files') {
            const uploaded = interaction.fields.getUploadedFiles(f.id);
            for (const a of uploaded?.values() ?? []) {
                const ok =
                    /^(image|video)\//.test(a.contentType ?? '') ||
                    /\.(png|jpe?g|gif|webp|mp4|mov|webm|mkv)$/i.test(a.name ?? '');
                if (!ok) return { error: `File **${a.name}** tidak didukung. Hanya gambar atau video yang diterima.` };
                files.push({ name: a.name ?? 'bukti', url: a.url, size: a.size ?? 0 });
            }
        } else if (f.kind === 'faction') {
            const key = interaction.fields.getStringSelectValues(f.id)?.[0];
            if (!key || !factionOf(key))
                return { error: 'Faction tidak valid. Silakan ulangi dan pilih faction dari daftar.' };
            values[f.id] = key;
        } else {
            values[f.id] = (interaction.fields.getTextInputValue(f.id) ?? '').trim();
        }
    }
    return { values, files };
}

function previewEmbed(typeKey, values, files) {
    const t = TYPES[typeKey];
    const s = t.summarize(values);
    const embed = new EmbedBuilder()
        .setAuthor({ name: `${t.label.toUpperCase()} • PRATINJAU` })
        .setDescription(
            [
                '## 📝 Periksa Laporanmu',
                '> Pastikan semua data sudah benar. Setelah dikirim, **channel privat** akan dibuat khusus untuk **kamu dan Tim Admin**.',
            ].join('\n'),
        )
        .addFields(
            { name: '📌 Ringkasan', value: cut(s.headline, 1024) },
            { name: '📖 Kronologi / Deskripsi', value: cut(`>>> ${s.body}`, 1024) },
            ...s.extra,
            {
                name: '📎 Bukti',
                value: files.length ? `**${files.length}** file terlampir` : '_Tidak ada bukti dilampirkan_',
            },
        )
        .setColor('Orange')
        .setFooter({ text: 'Klik Kirim Laporan untuk melanjutkan • Draft berlaku 10 menit' });
    const firstImage = files.find((f) => /\.(png|jpe?g|gif|webp)$/i.test(f.name));
    if (firstImage) embed.setImage(firstImage.url);
    return embed;
}

const confirmRow = () =>
    new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('report-confirm')
            .setLabel('Kirim Laporan')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
        new ButtonBuilder()
            .setCustomId('report-cancel')
            .setLabel('Batal')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✖️'),
    );

const staffRoleIds = (typeKey) => [
    ...new Set([cfg.adminRoleId, ...(cfg.extraStaffRoleIds?.[typeKey] ?? [])].filter(Boolean)),
];

const isStaff = (member, typeKey) =>
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    staffRoleIds(typeKey).some((id) => member.roles.cache.has(id));

function getTicket(channel) {
    const m = channel?.topic?.match(TOPIC_RE);
    return m && TYPES[m[1]] ? { type: m[1], userId: m[2] } : null;
}

function ticketButtons(stage = 'open') {
    const done = stage === 'done';
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('report-process')
            .setLabel('Diproses')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🛠️')
            .setDisabled(done || stage === 'processing'),
        new ButtonBuilder()
            .setCustomId('report-resolve')
            .setLabel('Selesai')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
            .setDisabled(done),
        new ButtonBuilder()
            .setCustomId('report-reject')
            .setLabel('Tolak')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌')
            .setDisabled(done),
        new ButtonBuilder()
            .setCustomId('report-invite')
            .setLabel('Invite to Case')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👥')
            .setDisabled(done),
        new ButtonBuilder().setCustomId('report-close').setLabel('Tutup').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
    );
}

const countOpen = (guild, typeKey, userId) =>
    guild.channels.cache.filter(
        (c) => c.parentId === cfg.categoryId && c.topic?.startsWith(`report:${typeKey}:${userId}`),
    ).size;

function checkLimits(guild, user, typeKey) {
    if (countOpen(guild, typeKey, user.id) >= cfg.maxOpenPerUser)
        return `⛔ **Batas laporan tercapai.**\nKamu masih punya ${cfg.maxOpenPerUser} ${TYPES[typeKey].label} yang belum ditutup. Tunggu tim kami menyelesaikannya dulu ya.`;
    const wait = Math.ceil(((lastCreated.get(user.id) ?? 0) + cfg.cooldownSeconds * 1000 - Date.now()) / 1000);
    if (wait > 0) return `⏳ **Sabar sebentar!**\nTunggu ${wait} detik lagi sebelum membuat report baru.`;
    return null;
}

async function getCategory(guild) {
    const c =
        guild.channels.cache.get(cfg.categoryId) ?? (await guild.channels.fetch(cfg.categoryId).catch(() => null));
    if (!c || c.type !== ChannelType.GuildCategory)
        throw new Error(`Kategori report (${cfg.categoryId}) tidak ditemukan. Cek report.categoryId.`);
    return c;
}

function buildTicketEmbed(typeKey, values, user, num) {
    const t = TYPES[typeKey];
    const s = t.summarize(values);
    return new EmbedBuilder()
        .setAuthor({ name: 'Expensive ROLEPLAY • REPORT CENTER', iconURL: def.icon?.thumbnail })
        .setTitle(`${t.emoji} ${t.label} #${pad(num)}`)
        .setDescription(`### ${cut(s.headline, 200)}\n>>> ${cut(s.body, 3500)}`)
        .addFields(
            { name: '👤 Pelapor', value: `<@${user.id}>\n\`${user.username}\``, inline: true },
            { name: '📌 Status', value: '🟡 Menunggu', inline: true },
            {
                name: '🕒 Dilaporkan',
                value: `<t:${Math.floor(Date.now() / 1000)}:F>\n<t:${Math.floor(Date.now() / 1000)}:R>`,
                inline: true,
            },
            ...s.extra,
        )
        .setColor('Yellow')
        .setFooter({ text: 'Expensive Roleplay • Report Center' })
        .setTimestamp();
}

async function sendLog(guild, payload) {
    if (!cfg.logChannelId) return;
    const ch =
        guild.channels.cache.get(cfg.logChannelId) ?? (await guild.channels.fetch(cfg.logChannelId).catch(() => null));
    if (ch?.isTextBased())
        await ch
            .send({ ...payload, allowedMentions: { parse: [] } })
            .catch((e) => log(`Gagal kirim log report: ${e.message}`, 'warn'));
}

async function dmReporter(client, userId, embed) {
    const u = await client.users.fetch(userId).catch(() => null);
    await u?.send({ embeds: [embed] }).catch(() => {});
}

const uploadLimit = (guild) =>
    (guild.premiumTier >= 3 ? 100 : guild.premiumTier === 2 ? 50 : 10) * 1024 * 1024 - 64 * 1024;

async function createReport(interaction, draft) {
    return enqueue(async () => {
        const guild = interaction.guild;
        const user = interaction.user;
        const typeKey = draft.type;
        const t = TYPES[typeKey];

        const limitMsg = checkLimits(guild, user, typeKey);
        if (limitMsg) throw Object.assign(new Error(limitMsg), { known: true });

        const category = await getCategory(guild);
        const me = guild.members.me ?? (await guild.members.fetchMe());
        const num = (state.counters[typeKey] ?? 0) + 1;
        const staffIds = staffRoleIds(typeKey);

        const base = [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
        ];
        const s = t.summarize(draft.values);

        const channel = await guild.channels.create({
            name: `${t.prefix}-${pad(num)}-${slug(user.username)}`,
            type: ChannelType.GuildText,
            parent: category.id,
            topic: `report:${typeKey}:${user.id} | #${pad(num)} | ${cut(s.headline, 80)}`,

            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: base },
                { id: me.id, allow: [...base, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] },
                ...staffIds.map((id) => ({ id, allow: [...base, PermissionFlagsBits.ManageMessages] })),
            ],
            reason: `${t.label} #${pad(num)} oleh ${user.tag}`,
        });
        analytics.track('report');

        state.counters[typeKey] = num;
        saveState();
        lastCreated.set(user.id, Date.now());

        const maxSize = uploadLimit(guild);
        const files = [];
        const failedLinks = [];
        for (const [i, f] of draft.files.entries()) {
            try {
                if (f.size > maxSize) throw new Error('melebihi batas upload server');
                const res = await fetch(f.url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const buf = Buffer.from(await res.arrayBuffer());
                const ext = (f.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? 'png').toLowerCase();
                files.push(new AttachmentBuilder(buf, { name: `${t.prefix}-${pad(num)}-${i + 1}.${ext}` }));
            } catch (e) {
                log(`Gagal mengunduh bukti ${f.name}: ${e.message}`, 'warn');
                failedLinks.push(`[${f.name}](${f.url})`);
            }
        }

        const embed = buildTicketEmbed(typeKey, draft.values, user, num);
        embed.addFields({
            name: '📎 Bukti',
            value: draft.files.length ? `**${draft.files.length}** file dilampirkan` : '_Tidak ada bukti dilampirkan_',
            inline: true,
        });
        if (failedLinks.length)
            embed.addFields({ name: '📎 Bukti (gagal diunggah ulang)', value: cut(failedLinks.join('\n'), 1024) });
        const firstImage = files.find((a) => /\.(png|jpe?g|gif|webp)$/i.test(a.name));
        if (firstImage) embed.setImage(`attachment://${firstImage.name}`);

        const pings = [...staffIds.map((id) => `<@&${id}>`), `<@${user.id}>`].join(' ');
        await channel.send({
            content: [
                pings,
                `## 🛎️ ${t.label} Dibuka`,
                '> Terima kasih sudah melapor. **Tim Admin** akan segera meninjau laporanmu.',
                '> 🔒 Channel ini **privat**: hanya Tim Admin dan pelapor yang bisa melihatnya.',
                '> 📎 Punya bukti atau info tambahan? Kirim langsung di channel ini.',
            ].join('\n'),
            embeds: [embed],
            files,
            components: [ticketButtons('open')],
            allowedMentions: { roles: staffIds, users: [user.id] },
        });

        await sendLog(guild, {
            embeds: [
                new EmbedBuilder()
                    .setColor('Yellow')
                    .setDescription(`## 📥 ${t.label} Baru #${pad(num)}\n### ${cut(s.headline, 200)}`)
                    .addFields(
                        { name: 'Pelapor', value: `<@${user.id}> (\`${user.username}\`)`, inline: true },
                        { name: 'Channel', value: `<#${channel.id}>`, inline: true },
                    )
                    .setTimestamp(),
            ],
        });

        return { channel, num };
    });
}

const STAGES = {
    process: {
        color: 'Blue',
        stage: 'processing',
        value: (id) => `🔵 Diproses oleh <@${id}>`,
        notice: (id) => `### 🛠️ Sedang Diproses\n> <@${id}> mulai menangani laporan ini.`,
        dmTitle: '🛠️ Laporanmu Sedang Diproses',
        dm: 'Tim kami sudah mulai menangani laporanmu. Mohon ditunggu ya!',
    },
    resolve: {
        color: 'Green',
        stage: 'done',
        rename: 'selesai-',
        value: (id) => `🟢 Selesai oleh <@${id}>`,
        notice: (id) =>
            `### ✅ Laporan Selesai\n> Ditandai **selesai** oleh <@${id}>.\n> Klik **Tutup** untuk mengarsipkan tiket jika sudah tidak diperlukan.`,
        dmTitle: '✅ Laporanmu Telah Selesai',
        dm: 'Laporanmu sudah **diselesaikan**. Terima kasih sudah membantu menjaga kota tetap tertib!',
    },
    reject: {
        color: 'Red',
        stage: 'done',
        rename: 'ditolak-',
        value: (id) => `🔴 Ditolak oleh <@${id}>`,
        notice: (id) =>
            `### ❌ Laporan Ditolak\n> Ditandai **ditolak** oleh <@${id}>.\n> Staff akan menjelaskan alasannya di channel ini sebelum tiket ditutup.`,
        dmTitle: '❌ Laporanmu Ditolak',
        dm: 'Laporanmu **tidak dapat diproses**. Buka channel tiketmu untuk melihat penjelasan dari staff.',
    },
};

async function changeStatus(interaction, key) {
    const ticket = getTicket(interaction.channel);
    if (!ticket) return;
    if (!isStaff(interaction.member, ticket.type))
        return interaction.reply({ content: STAFF_ONLY, flags: MessageFlags.Ephemeral });

    const st = STAGES[key];
    const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(st.color);
    const field = embed.data.fields?.find((x) => x.name.includes('Status'));
    if (field) field.value = st.value(interaction.user.id);

    await interaction.update({ embeds: [embed], components: [ticketButtons(st.stage)] });
    await interaction.channel.send({ content: st.notice(interaction.user.id), allowedMentions: { parse: [] } });
    if (st.rename)
        interaction.channel
            .setName(`${st.rename}${interaction.channel.name.replace(/^(selesai|ditolak)-/, '')}`.slice(0, 100))
            .catch(() => {});

    const t = TYPES[ticket.type];
    await dmReporter(
        interaction.client,
        ticket.userId,
        new EmbedBuilder()
            .setColor(st.color)
            .setAuthor({ name: `${t.label.toUpperCase()} • UPDATE STATUS` })
            .setDescription(`## ${st.dmTitle}\n${st.dm}\n\n**Tiket:** <#${interaction.channel.id}>`)
            .setFooter({ text: 'Expensive Roleplay • Report Center' })
            .setTimestamp(),
    );
}

const canInvite = (member, ticket) =>
    isStaff(member, ticket.type) || (cfg.reporterCanInvite && member.id === ticket.userId);

const closing = new Set();

async function buildTranscript(channel, name) {
    const all = [];
    let before;
    for (let i = 0; i < 10; i++) {
        const batch = await channel.messages.fetch({ limit: 100, before });
        if (!batch.size) break;
        all.push(...batch.values());
        before = batch.last().id;
        if (batch.size < 100) break;
    }
    all.reverse();

    const offset = (def.dutyreport?.utcOffsetHours ?? 7) * 3600 * 1000;
    const fmt = (ts) => new Date(ts + offset).toISOString().replace('T', ' ').slice(0, 16);
    const lines = [
        `Transcript #${channel.name} (${channel.id})`,
        `Dibuat: ${fmt(channel.createdTimestamp)} (UTC+${def.dutyreport?.utcOffsetHours ?? 7})`,
        '='.repeat(60),
        '',
    ];
    for (const m of all) {
        lines.push(`[${fmt(m.createdTimestamp)}] ${m.author.tag}: ${m.content || ''}`.trimEnd());
        for (const e of m.embeds)
            if (e.title)
                lines.push(`    [embed] ${e.title}${e.description ? ' - ' + e.description.replace(/\n+/g, ' ') : ''}`);
        for (const a of m.attachments.values()) lines.push(`    [lampiran] ${a.name} ${a.url}`);
    }
    return new AttachmentBuilder(Buffer.from(lines.join('\n'), 'utf8'), { name: `transcript-${name}.txt` });
}

async function closeTicket(interaction) {
    const ticket = getTicket(interaction.channel);
    if (!ticket) return;
    if (!isStaff(interaction.member, ticket.type))
        return interaction.reply({ content: STAFF_ONLY, flags: MessageFlags.Ephemeral });

    const channel = interaction.channel;
    if (closing.has(channel.id))
        return interaction.reply({
            content: '⏳ Tiket ini sedang dalam proses penutupan.',
            flags: MessageFlags.Ephemeral,
        });
    closing.add(channel.id);

    await interaction.reply({
        content:
            '### 🔒 Menutup Tiket\n> Menyimpan transcript ke log... Channel ini akan dihapus dalam beberapa detik.',
    });

    const t = TYPES[ticket.type];
    const status = interaction.message.embeds[0]?.fields?.find((f) => f.name.includes('Status'))?.value ?? '-';
    const title = interaction.message.embeds[0]?.title ?? t.label;

    let transcript = null;
    try {
        transcript = await buildTranscript(channel, channel.name);
    } catch (e) {
        log(`Gagal membuat transcript ${channel.name}: ${e.message}`, 'warn');
    }

    await sendLog(interaction.guild, {
        embeds: [
            new EmbedBuilder()
                .setColor('Grey')
                .setDescription(`## 🔒 ${title} Ditutup`)
                .addFields(
                    { name: 'Pelapor', value: `<@${ticket.userId}>`, inline: true },
                    { name: 'Status Akhir', value: status, inline: true },
                    { name: 'Ditutup oleh', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Channel', value: `\`#${channel.name}\``, inline: true },
                )
                .setTimestamp(),
        ],
        files: transcript ? [transcript] : [],
    });

    setTimeout(() => {
        channel.delete(`Report ditutup oleh ${interaction.user.tag}`).catch(() => {});
        closing.delete(channel.id);
    }, 5000);
}

module.exports = {
    cfg,
    TYPES,
    STAFF_ONLY,
    drafts,
    DRAFT_TTL,
    safe,
    cut,
    panelPayload,
    buildModal,
    readModal,
    previewEmbed,
    confirmRow,
    isStaff,
    getTicket,
    ticketButtons,
    checkLimits,
    createReport,
    changeStatus,
    canInvite,
    closeTicket,
    buildTicketEmbed,
    buildTranscript,
};
