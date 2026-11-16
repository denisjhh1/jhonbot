const fs = require('fs');
const path = require('path');
const { PassThrough, Readable } = require('stream');
const PImage = require('pureimage');

const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');

PImage.registerFont(path.join(FONT_DIR, 'DejaVuSansMono.ttf'), 'IDMono', 400, 'normal').loadSync();
PImage.registerFont(path.join(FONT_DIR, 'DejaVuSansMono-Bold.ttf'), 'IDMonoBold', 700, 'normal').loadSync();

const W = 1012;
const H = 638;

function clean(s) {
    return String(s ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/_/g, ' ')
        .replace(/[^\x20-\x7e]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

const font = (ctx, size, bold = false) => {
    ctx.font = `${size}px ${bold ? 'IDMonoBold' : 'IDMono'}`;
};

function wrap(ctx, text, maxWidth, maxLines = 3) {
    const lines = [];
    let line = '';
    for (const word of String(text).split(' ')) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width <= maxWidth) {
            line = test;
            continue;
        }
        if (line) lines.push(line);
        line = word;
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
        lines.length = maxLines;
        lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, '..');
    }
    return lines;
}

function text(ctx, str, x, y, { size = 24, bold = false, color = '#111', align = 'left', max = 0 } = {}) {
    font(ctx, size, bold);
    let s = String(str);
    if (max) while (s.length > 1 && ctx.measureText(s).width > max) s = s.slice(0, -1);
    const w = ctx.measureText(s).width;
    const px = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    ctx.fillStyle = color;
    ctx.fillText(s, px, y);
    return w;
}

const rect = (ctx, x, y, w, h, color, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
};

function roundedFill(ctx, x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
}

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

function background(ctx, top, bottom, line = '#ffffff') {
    const a = hex(top),
        b = hex(bottom);
    for (let y = 0; y < H; y += 2) {
        const t = y / H;
        const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fillRect(0, y, W, 2);
    }
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    for (let x = -H; x < W; x += 26) {
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.lineTo(x + H, 0);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

function frame(ctx, color, width = 8) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.strokeRect(width / 2, width / 2, W - width, H - width);
}

function drawPhoto(ctx, photo, x, y, w, h, { focusY = 0.2, bg = '#dfe6ee', border = '#1b2a41' } = {}) {
    rect(ctx, x - 6, y - 6, w + 12, h + 12, border);
    rect(ctx, x, y, w, h, bg);
    if (photo?.width && photo?.height) {
        const target = w / h;
        let sw = photo.width,
            sh = photo.height;
        if (sw / sh > target) sw = Math.round(sh * target);
        else sh = Math.round(sw / target);
        const sx = Math.round((photo.width - sw) / 2);
        const sy = Math.round((photo.height - sh) * focusY);
        ctx.drawImage(photo, sx, sy, sw, sh, x, y, w, h);
        return;
    }

    ctx.fillStyle = '#9aa7b6';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.36, w * 0.2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.1, y + h);
    ctx.quadraticCurveTo(x + w * 0.1, y + h * 0.62, x + w * 0.5, y + h * 0.62);
    ctx.quadraticCurveTo(x + w * 0.9, y + h * 0.62, x + w * 0.9, y + h);
    ctx.closePath();
    ctx.fill();
}

function field(
    ctx,
    label,
    value,
    x,
    y,
    {
        labelW = 250,
        valueW = 400,
        size = 22,
        labelSize = size,
        gap = 38,
        color = '#0d1b2a',
        labelColor = '#34495e',
        bold = true,
    } = {},
) {
    text(ctx, label, x, y, { size: labelSize, color: labelColor });
    text(ctx, ':', x + labelW - 18, y, { size, color: labelColor });
    font(ctx, size, bold);
    const lines = wrap(ctx, value, valueW, 3);
    lines.forEach((ln, i) => text(ctx, ln, x + labelW, y + i * (size + 6), { size, bold, color }));
    return y + Math.max(gap, lines.length * (size + 6) + 10);
}

async function toPng(canvas) {
    const out = new PassThrough();
    const chunks = [];
    out.on('data', (c) => chunks.push(c));
    await PImage.encodePNGToStream(canvas, out);
    return Buffer.concat(chunks);
}

async function decodeImage(buf) {
    try {
        const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
        const isJpg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8;
        if (isPng) return await PImage.decodePNGFromStream(Readable.from(buf));
        if (isJpg) return await PImage.decodeJPEGFromStream(Readable.from(buf));
    } catch {}
    return null;
}

function renderKtp(ctx, d, photo) {
    background(ctx, '#d6ecfa', '#8fc6e8');
    frame(ctx, '#1d5f8a');
    rect(ctx, 0, 0, W, 8, '#1d5f8a');

    text(ctx, d.province, W / 2 - 110, 54, { size: 32, bold: true, color: '#0b2d45', align: 'center' });
    text(ctx, d.city, W / 2 - 110, 92, { size: 28, bold: true, color: '#0b2d45', align: 'center' });

    text(ctx, 'NIK', 40, 160, { size: 28, bold: true, color: '#0b2d45' });
    text(ctx, ':', 128, 160, { size: 28, bold: true, color: '#0b2d45' });
    text(ctx, d.nik, 150, 160, { size: 40, bold: true, color: '#0b2d45' });

    let y = 214;
    const o = { labelW: 270, valueW: 410, size: 22 };
    y = field(ctx, 'Nama', d.name, 40, y, o);
    y = field(ctx, 'Tempat/Tgl Lahir', `${d.birthPlace}, ${d.birthDate}`, 40, y, o);
    y = field(ctx, 'Jenis Kelamin', d.gender, 40, y, o);
    y = field(ctx, 'Alamat', d.address, 40, y, o);
    y = field(ctx, 'Kewarganegaraan', d.nationality, 40, y, o);
    y = field(ctx, 'Berlaku Hingga', d.validUntil, 40, y, o);

    drawPhoto(ctx, photo, 746, 150, 232, 300, { focusY: d.photoFocus });
    text(ctx, d.city.replace(/^KOTA /, ''), 862, 500, { size: 22, bold: true, color: '#0b2d45', align: 'center' });
    text(ctx, d.issueDate, 862, 530, { size: 22, color: '#0b2d45', align: 'center' });

    rect(ctx, 0, H - 52, W, 52, '#1d5f8a');
    text(ctx, `${d.serverName}  |  KARTU DIGITAL - KHUSUS ROLEPLAY`, W / 2, H - 18, {
        size: 20,
        color: '#eaf6ff',
        align: 'center',
    });
    text(ctx, 'KARTU TANDA PENDUDUK', 40, H - 70, { size: 18, bold: true, color: '#1d5f8a' });
}

function renderSim(ctx, d, photo) {
    background(ctx, '#fbeedd', '#f1c9a0');
    frame(ctx, '#a1480f');
    rect(ctx, 0, 0, W, 96, '#a1480f');
    text(ctx, 'SURAT IZIN MENGEMUDI', 40, 48, { size: 34, bold: true, color: '#fff5e8' });
    text(ctx, `DRIVING LICENCE  |  ${d.city}`, 40, 80, { size: 20, color: '#ffd9b3' });

    roundedFill(ctx, 870, 14, 110, 68, 12, '#fff5e8');
    text(
        ctx,
        d.simClasses
            .map((c) => c.cls)
            .join(' ')
            .slice(0, 5) || '-',
        925,
        64,
        { size: 44, bold: true, color: '#a1480f', align: 'center' },
    );

    text(ctx, `No. ${d.simNumber}`, 40, 150, { size: 34, bold: true, color: '#5b2606' });

    let y = 200;
    const o = { labelW: 270, valueW: 400, size: 22, labelColor: '#6b3a1a', color: '#2b1204' };
    y = field(ctx, 'Nama', d.name, 40, y, o);
    y = field(ctx, 'Tempat/Tgl Lahir', `${d.birthPlace}, ${d.birthDate}`, 40, y, o);
    y = field(ctx, 'Jenis Kelamin', `${d.gender}   TINGGI ${d.height} CM`, 40, y, o);
    y = field(ctx, 'Alamat', d.address, 40, y, o);

    y += 4;
    d.simClasses.slice(0, 3).forEach((c) => {
        const expired = c.expired;
        text(ctx, `GOL ${c.cls}`, 40, y, { size: 22, bold: true, color: '#6b3a1a' });
        text(ctx, `S/D ${c.until}`, 160, y, { size: 22, bold: true, color: expired ? '#b00020' : '#2b1204' });
        if (expired) text(ctx, 'KADALUARSA', 420, y, { size: 20, bold: true, color: '#b00020' });
        y += 34;
    });

    drawPhoto(ctx, photo, 746, 128, 232, 300, { focusY: d.photoFocus, border: '#5b2606' });
    text(ctx, d.issueDate, 862, 470, { size: 22, color: '#5b2606', align: 'center' });

    rect(ctx, 0, H - 52, W, 52, '#a1480f');
    text(ctx, `${d.serverName}  |  KARTU DIGITAL - KHUSUS ROLEPLAY`, W / 2, H - 18, {
        size: 20,
        color: '#fff5e8',
        align: 'center',
    });
}

function renderPassport(ctx, d, photo) {
    background(ctx, '#f4efe2', '#e2d9bf', '#b9a972');
    frame(ctx, '#15305a');
    rect(ctx, 0, 0, W, 86, '#15305a');
    text(ctx, 'PASPOR  /  PASSPORT', 40, 44, { size: 34, bold: true, color: '#f7e7b0' });
    text(ctx, d.passportCountry, 40, 74, { size: 20, color: '#c9d6ee' });
    text(ctx, `Tipe/Type  P     Kode/Code  ${d.countryCode}`, W - 40, 56, {
        size: 22,
        bold: true,
        color: '#f7e7b0',
        align: 'right',
    });

    drawPhoto(ctx, photo, 40, 118, 220, 285, { focusY: d.photoFocus, border: '#15305a', bg: '#e6ebf2' });

    const x = 300;
    const o = { labelW: 300, valueW: 370, size: 20, labelSize: 16, gap: 34, labelColor: '#3b4a68', color: '#0f1c33' };
    let y = 134;
    y = field(ctx, 'No. Paspor/Passport No.', d.passportNumber, x, y, o);
    y = field(ctx, 'Nama/Surname', d.surname, x, y, o);
    y = field(ctx, 'Nama Depan/Given Names', d.givenNames, x, y, o);
    y = field(ctx, 'Kewarganegaraan/Nationality', d.nationalityLong, x, y, o);
    y = field(ctx, 'Tgl Lahir/Date of Birth', d.birthDate, x, y, o);
    y = field(ctx, 'Tempat Lahir/Place of Birth', d.birthPlace, x, y, o);
    y = field(ctx, 'Jenis Kelamin/Sex', d.sex, x, y, o);
    y = field(ctx, 'Tgl Terbit/Date of Issue', d.issueDate, x, y, o);
    y = field(ctx, 'Berlaku s/d / Date of Expiry', d.passportExpiry, x, y, o);

    rect(ctx, 24, H - 150, W - 48, 118, '#fffdf5');
    text(ctx, d.mrz[0], 40, H - 92, { size: 29, bold: true, color: '#111' });
    text(ctx, d.mrz[1], 40, H - 52, { size: 29, bold: true, color: '#111' });
    text(ctx, `${d.serverName}  |  KARTU DIGITAL - KHUSUS ROLEPLAY`, W / 2, H - 12, {
        size: 16,
        color: '#3b4a68',
        align: 'center',
    });
}

const RENDERERS = { ktp: renderKtp, sim: renderSim, paspor: renderPassport };

async function renderCard(kind, data, photo) {
    const canvas = PImage.make(W, H);
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic';
    RENDERERS[kind](ctx, data, photo);
    return toPng(canvas);
}

module.exports = { renderCard, decodeImage, clean, W, H };
