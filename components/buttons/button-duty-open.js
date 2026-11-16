const {
    ModalBuilder,
    LabelBuilder,
    TextInputBuilder,
    TextInputStyle,
    FileUploadBuilder,
    MessageFlags,
} = require('discord.js');
const {
    state,
    canReport,
    lastReport,
    REPORT_COOLDOWN,
    REQUIRE_PROOF,
    MIN_MINUTES,
    MAX_IMAGES,
    fmtDur,
} = require('../../core/dutyreport-core');

module.exports = {
    customId: 'duty-open',

    run: async (client, interaction) => {
        if (!canReport(interaction.member))
            return interaction.reply({ content: 'Panel ini hanya untuk staff/admin.', flags: MessageFlags.Ephemeral });

        const wait = REPORT_COOLDOWN - (Date.now() - (lastReport.get(interaction.user.id) ?? 0));
        if (wait > 0)
            return interaction.reply({
                content: `⏳ Tunggu ${Math.ceil(wait / 1000)} detik lagi sebelum mengirim laporan berikutnya.`,
                flags: MessageFlags.Ephemeral,
            });

        const rank = new TextInputBuilder()
            .setCustomId('duty-rank')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Contoh: Management')
            .setMaxLength(50)
            .setRequired(true);
        const lastRank = state.lastRank[interaction.user.id];
        if (lastRank) rank.setValue(lastRank);

        const modal = new ModalBuilder()
            .setCustomId('modal-duty')
            .setTitle('Laporan Duty Staff')
            .addLabelComponents(
                new LabelBuilder().setLabel('Pangkat').setTextInputComponent(rank),
                new LabelBuilder()
                    .setLabel('Durasi Duty')
                    .setDescription(`Minimal ${fmtDur(MIN_MINUTES)}.`)
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('duty-time')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Contoh: 2 jam 40 menit')
                            .setMaxLength(30)
                            .setRequired(true),
                    ),
                new LabelBuilder()
                    .setLabel('Aktivitas')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('duty-activity')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Apa saja yang kamu kerjakan saat duty.')
                            .setMinLength(10)
                            .setMaxLength(1500)
                            .setRequired(true),
                    ),
                new LabelBuilder()
                    .setLabel('Catatan (opsional)')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('duty-note')
                            .setStyle(TextInputStyle.Paragraph)
                            .setMaxLength(500)
                            .setRequired(false),
                    ),
                new LabelBuilder()
                    .setLabel(REQUIRE_PROOF ? 'Bukti Screenshot' : 'Bukti Screenshot (opsional)')
                    .setDescription(`Maksimal ${MAX_IMAGES} gambar.`)
                    .setFileUploadComponent(
                        new FileUploadBuilder()
                            .setCustomId('duty-files')
                            .setMinValues(REQUIRE_PROOF ? 1 : 0)
                            .setMaxValues(MAX_IMAGES)
                            .setRequired(REQUIRE_PROOF),
                    ),
            );

        await interaction.showModal(modal);
    },
};
