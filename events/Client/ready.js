const { log } = require('../../functions');
const ExtendedClient = require('../../class/Client');
const monitoring = require('../../core/monitoring-core');
const izin = require('../../core/izin-core');
const rekrut = require('../../core/rekrut-core');
const analytics = require('../../core/analytics-core');
const adminMonitor = require('../../adminMonitor');
const moneylog = require('../../core/moneylog-core');
const gamelog = require('../../core/gamelog-core');
const incomelog = require('../../core/incomelog-core');
const leaderboard = require('../../core/leaderboard-core');
const discordAdmin = require('../../core/discordadmin-core');
const familylog = require('../../core/familylog-core');
const factionVaultLog = require('../../core/factionvaultlog-core');

module.exports = {
    event: 'clientReady',
    once: true,

    run: (_, client) => {
        log('Logged in as: ' + client.user.tag, 'done');
        require('../../core/db-migrate').run().catch((e) => log(`DB migrate gagal: ${e.message}`, 'err'));
        monitoring.start(client);
        analytics.start(client);
        izin.start(client);
        adminMonitor.start(client);
        moneylog.start(client);
        gamelog.start(client);
        incomelog.start(client);
        leaderboard.start(client);
        discordAdmin.start();
        familylog.start(client).catch((e) => log(`FamilyLog gagal start: ${e.message}`, 'err'));
        factionVaultLog.start(client).catch((e) => log(`FactionVaultLog gagal start: ${e.message}`, 'err'));
        rekrut.refreshPanels(client).catch((e) => log(`Refresh panel rekrutmen gagal: ${e.message}`, 'warn'));
    },
};
