const { ButtonInteraction } = require('discord.js');
const ExtendedClient = require('../../class/Client');
const def = require('../../defines');
const { IntSucces, IntError } = require('../../functions');
const ucpDb = require('../../core/ucp-db');

module.exports = {
    customId: 'button-reffrole',

    run: async (client, interaction) => {
        const userid = interaction.user.id;

        {
            let row;
            try {
                row = await ucpDb.findByDiscord(userid);
            } catch (err) {
                console.error(err);
                return IntError(interaction, 'Terjadi kesalahan saat mengambil data dari database');
            }

            if (row) {
                const rUCP = await interaction.guild.roles.cache.get(def.idrole.ucp);

                if (!interaction.member.permissions.has('Administrator')) {
                    interaction.member.roles.add(rUCP);
                    interaction.member.setNickname(`Exensive | ${row.ucp}`);
                }

                IntSucces(
                    interaction,
                    `**REFF ROLE | Expensive ROLEPLAY**\n:white_check_mark: **Berhasil!**\n\n> Akun Discord Anda berhasil kami verifikasi sebagai pemain di **Expensive Roleplay**.\n> Mohon untuk tidak keluar lagi dari Discord **Expensive Roleplay**.\n\n**#Expensive Roleplay**`,
                );
            } else {
                IntError(
                    interaction,
                    `**REFF ROLE | Expensive ROLEPLAY**\n:x: **ERROR!** \n\n> Anda belum pernah mendaftar/ambil tiket di **Expensive Roleplay**. Silakan ambil tiket terlebih dahulu.\n\n**#ExpensiveRoleplay**`,
                );
            }
        }
    },
};
