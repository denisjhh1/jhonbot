const { MessageFlags, EmbedBuilder } = require('discord.js');
const { state, canReport, monthOf, monthStats, fmtDur, MIN_MINUTES } = require('../../core/dutyreport-core');

module.exports = {
    customId: 'duty-recap',

    run: async (client, interaction) => {
        if (!canReport(interaction.member))
            return interaction.reply({ content: 'Panel ini hanya untuk staff/admin.', flags: MessageFlags.Ephemeral });

        const id = interaction.user.id;
        const { y, m } = monthOf(Math.floor(Date.now() / 1000));
        const mine = Object.values(state.reports).filter((r) => r.userId === id);
        const { minutes, count } = monthStats(id, y, m);
        const last = mine.sort((a, b) => b.ts - a.ts)[0];

        const embed = new EmbedBuilder()
            .setTitle(`📊 Rekap Dutymu — ${String(m).padStart(2, '0')}/${y}`)
            .setColor('Blue')
            .addFields(
                { name: 'Total Duty', value: fmtDur(minutes), inline: true },
                { name: 'Jumlah Laporan', value: String(count), inline: true },
                { name: 'Rata-rata / Sesi', value: count ? fmtDur(Math.round(minutes / count)) : '-', inline: true },
                {
                    name: 'Laporan Terakhir',
                    value: last ? `<t:${last.ts}:R> • ${fmtDur(last.minutes)}` : '_Belum ada_',
                },
                { name: 'Thread Dutymu', value: state.threads[id] ? `<#${state.threads[id]}>` : '_Belum dibuat_' },
            )
            .setFooter({ text: `Minimal per sesi: ${fmtDur(MIN_MINUTES)}` });

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
