const { ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const { CATS, getPost, canManage } = require('../../core/suggestion-core');

module.exports = {
    customId: 'saran-edit',

    run: async (client, interaction) => {
        const post = getPost(interaction.message.id);
        if (!post)
            return interaction.reply({ content: 'Data saran ini tidak ditemukan.', flags: MessageFlags.Ephemeral });
        if (!canManage(interaction.member, post))
            return interaction.reply({
                content: 'Hanya pengusul, Admin, atau Developer yang bisa mengedit saran ini.',
                flags: MessageFlags.Ephemeral,
            });

        const cat = CATS[post.category];
        const input = (id, style, min, max, required, value) => {
            const t = new TextInputBuilder().setCustomId(id).setStyle(style).setMaxLength(max).setRequired(required);
            if (min) t.setMinLength(min);
            if (value) t.setValue(value);
            return t;
        };

        const modal = new ModalBuilder()
            .setCustomId(`modal-saran-edit:${interaction.message.id}`)
            .setTitle('Edit Saran')
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Judul Saran')
                    .setTextInputComponent(input('saran-title', TextInputStyle.Short, 5, 100, true, post.title)),
                new LabelBuilder()
                    .setLabel('Isi Saran')
                    .setTextInputComponent(input('saran-body', TextInputStyle.Paragraph, 15, 1500, true, post.body)),
                new LabelBuilder()
                    .setLabel(cat.extraLabel)
                    .setTextInputComponent(input('saran-extra', TextInputStyle.Paragraph, 0, 1000, false, post.extra)),
            );

        await interaction.showModal(modal);
    },
};
