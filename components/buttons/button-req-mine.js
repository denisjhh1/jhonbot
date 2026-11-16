const { safe, showMine } = require('../../core/req-core');

module.exports = {
    customId: 'req-mine',
    run: safe(async (client, interaction) => showMine(client, interaction)),
};
