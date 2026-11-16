const { sendStatus } = require('../../core/status-core');

module.exports = {
    customId: 'status-offline',
    run: (client, interaction) => sendStatus(interaction, 'offline'),
};
