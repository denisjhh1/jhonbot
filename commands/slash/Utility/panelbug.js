const {
    MessageFlags,
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const def = require('../../../defines');

module.exports = {
    structure: new SlashCommandBuilder().setName('panelbug').setDescription('Menampilkan panel Report Bug.'),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        const descriptionText = [
            'Selamat datang di sistem pelaporan kendala teknis Kota **Expensive Roleplay**.',
            '',
            'Apakah kalian menemukan keberadaan *bug*, *glitch*, atau *error* saat sedang berada di kota? Bantu tim developer kami menciptakan pengalaman ber-roleplay yang lebih stabil dan nyaman dengan melaporkannya secara detail.',
            '',
            '📌 **Panduan & Tata Cara Melapor:**',
            '1. Klik tombol **` Report Bug `** berikon 🐞 di bawah ini.',
            '2. Isi formulir dengan jelas (Judul Kendala, Deskripsi Detail, serta Langkah Rekonstruksi Bug).',
            '3. Lampirkan bukti pendukung seperti tautan *screenshot* atau rekaman video (*opsional namun sangat disarankan*).',
            '4. Tekan tombol **Kirim/Submit** untuk memproses laporanmu.',
            '5. Sistem akan otomatis membuatkan **channel tiket khusus** yang sifatnya privat (hanya dapat diakses oleh kamu, Tim Admin, dan Developer).',
            '',
            '⚠️ **Aturan Penting:**',
            '• Dilarang keras melakukan *bug abuse* (memanfaatkan bug untuk keuntungan pribadi/kelompok).',
            '• Jangan melaporkan bug secara terbuka di channel publik untuk menghindari penyalahgunaan oleh pemain lain.',
            '',
            'Terima kasih atas kontribusi dan kepedulian Warga demi kemajuan Expensive Roleplay!',
        ].join('\n');

        const embed = new EmbedBuilder()
            .setTitle('🐞 Expensive Roleplay — Bug Report Panel')
            .setThumbnail(def.icon.thumbnail)
            .setDescription(descriptionText)
            .setColor('Orange')
            .setFooter({
                text: '© 2026 Expensive Roleplay • All Rights Reserved.',
                iconURL: def.icon.thumbnail,
            })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('button-bugreport')
                .setLabel('Report Bug')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🐞'),
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });

        return interaction.reply({
            content: '✅ Panel Report Bug berhasil terpasang!',
            flags: MessageFlags.Ephemeral,
        });
    },
};
