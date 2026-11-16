const { MessageFlags } = require('discord.js');
const { STATUS, getPost, save, render, isStaff } = require('../../core/suggestion-core');

module.exports = {
    customId: 'saran-status',

    run: async (client, interaction) => {
        if (!isStaff(interaction.member))
            return interaction.reply({
                content: 'Hanya Admin/Developer yang bisa mengubah status saran.',
                flags: MessageFlags.Ephemeral,
            });

        const post = getPost(interaction.message.id);
        if (!post)
            return interaction.reply({ content: 'Data saran ini tidak ditemukan.', flags: MessageFlags.Ephemeral });

        const value = interaction.values[0];
        if (!STATUS[value]) return;
        post.status = value;
        post.statusBy = value === 'waiting' ? null : interaction.user.id;
        save();

        await interaction.update({ ...render(post, interaction.guild.name), allowedMentions: { parse: [] } });
    },
};
