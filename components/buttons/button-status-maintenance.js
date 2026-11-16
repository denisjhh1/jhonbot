const { sendStatus } = require('../../core/status-core');

module.exports = {
    customId: 'status-maintenance',
    run: (client, interaction) => sendStatus(interaction, 'maintenance'),
};
