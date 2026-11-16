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
    structure: new SlashCommandBuilder()
        .setName('paneldiskon')
        .setDescription('Menampilkan panel pengaturan diskon donasi (Khusus Staff).'),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        const name = interaction.guild.name;
        const guildIcon = interaction.guild.iconURL({ dynamic: true }) ?? def.icon?.thumbnail;

        const description = [
            `### 🏷️ PUSAT KONTROL DISKON DONASI`,
            `Gunakan panel eksklusif ini untuk mengatur promo atau potongan harga donasi secara praktis tanpa harus mengubah kode script bot.\n`,
            `⚙️ **FITUR PENGATURAN DISKON:**`,
            `> 🏷️ **Atur Diskon** — Masukkan persentase (1–90%), nama promo, durasi waktu, dan pilih kategori item.`,
            `> 📋 **Diskon Aktif** — Pantau seluruh daftar promo yang sedang berjalan real-time.`,
            `> 🗑️ **Hapus Diskon** — Hentikan promo atau bersihkan semua diskon sekaligus dengan cepat.\n`,
            `📌 **KETENTUAN SISTEM PROMO:**`,
            `> • Jika terdapat beberapa diskon pada kategori yang sama, sistem otomatis mengambil **persentase terbesar** (tidak ditumpuk).`,
            `> • Diskon akan langsung tampil secara otomatis pada Katalog & Menu Pemilihan Item.`,
            `> • Harga final dikunci saat pemain mengirim pesanan, sehingga pesanan lama yang sudah dibuat tidak akan berubah.`,
        ].join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`🎫 ${name} — Staff Discount Control Center`)
            .setThumbnail(guildIcon)
            .setDescription(description)
            .setColor('#E67E22')
            .setFooter({ text: `Management Server • Staff Only Control Panel © 2026`, iconURL: guildIcon })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('disc-set')
                .setLabel('Atur Diskon')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🏷️'),
            new ButtonBuilder()
                .setCustomId('disc-list')
                .setLabel('Diskon Aktif')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📋'),
            new ButtonBuilder()
                .setCustomId('disc-clear')
                .setLabel('Hapus Diskon')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️'),
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        return interaction.reply({
            content: '✅ Panel Pengaturan Diskon berhasil terpasang!',
            flags: MessageFlags.Ephemeral,
        });
    },
};
