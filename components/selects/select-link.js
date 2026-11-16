const { MessageFlags } = require('discord.js');
const { getLink, linkPayload, selectRow } = require('../../core/link-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'link-select',

    run: async (client, interaction) => {
        try {
            const l = getLink(interaction.values[0]);
            if (!l) return interaction.reply({ content: 'Pilihan tidak dikenal.', flags: MessageFlags.Ephemeral });

            await interaction.reply(linkPayload(l));

            await interaction.message.edit({ components: [selectRow()] }).catch(() => {});
        } catch (err) {
            log(err.stack ?? String(err), 'err');
            const msg = { content: '❌ Terjadi kesalahan. Coba lagi sebentar.', flags: MessageFlags.Ephemeral };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
            else await interaction.reply(msg).catch(() => {});
        }
    },
};
