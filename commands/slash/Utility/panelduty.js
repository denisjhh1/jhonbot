const {
    MessageFlags,
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const def = require('../../../defines');
const { MIN_MINUTES, fmtDur } = require('../../../core/dutyreport-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panelduty')
        .setDescription('Menampilkan panel Laporan Duty Admin yang interaktif.'),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        const name = interaction.guild.name;
        const guildIcon = interaction.guild.iconURL({ dynamic: true }) ?? def.icon?.thumbnail;

        const description = [
            `### 🛡️ PUSAT LAPORAN STAFF ${name.toUpperCase()}`,
            `Selamat datang di panel resmi pelaporan duty staff. Setiap selesai bertugas, pastikan untuk mengirimkan laporanmu melalui tombol interaktif di bawah agar tercatat secara otomatis.\n`,
            `📝 **PANDUAN LAPOR DUTY:**`,
            `> 1️⃣ Klik tombol **Lapor Duty** di bawah.`,
            `> 2️⃣ Lengkapi form (Pangkat, Durasi, Aktivitas, Catatan, & Bukti Screenshot).`,
            `> 3️⃣ Periksa pratinjau lalu klik **Kirim Laporan**.`,
            `> 4️⃣ Laporan akan masuk ke **thread pribadi** dalam forum duty staff. Bot akan membuatnya otomatis jika belum ada.\n`,
            `📊 **REKAP & EVALUASI:**`,
            `> Klik tombol **Rekap Saya** untuk melihat statistik total jam duty serta jumlah laporanmu pada bulan ini.\n`,
            `⚠️ **ATURAN & KETENTUAN:**`,
            `> • Minimal durasi duty: **${fmtDur(MIN_MINUTES)}**.`,
            `> • Laporan wajib valid dan disertai bukti nyata. Pemalsuan laporan akan dikenakan sanksi tegas.`,
            `> • Jika ada kesalahan pengisian, gunakan tombol **Edit** pada laporan yang sudah terkirim.`,
        ].join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`👮‍♂️ ${name} — Official Admin Duty Panel`)
            .setThumbnail(guildIcon)
            .setDescription(description)
            .setColor('#2b6cb0')
            .setFooter({ text: `Management Server • Staff Portal © 2026`, iconURL: guildIcon })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('duty-open')
                .setLabel('Lapor Duty')
                .setStyle(ButtonStyle.Success)
                .setEmoji('📝'),
            new ButtonBuilder()
                .setCustomId('duty-recap')
                .setLabel('Rekap Saya')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📊'),
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        return interaction.reply({
            content: '✅ Panel Laporan Duty berhasil dipasang dengan tampilan baru!',
            flags: MessageFlags.Ephemeral,
        });
    },
};
