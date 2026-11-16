const { safe, startReject } = require('../../core/req-core');

module.exports = {
    customId: 'req-reject',
    run: safe(async (client, interaction) => {
        const num = Number(interaction.customId.split(':')[1]);
        return startReject(client, interaction, num);
    }),
};
