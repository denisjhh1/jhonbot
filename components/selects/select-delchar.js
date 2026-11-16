const dc = require('../../core/delchar-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'delchar-select',

    run: async (client, interaction) => {
        try {
            const ucp = await dc.getUcpByDiscord(interaction.user.id);
            const char = ucp ? await dc.getOwnedCharacter(ucp, interaction.values[0]) : null;
            if (!char) {
                return interaction.update({
                    embeds: [dc.errEmbed('❌ Karakter tidak ditemukan atau bukan milik UCP kamu.')],
                    components: [],
                });
            }
            if (char.banned) return interaction.update(dc.bannedPayload(char));
            return interaction.update(dc.confirmPayload(char));
        } catch (err) {
            log(err.stack ?? String(err), 'err');
            await interaction
                .update({ embeds: [dc.errEmbed('❌ Terjadi kesalahan. Coba lagi sebentar.')], components: [] })
                .catch(() => {});
        }
    },
};
