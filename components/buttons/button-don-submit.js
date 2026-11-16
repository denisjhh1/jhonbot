const { EmbedBuilder } = require('discord.js');
const { drafts, createOrder } = require('../../core/donation-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'don-submit',

    run: async (client, interaction) => {
        const draft = drafts.get(interaction.user.id);
        if (!draft || draft.expires < Date.now() || !draft.ic)
            return interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription('⌛ Sesi pemesanan sudah kedaluwarsa. Klik **Beli Donasi** lagi.'),
                ],
                components: [],
            });

        await interaction.update({
            embeds: [new EmbedBuilder().setColor('Blue').setDescription('⏳ Membuat tiket pesanan...')],
            components: [],
        });
        drafts.delete(interaction.user.id);

        try {
            const { channel, order } = await createOrder(interaction, draft);
            log(`Pesanan donasi #${order.num} dibuat oleh ${interaction.user.tag} (${channel.id})`, 'done');
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Green')
                        .setDescription(
                            `✅ Pesanan **#${String(order.num).padStart(4, '0')}** dibuat di <#${channel.id}>.\nBuka tiket itu untuk membayar via QRIS dan berbincang dengan staff.`,
                        ),
                ],
            });
        } catch (err) {
            log(err.stack ?? err, 'err');
            const known = err.message?.startsWith('Kamu masih');
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription(
                            known
                                ? `❌ ${err.message}`
                                : `❌ Gagal membuat tiket pesanan.\n\n**Penyebab:**\n\`\`\`${String(err.message).slice(0, 800)}\`\`\``,
                        ),
                ],
            });
        }
    },
};
