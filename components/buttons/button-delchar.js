const { MessageFlags } = require('discord.js');
const dc = require('../../core/delchar-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'button-delchar',

    run: async (client, interaction) => {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const ucp = await dc.getUcpByDiscord(interaction.user.id);
            if (!ucp) {
                return interaction.editReply({
                    embeds: [dc.errEmbed('❌ Kamu belum mendaftarkan akun UCP. Klik **Buat UCP** terlebih dahulu.')],
                });
            }

            const chars = await dc.listCharacters(ucp);
            if (chars === null) {
                return interaction.editReply({
                    embeds: [dc.errEmbed('❌ Fitur ini belum dikonfigurasi dengan benar. Hubungi developer.')],
                });
            }
            if (!chars.length) {
                return interaction.editReply({ embeds: [dc.errEmbed(`ℹ️ UCP **${ucp}** belum memiliki karakter.`)] });
            }

            return interaction.editReply(dc.listPayload(ucp, chars));
        } catch (err) {
            log(err.stack ?? String(err), 'err');
            const msg = {
                embeds: [dc.errEmbed('❌ Terjadi kesalahan saat mengambil data karakter. Coba lagi sebentar.')],
            };
            if (interaction.deferred || interaction.replied) await interaction.editReply(msg).catch(() => {});
            else await interaction.reply({ ...msg, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    },
};
