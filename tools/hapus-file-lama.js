const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const targetOf = (f) => {
    if (
        f.endsWith('-core.js') ||
        ['query.js', 'ratestaff-select.js', 'rekrut-form.js', 'analytics-chart.js'].includes(f)
    )
        return 'core';
    if (f.endsWith('-catalog.js')) return 'catalog';
    if (f === 'defines-ai.txt' || f === 'defines-refund.txt') return 'docs';
    if (f === 'test-gemini.js') return 'tools';
    return null;
};

let n = 0;
for (const f of fs.readdirSync(ROOT)) {
    const t = targetOf(f);
    if (!t || !fs.statSync(path.join(ROOT, f)).isFile()) continue;
    if (fs.existsSync(path.join(ROOT, t, f))) {
        fs.unlinkSync(path.join(ROOT, f));
        console.log(`dihapus: ${f}  (salinan baru ada di ${t}/${f})`);
        n++;
    } else {
        console.log(`DILEWATI: ${f}  (belum ada di ${t}/, tidak dihapus)`);
    }
}
console.log(n ? `\nSelesai, ${n} file lama dibersihkan.` : '\nTidak ada file lama yang perlu dibersihkan.');
