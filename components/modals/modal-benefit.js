const { MessageFlags } = require('discord.js');
const { safe, submitClaim } = require('../../core/benefit-core');

module.exports = {
    customId: 'modal-benefit',
    run: safe(async (client, interaction) => {
        const char = interaction.fields.getTextInputValue('benefit-char').trim();
        const ucp = interaction.fields.getTextInputValue('benefit-ucp').trim();
        const benefitId = interaction.fields.getStringSelectValues('benefit-pick')?.[0];
        const detail = interaction.fields.getTextInputValue('benefit-detail').trim();
        if (!char || !ucp || !benefitId || !detail)
            return interaction.reply({
                content: '❌ Form belum lengkap. Silakan claim ulang.',
                flags: MessageFlags.Ephemeral,
            });
        return submitClaim(client, interaction, { char, ucp, benefitId, detail });
    }),
};
