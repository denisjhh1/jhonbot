const { ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const { getPost, MAX_COMMENTS } = require('../../core/suggestion-core');

module.exports = {
    customId: 'saran-comment',

    run: async (client, interaction) => {
        const post = getPost(interaction.message.id);
        if (!post)
            return interaction.reply({ content: 'Data saran ini tidak ditemukan.', flags: MessageFlags.Ephemeral });
        if (post.comments.length >= MAX_COMMENTS)
            return interaction.reply({
                content: `Komentar pada saran ini sudah penuh (${MAX_COMMENTS}).`,
                flags: MessageFlags.Ephemeral,
            });

        const modal = new ModalBuilder()
            .setCustomId(`modal-saran-comment:${interaction.message.id}`)
            .setTitle('Tulis Komentar')
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Komentar')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('comment-text')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Tulis pendapat atau tambahan untuk saran ini.')
                            .setMinLength(2)
                            .setMaxLength(500)
                            .setRequired(true),
                    ),
            );

        await interaction.showModal(modal);
    },
};
