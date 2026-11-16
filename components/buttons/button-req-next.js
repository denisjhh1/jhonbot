const { safe, nextStep } = require('../../core/req-core');

module.exports = {
    customId: 'req-next',
    run: safe(async (client, interaction) => {
        const [, type, step] = interaction.customId.split(':');
        return nextStep(client, interaction, type, Number(step));
    }),
};
