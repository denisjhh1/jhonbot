const dc = require('../../core/delchar-core');
const { EmbedBuilder } = require('discord.js');
const { log } = require('../../functions');

module.exports = {
    customId: 'delchar-confirm',

    run: async (client, interaction) => {
        try {
            await interaction.deferUpdate();

            const charId = interaction.customId.split(':')[1];
            const ucp = await dc.getUcpByDiscord(interaction.user.id);

            const char = ucp ? await dc.getOwnedCharacter(ucp, charId) : null;
            if (!char) {
                return interaction.editReply({
                    embeds: [
                        dc.errEmbed('❌ Karakter tidak ditemukan (mungkin sudah dihapus) atau bukan milik UCP kamu.'),
                    ],
                    components: [],
                });
            }

            if (char.banned) return interaction.editReply(dc.bannedPayload(char));

            if (await dc.isCharacterOnline(char.name)) {
                return interaction.editReply({
                    embeds: [
                        dc.errEmbed(
                            `❌ Karakter **${char.name}** sedang online di server. Keluar dari game terlebih dahulu, lalu coba lagi.`,
                        ),
                    ],
                    components: [],
                });
            }

            const s = await dc.getSchema();
            if (!s) {
                return interaction.editReply({
                    embeds: [dc.errEmbed('❌ Fitur ini belum dikonfigurasi dengan benar. Hubungi developer.')],
                    components: [],
                });
            }
            await dc.deleteCharacter(ucp, char, s);
            dc.sendLog(client, interaction.user, ucp, char);

            const left = (await dc.listCharacters(ucp))?.length ?? 0;
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Green')
                        .setTitle('✅ KARAKTER DIHAPUS')
                        .setDescription(
                            `Karakter **${char.name.replace(/_/g, ' ')}** berhasil dihapus.\nSisa karakter di UCP **${ucp}**: **${left}**.`,
                        ),
                ],
                components: [],
            });
        } catch (err) {
            log(err.stack ?? String(err), 'err');
            await interaction
                .editReply({
                    embeds: [
                        dc.errEmbed(
                            '❌ Gagal menghapus karakter. Tidak ada data yang berubah, coba lagi atau hubungi developer.',
                        ),
                    ],
                    components: [],
                })
                .catch(() => {});
        }
    },
};
