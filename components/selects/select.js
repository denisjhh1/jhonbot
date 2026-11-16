const { MessageFlags, StringSelectMenuInteraction } = require('discord.js');
const ExtendedClient = require('../../class/Client');

module.exports = {
    customId: 'example-select',

    run: async (client, interaction) => {
        const value = interaction.values[0];

        await interaction.reply({
            content: `You have selected from the menu: **${value}**`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
