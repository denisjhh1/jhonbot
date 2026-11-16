const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const LEGACY = [
    'analytics-data.json',
    'benefit-state.json',
    'changelog-state.json',
    'donation-state.json',
    'dutyreport-state.json',
    'izin-state.json',
    'monitoring-state.json',
    'ratestaff-state.json',
    'refund-state.json',
    'rekrut-state.json',
    'report-state.json',
    'req-state.json',
    'suggestion-state.json',
];

module.exports = function migrateLegacyData() {
    fs.mkdirSync(DATA, { recursive: true });
    for (const f of LEGACY) {
        const from = path.join(ROOT, f);
        const to = path.join(DATA, f);
        if (!fs.existsSync(from) || fs.existsSync(to)) continue;
        try {
            fs.renameSync(from, to);
            console.log(`[INFO] Data lama dipindah: ${f} -> data/${f}`);
        } catch (e) {
            try {
                fs.copyFileSync(from, to);
                fs.unlinkSync(from);
            } catch (e2) {
                console.log(`[WARNING] Gagal memindah ${f}: ${e2.message}`);
            }
        }
    }
};
