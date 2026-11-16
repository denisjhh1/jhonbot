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
        .setName('panelstatus')
        .setDescription('Menampilkan panel kontrol status server (khusus staf).'),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        const embed = new EmbedBuilder()
            .setTitle('🛠️ Panel Status Server')
            .setDescription(
                `Klik salah satu tombol untuk mengirim pengumuman status ke${def.statusserver?.channelId ? ` <#${def.statusserver.channelId}>` : ' channel status'}.\n\n🟢 **Online** • 🔴 **Offline** • 🟠 **Maintenance**`,
            )
            .setColor('Blurple')
            .setFooter({ text: 'Hanya staf yang bisa memakai panel ini.' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('status-online')
                .setLabel('Online')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🟢'),
            new ButtonBuilder()
                .setCustomId('status-offline')
                .setLabel('Offline')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔴'),
            new ButtonBuilder()
                .setCustomId('status-maintenance')
                .setLabel('Maintenance')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🟠'),
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        return interaction.reply({
            content: '✅ Panel status server berhasil terpasang!',
            flags: MessageFlags.Ephemeral,
        });
    },
};
