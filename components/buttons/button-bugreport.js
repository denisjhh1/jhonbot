const { ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, FileUploadBuilder } = require('discord.js');

module.exports = {
    customId: 'button-bugreport',

    run: async (client, interaction) => {
        const modal = new ModalBuilder()
            .setCustomId('modal-bugreport')
            .setTitle('Laporkan Bug')
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Judul Bug')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('bug-title')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Contoh: Tidak bisa masuk rumah setelah respawn')
                            .setMinLength(5)
                            .setMaxLength(100)
                            .setRequired(true),
                    ),
                new LabelBuilder()
                    .setLabel('Deskripsi Bug')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('bug-desc')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Jelaskan apa yang terjadi dan apa yang seharusnya terjadi.')
                            .setMinLength(15)
                            .setMaxLength(1500)
                            .setRequired(true),
                    ),
                new LabelBuilder()
                    .setLabel('Langkah Menemukan BUG (opsional)')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('bug-steps')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('1. Pergi ke ...\n2. Tekan ...\n3. Bug muncul')
                            .setMaxLength(1000)
                            .setRequired(false),
                    ),
                new LabelBuilder()
                    .setLabel('Screenshot / Bukti (opsional)')
                    .setDescription('Maksimal 5 file gambar.')
                    .setFileUploadComponent(
                        new FileUploadBuilder()
                            .setCustomId('bug-files')
                            .setMinValues(0)
                            .setMaxValues(5)
                            .setRequired(false),
                    ),
            );

        await interaction.showModal(modal);
    },
};
