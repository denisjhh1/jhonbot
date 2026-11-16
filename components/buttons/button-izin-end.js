const { safe, endEarly } = require('../../core/izin-core');

module.exports = {
    customId: 'izin-end',
    run: safe(async (client, interaction) => {
        const num = Number(interaction.customId.split(':')[1]);
        return endEarly(client, interaction, num);
    }),
};
