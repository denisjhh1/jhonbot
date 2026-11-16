const {
    SlashCommandBuilder,
    MessageFlags,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const def = require('../../../defines');
const { querySamp } = require('../../../core/monitoring-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('ip')
        .setDescription('Menampilkan IP & port server beserta status singkatnya.'),
    options: {
        cooldown: 10000,
    },

    run: async (client, interaction) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const { ip, port } = def.sserver;
        const res = await querySamp();

        const embed = new EmbedBuilder()
            .setTitle('🌐 IP SERVER')
            .setColor(res.ok ? 'Green' : 'Red')
            .setThumbnail(def.icon?.thumbnail ?? null)
            .addFields(
                { name: 'IP', value: `\`${ip}\``, inline: true },
                { name: 'Port', value: `\`${port}\``, inline: true },
                {
                    name: 'Status',
                    value: res.ok ? `🟢 Online (${res.data.online}/${res.data.maxplayers})` : '🔴 Offline',
                    inline: true,
                },
                { name: 'Alamat Lengkap', value: `\`${ip}:${port}\``, inline: false },
            )
            .setFooter({ text: 'Tekan tombol di bawah untuk menyalin IP.' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ip-copy')
                .setLabel('Salin IP')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📋'),
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
    },
};
