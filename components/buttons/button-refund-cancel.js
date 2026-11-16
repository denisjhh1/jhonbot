const { EmbedBuilder } = require('discord.js');
const { drafts, safe } = require('../../core/refund-core');

module.exports = {
    customId: 'refund-cancel',
    run: safe(async (client, interaction) => {
        drafts.delete(interaction.user.id);
        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setColor('Grey')
                    .setDescription(
                        '## ✖️ Pengajuan Dibatalkan\n> Tidak ada yang dikirim. Kamu bisa mengajukan lagi kapan saja lewat panel.',
                    ),
            ],
            components: [],
        });
    }),
};
