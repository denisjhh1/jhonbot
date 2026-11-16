const { safe, cancel } = require('../../core/izin-core');

module.exports = {
    customId: 'izin-cancel',
    run: safe(async (client, interaction) => {
        const num = Number(interaction.customId.split(':')[1]);
        return cancel(client, interaction, num);
    }),
};
