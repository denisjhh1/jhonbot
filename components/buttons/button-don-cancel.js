const { EmbedBuilder } = require('discord.js');
const { drafts } = require('../../core/donation-core');

module.exports = {
    customId: 'don-cancel',
    run: async (client, interaction) => {
        drafts.delete(interaction.user.id);
        await interaction.update({
            embeds: [new EmbedBuilder().setColor('Grey').setDescription('Pesanan dibatalkan.')],
            components: [],
        });
    },
};
