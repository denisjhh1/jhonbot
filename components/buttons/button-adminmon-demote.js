const { openDemote } = require('../../core/adminmonitor-actions');

module.exports = {
    customId: 'adminmon-demote',
    run: openDemote,
};
