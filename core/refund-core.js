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
const { buildTranscript } = require('./report-core');

const DEFAULTS = {
    open: true,
    categoryId: 'YOUR_DISCORD_ID',
    logChannelId: 'YOUR_DISCORD_ID',
    adminRoleId: 'YOUR_DISCORD_ID',
    managerRoleIds: ['YOUR_DISCORD_ID'],
    maxOpenPerUser: 2,
    cooldownSeconds: 60,
    maxFiles: 5,
};

const cfg = { ...DEFAULTS, ...(def.refund ?? {}) };

const DRAFT_TTL = 10 * 60 * 1000;
const TOPIC_RE = /^refund:([a-z]+):(\d+) \| #(\d+)/;

const STATE_FILE = path.join(__dirname, '..', 'data', 'refund-state.json');
let state = { counter: 0, requests: {} };

try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state = { counter: s.counter ?? 0, requests: s.requests ?? {} };
} catch {}

const saveState = () => {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (e) {
        log(`Gagal menyimpan refund-state.json: ${e.message}`, 'warn');
    }
};

const pad = (n) => String(n).padStart(4, '0');
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
const slug = (s) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 20) || 'player';
const clean = (s) => String(s ?? '').replace(/`/g, "'");

const plain = (t) =>
    String(t)
        .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
const STAFF_ONLY = '🔒 **Khusus Tim Admin**\nTombol ini hanya dapat diakses oleh staff berwenang.';
const MANAGER_ONLY =
    '🔒 **Khusus Management**\nKeputusan untuk refund kategori **donasi** hanya dapat diambil oleh Management.';

const drafts = new Map();
setInterval(() => {
    for (const [k, v] of drafts) {
        if (v.expires < Date.now()) drafts.delete(k);
    }
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
                '### ❌ Terjadi Kesalahan\n> Sistem refund sedang mengalami kendala. Silakan coba beberapa saat lagi atau hubungi staff.',
            flags: MessageFlags.Ephemeral,
        };
        if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
        else await interaction.reply(msg).catch(() => {});
    }
};

const CATS = {
    uang: {
        label: 'Uang IC',
        emoji: '💵',
        short: 'Uang cash / bank yang hilang',
        item: { label: 'Jumlah Uang yang Hilang', ph: 'Contoh: $25.000.000 (cash / bank)', max: 80 },
    },
    item: {
        label: 'Item',
        emoji: '🎒',
        short: 'Senjata, makanan, barang, dll',
        item: { label: 'Nama Item & Jumlah', ph: 'Contoh: Armor x2, Burger x10, Phone x1', max: 500, long: true },
    },
    kendaraan: {
        label: 'Kendaraan',
        emoji: '🚗',
        short: 'Kendaraan pribadi yang hilang',
        item: {
            label: 'Kendaraan (Model, Plat/ID, Modifikasi)',
            ph: 'Contoh: Infernus, plat ABC123, full modifikasi',
            max: 500,
            long: true,
        },
    },
    properti: {
        label: 'Rumah / Bisnis',
        emoji: '🏠',
        short: 'Rumah, bisnis, atau workshop',
        item: {
            label: 'Rumah / Bisnis (Lokasi atau ID)',
            ph: 'Contoh: Rumah ID 12, Jalan Temple, isi brankas',
            max: 500,
            long: true,
        },
    },
    donasi: {
        label: 'Donasi',
        emoji: '💎',
        short: 'Item donasi yang sudah dibeli',
        donation: true,
        item: {
            label: 'Item / Nomor Pesanan Donasi',
            ph: 'Contoh: Paket QUANTUM, Pesanan #0012',
            max: 500,
            long: true,
        },
    },
    progres: {
        label: 'Level / Progres',
        emoji: '📈',
        short: 'Level, EXP, atau progres lain',
        item: {
            label: 'Level / Progres Sebelumnya',
            ph: 'Contoh: Level 12, EXP 800, kembali ke Level 5',
            max: 300,
            long: true,
        },
    },
    lainnya: {
        label: 'Lainnya',
        emoji: '📦',
        short: 'Kasus di luar kategori di atas',
        item: { label: 'Yang Diminta', ph: 'Jelaskan apa yang ingin dikembalikan', max: 500, long: true },
    },
};

const FIELDS = (cat) => [
    { id: 'char', label: 'Nama Karakter', ph: 'Contoh: Nama_Karakter', min: 3, max: 40 },
    { id: 'item', ...CATS[cat].item, min: 2 },
    {
        id: 'when',
        label: 'Perkiraan Waktu Kejadian',
        ph: 'Contoh: 10 Okt 2026, sebelum server restart',
        min: 3,
        max: 80,
    },
    {
        id: 'story',
        label: 'Kronologi Singkat',
        long: true,
        ph: 'Ceritakan bagaimana barang/uang tersebut hilang secara jelas.',
        min: 20,
        max: 1500,
    },
    {
        kind: 'files',
        id: 'files',
        label: 'Bukti (Screenshot / Video)',
        desc: `Wajib. Minimal 1, maksimal ${cfg.maxFiles} file. Contoh: screenshot inventory/bank/garasi.`,
    },
];

const STATUS = {
    waiting: { label: '🟡 Menunggu Pemeriksaan', color: 'Yellow' },
    processing: { label: '🔵 Sedang Diproses', color: 'Blue' },
    needinfo: { label: '🟠 Butuh Bukti Tambahan', color: 'Orange' },
    approved: { label: '🟢 Disetujui', color: 'Green' },
    sent: { label: '✅ Selesai / Dikirim', color: 'DarkGreen' },
    rejected: { label: '🔴 Ditolak', color: 'Red' },
};
const ACTIVE = new Set(['waiting', 'processing', 'needinfo', 'approved']);

const ACTIONS = {
    process: {
        to: 'processing',
        from: ['waiting', 'needinfo'],
        label: 'Proses',
        emoji: '🛠️',
        style: ButtonStyle.Primary,
        notice: (id) => `### 🛠️ Pengajuan Diproses\n> Ditangani oleh <@${id}>. Mohon menunggu sebentar.`,
        dmTitle: '🛠️ Status Refund: Sedang Diproses',
        dm: 'Tim kami telah mulai memeriksa pengajuanmu.',
    },
    needinfo: {
        to: 'needinfo',
        from: ['waiting', 'processing'],
        label: 'Minta Bukti',
        emoji: '📎',
        style: ButtonStyle.Secondary,
        ask: 'Apa bukti atau informasi tambahan yang diperlukan?',
        notice: (id) =>
            `### 📎 Butuh Bukti Tambahan\n> <@${id}> meminta kelengkapan data. Silakan kirimkan bukti tambahan di channel ini.`,
        dmTitle: '📎 Status Refund: Butuh Bukti Tambahan',
        dm: 'Staff memerlukan data/bukti tambahan. Silakan buka tiketmu untuk melengkapinya.',
    },
    approve: {
        to: 'approved',
        from: ['waiting', 'processing', 'needinfo'],
        label: 'Setujui',
        emoji: '👍',
        style: ButtonStyle.Success,
        decision: true,
        notice: (id) =>
            `### 👍 Pengajuan Disetujui\n> Disetujui oleh <@${id}>. Staff akan segera memproses pengembaliannya.`,
        dmTitle: '🟢 Status Refund: Disetujui',
        dm: 'Pengajuanmu telah **disetujui**. Staff akan segera memprosesnya ke dalam game.',
    },
    sent: {
        to: 'sent',
        from: ['approved'],
        label: 'Selesai',
        emoji: '📦',
        style: ButtonStyle.Success,
        decision: true,
        rename: 'selesai-',
        notice: (id) =>
            `### 📦 Refund Telah Dikirim\n> Ditandai oleh <@${id}>. Silakan cek di dalam game, lalu klik **Tutup Tiket** jika sudah beres.`,
        dmTitle: '✅ Status Refund: Selesai',
        dm: 'Refund telah **dikirim**. Silakan cek langsung di dalam game.',
    },
    reject: {
        to: 'rejected',
        from: ['waiting', 'processing', 'needinfo', 'approved'],
        label: 'Tolak',
        emoji: '❌',
        style: ButtonStyle.Danger,
        decision: true,
        rename: 'ditolak-',
        ask: 'Alasan penolakan (akan dibaca oleh pemohon):',
        notice: (id) =>
            `### ❌ Pengajuan Ditolak\n> Ditolak oleh <@${id}>. Alasan dapat dilihat pada keterangan di bawah.`,
        dmTitle: '❌ Status Refund: Ditolak',
        dm: 'Mohon maaf, pengajuanmu **belum dapat disetujui**. Cek tiketmu untuk melihat alasan dari staff.',
    },
};

const isManager = (member) =>
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    cfg.managerRoleIds.some((id) => member.roles.cache.has(id));

const isStaff = (member, cat) =>
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.roles.cache.has(cfg.adminRoleId) ||
    (cat && CATS[cat]?.donation && isManager(member));

const staffRoleIds = (cat) => [
    ...new Set([cfg.adminRoleId, ...(CATS[cat]?.donation ? cfg.managerRoleIds : [])].filter(Boolean)),
];

function getTicket(channel) {
    const m = channel?.topic?.match(TOPIC_RE);
    return m && CATS[m[1]] ? { cat: m[1], userId: m[2], num: Number(m[3]) } : null;
}

function panelPayload(guild) {
    const description = [
        '## 💎 PUSAT LAYANAN REFUND & KLAIM',
        '*Mengalami kendala kehilangan data atau aset akibat kendala teknis/server? Ajukan klaimmu di sini secara terstruktur.*',
        '',
        '### Kategori Layanan',
        ...Object.values(CATS).map((c) => `> **${c.label}** — *${c.short}*`),
        '',
        '### Panduan Pengajuan',
        '**1.**  Klik tombol **Ajukan Refund**, lalu tentukan kategori kasus.',
        '**2.**  Isi formulir secara lengkap dan **lampirkan bukti valid**.',
        '**3.**  Periksa pratinjau data, lalu konfirmasi dengan **Kirim Pengajuan**.',
        '**4.**  Sistem akan membuka **channel privat** eksklusif untukmu.',
        '**5.**  Pantau progres melalui **DM** atau menu **Status Refund Saya**.',
        '',
        '### Kebijakan & Ketentuan',
        '> • **Bukti wajib dilampirkan.** Klaim tanpa bukti kuat tidak akan diproses.',
        '> • Penyalahgunaan sistem atau laporan palsu dapat dikenakan sanksi tegas.',
        '> • Seluruh pengajuan melalui proses verifikasi ketat oleh tim berwenang.',
        '> • Khusus kategori **Donasi**, keputusan mutlak berada di tangan Management.',
    ].join('\n');

    const embed = new EmbedBuilder()
        .setAuthor({ name: `${guild.name.toUpperCase()} • REFUND CENTER`, iconURL: def.icon?.thumbnail })
        .setThumbnail(def.icon?.thumbnail ?? null)
        .setDescription(description)
        .setColor('#E67E22')
        .setFooter({ text: '© 2026 Expensive Roleplay • All Rights Reserved.', iconURL: def.icon?.thumbnail })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('refund-open')
            .setLabel('Ajukan Refund')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💸'),
        new ButtonBuilder()
            .setCustomId('refund-mine')
            .setLabel('Status Refund Saya')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📋'),
    );
    return { embeds: [embed], components: [row] };
}

const activeOf = (userId) =>
    Object.values(state.requests).filter((r) => r.userId === userId && ACTIVE.has(r.status) && !r.closed);

function checkLimits(user) {
    if (!cfg.open)
        return '🔒 **Layanan Refund Ditutup Sementara**\nSilakan pantau pengumuman resmi server untuk informasi pembukaan berikutnya.';
    if (activeOf(user.id).length >= cfg.maxOpenPerUser)
        return `⛔ **Batas Maksimal Tercapai**\nKamu masih memiliki ${cfg.maxOpenPerUser} tiket aktif yang belum selesai. Harap selesaikan terlebih dahulu.`;
    const wait = Math.ceil(((lastCreated.get(user.id) ?? 0) + cfg.cooldownSeconds * 1000 - Date.now()) / 1000);
    if (wait > 0) return `⏳ **Harap Bersabar**\nTunggu ${wait} detik lagi sebelum membuat pengajuan baru.`;
    return null;
}

function categorySelect() {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('refund-cat')
            .setPlaceholder('Pilih kategori refund yang sesuai...')
            .addOptions(
                Object.entries(CATS).map(([value, c]) => ({
                    label: c.label,
                    value,
                    emoji: c.emoji,
                    description: c.short,
                })),
            ),
    );
}

function buildModal(cat) {
    const c = CATS[cat];
    const modal = new ModalBuilder().setCustomId(`refund-modal:${cat}`).setTitle(`Form Refund ${c.label}`.slice(0, 45));
    for (const f of FIELDS(cat)) {
        const label = new LabelBuilder().setLabel(f.label.slice(0, 45));
        if (f.desc) label.setDescription(f.desc.slice(0, 100));
        if (f.kind === 'files') {
            label.setFileUploadComponent(
                new FileUploadBuilder().setCustomId(f.id).setMinValues(1).setMaxValues(cfg.maxFiles).setRequired(true),
            );
        } else {
            const input = new TextInputBuilder()
                .setCustomId(f.id)
                .setStyle(f.long ? TextInputStyle.Paragraph : TextInputStyle.Short)
                .setMaxLength(f.max)
                .setMinLength(f.min ?? 1)
                .setRequired(true);
            if (f.ph) input.setPlaceholder(f.ph.slice(0, 100));
            label.setTextInputComponent(input);
        }
        modal.addLabelComponents(label);
    }
    return modal;
}

function readModal(interaction, cat) {
    const values = {};
    const files = [];
    for (const f of FIELDS(cat)) {
        if (f.kind === 'files') {
            const uploaded = interaction.fields.getUploadedFiles(f.id);
            for (const a of uploaded?.values() ?? []) {
                const ok =
                    /^(image|video)\//.test(a.contentType ?? '') ||
                    /\.(png|jpe?g|gif|webp|mp4|mov|webm|mkv)$/i.test(a.name ?? '');
                if (!ok) return { error: `File **${a.name}** tidak didukung. Harap unggah format gambar atau video.` };
                files.push({ name: a.name ?? 'bukti', url: a.url, size: a.size ?? 0 });
            }
            if (!files.length) return { error: 'Bukti wajib dilampirkan (minimal 1 screenshot atau video).' };
        } else {
            values[f.id] = (interaction.fields.getTextInputValue(f.id) ?? '').trim();
        }
    }
    return { values, files };
}

const headlineOf = (cat, v) => `${v.char} — ${CATS[cat].label}:${cut(v.item.replace(/\s+/g, ' '), 90)}`;

function detailFields(cat, v) {
    return [
        { name: 'Karakter', value: `\`${clean(cut(v.char, 60))}\``, inline: true },
        { name: CATS[cat].item.label.slice(0, 256), value: cut(v.item, 1024) },
        { name: 'Waktu Kejadian', value: cut(v.when, 1024) },
    ];
}

function previewEmbed(cat, values, files) {
    const c = CATS[cat];
    const embed = new EmbedBuilder()
        .setAuthor({ name: `REFUND ${c.label.toUpperCase()} • PRATINJAU` })
        .setDescription(
            [
                '## 📝 Periksa Kembali Data Anda',
                '> Pastikan seluruh informasi sudah benar. Setelah dikirim, channel privat akan otomatis dibuat.',
                ...(c.donation ? ['> Pengajuan khusus **donasi** akan ditinjau langsung oleh Management.'] : []),
            ].join('\n'),
        )
        .addFields(
            ...detailFields(cat, values),
            { name: 'Kronologi', value: cut(`>>> ${values.story}`, 1024) },
            { name: 'Bukti Pendukung', value: `**${files.length}** file terlampir` },
        )
        .setColor('Orange')
        .setFooter({ text: 'Klik "Kirim Pengajuan" untuk melanjutkan • Draft berlaku selama 10 menit' });

    const firstImage = files.find((f) => /\.(png|jpe?g|gif|webp)$/i.test(f.name));
    if (firstImage) embed.setImage(firstImage.url);
    return embed;
}

const confirmRow = () =>
    new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('refund-confirm')
            .setLabel('Kirim Pengajuan')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
        new ButtonBuilder()
            .setCustomId('refund-cancel')
            .setLabel('Batal')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✖️'),
    );

function ticketButtons(status = 'waiting') {
    const btn = (key) => {
        const a = ACTIONS[key];
        return new ButtonBuilder()
            .setCustomId(`refund-act:${key}`)
            .setLabel(a.label)
            .setStyle(a.style)
            .setEmoji(a.emoji)
            .setDisabled(!a.from.includes(status));
    };
    return [
        new ActionRowBuilder().addComponents(
            btn('process'),
            btn('needinfo'),
            btn('approve'),
            btn('sent'),
            btn('reject'),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('refund-close')
                .setLabel('Tutup Tiket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒'),
        ),
    ];
}

async function sendLog(guild, payload) {
    if (!cfg.logChannelId) return;
    const ch =
        guild.channels.cache.get(cfg.logChannelId) ?? (await guild.channels.fetch(cfg.logChannelId).catch(() => null));
    if (ch?.isTextBased())
        await ch
            .send({ ...payload, allowedMentions: { parse: [] } })
            .catch((e) => log(`Gagal mengirim log refund: ${e.message}`, 'warn'));
}

async function dmUser(client, userId, embed) {
    const u = await client.users.fetch(userId).catch(() => null);
    await u?.send({ embeds: [embed] }).catch(() => {});
}

const uploadLimit = (guild) =>
    (guild.premiumTier >= 3 ? 100 : guild.premiumTier === 2 ? 50 : 10) * 1024 * 1024 - 64 * 1024;

async function createRefund(interaction, draft) {
    return enqueue(async () => {
        const guild = interaction.guild;
        const user = interaction.user;
        const cat = draft.cat;
        const c = CATS[cat];

        const limitMsg = checkLimits(user);
        if (limitMsg) throw Object.assign(new Error(limitMsg), { known: true });

        const category =
            guild.channels.cache.get(cfg.categoryId) ?? (await guild.channels.fetch(cfg.categoryId).catch(() => null));
        if (!category || category.type !== ChannelType.GuildCategory)
            throw new Error(
                `Kategori refund (${cfg.categoryId}) tidak ditemukan. Periksa kembali pengaturan konfigurasi.`,
            );

        const me = guild.members.me ?? (await guild.members.fetchMe());
        const num = state.counter + 1;
        const staffIds = staffRoleIds(cat);
        const headline = headlineOf(cat, draft.values);

        const base = [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
        ];
        const channel = await guild.channels.create({
            name: `refund-${pad(num)}-${slug(user.username)}`,
            type: ChannelType.GuildText,
            parent: category.id,
            topic: `refund:${cat}:${user.id} | #${pad(num)} \vert{}${cut(headline, 80)}`,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: base },
                { id: me.id, allow: [...base, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] },
                ...staffIds.map((id) => ({ id, allow: [...base, PermissionFlagsBits.ManageMessages] })),
            ],
            reason: `Refund #${pad(num)} oleh${user.tag}`,
        });
        analytics.track('refund');

        state.counter = num;
        state.requests[num] = {
            num,
            userId: user.id,
            username: user.username,
            cat,
            headline,
            status: 'waiting',
            channelId: channel.id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            handledBy: null,
            note: null,
            closed: false,
        };
        saveState();
        lastCreated.set(user.id, Date.now());

        const maxSize = uploadLimit(guild);
        const files = [];
        const failedLinks = [];
        for (const [i, f] of draft.files.entries()) {
            try {
                if (f.size > maxSize) throw new Error('melebihi batas ukuran file server');
                const res = await fetch(f.url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const buf = Buffer.from(await res.arrayBuffer());
                const ext = (f.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? 'png').toLowerCase();
                files.push(new AttachmentBuilder(buf, { name: `refund-${pad(num)}-${i + 1}.${ext}` }));
            } catch (e) {
                log(`Gagal mengunduh file bukti ${f.name}:${e.message}`, 'warn');
                failedLinks.push(`[${f.name}](${f.url})`);
            }
        }

        const ts = Math.floor(Date.now() / 1000);
        const embed = new EmbedBuilder()
            .setAuthor({ name: 'EXPENSIVE ROLEPLAY • REFUND CENTER', iconURL: def.icon?.thumbnail })
            .setTitle(`${c.emoji} Refund ${c.label} #${pad(num)}`)
            .setDescription(`### ${cut(headline, 200)}\n>>>${cut(draft.values.story, 3500)}`)
            .addFields(
                { name: 'Pemohon', value: `<@${user.id}>\n\`${user.username}\``, inline: true },
                { name: 'Status', value: plain(STATUS.waiting.label), inline: true },
                { name: 'Diajukan', value: `<t:${ts}:F>\n<t:${ts}:R>`, inline: true },
                ...detailFields(cat, draft.values),
                { name: 'Bukti', value: `**${draft.files.length}** file dilampirkan`, inline: true },
            )
            .setColor(STATUS.waiting.color)
            .setFooter({ text: 'Expensive Roleplay • Refund Center' })
            .setTimestamp();

        if (failedLinks.length)
            embed.addFields({ name: 'Lampiran (Gagal diunggah ulang)', value: cut(failedLinks.join('\n'), 1024) });
        const firstImage = files.find((a) => /\.(png|jpe?g|gif|webp)$/i.test(a.name));
        if (firstImage) embed.setImage(`attachment://${firstImage.name}`);

        const pings = [...staffIds.map((id) => `<@&${id}>`), `<@${user.id}>`].join(' ');
        await channel.send({
            content: [
                pings,
                '## 💸 Pengajuan Refund Telah Dibuka',
                '> Terima kasih telah melapor. **Tim Admin** akan segera memeriksa rincian klaimmu.',
                ...(c.donation ? ['> Pengajuan donasi memerlukan keputusan dari pihak **Management**.'] : []),
                '> Channel ini bersifat **privat**: hanya dapat dilihat oleh Tim Admin dan pemohon.',
            ].join('\n'),
            embeds: [embed],
            files,
            components: ticketButtons('waiting'),
            allowedMentions: { roles: staffIds, users: [user.id] },
        });

        await sendLog(guild, {
            embeds: [
                new EmbedBuilder()
                    .setColor('Yellow')
                    .setDescription(`## 📥 Pengajuan Baru #${pad(num)}\n### ${cut(headline, 200)}`)
                    .addFields(
                        { name: 'Pemohon', value: `<@${user.id}> (\`${user.username}\`)`, inline: true },
                        { name: 'Kategori', value: c.label, inline: true },
                        { name: 'Channel', value: `<#${channel.id}>`, inline: true },
                    )
                    .setTimestamp(),
            ],
        });

        return { channel, num };
    });
}

function actionDenied(member, ticket, key) {
    if (!isStaff(member, ticket.cat)) return STAFF_ONLY;
    if (ACTIONS[key].decision && CATS[ticket.cat].donation && !isManager(member)) return MANAGER_ONLY;
    return null;
}

async function applyAction(interaction, key, note = null) {
    const ticket = getTicket(interaction.channel);
    if (!ticket) return;
    const a = ACTIONS[key];
    const reply = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

    const denied = actionDenied(interaction.member, ticket, key);
    if (denied) return reply(denied);

    const rec = state.requests[ticket.num];
    if (!rec) return reply('❌ Data pengajuan tidak ditemukan di sistem.');
    if (!a.from.includes(rec.status))
        return reply(
            `⚠️ Status pengajuan telah berubah menjadi **${STATUS[rec.status].label}**. Silakan muat ulang tiket.`,
        );

    rec.status = a.to;
    rec.updatedAt = Date.now();
    rec.handledBy = interaction.user.id;
    if (note) rec.note = note;
    saveState();

    const st = STATUS[a.to];
    const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(st.color);
    embed.data.fields ??= [];
    const statusField = embed.data.fields.find((x) => x.name.includes('Status'));
    if (statusField) statusField.value = `${plain(st.label)}\noleh <@${interaction.user.id}>`;
    if (note) {
        const noteField = embed.data.fields.find((x) => x.name.includes('Catatan Staff'));
        if (noteField) noteField.value = cut(note, 1024);
        else embed.addFields({ name: 'Catatan Staff', value: cut(note, 1024) });
    }

    await interaction.update({ embeds: [embed], components: ticketButtons(a.to) });
    await interaction.channel.send({
        content: a.notice(interaction.user.id) + (note ? `\n>>> ${cut(note, 1500)}` : ''),
        allowedMentions: { parse: [] },
    });

    if (a.rename)
        interaction.channel
            .setName(`${a.rename}${interaction.channel.name.replace(/^(selesai|ditolak)-/, '')}`.slice(0, 100))
            .catch(() => {});

    const c = CATS[ticket.cat];
    await dmUser(
        interaction.client,
        ticket.userId,
        new EmbedBuilder()
            .setColor(st.color)
            .setAuthor({ name: `REFUND ${c.label.toUpperCase()} • PEMBARUAN STATUS` })
            .setDescription(
                [
                    `## ${a.dmTitle}`,
                    a.dm,
                    ...(note ? ['', `**Catatan Staff:**\n>>> ${cut(note, 1200)}`] : []),
                    '',
                    `**Tiket:** <#${interaction.channel.id}>`,
                ].join('\n'),
            )
            .setFooter({ text: 'Expensive Roleplay • Refund Center' })
            .setTimestamp(),
    );

    await sendLog(interaction.guild, {
        embeds: [
            new EmbedBuilder()
                .setColor(st.color)
                .setDescription(`## ${st.label} • Refund #${pad(ticket.num)}\n### ${cut(rec.headline, 200)}`)
                .addFields(
                    { name: 'Pemohon', value: `<@${ticket.userId}>`, inline: true },
                    { name: 'Oleh', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
                    ...(note ? [{ name: 'Catatan', value: cut(note, 1024) }] : []),
                )
                .setTimestamp(),
        ],
    });
}

function noteModal(key) {
    return new ModalBuilder()
        .setCustomId(`refund-act:${key}`)
        .setTitle(`${ACTIONS[key].label} Refund`.slice(0, 45))
        .addLabelComponents(
            new LabelBuilder()
                .setLabel(ACTIONS[key].ask.slice(0, 45))
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId('note')
                        .setStyle(TextInputStyle.Paragraph)
                        .setMinLength(5)
                        .setMaxLength(1000)
                        .setRequired(true),
                ),
        );
}

function myRequestsEmbed(userId) {
    const mine = Object.values(state.requests)
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.num - a.num)
        .slice(0, 10);
    const e = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('📋 Status Pengajuan Refund Saya')
        .setFooter({ text: 'Menampilkan hingga 10 riwayat pengajuan terbaru' });

    if (!mine.length)
        return e.setDescription(
            'Kamu belum pernah mengajukan refund.\nKlik tombol **Ajukan Refund** pada panel utama untuk memulai.',
        );

    return e.setDescription(
        mine
            .map((r) => {
                const c = CATS[r.cat];
                const link = !r.closed && r.channelId ? ` • <#${r.channelId}>` : '';
                return [
                    `### #${pad(r.num)} ${c.emoji}${c.label}`,
                    `> ${STATUS[r.status].label} • <t:${Math.floor(r.updatedAt / 1000)}:R>${link}`,
                    `> ${cut(clean(r.headline), 120)}`,
                    ...(r.note && ['rejected', 'needinfo'].includes(r.status)
                        ? [`> 📝 ${cut(clean(r.note), 150)}`]
                        : []),
                ].join('\n');
            })
            .join('\n\n'),
    );
}

const closing = new Set();
async function closeTicket(interaction) {
    const ticket = getTicket(interaction.channel);
    if (!ticket) return;
    if (!isStaff(interaction.member, ticket.cat))
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
            '### 🔒 Menutup Tiket\n> Menyimpan transkrip dan membersihkan data... Channel akan dihapus dalam beberapa detik.',
    });

    const rec = state.requests[ticket.num];
    if (rec) {
        rec.closed = true;
        rec.updatedAt = Date.now();
        saveState();
    }

    let transcript = null;
    try {
        transcript = await buildTranscript(channel, channel.name);
    } catch (e) {
        log(`Gagal membuat transkrip ${channel.name}:${e.message}`, 'warn');
    }

    await sendLog(interaction.guild, {
        embeds: [
            new EmbedBuilder()
                .setColor('Grey')
                .setDescription(`## 🔒 Refund #${pad(ticket.num)} Ditutup`)
                .addFields(
                    { name: 'Pemohon', value: `<@${ticket.userId}>`, inline: true },
                    { name: 'Status Akhir', value: rec ? plain(STATUS[rec.status].label) : '-', inline: true },
                    { name: 'Ditutup oleh', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Channel', value: `\`#${channel.name}\``, inline: true },
                )
                .setTimestamp(),
        ],
        files: transcript ? [transcript] : [],
    });

    setTimeout(() => {
        channel.delete(`Refund ditutup oleh ${interaction.user.tag}`).catch(() => {});
        closing.delete(channel.id);
    }, 5000);
}

module.exports = {
    cfg,
    CATS,
    STATUS,
    ACTIONS,
    drafts,
    DRAFT_TTL,
    state,
    safe,
    cut,
    panelPayload,
    categorySelect,
    buildModal,
    readModal,
    previewEmbed,
    confirmRow,
    checkLimits,
    createRefund,
    ticketButtons,
    getTicket,
    actionDenied,
    applyAction,
    noteModal,
    myRequestsEmbed,
    closeTicket,
};
