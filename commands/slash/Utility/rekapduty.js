const { MessageFlags, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { state, monthOf, fmtDur, isManager, MIN_MINUTES } = require('../../../core/dutyreport-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('rekapduty')
        .setDescription('Rekap total duty semua admin (khusus Management).')
        .addIntegerOption((o) =>
            o.setName('bulan').setDescription('Bulan 1-12 (default: bulan ini)').setMinValue(1).setMaxValue(12),
        )
        .addIntegerOption((o) =>
            o.setName('tahun').setDescription('Tahun (default: tahun ini)').setMinValue(2024).setMaxValue(2100),
        ),
    options: { cooldown: 5000 },

    run: async (client, interaction) => {
        if (!isManager(interaction.member))
            return interaction.reply({
                content: 'Hanya Management yang bisa memakai perintah ini.',
                flags: MessageFlags.Ephemeral,
            });

        const now = monthOf(Math.floor(Date.now() / 1000));
        const m = interaction.options.getInteger('bulan') ?? now.m;
        const y = interaction.options.getInteger('tahun') ?? now.y;

        const per = new Map();
        for (const r of Object.values(state.reports)) {
            const mo = monthOf(r.ts);
            if (mo.y !== y || mo.m !== m) continue;
            const e = per.get(r.userId) ?? { minutes: 0, count: 0, approved: 0 };
            e.minutes += r.minutes;
            e.count++;
            if (r.approvedBy) e.approved++;
            per.set(r.userId, e);
        }

        const rows = [...per.entries()].sort((a, b) => b[1].minutes - a[1].minutes);
        let lines = rows.map(
            ([id, e], i) =>
                `**${i + 1}.** <@${id}> — ${fmtDur(e.minutes)} • ${e.count} laporan (${e.approved} disetujui)`,
        );
        let text = lines.join('\n');
        if (text.length > 3900) text = text.slice(0, 3890).replace(/\n[^\n]*$/, '') + '\n…';

        const total = rows.reduce((s, [, e]) => s + e.minutes, 0);
        const embed = new EmbedBuilder()
            .setTitle(`📊 Rekap Duty ${String(m).padStart(2, '0')}/${y}`)
            .setDescription(text || '_Belum ada laporan duty pada periode ini._')
            .setColor('Blue')
            .setFooter({
                text: `${rows.length} admin • total ${fmtDur(total)} • minimal per sesi ${fmtDur(MIN_MINUTES)}`,
            });

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    },
};
