const { safe, finishDecision } = require('../../core/rekrut-core');

module.exports = {
    customId: 'modal-rekrut-approve',
    run: safe((client, interaction) =>
        finishDecision(
            client,
            interaction,
            Number(interaction.customId.split(':')[1]),
            'approve',
            interaction.fields.getTextInputValue('rekrut-note'),
        ),
    ),
};
