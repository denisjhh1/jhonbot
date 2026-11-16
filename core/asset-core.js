const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    escapeMarkdown,
} = require('discord.js');
const def = require('../defines');
const db = require('./query');
const ucpDb = require('./ucp-db');
const S = require('./schema');
const gamelog = require('./gamelog-core');
const vehicleName = require('./vehicle-names');
const { log } = require('../functions');

const cfg = {
    staffRoleIds: ['YOUR_DISCORD_ID', 'YOUR_DISCORD_ID'],
    cooldownMs: 5000,
    maxLines: 25,
    charTable: 'player_characters',
    ...(def.asset ?? {}),
};

const GOLD = 0xd4af37;
const NAME_INPUT = 'aset-name';

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

const fmtMoney = (n) => `$${Number(n ?? 0).toLocaleString('en-US')}`;
const esc = (s) => escapeMarkdown(String(s ?? '-'));
const normName = (s) =>
    String(s ?? '')
        .trim()
        .replace(/\s+/g, '_');

const isOwnerOrDev = (id) => [].concat(def.users?.ownerId ?? [], def.users?.developers ?? []).includes(id);
function isStaff(interaction) {
    if (isOwnerOrDev(interaction.user.id)) return true;
    const roles = interaction.member?.roles?.cache;
    return !!roles && cfg.staffRoleIds.some((id) => roles.has(id));
}

const CATEGORIES = [
    { id: 'ringkasan', emoji: '📋', label: 'Ringkasan' },
    { id: 'rumah', emoji: '🏠', label: 'Rumah' },
    { id: 'kendaraan', emoji: '🚗', label: 'Kendaraan' },
    { id: 'bisnis', emoji: '🏪', label: 'Bisnis' },
    { id: 'workshop', emoji: '🔧', label: 'Workshop' },
    { id: 'rusun', emoji: '🏢', label: 'Rusun' },
    { id: 'restoran', emoji: '🍽️', label: 'Restoran' },
];

async function getUcpByDiscord(discordId) {
    return ucpDb.getUcpByDiscord(discordId);
}

async function findCharByName(input) {
    const name = normName(input);
    const rows = await q(
        'SELECT `pID`, `Char_Name`, `Char_UCP`, `Char_Money`, `Char_BankMoney` FROM ?? WHERE `Char_Name` = ? LIMIT 1',
        [cfg.charTable, name],
    );
    return rows[0] ?? null;
}

async function findCharById(pID) {
    const rows = await q(
        'SELECT `pID`, `Char_Name`, `Char_UCP`, `Char_Money`, `Char_BankMoney` FROM ?? WHERE `pID` = ? LIMIT 1',
        [cfg.charTable, pID],
    );
    return rows[0] ?? null;
}

async function access(interaction, char) {
    const ownUcp = await getUcpByDiscord(interaction.user.id);
    const own = !!ownUcp && !!char.Char_UCP && String(ownUcp).toLowerCase() === String(char.Char_UCP).toLowerCase();
    if (own) return { ok: true, own: true };
    if (isStaff(interaction)) return { ok: true, own: false, staff: true };
    return { ok: false, linked: !!ownUcp };
}

const safe = (label, sql, params) => {
    if (!sql) return Promise.resolve([]); // tabel tidak ada di database ini -> kategori kosong
    return q(sql, params).catch((e) => {
        log(`Aset: gagal membaca ${label} (${e.message})`, 'warn');
        return [];
    });
};

// Query aset memakai alias supaya sisa kode (entries/payload) tidak perlu berubah.
async function loadAssets(char) {
    const H = S.house;
    const V = S.vehicle;
    const B = S.business;
    const R = S.rusun;
    const W = S.workshop;
    const T = S.restaurant;
    const [houses, vehicles, business, workshops, rusun, restaurants] = await Promise.all([
        safe(
            'house',
            H.table && 'SELECT ?? AS `ID`, ?? AS `HS_Type` FROM ?? WHERE ?? = ? ORDER BY ??',
            [H.id, H.type, H.table, H.owner, char.pID, H.id],
        ),
        safe(
            'player_vehicles',
            V.table &&
                'SELECT ?? AS `id`, ?? AS `PVeh_ModelID`, ?? AS `PVeh_Plate`, ?? AS `PVeh_Price`, ?? AS `PVeh_Rental`, ?? AS `PVeh_Impounded` FROM ?? WHERE ?? = ? ORDER BY ??',
            [V.id, V.model, V.plate, V.price, V.rental, V.impounded, V.table, V.owner, char.pID, V.id],
        ),
        safe(
            'business',
            B.table && 'SELECT ?? AS `ID`, ?? AS `Name`, ?? AS `Money` FROM ?? WHERE ?? = ? ORDER BY ??',
            [B.id, B.name, B.money, B.table, B.owner, char.pID, B.id],
        ),
        safe(
            'workshop',
            W.table && 'SELECT ?? AS `ID`, ?? AS `Name`, ?? AS `Money` FROM ?? WHERE ?? = ? ORDER BY ??',
            [W.id, W.name, W.money, W.table, W.owner, char.pID, W.id],
        ),
        safe(
            'rusun',
            R.table && 'SELECT ?? AS `rID`, ?? AS `RusunName`, ?? AS `RusunPrice` FROM ?? WHERE ?? = ? ORDER BY ??',
            [R.id, R.name, R.price, R.table, R.owner, char.pID, R.id],
        ),
        safe(
            'restaurants',
            T.table && 'SELECT ?? AS `id`, ?? AS `name`, ?? AS `money` FROM ?? WHERE ?? = ? ORDER BY ??',
            [T.id, T.name, T.money, T.table, T.owner, char.pID, T.id],
        ),
    ]);
    return { houses, vehicles, business, workshops, rusun, restaurants };
}

const MAX_LINE = 900;

function entries(category, a) {
    switch (category) {
        case 'rumah':
            return a.houses.map((h) => ({
                name: 'Rumah',
                id: h.ID,
                extra: `tipe ${h.HS_Type}`,
            }));
        case 'kendaraan':
            return a.vehicles.map((v) => {
                const tags = [];
                if (Number(v.PVeh_Impounded)) tags.push('disita');
                if (Number(v.PVeh_Rental) > 0) tags.push('sewa');
                return {
                    name: vehicleName(v.PVeh_ModelID),
                    id: v.id,
                    extra: `${v.PVeh_Plate}, ${fmtMoney(v.PVeh_Price)}${tags.length ? `, ${tags.join(', ')}` : ''}`,
                };
            });
        case 'bisnis':
            return a.business.map((b) => ({ name: b.Name, id: b.ID, extra: `kas ${fmtMoney(b.Money)}` }));
        case 'workshop':
            return a.workshops.map((w) => ({ name: w.Name, id: w.ID, extra: `kas ${fmtMoney(w.Money)}` }));
        case 'rusun':
            return a.rusun.map((r) => ({ name: r.RusunName, id: r.rID, extra: fmtMoney(r.RusunPrice) }));
        case 'restoran':
            return a.restaurants.map((r) => ({ name: r.name, id: r.id, extra: `kas ${fmtMoney(r.money)}` }));
        default:
            return [];
    }
}

const cap = (text, shownCount, total) => (total > shownCount ? `${text} +${total - shownCount} lainnya` : text);

function summaryLine(category, a) {
    const list = entries(category, a);
    if (!list.length) return '-';
    const parts = category === 'rumah' ? list.map((e) => String(e.id)) : list.map((e) => `${esc(e.name)} (${e.id})`);
    let out = '';
    let n = 0;
    for (const part of parts) {
        const next = out ? `${out}, ${part}` : part;
        if (next.length > MAX_LINE) break;
        out = next;
        n++;
    }
    return category === 'rumah' ? `${list.length} unit (${cap(out, n, list.length)})` : cap(out, n, list.length);
}

const count = (a, cat) => entries(cat, a).length;

function viewRow(pID, current, a) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`aset-view:${pID}`)
            .setPlaceholder('Lihat detail kategori')
            .addOptions(
                CATEGORIES.map((c) => ({
                    label: c.id === 'ringkasan' ? c.label : `${c.label} (${count(a, c.id)})`,
                    value: c.id,
                    default: c.id === current,
                })),
            ),
    );
}

function payload(char, a, category = 'ringkasan') {
    const pretty = String(char.Char_Name).replace(/_/g, ' ');
    const embed = new EmbedBuilder().setColor(GOLD);

    if (category === 'ringkasan') {
        embed
            .setTitle(`📋 Aset ${pretty}`)
            .setDescription(
                [
                    `UCP: **${esc(char.Char_UCP ?? '-')}**`,
                    `Uang tunai: **${fmtMoney(char.Char_Money)}**`,
                    `Saldo bank: **${fmtMoney(char.Char_BankMoney)}**`,
                    '',
                    `**Rumah:** ${summaryLine('rumah', a)}`,
                    `**Kendaraan:** ${summaryLine('kendaraan', a)}`,
                    `**Bisnis:** ${summaryLine('bisnis', a)}`,
                    `**Workshop:** ${summaryLine('workshop', a)}`,
                    `**Rusun:** ${summaryLine('rusun', a)}`,
                    `**Restoran:** ${summaryLine('restoran', a)}`,
                ].join('\n'),
            );
    } else {
        const meta = CATEGORIES.find((c) => c.id === category);
        const all = entries(category, a);
        const shown = all.slice(0, cfg.maxLines);
        const rows = shown.map((e) => `**${esc(e.name)}** (${e.id}) • ${esc(e.extra)}`);
        embed
            .setTitle(`${meta.emoji} ${meta.label} ${pretty}`)
            .setDescription(
                (rows.length ? rows.join('\n') : `${pretty} tidak memiliki ${meta.label.toLowerCase()}.`) +
                    (all.length > shown.length ? `\n\n+${all.length - shown.length} lainnya tidak ditampilkan` : ''),
            );
    }
    return { embeds: [embed], components: [viewRow(char.pID, category, a)] };
}

function panelPayload() {
    const embed = new EmbedBuilder()
        .setColor(GOLD)
        .setTitle('🏠 Asset Record')
        .setDescription(
            [
                'Cek aset karaktermu: rumah, kendaraan, bisnis, workshop, rusun, dan restoran.',
                '',
                'Tekan **Cek Aset**, lalu ketik nama karakter, contoh: `Aldo_Romano`.',
                '',
                '-# Kamu hanya bisa melihat karakter milik akun UCP yang tertaut ke Discord ini.',
            ].join('\n'),
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('aset-open').setLabel('Cek Aset').setStyle(ButtonStyle.Primary),
    );
    return { embeds: [embed], components: [row] };
}

const modal = () =>
    new ModalBuilder()
        .setCustomId('modal-aset')
        .setTitle('Cek Aset Karakter')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId(NAME_INPUT)
                    .setLabel('Nama karakter')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMinLength(3)
                    .setMaxLength(24)
                    .setPlaceholder('Contoh: Aldo_Romano'),
            ),
        );

const errEmbed = (text) => new EmbedBuilder().setColor('Red').setDescription(text);

const lastUse = new Map();
function onCooldown(userId) {
    const now = Date.now();
    if (now - (lastUse.get(userId) ?? 0) < cfg.cooldownMs) return true;
    lastUse.set(userId, now);
    return false;
}

async function handleLookup(interaction, nameInput) {
    if (onCooldown(interaction.user.id))
        return { embeds: [errEmbed('⏳ Terlalu cepat, tunggu beberapa detik lalu coba lagi.')] };

    const char = await findCharByName(nameInput);

    const denied = {
        embeds: [
            errEmbed(
                `❌ Karakter \`${normName(nameInput)}\` tidak ditemukan di akun UCP milikmu.\nPastikan Discord kamu sudah tertaut ke UCP dan nama karakter diketik dengan benar.`,
            ),
        ],
    };
    if (!char) return denied;

    const acc = await access(interaction, char);
    if (!acc.ok) return denied;

    if (!acc.own) {
        gamelog.enqueue({
            type: 'asset',
            actor: `Discord:${interaction.user.username}`,
            target: char.Char_Name,
            info: 'Panel Aset',
            reason: 'Staff mengecek aset karakter pemain lain',
        });
    }
    return payload(char, await loadAssets(char), 'ringkasan');
}

async function handleView(interaction, pID, category) {
    const char = await findCharById(pID);
    if (!char) return { embeds: [errEmbed('❌ Karakter tidak ditemukan.')], components: [] };
    const acc = await access(interaction, char);
    if (!acc.ok) return { embeds: [errEmbed('❌ Kamu tidak punya akses ke karakter ini.')], components: [] };
    if (!CATEGORIES.some((c) => c.id === category)) category = 'ringkasan';
    return payload(char, await loadAssets(char), category);
}

module.exports = { panelPayload, modal, handleLookup, handleView, errEmbed, NAME_INPUT, config: cfg };
