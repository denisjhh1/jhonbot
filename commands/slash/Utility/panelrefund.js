const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { panelPayload } = require('../../../core/refund-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panelrefund')
        .setDescription('Memasang panel Refund & Pengajuan di channel ini.'),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        await interaction.channel.send(panelPayload(interaction.guild));
        return interaction.reply({ content: '✅ Panel Refund berhasil terpasang!', flags: MessageFlags.Ephemeral });
    },
};
