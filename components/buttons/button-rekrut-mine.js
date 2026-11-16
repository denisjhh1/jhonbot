const { safe, showMine } = require('../../core/rekrut-core');

module.exports = {
    customId: 'rekrut-mine',
    run: safe((client, interaction) => showMine(client, interaction)),
};
