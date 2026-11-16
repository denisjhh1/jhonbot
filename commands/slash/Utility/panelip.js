const {
    SlashCommandBuilder,
    MessageFlags,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const def = require('../../../defines');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panelip')
        .setDescription('Memasang panel IP server permanen di channel ini (khusus staf).'),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        const { ip, port } = def.sserver;

        const embed = new EmbedBuilder()
            .setTitle('🌐 IP SERVER')
            .setDescription('Klik tombol **Salin IP** untuk mendapatkan alamat server.')
            .setColor('Blurple')
            .setThumbnail(def.icon?.thumbnail ?? null)
            .addFields(
                { name: 'IP', value: `\`${ip}\``, inline: true },
                { name: 'Port', value: `\`${port}\``, inline: true },
                { name: 'Alamat Lengkap', value: `\`${ip}:${port}\``, inline: false },
            )
            .setFooter({ text: 'Management Server', iconURL: def.icon?.thumbnail });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ip-copy')
                .setLabel('Salin IP')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📋'),
        );

        await interaction.channel.send({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
        return interaction.reply({ content: '✅ Panel IP berhasil terpasang!', flags: MessageFlags.Ephemeral });
    },
};
