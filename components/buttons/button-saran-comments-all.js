const { MessageFlags, EmbedBuilder } = require('discord.js');
const { getPost } = require('../../core/suggestion-core');

module.exports = {
    customId: 'saran-comments-all',

    run: async (client, interaction) => {
        const post = getPost(interaction.message.id);
        if (!post)
            return interaction.reply({ content: 'Data saran ini tidak ditemukan.', flags: MessageFlags.Ephemeral });
        if (!post.comments.length)
            return interaction.reply({
                content: 'Belum ada komentar. Jadilah yang pertama! 💬',
                flags: MessageFlags.Ephemeral,
            });

        const lines = [];
        let size = 0;
        for (let i = post.comments.length - 1; i >= 0; i--) {
            const c = post.comments[i];
            const line = `**<@${c.userId}>** • <t:${c.ts}:R>\n${c.text}`;
            if (size + line.length + 2 > 3900) break;
            lines.unshift(line);
            size += line.length + 2;
        }
        const hidden = post.comments.length - lines.length;

        const embed = new EmbedBuilder()
            .setTitle(`💬 Komentar (${post.comments.length})`)
            .setDescription((hidden > 0 ? `_…${hidden} komentar lama tidak ditampilkan_\n\n` : '') + lines.join('\n\n'))
            .setColor('Blue');

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    },
};
