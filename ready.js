const { log } = require('../../functions');
const ExtendedClient = require('../../class/Client');
const monitoring = require('../../core/monitoring-core');
const izin = require('../../core/izin-core');
const rekrut = require('../../core/rekrut-core');
const analytics = require('../../core/analytics-core');
const adminMonitor = require('../../adminMonitor');

module.exports = {
    event: 'clientReady',
    once: true,

    run: (_, client) => {
        log('Logged in as: ' + client.user.tag, 'done');
        monitoring.start(client);
        analytics.start(client);
        izin.start(client);
        adminMonitor.start(client);
        rekrut.refreshPanels(client).catch((e) => log(`Refresh panel rekrutmen gagal: ${e.message}`, 'warn'));
    },
};
