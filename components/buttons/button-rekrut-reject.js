const { safe, startDecision } = require('../../core/rekrut-core');

module.exports = {
    customId: 'rekrut-reject',
    run: safe((client, interaction) =>
        startDecision(client, interaction, Number(interaction.customId.split(':')[1]), 'reject'),
    ),
};
