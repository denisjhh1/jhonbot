const fs = require('fs');
const path = require('path');
const {
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    AttachmentBuilder,
} = require('discord.js');
const def = require('../defines');
const { log } = require('../functions');
const analytics = require('./analytics-core');
const catalog = require('../catalog/donation-catalog');

const cfg = def.donation ?? {};
const DRAFT_TTL = 15 * 60 * 1000;
const MAX_OPEN = cfg.maxOpenPerUser ?? 2;
const QRIS_FILE = path.join(__dirname, '..', cfg.qrisFile ?? 'assets/qris.jpg');
const QRIS_NAME = 'qris.jpg';

const STATUS = {
    awaiting: { label: '🟡 Menunggu Pembayaran', color: '#F1C40F' },
    paid: { label: '🟠 Menunggu Verifikasi Staff', color: '#E67E22' },
    confirmed: { label: '🔵 Pembayaran Dikonfirmasi (Diproses)', color: '#3498DB' },
    delivered: { label: '🟢 Pesanan Selesai', color: '#2ECC71' },
    cancelled: { label: '🔴 Pesanan Dibatalkan', color: '#E74C3C' },
};
const ACTIVE = ['awaiting', 'paid', 'confirmed'];

const STATE_FILE = path.join(__dirname, '..', 'data', 'donation-state.json');
let state = { counter: 0, orders: {}, discounts: [] };
try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state = { counter: s.counter ?? 0, orders: s.orders ?? {}, discounts: s.discounts ?? [] };
} catch {}

function save() {
    try {
        const tmp = STATE_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(state));
        fs.renameSync(tmp, STATE_FILE);
    } catch (e) {
        log(`Gagal menyimpan donation-state.json: ${e.message}`, 'err');
    }
}
const getOrder = (channelId) => state.orders[channelId];

const roundTo100 = (n) => Math.round(n / 100) * 100;
const nowSec = () => Math.floor(Date.now() / 1000);

function activeDiscounts() {
    const before = state.discounts.length;
    state.discounts = state.discounts.filter((d) => !d.until || d.until > nowSec());
    if (state.discounts.length !== before) save();
    return state.discounts;
}

function discountFor(catKey) {
    let best = null;
    for (const d of activeDiscounts()) {
        if ((d.cats === 'all' || d.cats.includes(catKey)) && (!best || d.percent > best.percent)) best = d;
    }
    return best;
}

const discountedTotal = (base, qty, pct) => roundTo100((base * qty * (100 - pct)) / 100);

function parseSpan(input) {
    const s = String(input ?? '')
        .toLowerCase()
        .trim();
    if (!s) return null;
    const unit = { hari: 86400, d: 86400, jam: 3600, j: 3600, menit: 60, mnt: 60, m: 60 };
    let total = 0,
        rest = s;
    for (const m of s.matchAll(/(\d+)\s*(hari|d|jam|j|menit|mnt|m)\b/g)) {
        total += +m[1] * unit[m[2]];
        rest = rest.replace(m[0], '');
    }
    if (!total || rest.replace(/dan|[\s,]/g, '')) return undefined;
    return total >= 60 && total <= 90 * 86400 ? total : undefined;
}

function promoSummary(catKey) {
    const list = activeDiscounts().filter((d) => !catKey || d.cats === 'all' || d.cats.includes(catKey));
    if (!list.length) return '';
    return list
        .map(
            (d) =>
                `🔥 **${d.label || 'PROMO DISKON'} −${d.percent}\%**${d.cats === 'all' ? '' : ` (${d.cats.map((c) => categories[c]?.label ?? c).join(', ')})`}${d.until ? ` • berakhir <t:${d.until}:R>` : ''}`,
        )
        .join('\n');
}

const drafts = new Map();
setInterval(() => {
    for (const [k, v] of drafts) if (v.expires < Date.now()) drafts.delete(k);
}, 60 * 1000).unref();

const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const pad = (n) => String(n).padStart(4, '0');
const rupiah = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;
const slug = (s) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 20) || 'player';

const staffRoleIds = () => [...new Set((cfg.staffRoleIds ?? []).filter(Boolean))];
const isStaff = (member) =>
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    (def.users?.ownerId ?? []).includes(member.id) ||
    staffRoleIds().some((id) => member.roles.cache.has(id));

const categories = catalog.categories;
const getCat = (key) => categories[key];
const getItem = (catKey, itemId) => categories[catKey]?.items.find((i) => i.id === itemId);
const priceText = (item, catKey, md = false) => {
    if (item.price == null) return 'Harga Menyesuaikan';
    const unit = item.qty ? ` / ${item.qty.unit ?? 'unit'}` : '';
    const d = catKey ? discountFor(catKey) : null;
    if (!d) return rupiah(item.price) + unit;
    const final = item.qty
        ? Math.round((item.price * (100 - d.percent)) / 100)
        : discountedTotal(item.price, 1, d.percent);
    return md
        ? `~~${rupiah(item.price)}~~ **${rupiah(final)}**${unit} (−${d.percent}%)`
        : `${rupiah(final)}${unit} (-${d.percent}\%, normal${rupiah(item.price)})`;
};

function categorySelect(customId, placeholder = 'Pilih Kategori Donasi...') {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(placeholder)
            .addOptions(
                Object.entries(categories).map(([value, c]) => ({
                    label: c.label,
                    value,
                    emoji: c.emoji,
                    description: cut(`${c.items.length} pilihan item`, 100),
                })),
            ),
    );
}

function itemSelect(catKey) {
    const cat = categories[catKey];
    const max = cat.multi === false ? 1 : Math.min(cat.items.length, catalog.MAX_MULTI);
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`don-item:${catKey}`)
            .setPlaceholder(max > 1 ? `Pilih item (maksimal ${max})...` : 'Pilih item...')
            .setMinValues(1)
            .setMaxValues(max)
            .addOptions(
                cat.items.map((i) => {
                    const first = Array.isArray(i.desc) ? i.desc.join(', ') : (i.desc ?? '');
                    return {
                        label: cut(i.name, 100),
                        value: i.id,
                        description: cut(`${priceText(i, catKey)}${first ? ' • ' + first : ''}`, 100),
                    };
                }),
            ),
    );
}

function categoryEmbed(catKey) {
    const cat = categories[catKey];
    const lines = cat.items.map((i) => {
        const d = Array.isArray(i.desc) ? i.desc.map((x) => `   ◦ ${x}`).join('\n') : i.desc ? `   ◦ ${i.desc}` : '';
        return `### ${cat.emoji} **${i.name}**\n> 💰 **Harga:** ${priceText(i, catKey, true)}${d ? '\n' + d : ''}`;
    });
    const banner = discountFor(catKey) ? promoSummary(catKey) + '\n\n' : '';
    const body = [banner + lines.join('\n\n'), cat.note ? `\n📌 **Catatan Tambahan:**\n${cat.note}` : ''].join('\n');
    return new EmbedBuilder()
        .setTitle(`📦 KATALOG DONASI • ${cat.label.toUpperCase()}`)
        .setDescription(cut(body, 4000))
        .setColor('#FFD700');
}

function buildLines(draft) {
    const d = discountFor(draft.cat);
    const lines = [];
    for (const id of draft.items) {
        const item = getItem(draft.cat, id);
        if (!item) continue;
        const qty = item.qty ? draft.qty : 1;
        const base = item.price;
        const pct = base != null && d ? d.percent : 0;
        lines.push({
            cat: draft.cat,
            id,
            name: item.name,
            qty,
            base,
            pct,
            promo: pct ? (d.label ?? '') : '',
            total: base == null ? null : pct ? discountedTotal(base, qty, pct) : base * qty,
        });
    }
    return lines;
}

const lineBase = (l) => (l.base !== undefined ? l.base : l.price);
const lineTotal = (l) => (l.total !== undefined ? l.total : l.price == null ? null : l.price * l.qty);
const orderTotal = (lines) =>
    lines.some((l) => lineTotal(l) == null) ? null : lines.reduce((s, l) => s + lineTotal(l), 0);
const orderSubtotal = (lines) =>
    lines.some((l) => lineBase(l) == null) ? null : lines.reduce((s, l) => s + lineBase(l) * l.qty, 0);
const lineText = (l) => {
    const t = lineTotal(l);
    const price =
        t == null
            ? '*Harga ditentukan staff*'
            : l.pct
              ? `~~${rupiah(lineBase(l) * l.qty)}~~ **${rupiah(t)}** \`(-${l.pct}%)\``
              : `\`${rupiah(t)}\``;
    return `> 🛍️ **${l.name}**${l.qty > 1 ? ` \`(${l.qty}x)\`` : ''} — ${price}`;
};

function buildEmbed(o) {
    const st = STATUS[o.status];
    const itemListText = o.items.map(lineText).join('\n');

    let totalDisplay = '*Ditentukan Staff*';
    if (o.total != null) {
        if (o.subtotal && o.subtotal > o.total) {
            const hemat = o.subtotal - o.total;
            totalDisplay = `~~${rupiah(o.subtotal)}~~\n**${rupiah(o.total)}**\n🏷️ *Hemat ${rupiah(hemat)}*`;
        } else {
            totalDisplay = `**${rupiah(o.total)}**`;
        }
    }

    const e = new EmbedBuilder()
        .setTitle(`🧾 TIKET DONASI #${pad(o.num)}`)
        .setDescription(`### 📌 DAFTAR ITEM PESANAN:\n${itemListText}`)
        .setColor(st.color)
        .addFields(
            { name: '👤 Pemesan', value: `<@${o.userId}>`, inline: true },
            { name: '🎭 Karakter (IC)', value: `\`${cut(o.ic, 100)}\``, inline: true },
            { name: '🆔 Akun (UCP)', value: `\`${cut(o.ucp, 100)}\``, inline: true },
            { name: '💰 Total Biaya', value: totalDisplay, inline: true },
            { name: '📊 Status Tiket', value: `**${st.label}**`, inline: true },
            { name: '🕒 Waktu Dibuat', value: `<t:${o.createdAt}:R>`, inline: true },
        )
        .setFooter({ text: `Management Server • Order ID #${pad(o.num)}` })
        .setTimestamp();

    if (o.detail) {
        e.addFields({ name: '📝 Detail Permintaan', value: `\`\`\`${cut(o.detail, 1000)}\`\`\`` });
    }

    const who = [];
    if (o.confirmedBy) who.push(`✅ Dikonfirmasi oleh <@${o.confirmedBy}>`);
    if (o.deliveredBy) who.push(`📦 Dikirim oleh <@${o.deliveredBy}>`);
    if (o.cancelledBy) who.push(`🚫 Dibatalkan oleh <@${o.cancelledBy}>`);
    if (who.length) {
        e.addFields({ name: '🧑‍💼 Riwayat Penanganan', value: who.join('\n') });
    }

    if (o.status === 'awaiting') {
        e.addFields({
            name: '💳 METODE PEMBAYARAN (QRIS)',
            value: [
                '1️⃣ Scan kode **QRIS** di bawah menggunakan e-wallet / mobile banking.',
                `2️⃣ Transfer nominal ${o.total == null ? 'sesuai instruksi staff' : `sebesar **${rupiah(o.total)}**`}.`,
                '3️⃣ Upload **foto/screenshot bukti transfer** ke dalam tiket ini.',
                '4️⃣ Tekan tombol **💸 Saya Sudah Bayar** di bawah untuk memberi tahu staff.',
                '',
                '⚠️ *Hati-hati terhadap penipuan! Staff tidak pernah meminta password atau data akun.*',
            ].join('\n'),
        });
        e.setImage(`attachment://${QRIS_NAME}`);
    }
    return e;
}

function ticketComponents(o) {
    const done = o.status === 'delivered' || o.status === 'cancelled';
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('don-paid')
                .setLabel('Saya Sudah Bayar')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('💸')
                .setDisabled(o.status !== 'awaiting' || o.total == null),
            new ButtonBuilder()
                .setCustomId('don-cancelorder')
                .setLabel('Batalkan Pesanan')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🚫')
                .setDisabled(done),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('don-verify')
                .setLabel('Konfirmasi Pembayaran')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
                .setDisabled(o.status === 'confirmed' || done),
            new ButtonBuilder()
                .setCustomId('don-done')
                .setLabel('Tandai Terkirim')
                .setStyle(ButtonStyle.Success)
                .setEmoji('📦')
                .setDisabled(o.status !== 'confirmed'),
            new ButtonBuilder()
                .setCustomId('don-close')
                .setLabel('Tutup Tiket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒'),
        ),
    ];
}

const render = (o) => ({ embeds: [buildEmbed(o)], components: ticketComponents(o) });

async function getTicketCategory(guild) {
    let id = cfg.categoryId || null;
    if (!id && cfg.panelChannelId) {
        const ch =
            guild.channels.cache.get(cfg.panelChannelId) ??
            (await guild.channels.fetch(cfg.panelChannelId).catch(() => null));
        id = ch?.parentId ?? null;
    }
    if (!id) throw new Error('Kategori donasi tidak ditemukan. Isi def.donation.categoryId atau panelChannelId.');
    const cat = guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null));
    if (!cat || cat.type !== ChannelType.GuildCategory) throw new Error(`Kategori donasi (${id}) tidak valid.`);
    return cat;
}

function countOpen(guild, userId) {
    let n = 0;
    for (const [chId, o] of Object.entries(state.orders)) {
        if (o.userId !== userId || !ACTIVE.includes(o.status)) continue;
        if (!guild.channels.cache.has(chId)) {
            o.status = 'cancelled';
            continue;
        }
        n++;
    }
    return n;
}

async function createOrder(interaction, draft) {
    const guild = interaction.guild;
    const user = interaction.user;
    if (countOpen(guild, user.id) >= MAX_OPEN)
        throw new Error(
            `Kamu masih memiliki ${MAX_OPEN} pesanan donasi aktif. Silakan selesaikan atau batalkan pesanan sebelumnya terlebih dahulu.`,
        );

    const category = await getTicketCategory(guild);
    const me = guild.members.me ?? (await guild.members.fetchMe());
    const lines = draft.lines ?? buildLines(draft);
    const num = ++state.counter;

    const staffIds = staffRoleIds();

    const hiddenRoles = guild.roles.cache
        .filter((r) => r.id !== guild.roles.everyone.id && !r.managed && !staffIds.includes(r.id))
        .map((r) => ({ id: r.id, deny: [PermissionFlagsBits.ViewChannel] }))
        .slice(0, 90);
    const channel = await guild.channels.create({
        name: `donasi-${pad(num)}-${slug(user.username)}`,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: `donasi:${user.id} | #${pad(num)}`,
        permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            ...hiddenRoles,
            {
                id: user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks,
                ],
            },
            {
                id: me.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.ManageMessages,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.ReadMessageHistory,
                ],
            },
            ...staffIds.map((id) => ({
                id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ManageMessages,
                ],
            })),
        ],
        reason: `Pesanan donasi #${pad(num)} oleh ${user.tag}`,
    });
    analytics.track('donasi');

    const order = {
        num,
        userId: user.id,
        channelId: channel.id,
        ic: draft.ic,
        ucp: draft.ucp,
        detail: draft.detail || '',
        items: lines,
        total: orderTotal(lines),
        subtotal: orderSubtotal(lines),
        status: 'awaiting',
        createdAt: Math.floor(Date.now() / 1000),
        confirmedBy: null,
        deliveredBy: null,
        cancelledBy: null,
    };

    const files = fs.existsSync(QRIS_FILE) ? [new AttachmentBuilder(QRIS_FILE, { name: QRIS_NAME })] : [];
    if (!files.length) log(`File QRIS tidak ditemukan: ${QRIS_FILE}`, 'warn');

    const pings = [
        ...staffIds.map((id) => `<@&${id}>`),
        ...(cfg.pingUserIds ?? []).map((id) => `<@${id}>`),
        `<@${user.id}>`,
    ].join(' ');

    state.orders[channel.id] = order;
    save();

    try {
        const msg = await channel.send({
            content: `${pings}\n> 🛎️ **Tiket pesanan donasi baru berhasil dibuat.** Silakan lakukan pembayaran lalu unggah bukti transfer dan klik tombol **Saya Sudah Bayar**.`,
            ...render(order),
            files,
            allowedMentions: { roles: staffIds, users: [...(cfg.pingUserIds ?? []), user.id] },
        });
        order.messageId = msg.id;
        save();
    } catch (e) {
        delete state.orders[channel.id];
        save();
        await channel.delete('Gagal membuat tiket donasi').catch(() => {});
        throw e;
    }
    return { channel, order };
}

async function sendLog(guild, embed) {
    if (!cfg.logChannelId) return;
    const ch =
        guild.channels.cache.get(cfg.logChannelId) ?? (await guild.channels.fetch(cfg.logChannelId).catch(() => null));
    if (ch?.isTextBased())
        await ch
            .send({ embeds: [embed], allowedMentions: { parse: [] } })
            .catch((e) => log(`Gagal kirim log donasi: ${e.message}`, 'warn'));
}

module.exports = {
    cfg,
    STATUS,
    ACTIVE,
    DRAFT_TTL,
    QRIS_NAME,
    state,
    save,
    getOrder,
    drafts,
    cut,
    pad,
    rupiah,
    isStaff,
    categories,
    getCat,
    getItem,
    categorySelect,
    itemSelect,
    categoryEmbed,
    buildLines,
    orderTotal,
    lineText,
    buildEmbed,
    ticketComponents,
    render,
    createOrder,
    sendLog,
    activeDiscounts,
    discountFor,
    parseSpan,
    promoSummary,
    nowSec,
    lineTotal,
    lineBase,
};
