const {
    MessageFlags,
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const def = require('../../../defines');
const { cfg } = require('../../../core/changelog-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panelchangelog')
        .setDescription('Menampilkan panel update changelog untuk developer.'),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        const embed = new EmbedBuilder()
            .setTitle('📝 Expensive Roleplay — Changelog Panel')
            .setDescription(
                [
                    'Panel ini khusus untuk **Developer** dan **Owner** mencatat pembaruan server.',
                    '',
                    '📌 **Cara Menggunakan:**',
                    '1. Klik tombol **` Update `** di bawah ini.',
                    '2. Isi **versi**, **judul update**, dan **daftar perubahan** (satu perubahan per baris).',
                    '3. Periksa pratinjau, lalu tekan **Konfirmasi**.',
                    `4. Changelog otomatis terkirim ke <#${cfg.channelId}> lengkap dengan waktu update.`,
                ].join('\n'),
            )
            .setColor('Blurple')
            .setFooter({ text: '© 2026 Expensive Roleplay • Developer Only', iconURL: def.icon?.thumbnail })
            .setTimestamp();
        if (def.icon?.thumbnail) embed.setThumbnail(def.icon.thumbnail);
        if (cfg.banner) embed.setImage(cfg.banner);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('button-changelog')
                .setLabel('Update')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📝'),
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });

        return interaction.reply({
            content: '✅ Panel Changelog berhasil terpasang!',
            flags: MessageFlags.Ephemeral,
        });
    },
};
