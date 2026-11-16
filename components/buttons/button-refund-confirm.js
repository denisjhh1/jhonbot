const { EmbedBuilder } = require('discord.js');
const { drafts, safe, createRefund, CATS } = require('../../core/refund-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'refund-confirm',
    run: safe(async (client, interaction) => {
        const draft = drafts.get(interaction.user.id);
        if (!draft || draft.expires < Date.now())
            return interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription(
                            '## ⌛ Draft Kedaluwarsa\n> Waktu konfirmasi sudah habis. Klik **Ajukan Refund** di panel untuk mengisi ulang.',
                        ),
                ],
                components: [],
            });

        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setColor('Blue')
                    .setDescription(
                        '## ⏳ Mengirim Pengajuan\n> Sebentar ya, channel privat untuk pengajuanmu sedang dibuat...',
                    ),
            ],
            components: [],
        });
        drafts.delete(interaction.user.id);

        try {
            const { channel, num } = await createRefund(interaction, draft);
            log(`Refund ${draft.cat} #${num} dibuat oleh ${interaction.user.tag} (${channel.id})`, 'done');
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Green')
                        .setDescription(
                            [
                                '## ✅ Pengajuan Terkirim!',
                                `> ${CATS[draft.cat].emoji} **Refund ${CATS[draft.cat].label} #${String(num).padStart(4, '0')}** sudah diterima dan dibuka di <#${channel.id}>.`,
                                '',
                                '### 📌 Selanjutnya',
                                '• Tim Admin akan memeriksa pengajuanmu',
                                '• Kamu mendapat **DM** setiap status berubah',
                                '• Bukti tambahan bisa dikirim langsung di channel tiket',
                                '• Pantau lewat tombol **📋 Status Refund Saya** di panel',
                            ].join('\n'),
                        ),
                ],
            });
        } catch (err) {
            if (!err.known) log(err.stack ?? err, 'err');
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription(
                            err.known
                                ? `## ❌ Belum Bisa Dikirim\n${err.message}`
                                : `## ❌ Gagal Membuat Pengajuan\n> Terjadi kendala saat membuat channel. Silakan hubungi staff.\n\n**Penyebab:**\n\`\`\`${String(err.message).slice(0, 800)}\`\`\``,
                        ),
                ],
            });
        }
    }),
};
