const {
    MessageFlags,
    ButtonInteraction,
    EmbedBuilder,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const ExtendedClient = require('../../class/Client');
const ucpDb = require('../../core/ucp-db');
const { IntSucces, IntError } = require('../../functions');

module.exports = {
    customId: 'button-resendcode',

    run: async (client, interaction) => {
        const userid = interaction.user.id;
        {
            let row;
            try {
                row = await ucpDb.findByDiscord(userid);
            } catch (error) {
                console.error(error);
                return IntError(interaction, 'Terjadi kesalahan saat mengambil data dari database');
            }

            if (row) {
                const verified = ucpDb.isVerified(row);
                const msgEmbed = new EmbedBuilder()
                    .setAuthor({ name: 'CEK AKUN | EXPENSIVE ROLEPLAY' })
                    .setDescription(
                        `:white_check_mark: **Berhasil!**\nBerikut adalah detail dari akun UCP Anda:\n\n**Nama UCP**\n${row.ucp}\n\n**Kode Verifikasi**\n${verified ? 'Sudah terverifikasi (tidak ada kode lagi). Gunakan tombol Reset Password jika lupa password.' : row.verifycode}\n\n**Pemilik Akun**\nUser ID: **${userid}**\nUsername Discord: **${interaction.user.tag}**\n\n**Status**\n${verified ? 'Terverifikasi' : 'Menunggu verifikasi di dalam game'}\n\n**Catatan**\nJangan beritahu informasi ini kepada orang lain!`,
                    )
                    .setColor('Green')
                    .setFooter({ text: interaction.guild.name })
                    .setTimestamp();

                await interaction.user.send({ embeds: [msgEmbed] }).catch((error) => {
                    return interaction.reply({
                        content:
                            'Tidak dapat mengirimkan kode/pin verifikasi akun UCP Anda. Silakan gunakan command /resendcode setelah membuka Direct Message di pengaturan Discord Anda.',
                        flags: MessageFlags.Ephemeral,
                    });
                });

                IntSucces(
                    interaction,
                    `**CEK AKUN | Expensive ROLEPLAY**\n:white_check_mark: Berhasil!\nKami telah mengirimkan DM kepada Anda. Silakan cek pesan tersebut.`,
                );
            } else {
                return IntError(
                    interaction,
                    `**CEK AKUN | Expensive ROLEPLAY**\n:x: **ERROR!**\nAnda belum pernah mengambil tiket di kota Expensive ROLEPLAY. Silakan daftar dengan mengambil tiket.`,
                );
            }
        }
    },
};
