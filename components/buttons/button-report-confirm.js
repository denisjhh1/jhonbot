const { EmbedBuilder } = require('discord.js');
const { drafts, safe, createReport, TYPES } = require('../../core/report-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'report-confirm',
    run: safe(async (client, interaction) => {
        const draft = drafts.get(interaction.user.id);
        if (!draft || draft.expires < Date.now())
            return interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription(
                            '## ⌛ Draft Kedaluwarsa\n> Waktu konfirmasi sudah habis. Silakan klik tombol report di panel untuk membuat laporan lagi.',
                        ),
                ],
                components: [],
            });

        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setColor('Blue')
                    .setDescription(
                        '## ⏳ Mengirim Laporan\n> Sebentar ya, channel privat untuk laporanmu sedang dibuat...',
                    ),
            ],
            components: [],
        });
        drafts.delete(interaction.user.id);

        try {
            const { channel, num } = await createReport(interaction, draft);
            log(`Report ${draft.type} #${num} dibuat oleh ${interaction.user.tag} (${channel.id})`, 'done');
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Green')
                        .setDescription(
                            [
                                `## ✅ Laporan Terkirim!`,
                                `> ${TYPES[draft.type].emoji} **${TYPES[draft.type].label} #${String(num).padStart(4, '0')}** sudah diterima dan dibuka di <#${channel.id}>.`,
                                '',
                                '### 📌 Selanjutnya',
                                '• Tim Admin akan segera meninjau laporanmu',
                                '• Kamu akan mendapat **DM** setiap status berubah',
                                '• Tambahkan bukti lain langsung di channel tiket',
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
                                : `## ❌ Gagal Membuat Laporan\n> Terjadi kendala saat membuat channel laporan. Silakan hubungi staff.\n\n**Penyebab:**\n\`\`\`${String(err.message).slice(0, 800)}\`\`\``,
                        ),
                ],
            });
        }
    }),
};
