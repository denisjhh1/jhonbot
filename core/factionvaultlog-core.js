const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    escapeMarkdown,
} = require('discord.js');
const def = require('../defines');
const db = require('./query');
const { log } = require('../functions');

const cfg = {
    enabled: true,
    channelId: '',
    refreshMinutes: 10,
    pageSize: 10,
    allowedRoleIds: [],
    table: 'faction_vaultlogs',
    ...(def.factionvaultlog ?? {}),
};

const SELECT_ID = 'factionvaultlog-select';
const PAGE_ID = 'factionvaultlog-page';
const FOOTER = 'Panel Log Brankas Faction • Diperbarui otomatis';
const COLOR = 0xd4af37;
const MAX_OPTIONS = 25;
const MAX_MENUS = 5;
const STATE_FILE = path.join(__dirname, '..', 'data', 'factionvaultlog-state.json');
const state = { channelId: null, messageId: null };

try {
    const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (saved.channelId && saved.messageId) {
        state.channelId = saved.channelId;
        state.messageId = saved.messageId;
    }
} catch {}

function save() {
    try {
        fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
        const tmp = STATE_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
        fs.renameSync(tmp, STATE_FILE);
    } catch (e) {
        log(`Gagal menyimpan factionvaultlog-state.json: ${e.message}`, 'err');
    }
}

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

const cut = (s, n) => {
    s = String(s ?? '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
};
const esc = (s) => escapeMarkdown(String(s ?? '-'));
const OPTS = { allowedMentions: { parse: [] } };

async function listFactions() {
    const rows = await q(
        'SELECT DISTINCT TRIM(`Faction`) AS `Faction` FROM ?? ' +
            'WHERE `Faction` IS NOT NULL AND TRIM(`Faction`) <> \'\' ' +
            'ORDER BY TRIM(`Faction`) ASC',
        [cfg.table],
    );
    return rows.filter((r) => r.Faction);
}

async function panelPayload() {
    const factions = await listFactions();
    const shown = factions.slice(0, MAX_OPTIONS * MAX_MENUS);
    if (factions.length > shown.length)
        log(`FactionVaultLog: ${factions.length} faction, hanya ${shown.length} yang muat di panel.`, 'warn');

    const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('📦 Log Brankas Faction')
        .setDescription(
            [
                'Lihat riwayat aktivitas brankas setiap faction langsung dari database.',
                '',
                '> 1️⃣ **Pilih faction** di menu bawah.',
                '> 2️⃣ Riwayat aktivitas tampil di balasan pribadi (hanya terlihat olehmu).',
                '> 3️⃣ Gunakan tombol **◀ ▶** untuk membuka log yang lebih lama.',
                '',
                `📊 **${factions.length}** faction terdeteksi dari database`,
            ].join('\n'),
        )
        .setFooter({ text: FOOTER });
    if (def.icon?.thumbnail) embed.setThumbnail(def.icon.thumbnail);

    if (!shown.length) {
        embed.setDescription('Belum ada aktivitas brankas faction di tabel `faction_vaultlogs`.');
        return { embeds: [embed], components: [], ...OPTS };
    }

    const rows = [];
    for (let i = 0; i < shown.length; i += MAX_OPTIONS) {
        const chunk = shown.slice(i, i + MAX_OPTIONS);
        const n = rows.length + 1;
        const total = Math.ceil(shown.length / MAX_OPTIONS);
        rows.push(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`${SELECT_ID}:${n}`)
                    .setPlaceholder(total > 1 ? `📦 Pilih faction (${n}/${total})...` : '📦 Pilih faction...')
                    .addOptions(
                        chunk.map((f) => ({
                            label: cut(f.Faction, 100),
                            value: String(f.Faction),
                            description: 'Lihat riwayat aktivitas brankas faction',
                        })),
                    ),
            ),
        );
    }
    return { embeds: [embed], components: rows, ...OPTS };
}

const isUnknownMessage = (e) => e?.code === 10008;
let lastSig = null;
let busy = false;

async function findOwnPanel(client, channel) {
    const recent = await channel.messages.fetch({ limit: 50 });
    return [...recent.values()]
        .filter((m) => m.author?.id === client.user.id && m.embeds[0]?.footer?.text === FOOTER)
        .sort((a, b) => b.createdTimestamp - a.createdTimestamp);
}

async function ensurePanel(client, { channel: forced, force = false } = {}) {
    if (busy) return null;
    busy = true;
    try {
        const channel = forced ?? (cfg.channelId ? await client.channels.fetch(cfg.channelId).catch(() => null) : null);
        if (!channel?.isTextBased()) {
            log(`FactionVaultLog: channel ${cfg.channelId || '(belum diatur)'} tidak ditemukan / bukan channel teks.`, 'warn');
            return null;
        }

        const payload = await panelPayload();
        const sig = crypto.createHash('md5').update(JSON.stringify(payload.embeds.concat(payload.components))).digest('hex');

        if (force) {
            const old = state.channelId ? await client.channels.fetch(state.channelId).catch(() => null) : null;
            const oldMsg =
                old?.isTextBased() && state.messageId
                    ? await old.messages.fetch(state.messageId).catch(() => null)
                    : null;
            if (oldMsg) await oldMsg.delete().catch(() => null);
            state.messageId = null;
        } else if (state.messageId && state.channelId === channel.id) {
            try {
                const msg = await channel.messages.fetch(state.messageId);
                if (sig !== lastSig) await msg.edit(payload);
                lastSig = sig;
                return msg;
            } catch (e) {
                if (!isUnknownMessage(e)) {
                    log(`FactionVaultLog: gagal memperbarui panel (${e.message}).`, 'warn');
                    return null;
                }
                state.messageId = null;
            }
        }

        let msg = null;
        if (!force) {
            const found = await findOwnPanel(client, channel).catch(() => []);
            msg = found[0] ?? null;
            for (const duplicate of found.slice(1)) await duplicate.delete().catch(() => null);
            if (msg) await msg.edit(payload);
        }
        if (!msg) msg = await channel.send(payload);

        state.channelId = channel.id;
        state.messageId = msg.id;
        lastSig = sig;
        save();
        return msg;
    } catch (e) {
        log(`FactionVaultLog: gagal menyiapkan panel (${e.message ?? e})`, 'err');
        return null;
    } finally {
        busy = false;
    }
}

function canView(member) {
    if (!cfg.allowedRoleIds?.length) return true;
    return cfg.allowedRoleIds.some((id) => member?.roles?.cache?.has(id));
}

async function logPayload(factionName, page = 0) {
    const [{ c }] = await q('SELECT COUNT(*) AS `c` FROM ?? WHERE TRIM(`Faction`) = ?', [cfg.table, factionName]);
    const total = Number(c) || 0;
    const pages = Math.max(1, Math.ceil(total / cfg.pageSize));
    page = Math.min(Math.max(0, Number(page) || 0), pages - 1);

    const rows = total
        ? await q(
              'SELECT `Name`, `UCP`, `Item`, `Quantity`, `Time` FROM ?? ' +
                  'WHERE TRIM(`Faction`) = ? ORDER BY `Time` DESC, `ID` DESC LIMIT ? OFFSET ?',
              [cfg.table, factionName, cfg.pageSize, page * cfg.pageSize],
          )
        : [];

    const lines = rows.map((r) => {
        const ucp = r.UCP ? ` (${esc(r.UCP)})` : '';
        return `🕒 \`${esc(cut(r.Time, 19))}\`\n**${esc(r.Name)}**${ucp}\n> 📦 ${esc(r.Item)} — **${Number(r.Quantity || 0).toLocaleString('en-US')}x**`;
    });
    let description = lines.length ? lines.join('\n\n') : '*Belum ada log untuk faction ini.*';
    if (description.length > 4000) description = cut(description, 4000);

    const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`📦 Log Brankas Faction — ${cut(factionName, 180)}`)
        .setDescription(description)
        .addFields({ name: 'Total Aktivitas', value: String(total), inline: true })
        .setFooter({ text: `Halaman ${page + 1}/${pages} • Terbaru di atas` });

    const id = (p) => `${PAGE_ID}:${encodeURIComponent(factionName)}:${p}`;
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(id(page - 1))
            .setLabel('Sebelumnya')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page <= 0),
        new ButtonBuilder()
            .setCustomId(id(page + 1))
            .setLabel('Berikutnya')
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= pages - 1),
        new ButtonBuilder().setCustomId(id(page)).setLabel('Segarkan').setEmoji('🔄').setStyle(ButtonStyle.Primary),
    );
    return { content: '', embeds: [embed], components: [row], ...OPTS };
}

let timer = null;
async function start(client) {
    if (cfg.enabled === false) return log('FactionVaultLog dimatikan (factionvaultlog.enabled = false).', 'warn');
    if (!cfg.channelId) return log('FactionVaultLog: channelId belum diatur. Gunakan /panelfactionvaultlog atau isi factionvaultlog.channelId.', 'warn');
    await ensurePanel(client);
    if (timer) clearInterval(timer);
    timer = setInterval(() => ensurePanel(client), Math.max(1, cfg.refreshMinutes) * 60 * 1000);
    log(`FactionVaultLog aktif: panel di channel ${cfg.channelId}.`, 'done');
}

module.exports = { start, ensurePanel, logPayload, canView, SELECT_ID, PAGE_ID, config: cfg };
