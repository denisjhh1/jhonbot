const { MessageFlags } = require('discord.js');
const { getPost, save, render, MAX_COMMENTS } = require('../../core/suggestion-core');
const { IntError, log } = require('../../functions');

module.exports = {
    customId: 'modal-saran-comment',

    run: async (client, interaction) => {
        const postId = interaction.customId.split(':')[1];
        const post = getPost(postId);
        if (!post) return IntError(interaction, 'Data saran ini tidak ditemukan.');
        if (post.comments.length >= MAX_COMMENTS)
            return IntError(interaction, `Komentar pada saran ini sudah penuh (${MAX_COMMENTS}).`);

        const text = interaction.fields.getTextInputValue('comment-text').trim();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        post.comments.push({ userId: interaction.user.id, text, ts: Math.floor(Date.now() / 1000) });
        save();

        try {
            const msg = await interaction.channel.messages.fetch(postId);
            await msg.edit({ ...render(post, interaction.guild.name), allowedMentions: { parse: [] } });
            await interaction.editReply('✅ Komentarmu sudah ditambahkan.');
        } catch (e) {
            log(e.stack ?? e, 'err');
            await interaction.editReply('❌ Komentar tersimpan, tapi gagal memperbarui tampilan saran.');
        }
    },
};
