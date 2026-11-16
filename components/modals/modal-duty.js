const { MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
    drafts,
    DRAFT_TTL,
    cut,
    isImageName,
    parseDuration,
    fmtDur,
    MIN_MINUTES,
    canReport,
} = require('../../core/dutyreport-core');
const { IntError } = require('../../functions');

module.exports = {
    customId: 'modal-duty',

    run: async (client, interaction) => {
        if (!canReport(interaction.member)) return IntError(interaction, 'Panel ini hanya untuk staff/admin.');

        const rank = interaction.fields.getTextInputValue('duty-rank').trim();
        const timeRaw = interaction.fields.getTextInputValue('duty-time').trim();
        const activity = interaction.fields.getTextInputValue('duty-activity').trim();
        const note = (interaction.fields.getTextInputValue('duty-note') ?? '').trim();
        const uploaded = interaction.fields.getUploadedFiles('duty-files');

        const minutes = parseDuration(timeRaw);
        if (!minutes)
            return IntError(
                interaction,
                `Durasi **${cut(timeRaw, 40)}** tidak dikenali. Contoh yang benar: \`2 jam 40 menit\`, \`2j40m\`, \`2:40\`, atau \`90 menit\`.`,
            );

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

        drafts.set(interaction.user.id, { rank, minutes, activity, note, files, expires: Date.now() + DRAFT_TTL });

        const below = minutes < MIN_MINUTES;
        const preview = new EmbedBuilder()
            .setTitle('📝 Konfirmasi Laporan Duty')
            .setDescription(
                'Periksa kembali laporanmu. Setelah dikirim, laporan masuk ke thread dutymu di forum duty-staff.',
            )
            .addFields(
                { name: 'Pangkat', value: cut(rank, 1024), inline: true },
                {
                    name: 'Durasi',
                    value: fmtDur(minutes) + (below ? `\n⚠️ Di bawah minimal ${fmtDur(MIN_MINUTES)}` : ' ✅'),
                    inline: true,
                },
                { name: 'Aktivitas', value: cut(activity, 1024) },
                { name: 'Catatan', value: note ? cut(note, 1024) : '_Tidak diisi_' },
                { name: 'Bukti', value: files.length ? `${files.length} gambar terlampir` : '_Tidak ada_' },
            )
            .setColor(below ? 'Orange' : 'Blue');
        if (files.length) preview.setImage(files[0].url);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('duty-confirm')
                .setLabel('Kirim Laporan')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId('duty-cancel')
                .setLabel('Batal')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('✖️'),
        );

        return interaction.reply({ embeds: [preview], components: [row], flags: MessageFlags.Ephemeral });
    },
};
