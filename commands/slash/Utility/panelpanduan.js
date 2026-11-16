const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { panelPayload } = require('../../../core/panduan-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panelpanduan')
        .setDescription('Memasang panel Panduan publik di channel ini.'),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        await interaction.channel.send(panelPayload());
        return interaction.reply({ content: '✅ Panel Panduan berhasil terpasang!', flags: MessageFlags.Ephemeral });
    },
};
