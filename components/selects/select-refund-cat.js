const { MessageFlags } = require('discord.js');
const { CATS, safe, checkLimits, buildModal } = require('../../core/refund-core');

module.exports = {
    customId: 'refund-cat',
    run: safe(async (client, interaction) => {
        const cat = interaction.values[0];
        if (!CATS[cat]) return interaction.reply({ content: 'Kategori tidak dikenal.', flags: MessageFlags.Ephemeral });

        const limitMsg = checkLimits(interaction.user);
        if (limitMsg) return interaction.reply({ content: limitMsg, flags: MessageFlags.Ephemeral });

        await interaction.showModal(buildModal(cat));
    }),
};
