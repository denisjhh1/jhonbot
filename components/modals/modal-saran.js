const { MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { CATS, drafts, DRAFT_TTL, cut, isImageName } = require('../../core/suggestion-core');
const { IntError } = require('../../functions');

module.exports = {
    customId: 'modal-saran',

    run: async (client, interaction) => {
        const key = interaction.customId.split(':')[1];
        const cat = CATS[key];
        if (!cat) return IntError(interaction, 'Kategori saran tidak dikenal.');

        const title = interaction.fields.getTextInputValue('saran-title').trim();
        const body = interaction.fields.getTextInputValue('saran-body').trim();
        const extra = (interaction.fields.getTextInputValue('saran-extra') ?? '').trim();
        const uploaded = interaction.fields.getUploadedFiles('saran-files');

        const files = [];
        for (const a of uploaded?.values() ?? []) {
            const isImage = a.contentType?.startsWith('image/') || isImageName(a.name);
            if (!isImage)
                return IntError(
                    interaction,
                    `File **${a.name}** bukan gambar. Hanya gambar (png/jpg/gif/webp) yang diterima.`,
                );
            files.push({ name: a.name ?? 'image.png', url: a.url });
        }

        drafts.set(interaction.user.id, { key, title, body, extra, files, expires: Date.now() + DRAFT_TTL });

        const preview = new EmbedBuilder()
            .setTitle(`📝 Konfirmasi ${cat.label}`)
            .setDescription(
                'Periksa kembali saranmu. Setelah dikirim, saran akan tampil **terbuka** di channel kategorinya dan bisa dilihat serta dikomentari semua warga.',
            )
            .addFields(
                { name: 'Judul', value: cut(title, 1024) },
                { name: 'Isi Saran', value: cut(body, 1024) },
                { name: cat.extraLabel, value: extra ? cut(extra, 1024) : '_Tidak diisi_' },
                { name: 'Gambar', value: files.length ? `${files.length} file terlampir` : '_Tidak ada_' },
            )
            .setColor(cat.color);
        if (files.length) preview.setImage(files[0].url);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('saran-confirm')
                .setLabel('Kirim Saran')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId('saran-cancel')
                .setLabel('Batal')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('✖️'),
        );

        return interaction.reply({ embeds: [preview], components: [row], flags: MessageFlags.Ephemeral });
    },
};
