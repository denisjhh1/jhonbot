const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { panelPayload } = require('../../../core/benefit-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panelbenefit')
        .setDescription('Memasang panel Benefit & Claim di channel ini.'),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        await interaction.channel.send(panelPayload(interaction.guild));
        return interaction.reply({ content: '✅ Panel Benefit berhasil terpasang!', flags: MessageFlags.Ephemeral });
    },
};
