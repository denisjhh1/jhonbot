const { MessageFlags, ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { canUpdate, suggestNextVersion } = require('../../core/changelog-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'button-changelog',

    run: async (client, interaction) => {
        try {
            if (!canUpdate(interaction)) {
                return interaction.reply({
                    content: '❌ Hanya **Developer** atau **Owner** yang bisa menambahkan changelog.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const modal = new ModalBuilder()
                .setCustomId('modal-changelog')
                .setTitle('Tambah Changelog')
                .addLabelComponents(
                    new LabelBuilder()
                        .setLabel('Versi')
                        .setDescription('Otomatis disarankan. Format: v1.0.0')
                        .setTextInputComponent(
                            new TextInputBuilder()
                                .setCustomId('cl-version')
                                .setStyle(TextInputStyle.Short)
                                .setValue(suggestNextVersion())
                                .setMinLength(5)
                                .setMaxLength(20)
                                .setRequired(true),
                        ),
                    new LabelBuilder()
                        .setLabel('Judul Update')
                        .setTextInputComponent(
                            new TextInputBuilder()
                                .setCustomId('cl-title')
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder('Contoh: Update Sistem Bank & Perbaikan Bug')
                                .setMinLength(3)
                                .setMaxLength(100)
                                .setRequired(true),
                        ),
                    new LabelBuilder()
                        .setLabel('Daftar Perubahan')
                        .setDescription('Satu perubahan per baris.')
                        .setTextInputComponent(
                            new TextInputBuilder()
                                .setCustomId('cl-changes')
                                .setStyle(TextInputStyle.Paragraph)
                                .setPlaceholder(
                                    'Menambahkan fitur ATM baru\nMemperbaiki bug spawn kendaraan\nMengubah harga item di toko',
                                )
                                .setMinLength(5)
                                .setMaxLength(3000)
                                .setRequired(true),
                        ),
                );

            await interaction.showModal(modal);
        } catch (err) {
            log(err.stack ?? err, 'err');
        }
    },
};
