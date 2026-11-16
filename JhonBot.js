require('./core/migrate-data')();
const ExtendedClient = require('./class/Client');
const client = new ExtendedClient();

client.start();

try {
    require('./dashboard/server').start(client);
} catch (e) {
    console.error('[DASHBOARD] gagal start:', e.message);
}

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);
