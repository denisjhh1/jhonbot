const { MessageFlags } = require('discord.js');
const { TYPES, drafts, DRAFT_TTL, safe, readModal, previewEmbed, confirmRow } = require('../../core/report-core');
const { IntError } = require('../../functions');

module.exports = {
    customId: 'report-modal',
    run: safe(async (client, interaction) => {
        const type = interaction.customId.split(':')[1];
        if (!TYPES[type]) return;

        const data = readModal(interaction, type);
        if (data.error) return IntError(interaction, data.error);

        drafts.set(interaction.user.id, {
            type,
            values: data.values,
            files: data.files,
            expires: Date.now() + DRAFT_TTL,
        });

        return interaction.reply({
            embeds: [previewEmbed(type, data.values, data.files)],
            components: [confirmRow()],
            flags: MessageFlags.Ephemeral,
        });
    }),
};
