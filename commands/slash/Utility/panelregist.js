const {
    MessageFlags,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const ExtendedClient = require('../../../class/Client');
const def = require('../../../defines');

const REGIST_BANNER = 'https://i.imgur.com/90k35w6.png';

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panelregist')
        .setDescription('Menampilkan panel registrasi akun UCP.'),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        const msgEmbed = new EmbedBuilder()
            .setAuthor({ name: 'Expensive Roleplay • Management Center', iconURL: def.icon.thumbnail })
            .setTitle('🌐 EXPENSIVE UCP ACCOUNT CENTER')
            .setDescription(
                `Selamat datang! Kelola seluruh kebutuhan akun **UCP (User Control Panel)** kamu secara instan dan mandiri langsung dari panel ini.\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `📝 **BUAT UCP BARU**\n` +
                    `> Belum punya akun? Daftarkan UCP kamu sekarang dan mulailah berpetualang di **Expensive Roleplay**.\n\n` +
                    `🔍 **CEK STATUS & KODE**\n` +
                    `> Pantau progres pendaftaranmu atau minta ulang kode verifikasi yang belum masuk.\n\n` +
                    `🔄 **SINKRONISASI ROLE**\n` +
                    `> Role <@&${def.idrole.ucp}> belum muncul? Klik tombol ini untuk menyinkronkan ulang role Discord kamu.\n\n` +
                    `🔑 **LUPA / RESET PASSWORD**\n` +
                    `> Mengalami masalah login? Atur ulang kata sandi akun UCP kamu dengan aman di sini.\n\n` +
                    `🗑️ **HAPUS KARAKTER**\n` +
                    `> Lihat daftar karakter di UCP kamu dan hapus karakter yang tidak dipakai lagi. Karakter yang sedang *banned* tidak dapat dihapus.\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `⚠️ **PENTING:** *Pastikan fitur Direct Message (DM) Discord kamu aktif agar bot dapat mengirimkan informasi penting secara pribadi.*`,
            )
            .setImage(REGIST_BANNER)
            .setColor('#2B2D31')
            .setFooter({ text: 'Expensive Roleplay • Direct Support & System', iconURL: def.icon.thumbnail });

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Buat UCP')
                .setStyle(ButtonStyle.Success)
                .setCustomId('button-register')
                .setEmoji('📝'),

            new ButtonBuilder()
                .setLabel('Cek Status')
                .setStyle(ButtonStyle.Primary)
                .setCustomId('button-resendcode')
                .setEmoji('🔍'),

            new ButtonBuilder()
                .setLabel('Sync Role')
                .setStyle(ButtonStyle.Secondary)
                .setCustomId('button-reffrole')
                .setEmoji('🔄'),

            new ButtonBuilder()
                .setLabel('Reset Password')
                .setStyle(ButtonStyle.Danger)
                .setCustomId('button-reset')
                .setEmoji('🔑'),

            new ButtonBuilder()
                .setLabel('Hapus Karakter')
                .setStyle(ButtonStyle.Danger)
                .setCustomId('button-delchar')
                .setEmoji('🗑️'),
        );

        await interaction.channel.send({ embeds: [msgEmbed], components: [buttons] });

        return interaction.reply({
            content: '✅ **Berhasil:** Panel registrasi akun berhasil dipasang di channel ini!',
            flags: MessageFlags.Ephemeral,
        });
    },
};
