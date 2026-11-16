const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { panelPayload } = require('../../../core/link-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panellink')
        .setDescription('Memasang panel Link Discord Official di channel ini.'),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        await interaction.channel.send(panelPayload(interaction.guild));
        return interaction.reply({
            content: '✅ Panel Link Discord berhasil terpasang!',
            flags: MessageFlags.Ephemeral,
        });
    },
};
