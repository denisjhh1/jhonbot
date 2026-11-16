const { safe, askCancel } = require('../../core/rekrut-core');

module.exports = {
    customId: 'rekrut-cancel',
    run: safe((client, interaction) => askCancel(client, interaction)),
};
