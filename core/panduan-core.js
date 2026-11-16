const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const def = require('../defines');

const COLOR = '#5865F2';
const SELECT_ID = 'panduan-select';
const PANEL_ID = 'panduan-panel';

const TOPICS = {
    ucp: {
        emoji: '🌐',
        label: 'Akun UCP',
        short: 'Daftar, cek status, sync role, reset password',
        color: '#2B2D31',
        body: [
            'Akun **UCP** dibutuhkan sebelum kamu bisa bermain di server. Semua dikelola lewat **panel Account Hub** (cari di channel registrasi).',
            '',
            '### 📝 Buat UCP Baru',
            '> 1️⃣ Klik **Buat UCP** lalu isi nama UCP.',
            '> 2️⃣ Nama harus **4–15 huruf**, tanpa angka atau simbol.',
            '> 3️⃣ Satu akun Discord hanya bisa memiliki **satu UCP**.',
            '> 4️⃣ Kode verifikasi dikirim lewat **DM bot**.',
            '',
            '### 🔍 Cek Status',
            '> Pantau progres pendaftaran atau ambil ulang kode verifikasi jika DM tidak masuk.',
            '',
            '### 🔄 Sync Role',
            '> Role UCP hilang atau belum muncul setelah rejoin? Klik **Sync Role**.',
            '',
            '### 🔑 Reset Password',
            '> Lupa kata sandi UCP? Atur ulang lewat tombol **Reset Password**.',
            '',
            '💡 **Penting:** buka pengaturan DM Discord kamu agar bisa menerima pesan dari bot.',
        ],
    },
    report: {
        emoji: '🚫',
        label: 'Report',
        short: 'Lapor admin, player, faction, atau bug',
        color: 'Orange',
        body: [
            'Sistem report memakai **tiket privat**: hanya kamu dan Tim Admin yang bisa melihat channelnya.',
            '',
            '### 🧭 Jenis Report',
            '> 🛡️ **Report Admin** — staff menyalahgunakan wewenang atau tidak adil.',
            '> 🚫 **Report Player** — pemain melanggar aturan server.',
            '> 🏢 **Report Faction** — masalah pada faction (pilih faction dari daftar).',
            '> 🐞 **Report Bug** — bug, glitch, atau error di kota.',
            '',
            '### 🚀 Cara Melapor',
            '> 1️⃣ Klik tombol sesuai jenis report di panel.',
            '> 2️⃣ Isi form: nama pihak terkait, waktu kejadian, dan kronologi lengkap.',
            '> 3️⃣ Lampirkan bukti (screenshot/video, **maksimal 5 file**).',
            '> 4️⃣ Periksa pratinjau lalu tekan **Kirim**.',
            '> 5️⃣ Bot membuat channel privat dan kamu dikabari lewat DM saat laporan selesai atau ditolak.',
            '',
            '⚠️ **Ketentuan:**',
            '> • Jeda antar report **60 detik**; maksimal **2 tiket terbuka** per jenis.',
            '> • Bukti wajib valid. Laporan palsu bisa dikenai sanksi.',
            '> • Bug **jangan** dibahas di channel publik agar tidak disalahgunakan (*bug abuse* dilarang).',
        ],
    },
    saran: {
        emoji: '💡',
        label: 'Saran',
        short: 'Kirim ide, vote, dan komentar',
        color: 'Gold',
        body: [
            'Punya ide untuk memajukan server? Kirim lewat **panel Saran**. Semua warga bisa melihat, vote, dan berkomentar.',
            '',
            '### 📌 Kategori',
            '> 💡 **Saran Fitur** • 🗺️ **Saran Mapingan** • 🎨 **Saran Textdraw** • 🤖 **Saran Fitur DC**',
            '',
            '### 📝 Cara Mengirim',
            '> 1️⃣ Klik tombol kategori yang sesuai.',
            '> 2️⃣ Isi judul, deskripsi detail, dan lampiran foto.',
            '> 3️⃣ Periksa pratinjau lalu tekan **Kirim Saran** (draft berlaku **10 menit**).',
            '> 4️⃣ Saran tampil di channel publik. Kamu bisa mengubahnya kapan saja lewat tombol **Edit**.',
            '',
            '### 🗳️ Interaksi',
            '> 👍👎 **Vote** — klik lagi untuk membatalkan vote.',
            '> 💬 **Komentar** — beri tanggapan pada saran warga lain.',
            '> 🏷️ **Status** — ⏳ Menunggu → 👀 Dipertimbangkan → ✅ Diterima → 🚧 Dikerjakan → 🎉 Selesai (atau ❌ Ditolak).',
            '',
            '⚠️ Gunakan bahasa sopan, satu topik per saran, tanpa spam/duplikat. Laporan bug masuk ke **Report Bug**.',
        ],
    },
    donasi: {
        emoji: '💎',
        label: 'Donasi',
        short: 'Katalog, cara beli, dan pesanan',
        color: '#FFD700',
        body: [
            'Dukung server sekaligus dapatkan item donasi lewat **panel Donasi**. Semua transaksi lewat **tiket privat**.',
            '',
            '### 🛒 Cara Memesan',
            '> 1️⃣ Klik **Beli Donasi**, pilih kategori lalu item.',
            '> 2️⃣ Lengkapi data (nama karakter, nama UCP, detail permintaan).',
            '> 3️⃣ Periksa pratinjau lalu **Kirim Pesanan**; tiket privat dibuat otomatis.',
            '> 4️⃣ Bayar via **QRIS** di dalam tiket, upload bukti, lalu tekan **Saya Sudah Bayar**.',
            '> 5️⃣ Staff memverifikasi dan memproses pesananmu di tiket yang sama.',
            '',
            '### 📖 Fitur Lain',
            '> **Lihat Katalog** — daftar harga, paket, dan detail benefit.',
            '> **Pesanan Saya** — cek status dan riwayat pesananmu.',
            '> Kategori mencakup paket donasi, rumah, kendaraan, mapping, VIP, bisnis, workshop, dan layanan lainnya.',
            '',
            '🚨 **Waspada penipuan:**',
            '> • Bayar **hanya** lewat QRIS resmi di dalam tiket bot.',
            '> • Transaksi lewat DM staff/orang lain adalah **penipuan**; staff tidak pernah meminta password.',
            '> • Penyalahgunaan item donasi dapat dicabut tanpa pengembalian dana.',
        ],
    },
    refund: {
        emoji: '💸',
        label: 'Refund',
        short: 'Ajukan pengembalian & cek status',
        color: '#E67E22',
        body: [
            'Kehilangan uang, item, atau progres? Ajukan lewat **panel Refund**. Pengajuan diproses lewat **tiket privat**.',
            '',
            '### 📋 Kategori',
            '> 💵 Uang IC • 🎒 Item • 🚗 Kendaraan • 🏠 Rumah/Bisnis • 💎 Donasi • 📈 Level/Progres • 📦 Lainnya',
            '',
            '### 🚀 Cara Mengajukan',
            '> 1️⃣ Klik **Ajukan Refund**, lalu pilih kategori.',
            '> 2️⃣ Isi nama karakter, yang hilang, waktu kejadian, dan kronologi singkat.',
            '> 3️⃣ **Lampirkan bukti** (screenshot/video, wajib, maksimal 5 file).',
            '> 4️⃣ Periksa pratinjau lalu **Kirim Pengajuan**.',
            '> 5️⃣ Pantau lewat **DM** atau tombol **Status Refund Saya**.',
            '',
            '### 📌 Status Pengajuan',
            '> 🟡 Menunggu → 🔵 Diproses → 🟠 Butuh Bukti Tambahan → 🟢 Disetujui → ✅ Sudah Dikirim (atau 🔴 Ditolak).',
            '',
            '⚠️ **Ketentuan:**',
            '> • Bukti wajib; pengajuan tanpa bukti jelas tidak diproses.',
            '> • Maksimal **2 pengajuan aktif** per orang, dengan jeda 60 detik antar pengajuan.',
            '> • Pengajuan palsu atau berlebihan dapat dikenai sanksi, dan tidak ada jaminan disetujui.',
            '> • Refund **donasi** diputuskan langsung oleh Management.',
            '> • Jangan DM staff; pantau lewat tiketmu.',
        ],
    },
    rate: {
        emoji: '⭐',
        label: 'Rate Staff',
        short: 'Nilai pelayanan staff',
        color: '#F1C40F',
        body: [
            'Bantu kami menjaga kualitas pelayanan lewat **panel Rate Staff**.',
            '',
            '### 📌 Cara Menilai',
            '> 1️⃣ Klik **⭐ Rate Staff**.',
            '> 2️⃣ Pilih staff yang ingin dinilai.',
            '> 3️⃣ Pilih bintang **1–5** dan tulis alasan (boleh dikosongkan).',
            '> 4️⃣ Periksa pratinjau lalu **Kirim**.',
            '',
            '### ⚠️ Ketentuan',
            '> • Satu staff hanya bisa dinilai **1x per 24 jam** oleh orang yang sama.',
            '> • Nilai dengan jujur dan sopan; ulasan palsu/spam bisa dikenai sanksi.',
            '> • Tersedia opsi **kirim anonim** (nama disembunyikan dari tampilan).',
        ],
    },
    server: {
        emoji: '📡',
        label: 'Info Server',
        short: 'IP, status, dan ping',
        color: 'Green',
        body: [
            '### 🌐 `/ip`',
            '> Menampilkan IP, port, dan status server (online/offline beserta jumlah pemain). Tekan **Salin IP** untuk menyalin alamatnya.',
            '',
            '### 📡 Status Server Otomatis',
            '> Bot memantau server secara berkala dan memperbarui **satu pesan status** di channel status, tanpa spam atau tag.',
            '> Pengumuman 🟢 Online, 🔴 Offline, dan 🟠 Maintenance juga dikirim ke channel status.',
            '',
            '### 🏓 `/ping`',
            '> Mengecek apakah bot merespons beserta latensinya.',
        ],
    },
    top: {
        emoji: '🏆',
        label: 'Leaderboard',
        short: 'Top online dan top admin',
        color: 'Gold',
        body: [
            '### ⏱️ `/toponline [jumlah]`',
            '> Daftar pemain dengan **waktu online terbanyak**.',
            `> Opsi \`jumlah\`: opsional, default 10, maksimal 25.`,
            '',
            '### 🛡️ `/topadmin [urutkan]`',
            '> Daftar admin dengan point tertinggi.',
            '> Opsi `urutkan`: pilih urutan berdasarkan jenis point (default: Admin Point).',
        ],
    },
};

const keys = Object.keys(TOPICS);

function homeEmbed() {
    const lines = keys.map((k) => `> ${TOPICS[k].emoji} **${TOPICS[k].label}** — ${TOPICS[k].short}`);
    const e = new EmbedBuilder()
        .setTitle('📖 Panduan Penggunaan Bot — Expensive Roleplay')
        .setColor(COLOR)
        .setDescription(
            [
                'Selamat datang! Berikut fitur yang bisa kamu pakai. **Pilih topik di menu bawah** untuk melihat panduan lengkapnya.',
                '',
                ...lines,
                '',
                '### ⚡ Command Cepat',
                '> `/panduan` — membuka panduan ini',
                '> `/ip` — IP & status server',
                '> `/toponline` — top pemain online',
                '> `/topadmin` — top admin',
                '> `/ping` — cek respons bot',
                '',
                '💡 Fitur seperti Report, Saran, Donasi, Rate Staff, dan UCP dipakai lewat **tombol pada panel** di channel masing-masing.',
            ].join('\n'),
        )
        .setFooter({ text: 'Expensive Roleplay • Panduan Warga', iconURL: def.icon?.thumbnail })
        .setTimestamp();
    if (def.icon?.thumbnail) e.setThumbnail(def.icon.thumbnail);
    return e;
}

function topicEmbed(key) {
    const t = TOPICS[key];
    const e = new EmbedBuilder()
        .setTitle(`${t.emoji} Panduan ${t.label}`)
        .setColor(t.color ?? COLOR)
        .setDescription(t.body.join('\n'))
        .setFooter({ text: 'Pilih topik lain di menu bawah • Expensive Roleplay', iconURL: def.icon?.thumbnail })
        .setTimestamp();
    if (def.icon?.thumbnail) e.setThumbnail(def.icon.thumbnail);
    return e;
}

function menuRow(current = 'home') {
    const options = [
        {
            label: 'Beranda',
            value: 'home',
            emoji: '📖',
            description: 'Ringkasan semua fitur',
            default: current === 'home',
        },
        ...keys.map((k) => ({
            label: TOPICS[k].label,
            value: k,
            emoji: TOPICS[k].emoji,
            description: TOPICS[k].short.slice(0, 100),
            default: current === k,
        })),
    ];
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(SELECT_ID)
            .setPlaceholder('Pilih topik panduan...')
            .addOptions(options),
    );
}

function panelPayload() {
    const options = keys.map((k) => ({
        label: TOPICS[k].label,
        value: k,
        emoji: TOPICS[k].emoji,
        description: TOPICS[k].short.slice(0, 100),
    }));
    const embed = homeEmbed().setDescription(
        homeEmbed().data.description.replace(
            '**Pilih topik di menu bawah** untuk melihat panduan lengkapnya.',
            '**Pilih topik di menu bawah** untuk melihat panduan lengkapnya. Jawaban hanya terlihat olehmu.',
        ),
    );
    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(PANEL_ID)
                    .setPlaceholder('📖 Pilih topik panduan...')
                    .addOptions(options),
            ),
        ],
    };
}

function payload(key = 'home') {
    const embed = key === 'home' || !TOPICS[key] ? homeEmbed() : topicEmbed(key);
    return { embeds: [embed], components: [menuRow(TOPICS[key] ? key : 'home')] };
}

module.exports = { TOPICS, SELECT_ID, PANEL_ID, payload, panelPayload };
