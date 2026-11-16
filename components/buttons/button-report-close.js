const { safe, closeTicket } = require('../../core/report-core');

module.exports = {
    customId: 'report-close',
    run: safe((client, interaction) => closeTicket(interaction)),
};
