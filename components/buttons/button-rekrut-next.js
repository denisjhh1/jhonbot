const { safe, openStep } = require('../../core/rekrut-core');

module.exports = {
    customId: 'rekrut-next',
    run: safe((client, interaction) => openStep(client, interaction, Number(interaction.customId.split(':')[1]))),
};
