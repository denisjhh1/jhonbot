const { MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { drafts, DRAFT_TTL, cut } = require('../../core/bugreport-core');
const { IntError } = require('../../functions');

module.exports = {
    customId: 'modal-bugreport',

    run: async (client, interaction) => {
        const title = interaction.fields.getTextInputValue('bug-title').trim();
        const desc = interaction.fields.getTextInputValue('bug-desc').trim();
        const steps = (interaction.fields.getTextInputValue('bug-steps') ?? '').trim();
        const uploaded = interaction.fields.getUploadedFiles('bug-files');

        const files = [];
        for (const a of uploaded?.values() ?? []) {
            const isImage = a.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(a.name ?? '');
            if (!isImage)
                return IntError(
                    interaction,
                    `File **${a.name}** bukan gambar. Hanya gambar (png/jpg/gif/webp) yang diterima.`,
                );
            files.push({ name: a.name ?? 'image.png', url: a.url });
        }

        drafts.set(interaction.user.id, { title, desc, steps, files, expires: Date.now() + DRAFT_TTL });

        const preview = new EmbedBuilder()
            .setTitle('📝 Konfirmasi Laporan Bug')
            .setDescription(
                'Periksa kembali laporanmu. Setelah dikonfirmasi, channel khusus akan dibuat dan hanya bisa dilihat oleh kamu, Admin, dan Developer.',
            )
            .addFields(
                { name: 'Judul', value: cut(title, 1024) },
                { name: 'Deskripsi', value: cut(desc, 1024) },
                { name: 'Langkah Menemukan BUG', value: steps ? cut(steps, 1024) : '_Tidak diisi_' },
                { name: 'Gambar', value: files.length ? `${files.length} file terlampir` : '_Tidak ada_' },
            )
            .setColor('Orange');
        if (files.length) preview.setImage(files[0].url);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('bug-confirm')
                .setLabel('Kirim Laporan')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId('bug-cancel')
                .setLabel('Batal')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('✖️'),
        );

        return interaction.reply({ embeds: [preview], components: [row], flags: MessageFlags.Ephemeral });
    },
};
