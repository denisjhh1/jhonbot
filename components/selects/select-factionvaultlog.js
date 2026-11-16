const { MessageFlags } = require('discord.js');
const { log } = require('../../functions');
const factionVaultLog = require('../../core/factionvaultlog-core');

module.exports = {
    customId: factionVaultLog.SELECT_ID,
    run: async (client, interaction) => {
        try {
            if (!factionVaultLog.canView(interaction.member)) {
                return await interaction.reply({
                    content: '❌ Kamu tidak punya akses untuk melihat log brankas faction.',
                    flags: MessageFlags.Ephemeral,
                });
            }
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            await interaction.editReply(await factionVaultLog.logPayload(interaction.values[0], 0));
        } catch (err) {
            log(err.stack ?? err, 'err');
            const payload = {
                content: '❌ Gagal membaca log brankas faction. Periksa tabel `faction_vaultlogs` dan konfigurasi database.',
                embeds: [],
                components: [],
            };
            if (interaction.deferred || interaction.replied)
                await interaction.editReply(payload).catch(() => null);
            else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => null);
        }
    },
};
