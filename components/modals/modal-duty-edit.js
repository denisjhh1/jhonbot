const { MessageFlags } = require('discord.js');
const { getReport, save, render, canManage, parseDuration, cut } = require('../../core/dutyreport-core');
const { IntError, log } = require('../../functions');

module.exports = {
    customId: 'modal-duty-edit',

    run: async (client, interaction) => {
        const id = interaction.customId.split(':')[1];
        const r = getReport(id);
        if (!r) return IntError(interaction, 'Data laporan ini tidak ditemukan.');
        if (!canManage(interaction.member, r))
            return IntError(interaction, 'Hanya pemilik laporan atau Management yang bisa mengedit.');

        const timeRaw = interaction.fields.getTextInputValue('duty-time').trim();
        const minutes = parseDuration(timeRaw);
        if (!minutes)
            return IntError(
                interaction,
                `Durasi **${cut(timeRaw, 40)}** tidak dikenali. Contoh: \`2 jam 40 menit\`, \`2j40m\`, \`2:40\`.`,
            );

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        r.rank = interaction.fields.getTextInputValue('duty-rank').trim();
        r.minutes = minutes;
        r.activity = interaction.fields.getTextInputValue('duty-activity').trim();
        r.note = (interaction.fields.getTextInputValue('duty-note') ?? '').trim();
        r.edited = true;
        r.approvedBy = null;
        save();

        try {
            const msg = await interaction.channel.messages.fetch(id);
            await msg.edit({ ...render(r), allowedMentions: { parse: [] } });
            await interaction.editReply('✅ Laporan berhasil diedit. Status persetujuan direset untuk ditinjau ulang.');
        } catch (e) {
            log(e.stack ?? e, 'err');
            await interaction.editReply('❌ Perubahan tersimpan, tapi gagal memperbarui tampilan laporan.');
        }
    },
};
