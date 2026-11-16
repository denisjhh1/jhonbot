const { MessageFlags } = require('discord.js');
const { getPost, save, render } = require('../../core/suggestion-core');

module.exports = {
    customId: 'saran-vote',

    run: async (client, interaction) => {
        const post = getPost(interaction.message.id);
        if (!post)
            return interaction.reply({ content: 'Data saran ini tidak ditemukan.', flags: MessageFlags.Ephemeral });

        const dir = interaction.customId.split(':')[1] === 'down' ? 'down' : 'up';
        const other = dir === 'up' ? 'down' : 'up';
        const id = interaction.user.id;

        post.votes[other] = post.votes[other].filter((u) => u !== id);
        if (post.votes[dir].includes(id)) post.votes[dir] = post.votes[dir].filter((u) => u !== id);
        else post.votes[dir].push(id);
        save();

        await interaction.update({ ...render(post, interaction.guild.name), allowedMentions: { parse: [] } });
    },
};
