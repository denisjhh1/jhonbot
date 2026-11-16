const { EmbedBuilder } = require('discord.js');
const { drafts } = require('../../core/bugreport-core');

module.exports = {
    customId: 'bug-cancel',
    run: async (client, interaction) => {
        drafts.delete(interaction.user.id);
        await interaction.update({
            embeds: [new EmbedBuilder().setColor('Grey').setDescription('Laporan dibatalkan.')],
            components: [],
        });
    },
};
