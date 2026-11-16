const { MessageFlags } = require('discord.js');
const asset = require('../../core/asset-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'modal-aset',

    run: async (client, interaction) => {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const name = interaction.fields.getTextInputValue(asset.NAME_INPUT);
            return interaction.editReply(await asset.handleLookup(interaction, name));
        } catch (err) {
            log(err.stack ?? String(err), 'err');
            const msg = {
                embeds: [asset.errEmbed('❌ Terjadi kesalahan saat mengambil data aset. Coba lagi sebentar.')],
            };
            if (interaction.deferred || interaction.replied) await interaction.editReply(msg).catch(() => {});
            else await interaction.reply({ ...msg, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    },
};
