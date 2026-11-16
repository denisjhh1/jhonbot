const { MessageFlags, ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getCat, getItem, drafts, DRAFT_TTL, cut } = require('../../core/donation-core');

module.exports = {
    customId: 'don-item',

    run: async (client, interaction) => {
        const catKey = interaction.customId.split(':')[1];
        if (!getCat(catKey))
            return interaction.reply({ content: 'Kategori tidak dikenal.', flags: MessageFlags.Ephemeral });

        const items = interaction.values.map((id) => getItem(catKey, id)).filter(Boolean);
        if (!items.length)
            return interaction.reply({ content: 'Item tidak ditemukan.', flags: MessageFlags.Ephemeral });

        drafts.set(interaction.user.id, {
            cat: catKey,
            items: items.map((i) => i.id),
            expires: Date.now() + DRAFT_TTL,
        });

        const qtyItems = items.filter((i) => i.qty);
        const hints = items.map((i) => i.detail).filter(Boolean);
        const needDetail = items.some((i) => i.needDetail);

        const modal = new ModalBuilder().setCustomId('modal-don').setTitle('Data Pesanan Donasi');
        modal.addLabelComponents(
            new LabelBuilder()
                .setLabel('Nama Karakter (IC)')
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId('don-ic')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Contoh: John_Doe')
                        .setMaxLength(40)
                        .setRequired(true),
                ),
            new LabelBuilder()
                .setLabel('Nama Akun (UCP)')
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId('don-ucp')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Nama UCP kamu')
                        .setMaxLength(40)
                        .setRequired(true),
                ),
        );

        if (qtyItems.length) {
            const min = Math.max(...qtyItems.map((i) => i.qty.min));
            const max = Math.min(...qtyItems.map((i) => i.qty.max));
            modal.addLabelComponents(
                new LabelBuilder()
                    .setLabel(cut(qtyItems[0].qty.label, 45))
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('don-qty')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder(`Angka ${min} - ${max}`)
                            .setValue(String(min))
                            .setMaxLength(6)
                            .setRequired(true),
                    ),
            );
        }

        modal.addLabelComponents(
            new LabelBuilder().setLabel('Detail Permintaan' + (needDetail ? '' : ' (opsional)')).setTextInputComponent(
                new TextInputBuilder()
                    .setCustomId('don-detail')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder(
                        cut(
                            hints.length ? `Isi: ${[...new Set(hints)].join('; ')}` : 'Catatan untuk staff (opsional)',
                            100,
                        ),
                    )
                    .setMaxLength(1000)
                    .setRequired(needDetail),
            ),
        );

        await interaction.showModal(modal);
    },
};
