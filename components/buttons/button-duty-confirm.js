const { EmbedBuilder } = require('discord.js');
const { drafts, createReport } = require('../../core/dutyreport-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'duty-confirm',

    run: async (client, interaction) => {
        const draft = drafts.get(interaction.user.id);
        if (!draft || draft.expires < Date.now())
            return interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription('⌛ Draft laporan sudah kedaluwarsa. Silakan klik **Lapor Duty** lagi.'),
                ],
                components: [],
            });

        await interaction.update({
            embeds: [new EmbedBuilder().setColor('Blue').setDescription('⏳ Mengirim laporan ke thread dutymu...')],
            components: [],
        });
        drafts.delete(interaction.user.id);

        try {
            const { msg, num } = await createReport(interaction, draft);
            log(`Laporan duty #${num} oleh ${interaction.user.tag} (${msg.id})`, 'done');
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Green')
                        .setDescription(`✅ Laporan duty **#${num}** berhasil dikirim: ${msg.url}`),
                ],
            });
        } catch (err) {
            log(err.stack ?? err, 'err');
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription(
                            `❌ Gagal mengirim laporan.\n\n**Penyebab:**\n\`\`\`${String(err.message).slice(0, 800)}\`\`\``,
                        ),
                ],
            });
        }
    },
};
