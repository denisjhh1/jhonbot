const { safe, changeStatus } = require('../../core/report-core');

module.exports = {
    customId: 'report-resolve',
    run: safe((client, interaction) => changeStatus(interaction, 'resolve')),
};
