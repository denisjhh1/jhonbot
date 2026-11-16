const { safe, changeStatus } = require('../../core/report-core');

module.exports = {
    customId: 'report-process',
    run: safe((client, interaction) => changeStatus(interaction, 'process')),
};
