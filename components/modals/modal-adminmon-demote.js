const { submitDemote } = require('../../core/adminmonitor-actions');

module.exports = {
    customId: 'modal-adminmon-demote',
    run: submitDemote,
};
