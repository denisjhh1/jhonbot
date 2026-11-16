const core = require('../../core/renamecat-core');

module.exports = {
    customId: 'rnk-cancel',

    run: async (client, interaction) => {
        core.cancel(interaction.customId.split(':')[1], interaction.user.id);
        return interaction.update({
            content: 'Dibatalkan. Tidak ada channel yang diubah.',
            embeds: [],
            components: [],
        });
    },
};
