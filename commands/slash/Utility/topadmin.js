const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const def = require('../../../defines');
const db = require('../../../core/query');
const { log } = require('../../../functions');

const defaultColumns = {
    name: 'Char_Name',
    adminName: 'Char_AdminName',
    level: 'Char_Admin',
    point: 'Char_AdminPoint',
    ask: 'Char_AskPoints',
    report: 'Char_ReportPoints',
};
const cfg = {
    allowedRoleIds: [],
    ephemeral: false,
    table: 'player_characters',
    limit: 10,

    adminLevelNames: {},
    ...(def.topadmin ?? {}),
};
cfg.columns = { ...defaultColumns, ...(def.topadmin?.columns ?? {}) };

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

const medals = ['🥇', '🥈', '🥉'];
const clean = (v) => String(v ?? '').replace(/`/g, "'");

function canUse(interaction) {
    if (!cfg.allowedRoleIds.length) return true;
    if ([].concat(def.users?.ownerId ?? []).includes(interaction.user.id)) return true;
    const roles = interaction.member?.roles?.cache;
    return !!roles && cfg.allowedRoleIds.some((id) => roles.has(id));
}

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('topadmin')
        .setDescription('Menampilkan daftar admin dengan point tertinggi.')
        .addStringOption((o) =>
            o
                .setName('urutkan')
                .setDescription('Urutkan berdasarkan point apa (default: Admin Point)')
                .addChoices(
                    { name: 'Admin Point', value: 'point' },
                    { name: 'Ask Points', value: 'ask' },
                    { name: 'Report Points', value: 'report' },
                    { name: 'Total Semua Point', value: 'total' },
                ),
        ),
    options: {
        cooldown: 10000,
    },

    run: async (client, interaction) => {
        const flags = cfg.ephemeral ? MessageFlags.Ephemeral : undefined;

        if (!canUse(interaction)) {
            return interaction.reply({
                content: '❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags });
        const c = cfg.columns;
        const sortKey = interaction.options.getString('urutkan') ?? 'point';

        try {
            const cols = await q('SHOW COLUMNS FROM ??', [cfg.table]);
            const set = new Set(cols.map((r) => r.Field));

            for (const key of ['name', 'point']) {
                if (!set.has(c[key])) {
                    log(`/topadmin: kolom "${c[key]}" (${key}) tidak ada di tabel ${cfg.table}.`, 'warn');
                    return interaction.editReply(
                        '❌ Kolom admin point belum diatur dengan benar. Cek console bot dan `topadmin.columns` di defines.js.',
                    );
                }
            }

            const select = [
                [c.name, 'name'],
                [c.point, 'point'],
            ];
            for (const key of ['adminName', 'level', 'ask', 'report']) {
                if (set.has(c[key])) select.push([c[key], key]);
            }
            const has = (k) => select.some(([, key]) => key === k);

            const pointKeys = ['point', 'ask', 'report'].filter(has);
            const sortKeys = sortKey === 'total' ? pointKeys : [has(sortKey) ? sortKey : 'point'];
            const sortExpr = sortKeys.map(() => 'COALESCE(??, 0)').join(' + ');
            const sortParams = sortKeys.map((k) => c[k]);

            const where = has('level') ? `?? > 0 AND (${sortExpr}) > 0` : `(${sortExpr}) > 0`;
            const whereParams = has('level') ? [c.level, ...sortParams] : sortParams;

            const rows = await q(
                `SELECT ${select.map(() => '?? AS ??').join(', ')} FROM ?? WHERE ${where} ORDER BY (${sortExpr}) DESC, ?? ASC LIMIT ?`,
                [...select.flat(), cfg.table, ...whereParams, ...sortParams, c.name, cfg.limit],
            );

            if (!rows.length) return interaction.editReply('⚠️ Belum ada admin dengan point.');

            const fmt = (n) => Number(n ?? 0).toLocaleString('id-ID');
            const sortLabel = {
                point: 'Admin Point',
                ask: 'Ask Points',
                report: 'Report Points',
                total: 'Total Point',
            }[sortKeys.length > 1 ? 'total' : sortKeys[0]];

            const lines = rows.map((r, i) => {
                const rank = medals[i] ?? `\`#${i + 1}\``;
                const display = r.adminName && r.adminName !== 'None' ? r.adminName : r.name;
                const lvl = r.level !== undefined ? (cfg.adminLevelNames[r.level] ?? `Level ${r.level}`) : null;

                const subParts = [`Char: \`${clean(r.name)}\``];
                if (lvl) subParts.push(lvl);

                const pts = [`⭐ Admin: \`${fmt(r.point)}\``];
                if (has('ask')) pts.push(`❓ Ask: \`${fmt(r.ask)}\``);
                if (has('report')) pts.push(`🚨 Report: \`${fmt(r.report)}\``);
                const total = pointKeys.reduce((sum, k) => sum + Number(r[k] ?? 0), 0);
                const totalLine = pointKeys.length > 1 ? `\n> 🏅 **Total:** \`${fmt(total)}\`` : '';

                return `### ${rank} **${clean(display)}**\n> ${pts.join('  •  ')}${totalLine}\n> 📌 *${subParts.join(' • ')}*`;
            });

            const thumb = def.icon?.thumbnail ?? interaction.guild?.iconURL();
            const embed = new EmbedBuilder()
                .setTitle(`🛡️ LEADERBOARD TOP ${rows.length} ADMIN`)
                .setDescription(`Diurutkan berdasarkan **${sortLabel}**\n\n${lines.join('\n\n')}`)
                .setColor('#FFD700')
                .setFooter({ text: 'Management Server • Staff Leaderboard', iconURL: def.icon?.thumbnail })
                .setTimestamp();
            if (thumb) embed.setThumbnail(thumb);

            return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
        } catch (err) {
            log(err.stack ?? err, 'err');
            return interaction.editReply('❌ Terjadi kesalahan saat mengambil data dari database.');
        }
    },
};
