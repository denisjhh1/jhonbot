const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { controlPayload, refreshPanels } = require('../../../core/rekrut-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('kontrolrekrut')
        .setDescription('Buka / tutup rekrutmen administrator (khusus Owner & Developer).'),
    options: {
        developers: true,
    },

    run: async (client, interaction) => {
        await interaction.reply({ ...controlPayload(), flags: MessageFlags.Ephemeral });

        refreshPanels(client).catch(() => {});
    },
};
