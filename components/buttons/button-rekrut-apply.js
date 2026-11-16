const { safe, startApply } = require('../../core/rekrut-core');

module.exports = {
    customId: 'rekrut-apply',
    run: safe((client, interaction) => startApply(client, interaction)),
};
