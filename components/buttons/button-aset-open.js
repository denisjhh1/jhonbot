const { modal } = require('../../core/asset-core');

module.exports = {
    customId: 'aset-open',

    run: async (client, interaction) => interaction.showModal(modal()),
};
