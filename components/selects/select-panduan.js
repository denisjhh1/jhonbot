const { SELECT_ID, payload } = require('../../core/panduan-core');

module.exports = {
    customId: SELECT_ID,

    run: async (client, interaction) => {
        return interaction.update(payload(interaction.values[0]));
    },
};
