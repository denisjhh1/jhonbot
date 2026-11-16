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
    channelId: 'YOUR_DISCORD_ID',
    refreshMinutes: 10,
    pageSize: 10,
    allowedRoleIds: [],
    familiesTable: require('./schema').family.table,
    logsTable: require('./schema').family.logsTable,
    ...(def.familylog ?? {}),
};

const SELECT_ID = 'familylog-select';
const PAGE_ID = 'familylog-page';
const FOOTER = 'Panel Log Families • Diperbarui otomatis';
const COLOR = 0x5865f2;
const MAX_OPTIONS = 25;
const MAX_MENUS = 5;

const STATE_FILE = path.join(__dirname, '..', 'data', 'familylog-state.json');
const state = { channelId: null, messageId: null };
try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (s.channelId && s.messageId) {
        state.channelId = s.channelId;
        state.messageId = s.messageId;
    }
} catch {}
function save() {
    try {
        const tmp = STATE_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
        fs.renameSync(tmp, STATE_FILE);
    } catch (e) {
        log(`Gagal menyimpan familylog-state.json: ${e.message}`, 'err');
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
const fmtMoney = (n) => `$${Number(n ?? 0).toLocaleString('en-US')}`;
const OPTS = { allowedMentions: { parse: [] } };

const FAM = () => require('./schema').family;

// Alias kolom supaya sisa kode tetap memakai F_ID / F_Name / F_Leader / F_Money
async function listFamilies() {
    const F = FAM();
    return q(
        'SELECT ?? AS `F_ID`, ?? AS `F_Name`, ?? AS `F_Leader`, ?? AS `F_Money` FROM ?? ' +
            'WHERE ?? IS NOT NULL AND TRIM(??) <> \'\' AND UPPER(TRIM(??)) <> \'N/A\' ' +
            'ORDER BY ?? ASC',
        [F.id, F.name, F.leader, F.money, cfg.familiesTable, F.name, F.name, F.name, F.name],
    );
}

async function getFamily(id) {
    const F = FAM();
    const rows = await q('SELECT ?? AS `F_ID`, ?? AS `F_Name`, ?? AS `F_Leader`, ?? AS `F_Money` FROM ?? WHERE ?? = ? LIMIT 1', [
        F.id,
        F.name,
        F.leader,
        F.money,
        cfg.familiesTable,
        F.id,
        id,
    ]);
    return rows[0] ?? null;
}

async function panelPayload() {
    const families = await listFamilies();
    const shown = families.slice(0, MAX_OPTIONS * MAX_MENUS);
    if (families.length > shown.length)
        log(`FamilyLog: ${families.length} family, hanya ${shown.length} yang muat di panel.`, 'warn');

    const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('📋 Log Families')
        .setDescription(
            [
                'Lihat aktivitas brankas & anggota sebuah family.',
                '',
                '> 1️⃣ **Pilih family** di menu bawah.',
                '> 2️⃣ Riwayat aktivitas terbaru tampil di balasan pribadi (hanya terlihat olehmu).',
                '> 3️⃣ Pakai tombol **◀ ▶** untuk membuka log yang lebih lama.',
                '',
                `📊 **${families.length}** family terdaftar`,
            ].join('\n'),
        )
        .setFooter({ text: FOOTER });
    if (def.icon?.thumbnail) embed.setThumbnail(def.icon.thumbnail);

    if (!shown.length) {
        embed.setDescription('Belum ada family yang terdaftar.');
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
                    .setPlaceholder(total > 1 ? `📋 Pilih family (${n}/${total})...` : '📋 Pilih family...')
                    .addOptions(
                        chunk.map((f) => ({
                            label: cut(f.F_Name, 100),
                            value: String(f.F_ID),
                            description: cut(`Leader: ${f.F_Leader && f.F_Leader !== 'N/A' ? f.F_Leader : '-'}`, 100),
                        })),
                    ),
            ),
        );
    }
    return { embeds: [embed], components: rows, ...OPTS };
}

const isUnknownMessage = (e) => e?.code === 10008;

async function findOwnPanel(client, channel) {
    const recent = await channel.messages.fetch({ limit: 50 });
    return [...recent.values()]
        .filter((m) => m.author?.id === client.user.id && m.embeds[0]?.footer?.text === FOOTER)
        .sort((a, b) => b.createdTimestamp - a.createdTimestamp);
}

let lastSig = null;
let busy = false;

async function ensurePanel(client, { channel: forced, force = false } = {}) {
    if (busy) return null;
    busy = true;
    try {
        const channel = forced ?? (await client.channels.fetch(cfg.channelId).catch(() => null));
        if (!channel?.isTextBased()) {
            log(`FamilyLog: channel ${cfg.channelId} tidak ditemukan / bukan channel teks.`, 'warn');
            return null;
        }
        const payload = await panelPayload();
        const sig = crypto
            .createHash('md5')
            .update(JSON.stringify(payload.embeds.concat(payload.components)))
            .digest('hex');

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
                    log(`FamilyLog: gagal memperbarui panel (${e.message}). Dicoba lagi nanti.`, 'warn');
                    return null;
                }
                log('FamilyLog: pesan panel sudah dihapus, memasang ulang.', 'warn');
                state.messageId = null;
            }
        }

        let msg = null;
        if (!force) {
            const found = await findOwnPanel(client, channel).catch(() => []);
            msg = found[0] ?? null;
            for (const d of found.slice(1)) await d.delete().catch(() => null);
            if (msg) await msg.edit(payload);
        }
        if (!msg) msg = await channel.send(payload);
        state.channelId = channel.id;
        state.messageId = msg.id;
        lastSig = sig;
        save();
        return msg;
    } catch (e) {
        log(`FamilyLog: gagal menyiapkan panel (${e.message ?? e})`, 'err');
        return null;
    } finally {
        busy = false;
    }
}

function canView(member) {
    if (!cfg.allowedRoleIds?.length) return true;
    return cfg.allowedRoleIds.some((id) => member?.roles?.cache?.has(id));
}

async function logPayload(famId, page = 0) {
    const fam = await getFamily(famId);
    if (!fam)
        return {
            content: '❌ Family tidak ditemukan (mungkin sudah dihapus). Pilih ulang dari panel.',
            embeds: [],
            components: [],
        };

    const [{ c }] = await q('SELECT COUNT(*) AS c FROM ?? WHERE `Families` = ?', [cfg.logsTable, fam.F_Name]);
    const total = Number(c) || 0;
    const pages = Math.max(1, Math.ceil(total / cfg.pageSize));
    page = Math.min(Math.max(0, Number(page) || 0), pages - 1);

    const rows = total
        ? await q(
              'SELECT `Name`, `UCP`, `Activity`, `Time` FROM ?? WHERE `Families` = ? ORDER BY `Time` DESC LIMIT ? OFFSET ?',
              [cfg.logsTable, fam.F_Name, cfg.pageSize, page * cfg.pageSize],
          )
        : [];

    const lines = rows.map((r) => {
        const ucp = r.UCP ? ` (${esc(r.UCP)})` : '';
        return `\`${esc(cut(r.Time, 19))}\` **${esc(r.Name)}**${ucp}\n> ${esc(cut(r.Activity, 250))}`;
    });
    let description = lines.length ? lines.join('\n\n') : '*Belum ada log untuk family ini.*';
    if (description.length > 4000) description = cut(description, 4000);

    const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`📋 Log Families — ${cut(fam.F_Name, 200)}`)
        .setDescription(description)
        .addFields(
            { name: 'Leader', value: esc(fam.F_Leader || '-'), inline: true },
            { name: 'Kas', value: fmtMoney(fam.F_Money), inline: true },
            { name: 'Total Log', value: String(total), inline: true },
        )
        .setFooter({ text: `Halaman ${page + 1}/${pages} • Terbaru di atas` });

    const id = (p) => `${PAGE_ID}:${fam.F_ID}:${p}`;
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
    if (cfg.enabled === false) return log('FamilyLog dimatikan (familylog.enabled = false).', 'warn');
    if (!cfg.channelId) return log('FamilyLog tidak aktif: familylog.channelId belum diisi.', 'warn');
    await ensurePanel(client);
    if (timer) clearInterval(timer);
    timer = setInterval(() => ensurePanel(client), Math.max(1, cfg.refreshMinutes) * 60 * 1000);
    log(
        `FamilyLog aktif: panel di channel ${cfg.channelId}, daftar family disegarkan tiap ${cfg.refreshMinutes} menit.`,
        'done',
    );
}

module.exports = { start, ensurePanel, logPayload, canView, SELECT_ID, PAGE_ID, config: cfg };
