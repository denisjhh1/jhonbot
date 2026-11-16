const { MessageFlags } = require('discord.js');
const { safe, myRequestsEmbed } = require('../../core/izin-core');

module.exports = {
    customId: 'izin-mine',
    run: safe(async (client, interaction) => {
        await interaction.reply({ embeds: [myRequestsEmbed(interaction.user.id)], flags: MessageFlags.Ephemeral });
    }),
};
