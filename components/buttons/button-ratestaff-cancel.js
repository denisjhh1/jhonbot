const { EmbedBuilder } = require('discord.js');
const { drafts, pending } = require('../../core/ratestaff-core');

module.exports = {
    customId: 'ratestaff-cancel',

    run: async (client, interaction) => {
        drafts.delete(interaction.user.id);
        pending.delete(interaction.user.id);
        return interaction.update({
            embeds: [new EmbedBuilder().setColor('Grey').setDescription('✖️ Penilaian dibatalkan.')],
            components: [],
        });
    },
};
