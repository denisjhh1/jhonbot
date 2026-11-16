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

const BANNED_TEXT = 'KARAKTER INI TIDAK BISA DIHAPUS KARENA SEDANG MASA BANNED, TOLONG HUBUNGI ADMINISTRATOR';

const cfg = {
    ucpTable: require('./schema').ucp.table,
    ucpColumn: require('./schema').ucp.ucp,
    discordColumn: require('./schema').ucp.discord,
    table: 'player_characters',
    logChannelId: '',
    banUtcOffsetHours: 0,
    relatedTables: [],
    ...(def.delchar ?? {}),
};

cfg.columns = { id: 'pID', name: 'Char_Name', ...(def.delchar?.columns ?? {}) };

cfg.banTable = def.delchar?.banTable ?? null;

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

const pretty = (name) => String(name ?? '').replace(/_/g, ' ');
const errEmbed = (text) => new EmbedBuilder().setColor('Red').setDescription(text);

let schemaCache = { time: 0, value: null };
const warned = new Set();
const warnOnce = (msg) => {
    if (!warned.has(msg)) {
        warned.add(msg);
        log(`Hapus Karakter: ${msg}`, 'warn');
    }
};

const pick = (list, wanted) => {
    if (wanted) return list.find((c) => c.toLowerCase() === String(wanted).toLowerCase()) ?? null;
    return null;
};

async function getSchema() {
    if (Date.now() - schemaCache.time < 10 * 60 * 1000 && schemaCache.value) return schemaCache.value;
    let list;
    try {
        list = (await q('SHOW COLUMNS FROM ??', [cfg.table])).map((r) => r.Field);
    } catch (e) {
        warnOnce(`tabel ${cfg.table} tidak bisa dibaca: ${e.message}`);
        return null;
    }

    const id = pick(list, cfg.columns.id);
    const name = pick(list, cfg.columns.name);
    if (!id || !name) {
        warnOnce(
            `kolom id/nama karakter tidak ditemukan di ${cfg.table}. Isi delchar.columns.id & delchar.columns.name di defines.js.`,
        );
        return null;
    }

    let ucp = pick(list, cfg.columns.ucp);
    if (!ucp && !cfg.columns.ucp) {
        for (const c of ['UCP', 'Char_UCP', 'Char_Ucp', 'AccountName', 'Char_Account', 'Char_Owner', 'Username']) {
            ucp = pick(list, c);
            if (ucp) break;
        }
        ucp = ucp ?? list.find((c) => /ucp/i.test(c)) ?? null;
    }
    if (!ucp) {
        warnOnce(
            `kolom pemilik (UCP) tidak ditemukan di ${cfg.table}. Isi delchar.columns.ucp di defines.js. Kolom tersedia: ${list.join(', ')}`,
        );
        return null;
    }

    let banFlag = pick(list, cfg.columns.banFlag);
    let banExpire = pick(list, cfg.columns.banExpire);
    const explicitBan = cfg.columns.banFlag || cfg.columns.banExpire;
    if (!explicitBan) {
        const cand = list.filter(
            (c) => /ban/i.test(c) && !/reason|alasan|by|admin|ip|msg|note|count|total|history/i.test(c),
        );
        banExpire = cand.find((c) => /expire|expir|until|end|time|date|left|duration/i.test(c)) ?? null;
        banFlag = cand.find((c) => c !== banExpire) ?? null;
    }

    const hasTableBan = !!(cfg.banTable?.table && cfg.banTable?.nameColumn);
    if (!banFlag && !banExpire && !hasTableBan) {
        warnOnce(
            `sumber data BAN tidak ditemukan. Isi delchar.columns.banFlag / banExpire atau delchar.banTable di defines.js. Kolom tersedia di ${cfg.table}: ${list.join(', ')}`,
        );
        return null;
    }

    const value = { id, name, ucp, banFlag, banExpire, hasTableBan };
    log(
        `Hapus Karakter aktif -> ${cfg.table}: id=${id}, nama=${name}, ucp=${ucp}, banFlag=${banFlag ?? '-'}, banExpire=${banExpire ?? '-'}${hasTableBan ? `, tabelBan=${cfg.banTable.table}` : ''}`,
        'info',
    );
    schemaCache = { time: Date.now(), value };
    return value;
}

const truthy = (v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (Buffer.isBuffer(v)) return v.length > 0 && v[0] !== 0;
    const n = Number(v);
    if (!Number.isNaN(n) && String(v).trim() !== '') return n !== 0;
    return !['', 'no', 'none', 'false', 'null'].includes(String(v).trim().toLowerCase());
};

const expiryMs = (v) => {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) || v.getTime() <= 0 ? null : v.getTime();
    const n = Number(v);
    if (!Number.isNaN(n) && String(v).trim() !== '') {
        if (n <= 0) return null;
        return n < 1e11 ? n * 1000 : n;
    }
    const s = String(v).trim();
    if (/^0000-00-00/.test(s)) return null;
    const t = Date.parse(s.replace(' ', 'T') + 'Z');
    return Number.isNaN(t) ? NaN : t - cfg.banUtcOffsetHours * 3600 * 1000;
};

function isActiveBan(flag, expire, hasFlag, hasExpire, now = Date.now()) {
    const exp = hasExpire ? expiryMs(expire) : null;
    if (Number.isNaN(exp)) return true;
    if (hasFlag) {
        if (!truthy(flag)) return false;
        return exp === null || exp > now;
    }
    return exp !== null && exp > now;
}

function rowBan(row, s, now = Date.now()) {
    return isActiveBan(row.ban_flag, row.ban_expire, !!s.banFlag, !!s.banExpire, now);
}

async function bannedByTable(names, ucp) {
    const b = cfg.banTable;
    const out = new Set();
    if (!b?.table || !b?.nameColumn || !names.length) return out;
    const cols = [b.nameColumn, b.ucpColumn, b.activeColumn, b.expireColumn].filter(Boolean);

    const rows = await q('SELECT ?? FROM ?? WHERE ?? IN (?)', [cols, b.table, b.nameColumn, names]);
    const now = Date.now();
    const active = (r) =>
        (b.zeroIsPermanent && b.expireColumn && Number(r[b.expireColumn]) === 0) ||
        isActiveBan(r[b.activeColumn], r[b.expireColumn], !!b.activeColumn, !!b.expireColumn, now) ||
        (!b.activeColumn && !b.expireColumn);
    for (const r of rows) if (active(r)) out.add(String(r[b.nameColumn]).toLowerCase());
    if (b.ucpColumn && ucp) {
        const accRows = await q('SELECT ?? FROM ?? WHERE ?? = ?', [cols, b.table, b.ucpColumn, ucp]);
        if (accRows.some(active)) names.forEach((n) => out.add(String(n).toLowerCase()));
    }
    return out;
}

async function getUcpByDiscord(discordId) {
    const rows = await q('SELECT ?? AS ucp FROM ?? WHERE ?? = ? LIMIT 1', [
        cfg.ucpColumn,
        cfg.ucpTable,
        cfg.discordColumn,
        String(discordId),
    ]);
    return rows[0]?.ucp ? String(rows[0].ucp) : null;
}

const selectCols = (s) => {
    const cols = [
        [s.id, 'id'],
        [s.name, 'name'],
    ];
    if (s.banFlag) cols.push([s.banFlag, 'ban_flag']);
    if (s.banExpire) cols.push([s.banExpire, 'ban_expire']);
    return cols;
};

async function fetchRows(ucp, s, charId) {
    const cols = selectCols(s);
    const sel = cols.map(() => '?? AS ??').join(', ');
    const params = cols.flat();
    let sql = `SELECT ${sel} FROM ?? WHERE ?? = ?`;
    params.push(cfg.table, s.ucp, ucp);
    if (charId !== undefined) {
        sql += ' AND ?? = ?';
        params.push(s.id, charId);
    }
    sql += ' ORDER BY ?? ASC';
    params.push(s.id);
    return q(sql, params);
}

async function decorate(rows, s, ucp) {
    const tableBanned = s.hasTableBan
        ? await bannedByTable(
              rows.map((r) => String(r.name)),
              ucp,
          )
        : new Set();
    return rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        banned: rowBan(r, s) || tableBanned.has(String(r.name).toLowerCase()),
    }));
}

async function listCharacters(ucp) {
    const s = await getSchema();
    if (!s) return null;
    return decorate(await fetchRows(ucp, s), s, ucp);
}

async function getOwnedCharacter(ucp, charId) {
    const s = await getSchema();
    if (!s || !/^\d+$/.test(String(charId))) return null;
    const list = await decorate(await fetchRows(ucp, s, charId), s, ucp);
    return list[0] ?? null;
}

async function isCharacterOnline(name) {
    const { querySamp } = require('./monitoring-core');
    const res = await querySamp();
    if (!res.ok) return false;
    const d = res.data;
    if (!d.players?.length) return d.online > 0;
    return d.players.some((p) => String(p.name).toLowerCase() === String(name).toLowerCase());
}

async function deleteCharacter(ucp, char, s) {
    const conn = await new Promise((resolve, reject) => db.getConnection((e, c) => (e ? reject(e) : resolve(c))));
    const cq = (sql, params) =>
        new Promise((resolve, reject) => conn.query(sql, params, (e, r) => (e ? reject(e) : resolve(r))));
    try {
        await new Promise((resolve, reject) => conn.beginTransaction((e) => (e ? reject(e) : resolve())));
        for (const r of cfg.relatedTables ?? []) {
            await cq('DELETE FROM ?? WHERE ?? = ?', [r.table, r.column, r.by === 'name' ? char.name : char.id]);
        }
        const res = await cq('DELETE FROM ?? WHERE ?? = ? AND ?? = ?', [cfg.table, s.id, char.id, s.ucp, ucp]);
        if (res.affectedRows !== 1) throw new Error(`DELETE mengenai ${res.affectedRows} baris (seharusnya 1)`);
        await new Promise((resolve, reject) => conn.commit((e) => (e ? reject(e) : resolve())));
    } catch (e) {
        await new Promise((resolve) => conn.rollback(() => resolve()));
        throw e;
    } finally {
        conn.release();
    }
}

const cancelRow = (extra = []) =>
    new ActionRowBuilder().addComponents(
        ...extra,
        new ButtonBuilder().setCustomId('delchar-cancel').setLabel('Tutup').setStyle(ButtonStyle.Secondary),
    );

function listPayload(ucp, chars) {
    const shown = chars.slice(0, 25);
    const lines = shown.map(
        (c, i) => `**${i + 1}.** ${escapeMarkdown(pretty(c.name))} — ${c.banned ? '🚫 **BANNED**' : '✅ Bisa dihapus'}`,
    );
    const embed = new EmbedBuilder()
        .setColor('#2B2D31')
        .setTitle('🗑️ HAPUS KARAKTER')
        .setDescription(
            `UCP **${escapeMarkdown(ucp)}** memiliki **${chars.length}** karakter:\n\n${lines.join('\n')}\n\n` +
                `Pilih karakter yang ingin dihapus pada menu di bawah.\n` +
                `⚠️ Karakter yang sedang **banned** tidak dapat dihapus.` +
                (chars.length > 25 ? `\n_Hanya 25 karakter pertama yang ditampilkan._` : ''),
        );
    const menu = new StringSelectMenuBuilder()
        .setCustomId('delchar-select')
        .setPlaceholder('Pilih karakter…')
        .addOptions(
            shown.map((c) => ({
                label: pretty(c.name).slice(0, 100),
                value: c.id,
                description: c.banned ? 'Sedang banned - tidak bisa dihapus' : 'Klik untuk menghapus',
                emoji: c.banned ? '🚫' : '👤',
            })),
        );
    return { content: '', embeds: [embed], components: [new ActionRowBuilder().addComponents(menu), cancelRow()] };
}

function confirmPayload(char) {
    const embed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('⚠️ KONFIRMASI HAPUS KARAKTER')
        .setDescription(
            `Kamu akan menghapus karakter **${escapeMarkdown(pretty(char.name))}**.\n\n` +
                `**Tindakan ini PERMANEN dan tidak dapat dibatalkan.** Semua data karakter akan hilang.\n` +
                `Pastikan karakter ini tidak sedang online di server.`,
        );
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`delchar-confirm:${char.id}`)
            .setLabel('Ya, Hapus')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
        new ButtonBuilder().setCustomId('delchar-back').setLabel('Kembali').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('delchar-cancel').setLabel('Batal').setStyle(ButtonStyle.Secondary),
    );
    return { content: '', embeds: [embed], components: [row] };
}

function bannedPayload(char) {
    const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('🚫 KARAKTER BANNED')
        .setDescription(`**${escapeMarkdown(pretty(char.name))}**\n\n❌ **${BANNED_TEXT}**`);
    return {
        content: '',
        embeds: [embed],
        components: [
            cancelRow([
                new ButtonBuilder().setCustomId('delchar-back').setLabel('Kembali').setStyle(ButtonStyle.Primary),
            ]),
        ],
    };
}

function sendLog(client, user, ucp, char) {
    log(`Hapus Karakter: ${user.tag} (${user.id}) menghapus ${char.name} (id ${char.id}) dari UCP ${ucp}`, 'info');
    if (!cfg.logChannelId) return;
    client.channels
        .fetch(cfg.logChannelId)
        .then((ch) => {
            if (!ch?.isTextBased()) return;
            return ch.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('🗑️ KARAKTER DIHAPUS')
                        .addFields(
                            { name: 'Pemain', value: `<@${user.id}> (${user.id})`, inline: true },
                            { name: 'UCP', value: `\`${ucp}\``, inline: true },
                            { name: 'Karakter', value: `\`${char.name}\` (ID ${char.id})`, inline: true },
                        )
                        .setTimestamp(),
                ],
                allowedMentions: { parse: [] },
            });
        })
        .catch((e) => log(`Hapus Karakter: gagal kirim log: ${e.message}`, 'warn'));
}

module.exports = {
    BANNED_TEXT,
    errEmbed,
    getSchema,
    getUcpByDiscord,
    listCharacters,
    getOwnedCharacter,
    isCharacterOnline,
    deleteCharacter,
    listPayload,
    confirmPayload,
    bannedPayload,
    sendLog,

    _isActiveBan: isActiveBan,
};
