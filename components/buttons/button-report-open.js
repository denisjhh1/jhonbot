const { MessageFlags } = require('discord.js');
const { TYPES, safe, buildModal, checkLimits } = require('../../core/report-core');
const { IntError } = require('../../functions');

module.exports = {
    customId: 'report-open',
    run: safe(async (client, interaction) => {
        const type = interaction.customId.split(':')[1];
        if (!TYPES[type]) return;

        const limitMsg = checkLimits(interaction.guild, interaction.user, type);
        if (limitMsg) return IntError(interaction, limitMsg);

        await interaction.showModal(buildModal(type));
    }),
};
