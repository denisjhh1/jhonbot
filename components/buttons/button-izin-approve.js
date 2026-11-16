const { safe, approve } = require('../../core/izin-core');

module.exports = {
    customId: 'izin-approve',
    run: safe(async (client, interaction) => {
        const num = Number(interaction.customId.split(':')[1]);
        return approve(client, interaction, num);
    }),
};
