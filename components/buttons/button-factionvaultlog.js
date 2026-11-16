const { MessageFlags } = require('discord.js');
const { log } = require('../../functions');
const factionVaultLog = require('../../core/factionvaultlog-core');

module.exports = {
    customId: factionVaultLog.PAGE_ID,
    run: async (client, interaction) => {
        try {
            if (!factionVaultLog.canView(interaction.member)) {
                return await interaction.reply({
                    content: '❌ Kamu tidak punya akses untuk melihat log brankas faction.',
                    flags: MessageFlags.Ephemeral,
                });
            }
            const [, encodedFaction, page] = interaction.customId.split(':');
            const factionName = decodeURIComponent(encodedFaction);
            await interaction.update(await factionVaultLog.logPayload(factionName, Number(page)));
        } catch (err) {
            log(err.stack ?? err, 'err');
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Gagal membuka halaman log brankas faction.',
                    flags: MessageFlags.Ephemeral,
                }).catch(() => null);
            }
        }
    },
};
