const fs = require('fs');
const path = require('path');

let bytenode;
try {
    bytenode = require('bytenode');
} catch {
    console.error('Paket "bytenode" belum terpasang. Jalankan dulu:  npm install');
    process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist');

const COMPILE_DIRS = ['core', 'commands', 'components', 'events', 'handlers', 'class'];
const COMPILE_FILES = ['functions.js'];
const COPY_FILES = ['JhonBot.js', 'defines.js', 'package.json', 'package-lock.json', 'start.bat', 'README.md'];
const COPY_DIRS = ['catalog', 'assets'];

const rm = (p) => fs.rmSync(p, { recursive: true, force: true });
const mkdir = (p) => fs.mkdirSync(p, { recursive: true });

function copyDir(from, to) {
    mkdir(to);
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
        const a = path.join(from, e.name),
            b = path.join(to, e.name);
        if (e.isDirectory()) copyDir(a, b);
        else fs.copyFileSync(a, b);
    }
}

let compiled = 0;
const failed = [];

function compileOne(relFile) {
    const src = path.join(ROOT, relFile);
    const jsc = path.join(OUT, relFile.replace(/\.js$/, '.jsc'));
    mkdir(path.dirname(jsc));
    try {
        bytenode.compileFile({ filename: src, output: jsc, compileAsModule: true });

        const base = path.basename(jsc);
        fs.writeFileSync(path.join(OUT, relFile), `require('bytenode');\nmodule.exports = require('./${base}');\n`);
        compiled++;
    } catch (e) {
        failed.push(`${relFile}: ${e.message.split('\n')[0]}`);
    }
}

function walk(dir, cb) {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = path.join(dir, e.name);
        if (e.isDirectory()) walk(rel, cb);
        else if (e.name.endsWith('.js')) cb(rel);
    }
}

console.log(`Node ${process.version} (${process.arch}) — samakan dengan versi Node di hosting!\n`);
rm(OUT);
mkdir(OUT);

for (const d of COMPILE_DIRS) if (fs.existsSync(path.join(ROOT, d))) walk(d, compileOne);
for (const f of COMPILE_FILES) if (fs.existsSync(path.join(ROOT, f))) compileOne(f);
for (const f of COPY_FILES)
    if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
for (const d of COPY_DIRS) if (fs.existsSync(path.join(ROOT, d))) copyDir(path.join(ROOT, d), path.join(OUT, d));

mkdir(path.join(OUT, 'data'));
fs.writeFileSync(path.join(OUT, 'data', 'BACA-INI.txt'), 'Folder ini berisi data bot (*.json). JANGAN dihapus.\n');

try {
    const pkgFile = path.join(OUT, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    pkg.dependencies = pkg.dependencies ?? {};
    pkg.dependencies.bytenode = pkg.dependencies.bytenode ?? `^${require('bytenode/package.json').version}`;
    fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
} catch (e) {
    console.log('Peringatan: gagal mengubah package.json di dist:', e.message);
}

fs.writeFileSync(
    path.join(OUT, 'NODE-VERSION.txt'),
    `Dibuild dengan Node ${process.version} (${process.platform}/${process.arch}) pada ${new Date().toISOString()}\nNode di hosting harus versi yang sama.\n`,
);

console.log(`✅ ${compiled} file dikompilasi ke .jsc`);
if (failed.length) {
    console.log(`❌ ${failed.length} file GAGAL dikompilasi (dibiarkan tidak ikut):`);
    failed.forEach((f) => console.log('   -', f));
    process.exitCode = 1;
}
console.log(
    `\nHasil ada di: ${OUT}\nUpload ISI folder dist/ ke hosting, lalu di hosting jalankan:  npm install  →  node JhonBot.js`,
);
