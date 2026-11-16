const { safe, closeTicket } = require('../../core/refund-core');

module.exports = {
    customId: 'refund-close',
    run: safe((client, interaction) => closeTicket(interaction)),
};
