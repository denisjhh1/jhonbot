const { safe, startOncam } = require('../../core/req-core');

module.exports = {
    customId: 'req-oncam',
    run: safe(async (client, interaction) => {
        const num = Number(interaction.customId.split(':')[1]);
        return startOncam(client, interaction, num);
    }),
};
