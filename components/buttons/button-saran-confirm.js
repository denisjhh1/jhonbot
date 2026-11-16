const { EmbedBuilder } = require('discord.js');
const { drafts, createPost } = require('../../core/suggestion-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'saran-confirm',

    run: async (client, interaction) => {
        const draft = drafts.get(interaction.user.id);
        if (!draft || draft.expires < Date.now())
            return interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription('⌛ Draft saran sudah kedaluwarsa. Silakan klik tombol kategori saran lagi.'),
                ],
                components: [],
            });

        await interaction.update({
            embeds: [new EmbedBuilder().setColor('Blue').setDescription('⏳ Mengirim saran...')],
            components: [],
        });
        drafts.delete(interaction.user.id);

        try {
            const { msg, num, cat } = await createPost(interaction, draft);
            log(`${cat.label} #${num} dibuat oleh ${interaction.user.tag} (${msg.id})`, 'done');
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Green')
                        .setDescription(
                            `✅ ${cat.label} **#${num}** berhasil dikirim: ${msg.url}\nKamu bisa mengeditnya dengan tombol **Edit** pada saranmu.`,
                        ),
                ],
            });
        } catch (err) {
            log(err.stack ?? err, 'err');
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription(
                            `❌ Gagal mengirim saran.\n\n**Penyebab:**\n\`\`\`${String(err.message).slice(0, 800)}\`\`\``,
                        ),
                ],
            });
        }
    },
};
