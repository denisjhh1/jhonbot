const { safe, openForm } = require('../../core/req-core');

module.exports = {
    customId: 'req-open',
    run: safe(async (client, interaction) => {
        const type = interaction.customId.split(':')[1];
        return openForm(client, interaction, type);
    }),
};
