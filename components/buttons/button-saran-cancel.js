const { EmbedBuilder } = require('discord.js');
const { drafts } = require('../../core/suggestion-core');

module.exports = {
    customId: 'saran-cancel',
    run: async (client, interaction) => {
        drafts.delete(interaction.user.id);
        await interaction.update({
            embeds: [new EmbedBuilder().setColor('Grey').setDescription('Saran dibatalkan.')],
            components: [],
        });
    },
};
