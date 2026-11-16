const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { panelPayload, registerPanel } = require('../../../core/rekrut-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panelrekrutmen')
        .setDescription('Memasang panel Rekrutmen Administrator di channel ini.'),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        const msg = await interaction.channel.send(panelPayload(interaction.guild));
        registerPanel(msg);
        return interaction.reply({
            content: '✅ Panel Rekrutmen Administrator berhasil terpasang!',
            flags: MessageFlags.Ephemeral,
        });
    },
};
