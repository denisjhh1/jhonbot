const { SlashCommandBuilder, EmbedBuilder, MessageFlags, escapeMarkdown } = require('discord.js');
const def = require('../../../defines');
const db = require('../../../core/query');
const { log } = require('../../../functions');

const defaultColumns = {
    name: 'Char_Name',
    ucp: 'Char_UCP',
    skin: 'Char_Skin',
    cash: 'Char_Money',
    bank: 'Char_BankMoney',
    job: 'Char_Job',
    faction: 'Char_Faction',
    family: 'Char_Family',
    lastLogin: 'Char_LastLogin',
    level: 'Char_Level',
};
const cfg = {
    allowedRoleIds: ['YOUR_DISCORD_ID'],
    allowEveryone: false,
    ephemeral: false,
    table: 'player_characters',

    jobNames: {},
    factionNames: {},
    familyNames: {},

    lastLoginUtcOffsetHours: 0,
    skinImageUrl: 'https://assets.open.mp/assets/images/skins/{id}.png',
    ...(def.stats ?? {}),
};

cfg.ephemeral = false;

cfg.columns = { ...defaultColumns, ...(def.stats?.columns ?? {}) };

const HINTS = {
    name: ['name', 'nama'],
    ucp: ['ucp'],
    job: ['job', 'kerja'],
    faction: ['faction', 'fact'],
    family: ['family', 'fam'],
    lastLogin: ['login', 'last'],
};

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

let columnCache = { time: 0, set: new Set(), list: [] };
async function getTableColumns() {
    if (Date.now() - columnCache.time < 10 * 60 * 1000 && columnCache.list.length) return columnCache;
    const rows = await q('SHOW COLUMNS FROM ??', [cfg.table]);
    const list = rows.map((r) => r.Field);
    columnCache = { time: Date.now(), set: new Set(list), list };
    return columnCache;
}

const warned = new Set();
function warnMissing(key, column, list) {
    if (warned.has(key)) return;
    warned.add(key);
    const hints = (HINTS[key] ?? []).flatMap((h) => list.filter((c) => c.toLowerCase().includes(h)));
    log(
        `/stats: kolom "${column}" (${key}) tidak ada di tabel ${cfg.table}. Kandidat: ${[...new Set(hints)].join(', ') || '(tidak ada)'}`,
        'warn',
    );
}

const money = (v) => (v === null || v === undefined ? '-' : `$${Number(v).toLocaleString('id-ID')}`);

function nameOf(map, value, noneValues) {
    if (value === null || value === undefined || value === '') return 'Tidak ada';
    if (noneValues.includes(Number(value))) return 'Tidak ada';
    return map?.[value] ?? `ID ${value}`;
}

function parseTime(v) {
    if (v === null || v === undefined || v === '' || v === 0 || v === '0') return null;
    if (v instanceof Date) return isNaN(v) ? null : v.getTime() - 0;
    if (/^\d+$/.test(String(v))) {
        const n = Number(v);
        return n > 1e12 ? n : n * 1000;
    }
    const m = String(v).match(/^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d):(\d\d)/);
    if (m) {
        const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
        return utc - (cfg.lastLoginUtcOffsetHours ?? 0) * 3600 * 1000;
    }
    const t = new Date(v).getTime();
    return isNaN(t) ? null : t;
}

function canUse(interaction) {
    if (cfg.allowEveryone) return true;
    if ([].concat(def.users?.ownerId ?? []).includes(interaction.user.id)) return true;
    const roles = interaction.member?.roles?.cache;
    return !!roles && cfg.allowedRoleIds.some((id) => roles.has(id));
}

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Menampilkan statistik karakter pemain.')
        .addStringOption((o) =>
            o.setName('nama').setDescription('Nama karakter, contoh: Aldo_Romano').setRequired(true),
        ),
    options: {
        cooldown: 5000,
    },

    run: async (client, interaction) => {
        const flags = cfg.ephemeral ? MessageFlags.Ephemeral : undefined;

        if (!canUse(interaction)) {
            return interaction.reply({
                content: 'Kamu tidak memiliki izin untuk menggunakan perintah ini.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags });

        const input = interaction.options.getString('nama').trim().replace(/\s+/g, '_');

        try {
            const { set, list } = await getTableColumns();
            const c = cfg.columns;

            if (!set.has(c.name)) {
                warnMissing('name', c.name, list);
                return interaction.editReply(
                    '❌ Kolom nama karakter belum diatur dengan benar. Cek console bot dan `stats.columns.name` di defines.js.',
                );
            }

            const wanted = ['name', 'ucp', 'skin', 'cash', 'bank', 'job', 'faction', 'family', 'lastLogin', 'level'];
            const select = [];
            for (const key of wanted) {
                if (set.has(c[key])) select.push([c[key], key]);
                else if (key !== 'name') warnMissing(key, c[key], list);
            }

            const rows = await q(`SELECT ${select.map(() => '?? AS ??').join(', ')} FROM ?? WHERE ?? = ? LIMIT 1`, [
                ...select.flat(),
                cfg.table,
                c.name,
                input,
            ]);

            if (!rows.length) {
                const like = await q('SELECT ?? AS name FROM ?? WHERE ?? LIKE ? LIMIT 5', [
                    c.name,
                    cfg.table,
                    c.name,
                    `%${input}%`,
                ]);
                const saran = like.length ? `\nMungkin maksudmu: ${like.map((r) => `\`${r.name}\``).join(', ')}` : '';
                return interaction.editReply(`❌ Karakter \`${input}\` tidak ditemukan.${saran}`);
            }

            const r = rows[0];
            const has = (k) => select.some(([, key]) => key === k);
            const lastLogin = has('lastLogin') ? parseTime(r.lastLogin) : null;

            const lastLoginText = !has('lastLogin')
                ? '-'
                : lastLogin
                  ? `<t:${Math.floor(lastLogin / 1000)}:F> (<t:${Math.floor(lastLogin / 1000)}:R>)`
                  : 'Belum pernah / tidak diketahui';

            const lines = [
                `**Nama:** ${escapeMarkdown(String(r.name))}`,
                `**UCP:** ${has('ucp') && r.ucp ? escapeMarkdown(String(r.ucp)) : '-'}`,
                `**Level:** ${has('level') ? r.level : '-'}`,
                `**Cash:** ${has('cash') ? money(r.cash) : '-'}`,
                `**Bank:** ${has('bank') ? money(r.bank) : '-'}`,
                `**Pekerjaan:** ${has('job') ? nameOf(cfg.jobNames, r.job, [0]) : '-'}`,
                `**Faction:** ${has('faction') ? nameOf(cfg.factionNames, r.faction, [0]) : '-'}`,
                `**Family:** ${has('family') ? nameOf(cfg.familyNames, r.family, [-1]) : '-'}`,
                `**Last Login:** ${lastLoginText}`,
            ];

            const embed = new EmbedBuilder()
                .setTitle('📋 Statistik Karakter')
                .setDescription(lines.join('\n'))
                .setColor('Blurple')
                .setFooter({ text: 'Management Server' });

            return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
        } catch (err) {
            log(err.stack ?? err, 'err');
            return interaction.editReply('❌ Terjadi kesalahan saat mengambil data dari database.');
        }
    },
};
