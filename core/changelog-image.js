const path = require('path');
const { PassThrough } = require('stream');
const PImage = require('pureimage');

const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
PImage.registerFont(path.join(FONT_DIR, 'DejaVuSansMono.ttf'), 'ChangelogMono', 400, 'normal').loadSync();
PImage.registerFont(path.join(FONT_DIR, 'DejaVuSansMono-Bold.ttf'), 'ChangelogMono', 700, 'normal').loadSync();
const createCanvas = (w, h) => PImage.make(w, h);

const STYLE = {
    width: 1280,
    padding: 56,
    fontSize: 26,
    lineHeight: 42,
    headerSize: 34,
    bg: '#000000',
    text: '#f2f2f2',
    dim: '#8a8a8a',
    rule: '#2a2a2a',
};

function parseItems(text) {
    return String(text ?? '')
        .split(/\r?\n/)
        .map((l) =>
            l
                .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
                .replace(/^\s*[-*•+]\s*/, '')
                .replace(
                    /^\[?(fitur|add|new|tambah|perbaikan|fix|bug|hotfix|update|change|ubah|pembaruan|hapus|remove|delete|optimasi|optimize|improve)\]\s*[:\-]?\s*/i,
                    '',
                )
                .trim()
                .toUpperCase(),
        )
        .filter(Boolean);
}

function wrap(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width <= maxWidth) {
            line = test;
            continue;
        }
        if (line) lines.push(line);
        line = '';
        let rest = word;
        while (ctx.measureText(rest).width > maxWidth) {
            let n = rest.length;
            while (n > 1 && ctx.measureText(rest.slice(0, n)).width > maxWidth) n--;
            lines.push(rest.slice(0, n));
            rest = rest.slice(n);
        }
        line = rest;
    }
    if (line) lines.push(line);
    return lines;
}

async function renderChangelogImage({ dateText, items }) {
    const S = STYLE;
    const font = `${S.fontSize}px ChangelogMono`;
    const measure = createCanvas(10, 10).getContext('2d');
    measure.font = font;
    const bulletW = measure.measureText('- ').width;
    const maxW = S.width - S.padding * 2 - bulletW;

    const blocks = items.map((t) => wrap(measure, t, maxW));
    const totalLines = blocks.reduce((n, b) => n + b.length, 0);
    const headerH = S.headerSize + 36;
    const height = Math.min(S.padding * 2 + headerH + totalLines * S.lineHeight + blocks.length * 6, 8000);

    const canvas = createCanvas(S.width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = S.bg;
    ctx.fillRect(0, 0, S.width, height);
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = S.text;
    ctx.font = `${S.headerSize}px ChangelogMono`;
    let y = S.padding + S.headerSize;
    ctx.fillText(dateText, S.padding, y);
    ctx.fillText(dateText, S.padding + 1, y);
    y += 20;
    ctx.fillStyle = S.rule;
    ctx.fillRect(S.padding, y, S.width - S.padding * 2, 2);
    y += 40;

    ctx.font = font;
    for (const lines of blocks) {
        if (y > height - S.padding / 2) break;
        lines.forEach((ln, i) => {
            if (i === 0) {
                ctx.fillStyle = S.dim;
                ctx.fillText('-', S.padding, y);
            }
            ctx.fillStyle = S.text;
            ctx.fillText(ln, S.padding + bulletW, y);
            y += S.lineHeight;
        });
        y += 6;
    }
    const out = new PassThrough();
    const chunks = [];
    out.on('data', (c) => chunks.push(c));
    await PImage.encodePNGToStream(canvas, out);
    return Buffer.concat(chunks);
}

module.exports = { renderChangelogImage, parseItems };
