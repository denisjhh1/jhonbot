const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const def = require('../../../defines');
const db = require('../../../core/query');
const { log } = require('../../../functions');

const defaultColumns = {
    name: 'Char_Name',
    time: 'Char_OnlineTimer',
    level: 'Char_Level',
    lastLogin: 'Char_LastLogin',
};
const cfg = {
    allowedRoleIds: [],
    ephemeral: false,
    table: 'player_characters',

    timeUnit: 'seconds',
    defaultLimit: 10,
    maxLimit: 25,
    ...(def.toponline ?? {}),
};
cfg.columns = { ...defaultColumns, ...(def.toponline?.columns ?? {}) };

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

const UNIT_SECONDS = { seconds: 1, minutes: 60, hours: 3600 };

function formatDuration(value) {
    const total = Math.max(0, Math.floor(Number(value) || 0) * (UNIT_SECONDS[cfg.timeUnit] ?? 1));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const parts = [];
    if (d) parts.push(`${d} Hari`);
    if (h || d || cfg.timeUnit === 'hours') parts.push(`${h} Jam`);

    if (cfg.timeUnit !== 'hours') parts.push(`${m} Menit`);
    return parts.join(' ');
}

const medals = ['🥇', '🥈', '🥉'];

function canUse(interaction) {
    if (!cfg.allowedRoleIds.length) return true;
    if ([].concat(def.users?.ownerId ?? []).includes(interaction.user.id)) return true;
    const roles = interaction.member?.roles?.cache;
    return !!roles && cfg.allowedRoleIds.some((id) => roles.has(id));
}

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('toponline')
        .setDescription('Menampilkan daftar pemain dengan waktu online terbanyak.')
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
        const c = cfg.columns;

        try {
            const cols = await q('SHOW COLUMNS FROM ??', [cfg.table]);
            const set = new Set(cols.map((r) => r.Field));

            for (const key of ['name', 'time']) {
                if (!set.has(c[key])) {
                    log(`/toponline: kolom "${c[key]}" (${key}) tidak ada di tabel${cfg.table}.`, 'warn');
                    return interaction.editReply(
                        '❌ Kolom waktu online belum diatur dengan benar. Cek console bot dan `toponline.columns` di defines.js.',
                    );
                }
            }

            const select = [
                [c.name, 'name'],
                [c.time, 'time'],
            ];
            if (set.has(c.level)) select.push([c.level, 'level']);

            const rows = await q(
                `SELECT ${select.map(() => '?? AS ??').join(', ')} FROM ?? WHERE ?? > 0 ORDER BY ?? DESC LIMIT ?`,
                [...select.flat(), cfg.table, c.time, c.time, limit],
            );

            if (!rows.length) return interaction.editReply('⚠️ Belum ada data waktu online.');

            const lines = rows.map((r, i) => {
                const rank = medals[i] ?? `\`#${i + 1}\``;
                const lvl = r.level !== undefined ? ` \`[Lv. ${r.level}]\`` : '';
                const nameClean = String(r.name).replace(/`/g, '');

                return `### ${rank} **${nameClean}**${lvl}\n> ⏳ **Total Playtime:** \`${formatDuration(r.time)}\``;
            });

            const embed = new EmbedBuilder()
                .setTitle(`👑 LEADERBOARD TOP ${rows.length} PLAYTIME`)
                .setDescription(lines.join('\n\n'))
                .setColor('#FFD700')
                .setThumbnail(def.icon?.thumbnail ?? interaction.guild?.iconURL({ dynamic: true }))
                .setFooter({ text: 'Management Server • Interactive Leaderboard', iconURL: def.icon?.thumbnail })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
        } catch (err) {
            log(err.stack ?? err, 'err');
            return interaction.editReply('❌ Terjadi kesalahan saat mengambil data dari database.');
        }
    },
};
