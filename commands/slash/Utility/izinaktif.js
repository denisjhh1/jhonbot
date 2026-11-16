const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { isApprover, activeListEmbed } = require('../../../core/izin-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('izinaktif')
        .setDescription('Melihat admin yang sedang izin dan pengajuan yang masih menunggu (khusus Owner/Developer).'),
    options: {},

    run: async (client, interaction) => {
        if (!isApprover(interaction.member))
            return interaction.reply({ content: '🔒 **Khusus Owner & Developer.**', flags: MessageFlags.Ephemeral });
        return interaction.reply({ embeds: [activeListEmbed()], flags: MessageFlags.Ephemeral });
    },
};
