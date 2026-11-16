const { MessageFlags, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ExtendedClient = require('../../class/Client');
const ucpDb = require('../../core/ucp-db');
const def = require('../../defines');
const { IntSucces, IntError } = require('../../functions');
const analytics = require('../../core/analytics-core');

module.exports = {
    customId: 'modal-register',

    run: async (client, interaction) => {
        const userid = interaction.user.id;
        const inputName = interaction.fields.getTextInputValue('reg-name').trim();
        const randCode = Math.floor(100000 + Math.random() * 900000);

        if (inputName.includes('_'))
            return IntError(interaction, 'Nama akun User Control Panel tidak boleh mengandung simbol "_"');
        if (inputName.includes(' '))
            return IntError(interaction, 'Nama akun User Control Panel tidak boleh mengandung spasi');
        if (!/^[a-z]+$/i.test(inputName))
            return IntError(interaction, 'Nama akun User Control Panel tidak boleh mengandung simbol atau angka!');

        try {
            const exist = await ucpDb.findExisting(inputName, userid);

            if (exist.length > 0) {
                if (exist.some((r) => String(r.DiscordID) === userid)) {
                    return IntError(
                        interaction,
                        'Akun Discord Anda sudah pernah mendaftar UCP di **Expensive Roleplay**.',
                    );
                }
                return IntError(
                    interaction,
                    'Maaf, nama akun yang Anda input telah terdaftar. Silakan coba nama akun yang lain!',
                );
            }

            await ucpDb.register(inputName, randCode, userid);
            analytics.trackRegistration();
        } catch (err) {
            console.error('[BOT ERROR] Gagal register UCP ke database:', err);
            return IntError(interaction, 'Terjadi kesalahan saat menyimpan data UCP. Silakan hubungi developer.');
        }

        const msgEmbed = new EmbedBuilder()
            .setAuthor({ name: 'PENGAMBILAN TIKET UCP | Expensive ROLEPLAY', iconURL: def.icon.thumbnail })
            .setDescription(
                `Yang terhormat, **${inputName}**,\n\nPengambilan Tiket berhasil. Gunakan UCP untuk login ke dalam server! Masuklah ke dalam server dan masukkan kode verifikasi di bawah!\n\n**UCP**: ${inputName}\n\n**Kode Verifikasi**: ${randCode}\n\n**Waktu Pendaftaran**: <t:${Math.round(Date.now() / 1000)}:R>`,
            )
            .setColor('Green')
            .setImage(def.icon.image)
            .setFooter({ text: interaction.guild.name })
            .setTimestamp();

        let dmOk = true;
        await interaction.user.send({ embeds: [msgEmbed] }).catch(() => {
            dmOk = false;
        });

        console.log(
            `[BOT]: User (${interaction.user.tag}) berhasil mendaftarkan akun UCP dengan nama (${inputName}) dan pin (${randCode})`,
        );

        const note = dmOk
            ? '> Pendaftaran akun UCP berhasil, silakan buka DM dari bot Expensive ROLEPLAY!'
            : '> Pendaftaran akun UCP berhasil, tetapi DM Anda tertutup. Buka DM lalu gunakan tombol **Resend Code** untuk menerima kode verifikasi.';
        await IntSucces(
            interaction,
            `**PENGAMBILAN TIKET UCP | Expensive ROLEPLAY**\n:white_check_mark: **Berhasil!**\n\n${note}\n\n**#ExpensiveRoleplay**`,
        );

        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                const rUCP = interaction.guild.roles.cache.get(def.idrole.ucp);
                if (rUCP) await interaction.member.roles.add(rUCP);
                await interaction.member.setNickname(`Exensive | ${inputName}`);
            }
        } catch (err) {
            console.error('[BOT ERROR] Gagal set role/nickname:', err.message);
        }
    },
};
