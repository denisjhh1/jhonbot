const { safe, approve } = require('../../core/req-core');

module.exports = {
    customId: 'req-approve',
    run: safe(async (client, interaction) => {
        const num = Number(interaction.customId.split(':')[1]);
        return approve(client, interaction, num);
    }),
};
