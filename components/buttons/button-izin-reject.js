const { safe, startReject } = require('../../core/izin-core');

module.exports = {
    customId: 'izin-reject',
    run: safe(async (client, interaction) => {
        const num = Number(interaction.customId.split(':')[1]);
        return startReject(client, interaction, num);
    }),
};
