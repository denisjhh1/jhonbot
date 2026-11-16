const { EmbedBuilder } = require('discord.js');
const { drafts, safe } = require('../../core/report-core');

module.exports = {
    customId: 'report-cancel',
    run: safe(async (client, interaction) => {
        drafts.delete(interaction.user.id);
        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setColor('Grey')
                    .setDescription(
                        '## ✖️ Laporan Dibatalkan\n> Tidak ada yang dikirim. Kamu bisa membuat laporan baru kapan saja lewat panel.',
                    ),
            ],
            components: [],
        });
    }),
};
