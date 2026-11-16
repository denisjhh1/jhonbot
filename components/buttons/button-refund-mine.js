const { MessageFlags } = require('discord.js');
const { safe, myRequestsEmbed } = require('../../core/refund-core');

module.exports = {
    customId: 'refund-mine',
    run: safe(async (client, interaction) => {
        await interaction.reply({ embeds: [myRequestsEmbed(interaction.user.id)], flags: MessageFlags.Ephemeral });
    }),
};
