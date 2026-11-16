const { MessageFlags } = require('discord.js');
const { state, save, isStaff } = require('../../core/donation-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'disc-remove',

    run: async (client, interaction) => {
        if (!isStaff(interaction.member))
            return interaction.reply({
                content: 'Hanya staff donasi yang bisa menghapus diskon.',
                flags: MessageFlags.Ephemeral,
            });

        const v = interaction.values[0];
        const before = state.discounts.length;
        state.discounts = v === '__all' ? [] : state.discounts.filter((d) => d.id !== v);
        save();
        log(`${before - state.discounts.length} diskon dihapus oleh ${interaction.user.tag}`, 'done');
        return interaction.update({
            content: v === '__all' ? '🗑️ Semua diskon dihapus. Harga kembali normal.' : '🗑️ Diskon dihapus.',
            components: [],
        });
    },
};
