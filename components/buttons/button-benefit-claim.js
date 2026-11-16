const { MessageFlags } = require('discord.js');
const { safe, cfg, getBenefit, claimModal } = require('../../core/benefit-core');

module.exports = {
    customId: 'benefit-claim',
    run: safe(async (client, interaction) => {
        if (!cfg.open)
            return interaction.reply({
                content: '🔒 Claim benefit sedang ditutup sementara.',
                flags: MessageFlags.Ephemeral,
            });
        const id = interaction.customId.split(':')[1];
        await interaction.showModal(claimModal(getBenefit(id) ? id : undefined));
    }),
};
