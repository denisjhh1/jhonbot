const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { panelPayload } = require('../../../core/izin-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panelizin')
        .setDescription('Memasang panel Izin Administrator di channel ini.'),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        await interaction.channel.send(panelPayload(interaction.guild));
        return interaction.reply({
            content: '✅ Panel Izin Administrator berhasil terpasang!',
            flags: MessageFlags.Ephemeral,
        });
    },
};
