const {
    ButtonInteraction,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const ExtendedClient = require('../../class/Client');
const ms = require('ms');
const timeAccount = ms('0 days');
const ucpDb = require('../../core/ucp-db');
const def = require('../../defines');
const { IntSucces, IntError } = require('../../functions');

module.exports = {
    customId: 'button-register',

    run: async (client, interaction) => {
        const userid = interaction.user.id;
        const createdAt = new Date(interaction.user.createdAt).getTime();
        const detectDays = Date.now() - createdAt;

        if (detectDays < timeAccount)
            return IntError(
                interaction,
                'Umur akun anda tidak mencukupi untuk mendaftar Akun UCP di server Expensive Roleplay!',
            );
        let row;
        try {
            row = await ucpDb.findByDiscord(userid);
        } catch (err) {
            console.error(err);
            return IntError(interaction, 'Terjadi kesalahan saat mengambil data dari database');
        }
        if (!row) {
            const modal = new ModalBuilder()
                .setTitle('Pendaftaran User Control Panel')
                .setCustomId('modal-register')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setLabel('Isi Nama UCP Anda Di Bawah Ini')
                            .setCustomId('reg-name')
                            .setPlaceholder('Nama User Control Panel Anda')
                            .setStyle(TextInputStyle.Short)
                            .setMinLength(4)
                            .setMaxLength(15)
                            .setRequired(true),
                    ),
                );

            return interaction.showModal(modal);
        }
        return IntError(
            interaction,
            `**PENDAFTARAN AKUN | Expensive ROLEPLAY**\n:x: Error!\n\n> Anda sudah pernah mendaftar dengan nama **_${row.ucp}_** dan tidak bisa lagi mengambil tiket\n\n**#ExpensiveRoleplay**\n`,
        );
    },
};
