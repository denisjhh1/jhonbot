const { MessageFlags } = require('discord.js');
const { CATS, drafts, DRAFT_TTL, safe, readModal, previewEmbed, confirmRow } = require('../../core/refund-core');
const { IntError } = require('../../functions');

module.exports = {
    customId: 'refund-modal',
    run: safe(async (client, interaction) => {
        const cat = interaction.customId.split(':')[1];
        if (!CATS[cat]) return;

        const data = readModal(interaction, cat);
        if (data.error) return IntError(interaction, data.error);

        drafts.set(interaction.user.id, {
            cat,
            values: data.values,
            files: data.files,
            expires: Date.now() + DRAFT_TTL,
        });

        return interaction.reply({
            embeds: [previewEmbed(cat, data.values, data.files)],
            components: [confirmRow()],
            flags: MessageFlags.Ephemeral,
        });
    }),
};
