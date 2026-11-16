// Kirim panel ke channel dari dashboard.
// Memakai command /panel... yang sudah ada (tampilan identik) lewat "interaction" tiruan
// yang mengarah ke channel tujuan, jadi tidak perlu menulis ulang isi panel.
const { PermissionFlagsBits } = require('discord.js');
const def = require('../defines');
const settings = require('./settings');
const { log } = require('../functions');

// suggest = path pengaturan yang menyimpan channel bawaan panel (dipakai untuk mengisi otomatis)
const CATALOG = [
    { id: 'panelregist', group: 'Akun & Server', label: 'Registrasi UCP', desc: 'Buat UCP, cek kode, sync role, reset password, hapus karakter.' },
    { id: 'panelip', group: 'Akun & Server', label: 'IP Server', desc: 'Tombol salin IP server.' },
    { id: 'panelstatus', group: 'Akun & Server', label: 'Kontrol Status Server', desc: 'Tombol Online / Offline / Maintenance (khusus staf).' },
    { id: 'panellink', group: 'Akun & Server', label: 'Link Discord Official', desc: 'Daftar link resmi.' },
    { id: 'panelpanduan', group: 'Akun & Server', label: 'Panduan Publik', desc: 'Menu panduan untuk pemain.' },
    { id: 'paneldonasi', group: 'Donasi', label: 'Donasi', desc: 'Beli donasi, katalog, pesanan saya.', suggest: 'donation.panelChannelId' },
    { id: 'paneldiskon', group: 'Donasi', label: 'Pengaturan Diskon (staf)', desc: 'Atur diskon donasi.' },
    { id: 'panelrefund', group: 'Tiket', label: 'Refund', desc: 'Pengajuan refund.' },
    { id: 'panelbug', group: 'Tiket', label: 'Report Bug', desc: 'Form laporan bug.' },
    { id: 'panelreport', group: 'Tiket', label: 'Report Pemain', desc: 'Report admin / player / faction / bug.', choice: 'jenis' },
    { id: 'panelsaran', group: 'Tiket', label: 'Saran', desc: 'Saran fitur, mapping, textdraw, dll.' },
    { id: 'panelbenefit', group: 'Request & Benefit', label: 'Benefit & Claim', desc: 'Klaim benefit.', suggest: 'benefit.claimChannelId' },
    { id: 'panelreq', group: 'Request & Benefit', label: 'Request Area', desc: 'VIP / Ladies / Faction / Streamer / Workshop.' },
    { id: 'panelaset', group: 'Request & Benefit', label: 'Asset Record', desc: 'Cek aset karakter.' },
    { id: 'panelrekrutmen', group: 'Staff', label: 'Rekrutmen Administrator', desc: 'Lamaran staff.', suggest: 'rekrutmen.channelId' },
    { id: 'panelkontrolrekrut', group: 'Staff', label: 'Buka/Tutup Rekrutmen (staf)', desc: 'Pasang di channel staff.' },
    { id: 'panelizin', group: 'Staff', label: 'Izin Administrator', desc: 'Pengajuan izin aktif.' },
    { id: 'panelduty', group: 'Staff', label: 'Laporan Duty', desc: 'Laporan duty admin.' },
    { id: 'panelratestaff', group: 'Staff', label: 'Rate Staff + Leaderboard', desc: 'Penilaian staff.' },
    { id: 'panelchangelog', group: 'Lainnya', label: 'Changelog (developer)', desc: 'Posting update.', suggest: 'changelog.channelId' },
    { id: 'panelfamilylog', group: 'Lainnya', label: 'Log Families', desc: 'Pilih family lalu lihat log.', suggest: 'familylog.channelId' },
    { id: 'factionvaultlog', group: 'Lainnya', label: 'Log Brankas Faction', desc: 'Pilih faction lalu lihat riwayat brankas otomatis dari tabel faction_vaultlogs.' },
    {
        id: 'panelleaderboard', group: 'Lainnya', label: 'Leaderboard Otomatis', desc: 'Top Harta, Top Admin, Top Online (update tiap jam).',
        extra: [
            { name: 'harta', label: 'Channel Top Harta (opsional)' },
            { name: 'admin', label: 'Channel Top Admin (opsional)' },
            { name: 'online', label: 'Channel Top Online (opsional)' },
        ],
    },
];

function reportTypes() {
    try {
        const { TYPES } = require('../core/report-core');
        return Object.entries(TYPES).map(([value, t]) => ({ value, label: t.label }));
    } catch {
        return ['admin', 'player', 'faction', 'bug'].map((v) => ({ value: v, label: v }));
    }
}

function catalog() {
    return CATALOG.map((p) => ({
        ...p,
        suggestedChannel: p.suggest ? settings.getPath(def, p.suggest) || '' : '',
        choices: p.choice ? reportTypes() : undefined,
    }));
}

const asChannel = async (guild, id) => {
    if (!id) return null;
    const c = guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null));
    return c;
};

function checkSendable(guild, ch, label = 'channel') {
    if (!ch) return `${label} tidak ditemukan di server.`;
    if (!ch.isTextBased?.() || !ch.send) return `#${ch.name} bukan channel teks.`;
    const me = guild.members.me;
    const perms = ch.permissionsFor(me);
    const need = [
        [PermissionFlagsBits.ViewChannel, 'Lihat Channel'],
        [PermissionFlagsBits.SendMessages, 'Kirim Pesan'],
        [PermissionFlagsBits.EmbedLinks, 'Sematkan Link'],
    ].filter(([f]) => !perms?.has(f));
    if (need.length) return `Bot tidak punya izin di #${ch.name}: ${need.map((n) => n[1]).join(', ')}.`;
    return null;
}

async function send(client, body) {
    if (!client?.isReady?.()) return { ok: false, error: 'Bot belum online.' };
    const entry = CATALOG.find((p) => p.id === body.panel);
    if (!entry) return { ok: false, error: 'Panel tidak dikenal.' };
    const cmd = client.collection.interactioncommands.get(entry.id);
    if (!cmd) return { ok: false, error: `Command /${entry.id} tidak ditemukan di bot.` };

    const guild = client.guilds.cache.get(def.client?.guild) ?? (await client.guilds.fetch(def.client?.guild).catch(() => null));
    if (!guild) return { ok: false, error: 'Guild ID salah atau bot belum masuk server.' };

    const target = await asChannel(guild, String(body.channelId ?? ''));
    const err = checkSendable(guild, target, 'Channel tujuan');
    if (err) return { ok: false, error: err };

    // Panel khusus FactionVaultLog: panggil core secara langsung, tidak perlu
    // slash command tiruan. Panel dipasang dari dashboard ke channel pilihan.
    if (entry.id === 'factionvaultlog') {
        try {
            const factionVaultLog = require('../core/factionvaultlog-core');
            const msg = await factionVaultLog.ensurePanel(client, { channel: target, force: true });
            if (!msg) return { ok: false, error: 'Panel gagal dikirim. Periksa console bot dan pastikan tabel faction_vaultlogs tersedia.' };
            log(`Dashboard: panel Log Brankas Faction dikirim ke #${target.name}`, 'done');
            return { ok: true, message: `Panel Log Brankas Faction berhasil dikirim ke #${target.name}.`, channel: target.name };
        } catch (e) {
            log(`Dashboard: gagal kirim Log Brankas Faction ke #${target.name}: ${e.stack ?? e}`, 'err');
            return { ok: false, error: `Gagal mengirim panel: ${e.message}` };
        }
    }

    const opts = {};
    for (const x of entry.extra ?? []) {
        const id = body.options?.[x.name];
        if (!id) continue;
        const ch = await asChannel(guild, String(id));
        const e2 = checkSendable(guild, ch, x.label);
        if (e2) return { ok: false, error: e2 };
        opts[x.name] = ch;
    }
    if (entry.choice) {
        const valid = reportTypes().map((t) => t.value);
        if (!valid.includes(body.options?.[entry.choice])) return { ok: false, error: 'Pilih jenis report.' };
        opts[entry.choice] = body.options[entry.choice];
    }

    // interaction tiruan: hanya yang dipakai command panel
    const replies = [];
    const grab = async (m) => {
        replies.push(typeof m === 'string' ? m : (m?.content ?? ''));
        return {};
    };
    const fake = {
        client, guild, guildId: guild.id, channel: target, channelId: target.id,
        user: client.user, member: guild.members.me, commandName: entry.id,
        deferred: false, replied: false,
        options: {
            getChannel: (n) => (opts[n] instanceof Object ? opts[n] : null),
            getString: (n) => (typeof opts[n] === 'string' ? opts[n] : null),
            getBoolean: () => null, getInteger: () => null, getUser: () => null, getRole: () => null,
        },
        isChatInputCommand: () => true,
        deferReply: async () => { fake.deferred = true; },
        reply: async (m) => { fake.replied = true; return grab(m); },
        editReply: async (m) => { fake.replied = true; return grab(m); },
        followUp: grab,
    };

    try {
        await cmd.run(client, fake);
    } catch (e) {
        log(`Dashboard: gagal kirim ${entry.id} ke #${target.name}: ${e.message}`, 'err');
        return { ok: false, error: `Gagal: ${e.message}` };
    }
    log(`Dashboard: panel ${entry.id} dikirim ke #${target.name}`, 'done');
    const msg = replies.join('\n') || 'Panel terkirim.';
    return { ok: !/^❌/.test(msg), message: msg.replace(/<#(\d+)>/g, (_, id) => '#' + (guild.channels.cache.get(id)?.name ?? id)), channel: target.name };
}

module.exports = { catalog, send, CATALOG };
