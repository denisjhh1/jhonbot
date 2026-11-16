const { MessageFlags } = require('discord.js');
const { getPost, save, state, canManage } = require('../../core/suggestion-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'saran-delete-confirm',

    run: async (client, interaction) => {
        const postId = interaction.customId.split(':')[1];
        const post = getPost(postId);
        if (!post) return interaction.update({ content: 'Saran ini sudah dihapus.', components: [] });
        if (!canManage(interaction.member, post))
            return interaction.reply({
                content: 'Kamu tidak punya izin menghapus saran ini.',
                flags: MessageFlags.Ephemeral,
            });

        try {
            await interaction.channel.messages.delete(postId);
        } catch (e) {
            if (e.code !== 10008) {
                log(e.stack ?? e, 'err');
                return interaction.update({ content: '❌ Gagal menghapus saran.', components: [] });
            }
        }
        delete state.posts[postId];
        save();
        log(`Saran ${postId} dihapus oleh ${interaction.user.tag}`, 'info');
        return interaction.update({ content: '🗑️ Saran berhasil dihapus.', components: [] });
    },
};
