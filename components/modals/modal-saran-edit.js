const { MessageFlags } = require('discord.js');
const { getPost, save, render, canManage } = require('../../core/suggestion-core');
const { IntError, log } = require('../../functions');

module.exports = {
    customId: 'modal-saran-edit',

    run: async (client, interaction) => {
        const postId = interaction.customId.split(':')[1];
        const post = getPost(postId);
        if (!post) return IntError(interaction, 'Data saran ini tidak ditemukan.');
        if (!canManage(interaction.member, post))
            return IntError(interaction, 'Hanya pengusul, Admin, atau Developer yang bisa mengedit saran ini.');

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        post.title = interaction.fields.getTextInputValue('saran-title').trim();
        post.body = interaction.fields.getTextInputValue('saran-body').trim();
        post.extra = (interaction.fields.getTextInputValue('saran-extra') ?? '').trim();
        post.edited = true;
        save();

        try {
            const msg = await interaction.channel.messages.fetch(postId);
            await msg.edit({ ...render(post, interaction.guild.name), allowedMentions: { parse: [] } });
            await interaction.editReply('✅ Saran berhasil diedit.');
        } catch (e) {
            log(e.stack ?? e, 'err');
            await interaction.editReply('❌ Perubahan tersimpan, tapi gagal memperbarui tampilan saran.');
        }
    },
};
