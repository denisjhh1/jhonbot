const {
    ModalBuilder,
    LabelBuilder,
    TextInputBuilder,
    TextInputStyle,
    FileUploadBuilder,
    MessageFlags,
} = require('discord.js');
const { CATS, lastPost, POST_COOLDOWN } = require('../../core/suggestion-core');

module.exports = {
    customId: 'saran-open',

    run: async (client, interaction) => {
        const key = interaction.customId.split(':')[1];
        const cat = CATS[key];
        if (!cat) return interaction.reply({ content: 'Kategori saran tidak dikenal.', flags: MessageFlags.Ephemeral });

        const wait = POST_COOLDOWN - (Date.now() - (lastPost.get(interaction.user.id) ?? 0));
        if (wait > 0)
            return interaction.reply({
                content: `⏳ Tunggu ${Math.ceil(wait / 1000)} detik lagi sebelum mengirim saran berikutnya.`,
                flags: MessageFlags.Ephemeral,
            });

        const modal = new ModalBuilder()
            .setCustomId(`modal-saran:${key}`)
            .setTitle(cat.label)
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Judul Saran')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('saran-title')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder(cat.titlePh)
                            .setMinLength(5)
                            .setMaxLength(100)
                            .setRequired(true),
                    ),
                new LabelBuilder()
                    .setLabel('Isi Saran')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('saran-body')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder(cat.bodyPh)
                            .setMinLength(15)
                            .setMaxLength(1500)
                            .setRequired(true),
                    ),
                new LabelBuilder()
                    .setLabel(cat.extraLabel)
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('saran-extra')
                            .setStyle(TextInputStyle.Paragraph)
                            .setMaxLength(1000)
                            .setRequired(false),
                    ),
                new LabelBuilder()
                    .setLabel('Gambar Pendukung (opsional)')
                    .setDescription('Maksimal 5 file gambar.')
                    .setFileUploadComponent(
                        new FileUploadBuilder()
                            .setCustomId('saran-files')
                            .setMinValues(0)
                            .setMaxValues(5)
                            .setRequired(false),
                    ),
            );

        await interaction.showModal(modal);
    },
};
