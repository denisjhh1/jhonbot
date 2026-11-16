const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const {
    drafts,
    DRAFT_TTL,
    getItem,
    buildLines,
    orderTotal,
    lineText,
    rupiah,
    cut,
    getCat,
} = require('../../core/donation-core');
const { IntError } = require('../../functions');

module.exports = {
    customId: 'modal-don',

    run: async (client, interaction) => {
        const draft = drafts.get(interaction.user.id);
        if (!draft || draft.expires < Date.now())
            return IntError(interaction, '⌛ Sesi pemesanan sudah kedaluwarsa. Klik **Beli Donasi** lagi.');

        const items = draft.items.map((id) => getItem(draft.cat, id)).filter(Boolean);
        const qtyItems = items.filter((i) => i.qty);

        draft.ic = interaction.fields.getTextInputValue('don-ic').trim();
        draft.ucp = interaction.fields.getTextInputValue('don-ucp').trim();
        draft.detail = (interaction.fields.getTextInputValue('don-detail') ?? '').trim();
        draft.qty = 1;

        if (qtyItems.length) {
            const raw = interaction.fields.getTextInputValue('don-qty').trim();
            const min = Math.max(...qtyItems.map((i) => i.qty.min));
            const max = Math.min(...qtyItems.map((i) => i.qty.max));
            const n = /^\d+$/.test(raw) ? parseInt(raw, 10) : NaN;
            if (!(n >= min && n <= max))
                return IntError(interaction, `Jumlah harus berupa angka antara **${min}** dan **${max}**.`);
            draft.qty = n;
        }
        draft.expires = Date.now() + DRAFT_TTL;

        const lines = buildLines(draft);
        draft.lines = lines;
        const total = orderTotal(lines);
        const cat = getCat(draft.cat);

        const preview = new EmbedBuilder()
            .setTitle(`📝 Konfirmasi Pesanan — ${cat.emoji} ${cat.label}`)
            .setDescription(lines.map(lineText).join('\n'))
            .addFields(
                { name: 'Karakter (IC)', value: cut(draft.ic, 100), inline: true },
                { name: 'Akun (UCP)', value: cut(draft.ucp, 100), inline: true },
                {
                    name: 'Total',
                    value:
                        total == null
                            ? 'Ditentukan staff di tiket'
                            : `**${rupiah(total)}**${lines.some((l) => l.pct) ? '\n🏷️ sudah termasuk diskon' : ''}`,
                    inline: true,
                },
                { name: 'Detail Permintaan', value: draft.detail ? cut(draft.detail, 1024) : '_Tidak diisi_' },
            )
            .setFooter({ text: 'Setelah dikirim, tiket privat dibuat dan kamu akan diarahkan membayar via QRIS.' })
            .setColor('Gold');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('don-submit')
                .setLabel('Kirim Pesanan')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId('don-cancel')
                .setLabel('Batal')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('✖️'),
        );

        const payload = { embeds: [preview], components: [row] };
        if (interaction.isFromMessage?.()) return interaction.update(payload);
        return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    },
};
