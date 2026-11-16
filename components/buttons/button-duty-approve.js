const { MessageFlags } = require('discord.js');
const { getReport, save, render, isManager } = require('../../core/dutyreport-core');

module.exports = {
    customId: 'duty-approve',

    run: async (client, interaction) => {
        if (!isManager(interaction.member))
            return interaction.reply({
                content: 'Hanya Management yang bisa menyetujui laporan duty.',
                flags: MessageFlags.Ephemeral,
            });

        const r = getReport(interaction.message.id);
        if (!r)
            return interaction.reply({ content: 'Data laporan ini tidak ditemukan.', flags: MessageFlags.Ephemeral });

        r.approvedBy = r.approvedBy ? null : interaction.user.id;
        save();
        await interaction.update({ ...render(r), allowedMentions: { parse: [] } });
    },
};
