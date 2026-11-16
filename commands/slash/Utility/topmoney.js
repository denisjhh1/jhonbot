const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const def = require('../../../defines');
const db = require('../../../core/query');
const { log } = require('../../../functions');

const defaultColumns = {
    name: 'Char_Name',
    cash: 'Char_Money',
    bank: 'Char_BankMoney',
    level: 'Char_Level',
    admin: 'Char_Admin',
};
const cfg = {
    allowedRoleIds: [],
    ephemeral: false,
    table: 'player_characters',
    defaultLimit: 10,
    maxLimit: 15,
    ...(def.topmoney ?? {}),
};
cfg.columns = { ...defaultColumns, ...(def.topmoney?.columns ?? {}) };

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

const medals = ['🥇', '🥈', '🥉'];
const clean = (v) => String(v ?? '').replace(/`/g, '');
const fmt = (n) => `$${Number(n ?? 0).toLocaleString('id-ID')}`;

function canUse(interaction) {
    if (!cfg.allowedRoleIds.length) return true;
    if ([].concat(def.users?.ownerId ?? []).includes(interaction.user.id)) return true;
    const roles = interaction.member?.roles?.cache;
    return !!roles && cfg.allowedRoleIds.some((id) => roles.has(id));
}

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('topmoney')
        .setDescription('Menampilkan daftar pemain dengan harta (cash + bank) terbanyak.')
        .addStringOption((o) =>
            o
                .setName('urutkan')
                .setDescription('Urutkan berdasarkan apa (default: Total Harta)')
                .addChoices(
                    { name: 'Total Harta (Cash + Bank)', value: 'total' },
                    { name: 'Cash', value: 'cash' },
                    { name: 'Bank', value: 'bank' },
                ),
        )
        .addIntegerOption((o) =>
            o
                .setName('jumlah')
                .setDescription(`Jumlah pemain yang ditampilkan (maks ${cfg.maxLimit})`)
                .setMinValue(1)
                .setMaxValue(cfg.maxLimit),
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

        const limit = Math.min(interaction.options.getInteger('jumlah') ?? cfg.defaultLimit, cfg.maxLimit);
        const sortKey = interaction.options.getString('urutkan') ?? 'total';
        const c = cfg.columns;

        try {
            const cols = await q('SHOW COLUMNS FROM ??', [cfg.table]);
            const set = new Set(cols.map((r) => r.Field));

            for (const key of ['name', 'cash', 'bank']) {
                if (!set.has(c[key])) {
                    log(`/topmoney: kolom "${c[key]}" (${key}) tidak ada di tabel ${cfg.table}.`, 'warn');
                    return interaction.editReply(
                        '❌ Kolom harta belum diatur dengan benar. Cek console bot dan `topmoney.columns` di defines.js.',
                    );
                }
            }

            const hasAdminCol = set.has(c.admin);
            if (!hasAdminCol)
                log(
                    `/topmoney: kolom "${c.admin}" (admin) tidak ada di tabel ${cfg.table}; admin TIDAK difilter.`,
                    'warn',
                );
            const adminWhere = hasAdminCol ? ' AND COALESCE(??, 0) = 0' : '';
            const adminParams = hasAdminCol ? [c.admin] : [];

            const select = [
                [c.name, 'name'],
                [c.cash, 'cash'],
                [c.bank, 'bank'],
            ];
            if (set.has(c.level)) select.push([c.level, 'level']);

            const sortKeys = sortKey === 'total' ? ['cash', 'bank'] : [sortKey];
            const sortExpr = sortKeys.map(() => 'COALESCE(??, 0)').join(' + ');
            const sortParams = sortKeys.map((k) => c[k]);

            const rows = await q(
                `SELECT ${select.map(() => '?? AS ??').join(', ')} FROM ?? WHERE (${sortExpr}) > 0${adminWhere} ORDER BY (${sortExpr}) DESC, ?? ASC LIMIT ?`,
                [...select.flat(), cfg.table, ...sortParams, ...adminParams, ...sortParams, c.name, limit],
            );

            if (!rows.length) return interaction.editReply('⚠️ Belum ada data harta pemain.');

            const sortLabel = { total: 'Total Harta (Cash + Bank)', cash: 'Cash', bank: 'Bank' }[sortKey];

            const lines = rows.map((r, i) => {
                const rank = medals[i] ?? `\`#${i + 1}\``;
                const lvl = r.level !== undefined ? ` \`[Lv. ${r.level}]\`` : '';
                const total = Number(r.cash ?? 0) + Number(r.bank ?? 0);

                return `### ${rank} **${clean(r.name)}**${lvl}\n> 💵 Cash: \`${fmt(r.cash)}\`  •  🏦 Bank: \`${fmt(r.bank)}\`\n> 💰 **Total:** \`${fmt(total)}\``;
            });

            const embed = new EmbedBuilder()
                .setTitle(`💰 TOP ${rows.length} HARTA`)
                .setDescription(`Diurutkan berdasarkan **${sortLabel}**\n\n${lines.join('\n\n')}`)
                .setColor('#FFD700')
                .setThumbnail(def.icon?.thumbnail ?? interaction.guild?.iconURL({ dynamic: true }) ?? null)
                .setFooter({ text: 'Management Server • Wealth Leaderboard', iconURL: def.icon?.thumbnail })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
        } catch (err) {
            log(err.stack ?? err, 'err');
            return interaction.editReply('❌ Terjadi kesalahan saat mengambil data dari database.');
        }
    },
};
