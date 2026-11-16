const { ChatInputCommandInteraction, SlashCommandBuilder } = require('discord.js');
const ExtendedClient = require('../../../class/Client');

module.exports = {
    structure: new SlashCommandBuilder().setName('ping').setDescription('Replies with pong!'),
    options: {
        cooldown: 5000,
    },

    run: async (client, interaction) => {
        await interaction.reply({
            content: 'Pong! ' + client.ws.ping,
        });
    },
};
