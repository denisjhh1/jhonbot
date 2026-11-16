const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getPost, canManage } = require('../../core/suggestion-core');

module.exports = {
    customId: 'saran-delete',

    run: async (client, interaction) => {
        const post = getPost(interaction.message.id);
        if (!post)
            return interaction.reply({ content: 'Data saran ini tidak ditemukan.', flags: MessageFlags.Ephemeral });
        if (!canManage(interaction.member, post))
            return interaction.reply({
                content: 'Hanya pengusul, Admin, atau Developer yang bisa menghapus saran ini.',
                flags: MessageFlags.Ephemeral,
            });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`saran-delete-confirm:${interaction.message.id}`)
                .setLabel('Ya, hapus')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️'),
        );
        return interaction.reply({
            content:
                '⚠️ Yakin ingin menghapus saran ini beserta semua komentarnya? Tindakan ini tidak bisa dibatalkan.',
            components: [row],
            flags: MessageFlags.Ephemeral,
        });
    },
};
