const { EmbedBuilder } = require('discord.js');
const { drafts } = require('../../core/dutyreport-core');

module.exports = {
    customId: 'duty-cancel',
    run: async (client, interaction) => {
        drafts.delete(interaction.user.id);
        await interaction.update({
            embeds: [new EmbedBuilder().setColor('Grey').setDescription('Laporan dibatalkan.')],
            components: [],
        });
    },
};
