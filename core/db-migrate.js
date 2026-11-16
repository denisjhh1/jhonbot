// Penyesuaian database yang sifatnya MENAMBAH saja (tidak mengubah/menghapus kolom milik gamemode).
// - player_ucp  : + DiscordID, + verifycode  (dibutuhkan registrasi UCP lewat Discord)
// - families log: tabel familieslogs (bila belum ada)
// Dijalankan otomatis saat bot start. Matikan lewat dashboard: db.autoMigrate = false
const db = require('./query');
const S = require('./schema');
const { log } = require('../functions');

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

async function hasColumn(table, column) {
    const rows = await q('SHOW COLUMNS FROM ?? LIKE ?', [table, column]);
    return rows.length > 0;
}

async function run() {
    if (!S.autoMigrate) return;
    const U = S.ucp;
    try {
        if (!(await hasColumn(U.table, U.discord))) {
            await q('ALTER TABLE ?? ADD COLUMN ?? VARCHAR(25) NULL DEFAULT NULL', [U.table, U.discord]);
            try {
                await q('ALTER TABLE ?? ADD INDEX ?? (??)', [U.table, `idx_${U.discord}`, U.discord]);
            } catch {}
            log(`DB: kolom ${U.table}.${U.discord} ditambahkan.`, 'done');
        }
        if (!(await hasColumn(U.table, U.verify))) {
            await q('ALTER TABLE ?? ADD COLUMN ?? INT(11) NOT NULL DEFAULT 0', [U.table, U.verify]);
            log(`DB: kolom ${U.table}.${U.verify} ditambahkan.`, 'done');
        }
        if (U.recovery && !(await hasColumn(U.table, U.recovery))) {
            await q('ALTER TABLE ?? ADD COLUMN ?? INT(11) NOT NULL DEFAULT -1', [U.table, U.recovery]);
            log(`DB: kolom ${U.table}.${U.recovery} ditambahkan.`, 'done');
        }
    } catch (e) {
        log(
            `DB: gagal menyesuaikan tabel ${U.table} (${e.message}). Jalankan sql/migration.sql secara manual.`,
            'err',
        );
    }

    const F = S.family;
    if (F.logsTable) {
        try {
            await q(
                'CREATE TABLE IF NOT EXISTS ?? (' +
                    '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,' +
                    "`Name` VARCHAR(64) NOT NULL DEFAULT ''," +
                    "`UCP` VARCHAR(32) NOT NULL DEFAULT ''," +
                    "`Activity` VARCHAR(255) NOT NULL DEFAULT ''," +
                    '`Time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,' +
                    "`Families` VARCHAR(64) NOT NULL DEFAULT ''," +
                    'KEY `idx_fam` (`Families`)' +
                    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
                [F.logsTable],
            );
        } catch (e) {
            log(`DB: gagal menyiapkan tabel ${F.logsTable} (${e.message})`, 'warn');
        }
    }
}

module.exports = { run };
