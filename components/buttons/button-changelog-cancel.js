const { EmbedBuilder } = require('discord.js');
const { drafts } = require('../../core/changelog-core');

module.exports = {
    customId: 'changelog-cancel',

    run: async (client, interaction) => {
        drafts.delete(interaction.user.id);
        return interaction.update({
            embeds: [new EmbedBuilder().setColor('Grey').setDescription('✖️ Changelog dibatalkan.')],
            components: [],
        });
    },
};
