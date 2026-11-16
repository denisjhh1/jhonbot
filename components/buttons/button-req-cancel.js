const { safe, cancel } = require('../../core/req-core');

module.exports = {
    customId: 'req-cancel',
    run: safe(async (client, interaction) => {
        const num = Number(interaction.customId.split(':')[1]);
        return cancel(client, interaction, num);
    }),
};
