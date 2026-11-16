const { safe, submitStep } = require('../../core/rekrut-core');

module.exports = {
    customId: 'modal-rekrut',
    run: safe((client, interaction) => submitStep(client, interaction, Number(interaction.customId.split(':')[1]))),
};
