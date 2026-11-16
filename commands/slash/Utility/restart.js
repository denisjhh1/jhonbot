const {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
} = require('discord.js');
const ExtendedClient = require('../../../class/Client');
const { time } = require('../../../functions');
const def = require('../../../defines');

module.exports = {
    structure: new SlashCommandBuilder().setName('restart').setDescription('system restart bot'),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        interaction.reply({ content: 'Restarting . . .' });
        process.send('reset');
    },
};
