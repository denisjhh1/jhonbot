const {
    MessageFlags,
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const def = require('../../../defines');
const { CATS } = require('../../../core/suggestion-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panelsaran')
        .setDescription('Menampilkan panel Saran interaktif (fitur, mapingan, textdraw, dll).'),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        const name = interaction.guild.name;
        const guildIcon = interaction.guild.iconURL({ dynamic: true }) ?? def.icon?.thumbnail;

        const description = [
            `### ✨ BANTU KEMBANGKAN ${name.toUpperCase()}!`,
            `Punya ide, masukan, atau inovasi kreatif untuk memajukan server kita? Sampaikan langsung melalui panel interaktif di bawah ini. Setiap warga dapat melihat, berdiskusi, dan memberikan dukungan suara (**vote**).\n`,
            `📌 **KATEGORI SARAN TERSEDIA:**`,
            ...Object.values(CATS).map((c) => `> ${c.emoji} **${c.label}**`),
            '',
            `📝 **PANDUAN PENGIRIMAN:**`,
            `> 1️⃣ Klik tombol kategori di bawah sesuai topik saranmu.`,
            `> 2️⃣ Isi formulir ringkas (Judul, Deskripsi Detail, & Lampiran Foto).`,
            `> 3️⃣ Periksa pratinjau lalu klik **Kirim Saran**.`,
            `> 4️⃣ Saran akan otomatis masuk ke channel publik. Kamu bebas mengubah isinya kapan saja menggunakan tombol **Edit**.\n`,
            `⚠️ **ATURAN UTAMA:**`,
            `> • Gunakan bahasa yang sopan, jelas, dan fokus pada satu topik per saran.`,
            `> • Dilarang melakukan *spam* atau mengirimkan ide duplikat.`,
            `> • Kendala bug/error teknis **tidak boleh** dikirim di sini; gunakan panel **Report Bug** khusus.`,
        ].join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`💡 ${name} — Official Suggestion Panel`)
            .setThumbnail(guildIcon)
            .setDescription(description)
            .setColor('#FFD700')
            .setImage(def.changelog?.banner ?? null)
            .setFooter({ text: `Management Server • ${name} © 2026`, iconURL: guildIcon })
            .setTimestamp();

        const entries = Object.entries(CATS);
        const rows = [];
        let currentRow = new ActionRowBuilder();

        entries.forEach(([key, c], index) => {
            let style = ButtonStyle.Primary;
            if (index % 3 === 1) style = ButtonStyle.Secondary;
            if (index % 3 === 2) style = ButtonStyle.Success;

            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`saran-open:${key}`)
                    .setLabel(c.label)
                    .setStyle(style)
                    .setEmoji(c.emoji),
            );

            if (currentRow.components.length === 5 || index === entries.length - 1) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }
        });

        await interaction.channel.send({ embeds: [embed], components: rows });

        return interaction.reply({
            content: '✅ Panel Saran interaktif berhasil terpasang di channel ini!',
            flags: MessageFlags.Ephemeral,
        });
    },
};
