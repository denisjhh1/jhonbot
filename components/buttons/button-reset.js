const { MessageFlags, ButtonInteraction, EmbedBuilder } = require('discord.js');
const ExtendedClient = require('../../class/Client');
const ucpDb = require('../../core/ucp-db');
const { IntSucces, IntError } = require('../../functions');

module.exports = {
    customId: 'button-reset',

    run: async (client, interaction) => {
        try {
            const userId = interaction.user.id;
            const randCode = Math.floor(100000 + Math.random() * 900000);

            const data = await ucpDb.findByDiscord(userId).catch((error) => {
                console.error(error);
                return undefined;
            });

            if (data === undefined)
                return IntError(interaction, ':x: **ERROR**\nTerjadi kesalahan saat mengambil data akun.');

            if (!data) {
                return IntError(interaction, ':x: **ERROR**\nAnda belum pernah mengambil tiket di Expensive ROLEPLAY.');
            }

            const msgEmbed = new EmbedBuilder()
                .setAuthor({ name: 'PEMULIHAN AKUN | Expensive ROLEPLAY' })
                .setDescription(
                    `:warning: **Peringatan!**\nAnda telah meminta reset password.\n\n**Kode Pemulihan**\n\`\`\`${randCode}\`\`\`\nMasuklah ke server dan gunakan kode ini untuk membuat password baru.`,
                )
                .setColor('Green')
                .setFooter({ text: interaction.guild.name })
                .setTimestamp();

            try {
                await interaction.user.send({ embeds: [msgEmbed] });
            } catch (sendError) {
                console.error(sendError);
                return interaction.reply({
                    content: 'Tidak dapat mengirim DM. Silakan aktifkan Direct Message terlebih dahulu.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            await ucpDb.startReset(data.ucp, randCode);

            return IntSucces(
                interaction,
                '**PEMULIHAN AKUN | Expensive ROLEPLAY**\n:white_check_mark: Berhasil! Kode pemulihan telah dikirim ke DM Anda.',
            );
        } catch (error) {
            console.error(error);
            return IntError(interaction, ':x: **ERROR**\nTerjadi kesalahan dalam memproses permintaan.');
        }
    },
};
