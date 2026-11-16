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
    structure: new SlashCommandBuilder().setName('paneldonasi').setDescription('Menampilkan panel Donasi resmi.'),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        const name = interaction.guild.name;
        const guildIcon = interaction.guild.iconURL({ dynamic: true }) ?? def.icon?.thumbnail;

        const description = [
            `### 💳 DUKUNG & Dapatkan Fitur Eksklusif ${name.toUpperCase()}`,
            `Dukungan donasimu sangat berharga untuk keberlangsungan dan perkembangan server. Seluruh transaksi dilakukan secara otomatis dan aman melalui satu panel ini.\n`,
            `🛒 **PANDUAN PEMESANAN:**`,
            `> 1️⃣ Klik tombol **Beli Donasi** lalu pilih kategori & item yang diinginkan.`,
            `> 2️⃣ Lengkapi data (Nama Karakter, Nama UCP, & Detail Permintaan).`,
            `> 3️⃣ Periksa pratinjau lalu klik **Kirim Pesanan**. Bot akan membuat **Tiket Privat** otomatis.`,
            `> 4️⃣ Lakukan pembayaran via **QRIS** yang tertera di dalam tiket, upload bukti, lalu tekan **Saya Sudah Bayar**.`,
            `> 5️⃣ Staff akan memverifikasi dan memproses pesananmu segera di dalam tiket tersebut.\n`,
            `📌 **FITUR PANEL:**`,
            `> 📖 **Lihat Katalog** — Cek daftar harga, paket VIP, dan detail benefit.`,
            `> 🧾 **Pesanan Saya** — Cek status & riwayat pesanan aktifmu.\n`,
            `🚨 **PERATURAN & PERIHAL KESEHATAN KEUANGAN (PENTING):**`,
            `> • Pembayaran **HANYA** melalui QRIS resmi di dalam tiket privat bot.`,
            `> • Transaksi di luar tiket (DM Staff/Orang Lain) adalah **PENIPUAN**. Staff tidak pernah meminta password / data sensitif.`,
            `> • Harga dapat berubah sewaktu-waktu. Penyalahgunaan item donasi dapat berujung pencabutan tanpa pengembalian dana (No Refund).`,
        ].join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`💎 ${name} — Official Donation Center`)
            .setThumbnail(guildIcon)
            .setDescription(description)
            .setColor('#FFD700')
            .setFooter({ text: `Management Server • Donation Support © 2026`, iconURL: guildIcon })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('don-buy')
                .setLabel('Beli Donasi')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🛒'),
            new ButtonBuilder()
                .setCustomId('don-catalog')
                .setLabel('Lihat Katalog')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📖'),
            new ButtonBuilder()
                .setCustomId('don-orders')
                .setLabel('Pesanan Saya')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🧾'),
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        return interaction.reply({
            content: '✅ Panel Donasi berhasil terpasang dengan tampilan baru!',
            flags: MessageFlags.Ephemeral,
        });
    },
};
