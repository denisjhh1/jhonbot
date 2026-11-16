const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { panelPayload } = require('../../../core/asset-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panelaset')
        .setDescription('Memasang panel Asset Record (cek aset karakter) di channel ini.'),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        await interaction.channel.send(panelPayload());
        return interaction.reply({
            content: '✅ Panel Asset Record berhasil terpasang!',
            flags: MessageFlags.Ephemeral,
        });
    },
};
