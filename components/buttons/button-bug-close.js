const { MessageFlags, EmbedBuilder } = require('discord.js');
const { isStaff, staffButtons, TOPIC_PREFIX } = require('../../core/bugreport-core');

module.exports = {
    customId: 'bug-close',

    run: async (client, interaction) => {
        if (!interaction.channel?.topic?.startsWith(TOPIC_PREFIX)) return;
        if (!isStaff(interaction.member))
            return interaction.reply({
                content: 'Hanya Admin/Developer yang bisa memakai tombol ini.',
                flags: MessageFlags.Ephemeral,
            });

        await interaction.reply({ content: '🔒 Channel akan dihapus dalam 5 detik...' });
        setTimeout(
            () => interaction.channel.delete(`Laporan ditutup oleh ${interaction.user.tag}`).catch(() => {}),
            5000,
        );
    },
};
