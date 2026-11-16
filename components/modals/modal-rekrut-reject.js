const { safe, finishDecision } = require('../../core/rekrut-core');

module.exports = {
    customId: 'modal-rekrut-reject',
    run: safe((client, interaction) =>
        finishDecision(
            client,
            interaction,
            Number(interaction.customId.split(':')[1]),
            'reject',
            interaction.fields.getTextInputValue('rekrut-note'),
        ),
    ),
};
