const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const income = require('../../../core/incomelog-core');
const { log } = require('../../../functions');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('laporanharian')
        .setDescription('Kirim ulang laporan pendapatan harian pemain ke channel laporan.')
        .addStringOption((o) =>
            o.setName('tanggal').setDescription('Format YYYY-MM-DD (kosong = hari ini sampai saat ini)'),
        ),
    options: {
        developers: true,
        cooldown: 15000,
    },

    run: async (client, interaction) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const input = interaction.options.getString('tanggal')?.trim();
        if (input && !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
            return interaction.editReply('❌ Format tanggal harus YYYY-MM-DD, contoh: 2026-10-26');
        }
        const key = input || income.dateKey(Date.now());
        try {
            await income.sendReport(client, key);
            return interaction.editReply(`✅ Laporan pendapatan **${key}** terkirim ke <#${income.config.channelId}>.`);
        } catch (e) {
            log(`/laporanharian gagal: ${e.stack ?? e}`, 'err');
            return interaction.editReply(`❌ Gagal mengirim laporan: ${e.message}`);
        }
    },
};
