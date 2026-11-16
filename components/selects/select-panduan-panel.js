const { MessageFlags } = require('discord.js');
const { PANEL_ID, TOPICS, payload } = require('../../core/panduan-core');

module.exports = {
    customId: PANEL_ID,

    run: async (client, interaction) => {
        const key = interaction.values[0];
        if (!TOPICS[key]) return interaction.reply({ content: 'Topik tidak dikenal.', flags: MessageFlags.Ephemeral });

        return interaction.reply({ ...payload(key), flags: MessageFlags.Ephemeral });
    },
};
