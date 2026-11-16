const { MessageFlags } = require('discord.js');
const asset = require('../../core/asset-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'aset-view',

    run: async (client, interaction) => {
        try {
            await interaction.deferUpdate();
            const pID = Number(interaction.customId.split(':')[1]);
            return interaction.editReply(await asset.handleView(interaction, pID, interaction.values[0]));
        } catch (err) {
            log(err.stack ?? String(err), 'err');
            await interaction
                .followUp({ content: '❌ Terjadi kesalahan. Coba lagi sebentar.', flags: MessageFlags.Ephemeral })
                .catch(() => {});
        }
    },
};
