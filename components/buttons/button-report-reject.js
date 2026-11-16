const { safe, changeStatus } = require('../../core/report-core');

module.exports = {
    customId: 'report-reject',
    run: safe((client, interaction) => changeStatus(interaction, 'reject')),
};
