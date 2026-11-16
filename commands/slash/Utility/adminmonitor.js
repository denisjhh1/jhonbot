const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const adminMonitor = require('../../../adminMonitor');
const { log } = require('../../../functions');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('adminmonitor')
        .setDescription('Kirim laporan keaktifan admin (yang lama tidak login) ke channel khusus.'),
    options: {
        developers: true,
        cooldown: 30000,
    },

    run: async (client, interaction) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const channelId = adminMonitor.config.commandChannelId;

        try {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel || !channel.isTextBased()) {
                return interaction.editReply(`❌ Channel \`${channelId}\` tidak ditemukan atau bot tidak punya akses.`);
            }
            const offline = await adminMonitor.sendReport(client, { channel, force: true });
            return interaction.editReply(
                offline.length
                    ? `✅ Laporan terkirim ke <#${channelId}> (${offline.length} admin tidak aktif).`
                    : `✅ Semua admin aktif. Pemberitahuan dikirim ke <#${channelId}>.`,
            );
        } catch (e) {
            log(`/adminmonitor gagal: ${e.stack ?? e}`, 'err');
            return interaction.editReply(`❌ Gagal membuat laporan: ${e.message}`);
        }
    },
};
