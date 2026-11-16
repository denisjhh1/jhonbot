const {
    MessageFlags,
    ModalBuilder,
    LabelBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
} = require('discord.js');
const { isStaff, categories } = require('../../core/donation-core');

module.exports = {
    customId: 'disc-set',

    run: async (client, interaction) => {
        if (!isStaff(interaction.member))
            return interaction.reply({
                content: 'Hanya staff donasi yang bisa mengatur diskon.',
                flags: MessageFlags.Ephemeral,
            });

        const modal = new ModalBuilder()
            .setCustomId('modal-disc')
            .setTitle('Atur Diskon Donasi')
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Persen Diskon (1-90)')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('disc-percent')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Contoh: 10')
                            .setMinLength(1)
                            .setMaxLength(2)
                            .setRequired(true),
                    ),
                new LabelBuilder()
                    .setLabel('Nama Promo (opsional)')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('disc-label')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Contoh: Promo Akhir Pekan')
                            .setMaxLength(40)
                            .setRequired(false),
                    ),
                new LabelBuilder()
                    .setLabel('Durasi (opsional)')
                    .setDescription('Kosongkan = berlaku sampai dihapus.')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('disc-span')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Contoh: 3 hari / 12 jam / 1 hari 12 jam')
                            .setMaxLength(30)
                            .setRequired(false),
                    ),
                new LabelBuilder()
                    .setLabel('Berlaku untuk kategori')
                    .setDescription('Kosongkan = semua kategori.')
                    .setStringSelectMenuComponent(
                        new StringSelectMenuBuilder()
                            .setCustomId('disc-cats')
                            .setMinValues(0)
                            .setMaxValues(Object.keys(categories).length)
                            .setRequired(false)
                            .addOptions(
                                Object.entries(categories).map(([value, c]) => ({
                                    label: c.label,
                                    value,
                                    emoji: c.emoji,
                                })),
                            ),
                    ),
            );

        await interaction.showModal(modal);
    },
};
