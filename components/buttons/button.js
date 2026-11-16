const { MessageFlags, ButtonInteraction } = require('discord.js');
const ExtendedClient = require('../../class/Client');

module.exports = {
    customId: 'example-button',

    run: async (client, interaction) => {
        await interaction.reply({
            content: 'The button has been successfully responded!',
            flags: MessageFlags.Ephemeral,
        });
    },
};
