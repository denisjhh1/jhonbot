const { sendStatus } = require('../../core/status-core');

module.exports = {
    customId: 'status-online',
    run: (client, interaction) => sendStatus(interaction, 'online'),
};
