const { safe, confirmCancel } = require('../../core/rekrut-core');

module.exports = {
    customId: 'rekrut-cancel-confirm',
    run: safe((client, interaction) => confirmCancel(client, interaction, Number(interaction.customId.split(':')[1]))),
};
