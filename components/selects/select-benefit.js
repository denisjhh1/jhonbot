const { MessageFlags } = require('discord.js');
const { safe, getBenefit, detailPayload, selectRow, panelButtons } = require('../../core/benefit-core');

module.exports = {
    customId: 'benefit-select',
    run: safe(async (client, interaction) => {
        const b = getBenefit(interaction.values[0]);
        if (!b) return interaction.reply({ content: 'Benefit tidak dikenal.', flags: MessageFlags.Ephemeral });

        await interaction.reply(detailPayload(b));

        await interaction.message.edit({ components: [selectRow(), panelButtons()] }).catch(() => {});
    }),
};
