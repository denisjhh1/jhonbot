const dc = require('../../core/delchar-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'delchar-back',

    run: async (client, interaction) => {
        try {
            const ucp = await dc.getUcpByDiscord(interaction.user.id);
            const chars = ucp ? await dc.listCharacters(ucp) : null;
            if (!chars?.length) {
                return interaction.update({
                    embeds: [dc.errEmbed('ℹ️ Tidak ada karakter yang bisa ditampilkan.')],
                    components: [],
                });
            }
            return interaction.update(dc.listPayload(ucp, chars));
        } catch (err) {
            log(err.stack ?? String(err), 'err');
            await interaction
                .update({ embeds: [dc.errEmbed('❌ Terjadi kesalahan. Coba lagi sebentar.')], components: [] })
                .catch(() => {});
        }
    },
};
