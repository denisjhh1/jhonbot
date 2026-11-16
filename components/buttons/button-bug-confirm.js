const { EmbedBuilder } = require('discord.js');
const { drafts, createReport } = require('../../core/bugreport-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'bug-confirm',

    run: async (client, interaction) => {
        const draft = drafts.get(interaction.user.id);
        if (!draft || draft.expires < Date.now())
            return interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription('⌛ Draft laporan sudah kedaluwarsa. Silakan klik tombol **Report Bug** lagi.'),
                ],
                components: [],
            });

        await interaction.update({
            embeds: [new EmbedBuilder().setColor('Blue').setDescription('⏳ Membuat channel laporan...')],
            components: [],
        });
        drafts.delete(interaction.user.id);

        try {
            const { channel, num } = await createReport(interaction, draft);
            log(`Bug report #${num} dibuat oleh ${interaction.user.tag} (${channel.id})`, 'done');
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Green')
                        .setDescription(
                            `✅ Laporan **#${num}** berhasil dibuat di <#${channel.id}>.\nTim kami akan segera memeriksanya.`,
                        ),
                ],
            });
        } catch (err) {
            log(err.stack ?? err, 'err');
            const known = err.message?.startsWith('Kamu masih');
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription(
                            known
                                ? `❌ ${err.message}`
                                : `❌ Gagal membuat channel laporan.\n\n**Penyebab:**\n\`\`\`${String(err.message).slice(0, 800)}\`\`\``,
                        ),
                ],
            });
        }
    },
};
