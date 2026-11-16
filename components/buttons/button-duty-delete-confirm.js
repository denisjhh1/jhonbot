const { MessageFlags } = require('discord.js');
const { getReport, save, state, canManage } = require('../../core/dutyreport-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'duty-delete-confirm',

    run: async (client, interaction) => {
        const id = interaction.customId.split(':')[1];
        const r = getReport(id);
        if (!r) return interaction.update({ content: 'Laporan ini sudah dihapus.', components: [] });
        if (!canManage(interaction.member, r))
            return interaction.reply({
                content: 'Kamu tidak punya izin menghapus laporan ini.',
                flags: MessageFlags.Ephemeral,
            });

        try {
            await interaction.channel.messages.delete(id);
        } catch (e) {
            if (e.code !== 10008) {
                log(e.stack ?? e, 'err');
                return interaction.update({ content: '❌ Gagal menghapus laporan.', components: [] });
            }
        }
        delete state.reports[id];
        save();
        log(`Laporan duty ${id} dihapus oleh ${interaction.user.tag}`, 'info');
        return interaction.update({ content: '🗑️ Laporan berhasil dihapus.', components: [] });
    },
};
