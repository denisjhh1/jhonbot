// Pemetaan nama tabel & kolom database GTA/SA-MP -> yang dipakai bot.
// Default di bawah SUDAH disesuaikan dengan dump `s2220_expensiveroleplay.sql`.
// Bisa diubah lewat dashboard (tab "Database") -> disimpan di data/settings.json -> def.db
const def = require('../defines');
const d = { ...(def.db ?? {}) };
// Override lama (versi sebelumnya menyimpan db.ucp.table = 'player_ucp') diabaikan:
// tiket UCP lewat Discord di gamemode ini ada di tabel `whitelists`.
if (d.ucp && String(d.ucp.table).trim().toLowerCase() === 'player_ucp') {
    d.ucp = { ...d.ucp };
    delete d.ucp.table;
}

const merge = (base, over) => ({ ...base, ...(over ?? {}) });

module.exports = {
    autoMigrate: d.autoMigrate !== false,

    // Akun UCP (registrasi lewat Discord)
    // Gamemode memakai tabel `whitelists` untuk tiket/registrasi UCP lewat Discord:
    //   verify   = kode verifikasi (-1 = sudah terverifikasi / sudah daftar di game)
    //   recovery = kode reset password (-1 = tidak ada permintaan)
    // Tabel player_ucp baru terisi saat pemain mendaftar password di dalam game.
    ucp: merge(
        {
            table: 'whitelists',
            ucp: 'ucp',
            password: null,
            discord: 'discordid',
            verify: 'verify',
            recovery: 'recovery',
            registerDate: 'date',
            lastLogin: null,
        },
        d.ucp,
    ),

    // Karakter: kolom yang berkaitan dengan jail / knockdown (dipakai /jail & /unjail)
    jail: merge(
        {
            jailed: 'Char_Jailed',
            cell: 'Char_JailCell', // -1 = sel ditentukan gamemode saat login
            time: 'Char_JailTime', // detik tersisa
            duration: 'Char_JailDur', // menit
            reason: 'Char_JailReason',
            admin: 'Char_JailAdmin',
            fine: 'Char_JailFine',
            knock: 'Char_Knockdown',
            knockTime: 'Char_KnockdownTime',
        },
        d.jail,
    ),

    // Aset (untuk /aset)
    house: merge({ table: 'houses', id: 'ID', owner: 'OwnerID', type: 'Type', x: 'X', y: 'Y' }, d.house),
    vehicle: merge(
        {
            table: 'player_vehicles',
            id: 'id',
            owner: 'PVeh_Owner',
            model: 'PVeh_ModelID',
            plate: 'PVeh_Plate',
            price: 'PVeh_Price',
            rental: 'PVeh_Rental',
            impounded: 'PVeh_Impounded',
        },
        d.vehicle,
    ),
    business: merge({ table: 'biz', id: 'ID', name: 'Name', money: 'Money', owner: 'OwnerID' }, d.business),
    rusun: merge({ table: 'rusun', id: 'ID', name: 'Name', price: 'Cost_30Day', owner: 'OwnerID' }, d.rusun),
    // Tabel di bawah TIDAK ada di database kamu -> dikosongkan (kategori tampil "-"). Isi nama tabel bila ada.
    workshop: merge({ table: null, id: 'ID', name: 'Name', money: 'Money', owner: 'OwnerID' }, d.workshop),
    restaurant: merge({ table: null, id: 'id', name: 'name', money: 'money', owner: 'OwnerID' }, d.restaurant),

    // Log admin & warning (ditulis oleh /jail, /ban, dsb dari Discord)
    adminLog: merge(
        { table: 'admin_logs', cmd: 'Prefix', admin: 'Admin', ucp: 'AdminUCP', target: 'UCPTarget' },
        d.adminLog,
    ),
    warnLog: merge(
        {
            table: 'player_warns',
            owner: 'Owner_ID',
            date: 'Date',
            dateTime: 'Date_Time',
            issuer: 'Issuer',
            type: 'Type',
            reason: 'Reason',
        },
        d.warnLog,
    ),

    // Family
    family: merge(
        { table: 'families', id: 'ID', name: 'Name', leader: 'LeaderName', money: 'Money', logsTable: 'familieslogs' },
        d.family,
    ),
};
