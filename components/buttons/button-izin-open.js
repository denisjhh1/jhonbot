const { safe, canRequest, requestModal, reply, openRequestFor, pad, cfg } = require('../../core/izin-core');

module.exports = {
    customId: 'izin-open',
    run: safe(async (client, interaction) => {
        if (!cfg.open) return reply(interaction, '🔒 Pengajuan izin sedang ditutup sementara.');
        if (!canRequest(interaction.member))
            return reply(interaction, '🔒 **Khusus staff/admin.** Panel ini hanya untuk tim admin.');

        const existing = openRequestFor(interaction.user.id);
        if (existing) {
            const info =
                existing.status === 'pending'
                    ? `pengajuan **#${pad(existing.num)}** masih menunggu keputusan`
                    : `izin **#${pad(existing.num)}** masih aktif sampai <t:${existing.endAt}:F>`;
            return reply(interaction, `⚠️ Kamu belum bisa mengajukan izin baru karena ${info}.`);
        }

        await interaction.showModal(requestModal());
    }),
};
