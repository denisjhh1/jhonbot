const MySQL = require('mysql');
const def = require('../defines');

const TAG = '\x1b[36m[MYSQL]: \x1b[0m';

const hints = {
    ER_ACCESS_DENIED_ERROR:
        'Username atau password salah. Copy-paste langsung dari panel (tab Databases), jangan diketik ulang.',
    ER_DBACCESS_DENIED_ERROR: 'User tidak punya akses ke database ini. Cek nama database di defines.js.',
    ER_BAD_DB_ERROR: 'Nama database salah / tidak ada. Cek mysql.database di defines.js.',
    ENOTFOUND: 'Host tidak ditemukan. Cek mysql.host di defines.js.',
    ECONNREFUSED: 'Koneksi ditolak. Cek host dan port.',
    ETIMEDOUT: 'Timeout. Host database mungkin memblokir koneksi dari hosting bot ini.',
    ER_NOT_SUPPORTED_AUTH_MODE:
        "Database memakai metode login baru yang tidak didukung library 'mysql'. Perlu ganti ke 'mysql2'.",
};

let JhonSQL = MySQL.createPool(def.mysql);

JhonSQL.getConnection((err, connect) => {
    if (err) {
        console.log(TAG + 'Database MySql tidak dapat terhubung!');
        console.log(TAG + `Penyebab: ${err.code ?? 'UNKNOWN'} - ${err.sqlMessage ?? err.message}`);
        if (hints[err.code]) console.log(TAG + `Saran: ${hints[err.code]}`);
        return;
    }

    console.log(TAG + 'Database MySql telah berhasil terhubung!');
    connect.release();
});

module.exports = JhonSQL;
