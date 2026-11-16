const db = require('../core/query');
const dc = require('../core/delchar-core');
const q = (sql, p) => new Promise((res, rej) => db.query(sql, p, (e, r) => (e ? rej(e) : res(r))));

(async () => {
    const cols = (await q('SHOW COLUMNS FROM ??', ['player_characters'])).map((r) => r.Field);
    console.log('\nKolom player_characters:\n ', cols.join(', '));
    const s = await dc.getSchema();
    console.log('\nHasil deteksi:', s ?? 'GAGAL (lihat peringatan di atas, isi delchar di defines.js)');

    const db_ = (await q('SELECT DATABASE() AS d'))[0].d;
    const rows = await q(
        "SELECT TABLE_NAME t, COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> 'player_characters' AND (COLUMN_NAME IN ('pID','Char_Name','PlayerID','CharID','Owner','OwnerID','Char_ID') OR COLUMN_NAME LIKE '%owner%' OR COLUMN_NAME LIKE '%ban%') ORDER BY TABLE_NAME",
        [db_],
    );
    console.log(
        '\nTabel lain yang kolomnya mirip kunci karakter / ban (periksa manual untuk delchar.relatedTables atau delchar.banTable):',
    );
    for (const r of rows) console.log(`  ${r.t}.${r.c}`);
    process.exit(0);
})().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
