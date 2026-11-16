const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getReport, canManage } = require('../../core/dutyreport-core');

module.exports = {
    customId: 'duty-delete',

    run: async (client, interaction) => {
        const r = getReport(interaction.message.id);
        if (!r)
            return interaction.reply({ content: 'Data laporan ini tidak ditemukan.', flags: MessageFlags.Ephemeral });
        if (!canManage(interaction.member, r))
            return interaction.reply({
                content: 'Hanya pemilik laporan atau Management yang bisa menghapus.',
                flags: MessageFlags.Ephemeral,
            });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`duty-delete-confirm:${interaction.message.id}`)
                .setLabel('Ya, hapus')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️'),
        );
        return interaction.reply({
            content: '⚠️ Yakin ingin menghapus laporan duty ini? Durasinya juga hilang dari rekap.',
            components: [row],
            flags: MessageFlags.Ephemeral,
        });
    },
};
