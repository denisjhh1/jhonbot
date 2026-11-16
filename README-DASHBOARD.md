# Dashboard Pengaturan Bot

## Cara pakai
1. `npm install` (tidak ada dependensi baru), lalu jalankan bot seperti biasa (`start.bat` / `node JhonBot.js`).
2. Saat pertama jalan, **password dashboard dibuat acak dan tampil di console** (sekali saja). Catat.
3. Buka `http://IP-SERVER:3000` (port/host: `dashboard.port` / `dashboard.host` di defines.js).
4. Isi token, database, ID channel/role. Setelah bot online, tiap kolom ID punya pilihan "pilih dari server…" (nama channel/role), dan ID yang salah diberi tanda ⚠.
5. Klik **Simpan** lalu **Simpan & restart bot**. Restart otomatis butuh `start.bat` (loop) / pm2 / systemd.

Perubahan disimpan di `data/settings.json` (menimpa defines.js). Tombol "↺ kembalikan ke bawaan" menghapus override.

## Keamanan
- Dashboard bisa mengubah token & database: pakai password kuat, jangan buka port 3000 ke publik tanpa HTTPS (pakai reverse proxy nginx/caddy) atau batasi dengan firewall / `host: '127.0.0.1'` + SSH tunnel.
- Rahasia bisa lewat env var: `DISCORD_TOKEN`, `MYSQL_PASSWORD`, `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_DATABASE`, `GEMINI_API_KEY`, `DASHBOARD_PASSWORD`.
- `data/settings.json` & `data/dashboard-auth.json` jangan di-commit/dibagikan.

## Penyesuaian database
Lihat `core/schema.js` (pemetaan tabel/kolom, bisa diubah di tab **Database**) dan `sql/migration.sql`.
Bot menambah kolom `player_ucp.DiscordID`, `player_ucp.verifycode` dan tabel `familieslogs` otomatis (hanya menambah).
Tab Database punya tombol **Cek kecocokan skema** untuk memastikan semua tabel/kolom ada.

## Kirim Panel dari web
Menu **📤 Kirim Panel**: pilih channel tujuan (atau tempel ID), klik **Kirim**. Ada 22 panel (registrasi UCP, donasi, refund, bug, report, saran, rekrutmen, izin, duty, leaderboard, dll). Tampilannya sama persis dengan command `/panel…` karena dashboard menjalankan command yang sama.
- Channel tujuan terisi otomatis dari pengaturan bila ada (mis. donasi, rekrutmen, changelog).
- Panel Report minta pilih jenis; Leaderboard bisa pakai 3 channel berbeda (kosong = channel tujuan).
- Panel lama tidak dihapus otomatis; hapus manual di Discord bila perlu.
- Bot butuh izin Lihat Channel, Kirim Pesan, Sematkan Link di channel tujuan (dicek sebelum kirim).

## Integrasi dengan gamemode (whitelists)
Registrasi UCP lewat Discord memakai tabel **`whitelists`** milik gamemode (kolom `ucp`, `verify`, `recovery`, `discordid`), bukan `player_ucp`:
- Daftar: bot mengisi `ucp`, `verify` (kode 6 digit), `discordid`. Pemain memasukkan kode itu saat login pertama di game, lalu `verify` jadi -1.
- Reset password: bot mengisi `recovery`; game meminta kode itu saat login lalu mengembalikannya ke -1.
- Tidak ada kolom yang perlu ditambah. (Override lama `db.ucp.table = player_ucp` di data/settings.json otomatis diabaikan.)
- /jail /unjail /ban dari Discord: pemain online dijalankan GM lewat tabel `discord_actions` (lihat paket gamemode), pemain offline langsung ke database.

## Auto-setup Log
Menu **🪄 Auto-setup Log**: mencocokkan nama channel (mis. `#logs-jail`) ke pengaturan log bot, dan membuat channel log yang belum ada (izin & kategori disalin dari `#logs-jail`, awalan emoji ikut). Pilih baris yang mau diterapkan, klik **Terapkan**, lalu **Simpan & restart bot**. Membuat channel butuh izin *Manage Channels* untuk bot.
