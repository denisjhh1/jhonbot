const zlib = require('zlib');

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C = {
    surface: hex('#1f2023'),
    ink: hex('#f0efec'),
    ink2: hex('#c3c2b7'),
    muted: hex('#8d8c85'),
    grid: hex('#3a3b3f'),
    axis: hex('#55565b'),
    series: ['#3987e5', '#d95926', '#199e70', '#9085e9', '#d55181'].map(hex),
};

const rows = (s) => s.match(/.{5}/g);
const FONT = {};
const def5 = (ch, str) => {
    FONT[ch] = rows(str.replace(/\s+/g, ''));
};
def5('0', '.###. #...# #..## #.#.# ##..# #...# .###.');
def5('1', '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.');
def5('2', '.###. #...# ....# ...#. ..#.. .#... #####');
def5('3', '.###. #...# ....# ..##. ....# #...# .###.');
def5('4', '...#. ..##. .#.#. #..#. ##### ...#. ...#.');
def5('5', '##### #.... ####. ....# ....# #...# .###.');
def5('6', '..##. .#... #.... ####. #...# #...# .###.');
def5('7', '##### ....# ...#. ..#.. .#... .#... .#...');
def5('8', '.###. #...# #...# .###. #...# #...# .###.');
def5('9', '.###. #...# #...# .#### ....# ...#. .##..');
def5('A', '.###. #...# #...# ##### #...# #...# #...#');
def5('B', '####. #...# #...# ####. #...# #...# ####.');
def5('C', '.###. #...# #.... #.... #.... #...# .###.');
def5('D', '####. #...# #...# #...# #...# #...# ####.');
def5('E', '##### #.... #.... ####. #.... #.... #####');
def5('F', '##### #.... #.... ####. #.... #.... #....');
def5('G', '.###. #...# #.... #.### #...# #...# .###.');
def5('H', '#...# #...# #...# ##### #...# #...# #...#');
def5('I', '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.');
def5('J', '..### ...#. ...#. ...#. ...#. #..#. .##..');
def5('K', '#...# #..#. #.#.. ##... #.#.. #..#. #...#');
def5('L', '#.... #.... #.... #.... #.... #.... #####');
def5('M', '#...# ##.## #.#.# #.#.# #...# #...# #...#');
def5('N', '#...# ##..# #.#.# #..## #...# #...# #...#');
def5('O', '.###. #...# #...# #...# #...# #...# .###.');
def5('P', '####. #...# #...# ####. #.... #.... #....');
def5('Q', '.###. #...# #...# #...# #.#.# #..#. .##.#');
def5('R', '####. #...# #...# ####. #.#.. #..#. #...#');
def5('S', '.#### #.... #.... .###. ....# ....# ####.');
def5('T', '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..');
def5('U', '#...# #...# #...# #...# #...# #...# .###.');
def5('V', '#...# #...# #...# #...# #...# .#.#. ..#..');
def5('W', '#...# #...# #...# #.#.# #.#.# ##.## #...#');
def5('X', '#...# #...# .#.#. ..#.. .#.#. #...# #...#');
def5('Y', '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..');
def5('Z', '##### ....# ...#. ..#.. .#... #.... #####');
def5('/', '....# ....# ...#. ..#.. .#... #.... #....');
def5(':', '..... ..#.. ..#.. ..... ..#.. ..#.. .....');
def5('.', '..... ..... ..... ..... ..... .##.. .##..');
def5('-', '..... ..... ..... ##### ..... ..... .....');
def5('%', '##..# ##..# ...#. ..#.. .#... #..## #..##');
def5('+', '..... ..#.. ..#.. ##### ..#.. ..#.. .....');
def5(' ', '..... ..... ..... ..... ..... ..... .....');

const SS = 2;

class Canvas {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.W = w * SS;
        this.H = h * SS;
        this.px = Buffer.alloc(this.W * this.H * 3);
        for (let i = 0; i < this.px.length; i += 3) {
            this.px[i] = C.surface[0];
            this.px[i + 1] = C.surface[1];
            this.px[i + 2] = C.surface[2];
        }
    }

    blend(x, y, col, a) {
        if (x < 0 || y < 0 || x >= this.W || y >= this.H || a <= 0) return;
        const i = (y * this.W + x) * 3;
        const p = this.px;
        p[i] += (col[0] - p[i]) * a;
        p[i + 1] += (col[1] - p[i + 1]) * a;
        p[i + 2] += (col[2] - p[i + 2]) * a;
    }

    rect(x, y, w, h, col, alpha = 1) {
        const x0 = Math.round(x * SS),
            y0 = Math.round(y * SS),
            x1 = Math.round((x + w) * SS),
            y1 = Math.round((y + h) * SS);
        for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.blend(xx, yy, col, alpha);
    }

    bar(x, y, w, h, col, r = 4) {
        if (h <= 0) return;
        r = Math.min(r, w / 2, h);
        const x0 = Math.round(x * SS),
            y0 = Math.round(y * SS),
            x1 = Math.round((x + w) * SS),
            y1 = Math.round((y + h) * SS);
        const R = r * SS;
        for (let yy = y0; yy < y1; yy++) {
            for (let xx = x0; xx < x1; xx++) {
                let a = 1;
                const dy = y0 + R - yy;
                if (dy > 0) {
                    const dxl = x0 + R - xx,
                        dxr = xx - (x1 - R);
                    const dx = dxl > 0 ? dxl : dxr > 0 ? dxr : 0;
                    if (dx > 0) a = Math.max(0, Math.min(1, R + 0.5 - Math.hypot(dx, dy)));
                }
                this.blend(xx, yy, col, a);
            }
        }
    }

    line(x1, y1, x2, y2, width, col, alpha = 1) {
        const hw = (width * SS) / 2;
        const ax = x1 * SS,
            ay = y1 * SS,
            bx = x2 * SS,
            by = y2 * SS;
        const minX = Math.floor(Math.min(ax, bx) - hw - 1),
            maxX = Math.ceil(Math.max(ax, bx) + hw + 1);
        const minY = Math.floor(Math.min(ay, by) - hw - 1),
            maxY = Math.ceil(Math.max(ay, by) + hw + 1);
        const dx = bx - ax,
            dy = by - ay;
        const len2 = dx * dx + dy * dy || 1;
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                let t = ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / len2;
                t = Math.max(0, Math.min(1, t));
                const d = Math.hypot(x + 0.5 - (ax + t * dx), y + 0.5 - (ay + t * dy));
                const cov = Math.max(0, Math.min(1, hw + 0.5 - d));
                if (cov > 0) this.blend(x, y, col, cov * alpha);
            }
        }
    }

    circle(cx, cy, r, col) {
        const R = r * SS,
            X = cx * SS,
            Y = cy * SS;
        for (let y = Math.floor(Y - R - 1); y <= Math.ceil(Y + R + 1); y++) {
            for (let x = Math.floor(X - R - 1); x <= Math.ceil(X + R + 1); x++) {
                const cov = Math.max(0, Math.min(1, R + 0.5 - Math.hypot(x + 0.5 - X, y + 0.5 - Y)));
                if (cov > 0) this.blend(x, y, col, cov);
            }
        }
    }

    area(pts, baseY, col, alpha) {
        for (let i = 0; i < pts.length - 1; i++) {
            const [xa, ya] = pts[i],
                [xb, yb] = pts[i + 1];
            const xs = Math.round(xa * SS),
                xe = Math.round(xb * SS);
            for (let x = xs; x < xe; x++) {
                const t = xe === xs ? 0 : (x - xs) / (xe - xs);
                const y = (ya + (yb - ya) * t) * SS;
                for (let yy = Math.round(y); yy < Math.round(baseY * SS); yy++) this.blend(x, yy, col, alpha);
            }
        }
    }

    text(str, x, y, scale, col, align = 'left') {
        str = String(str).toUpperCase();
        const adv = 6 * scale;
        const width = str.length * adv - scale;
        let cx = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
        for (const ch of str) {
            const g = FONT[ch] ?? FONT[' '];
            for (let r = 0; r < 7; r++) {
                for (let c = 0; c < 5; c++) {
                    if (g[r][c] === '#') this.rect(cx + c * scale, y + r * scale, scale, scale, col);
                }
            }
            cx += adv;
        }
    }

    toPNG() {
        const { w, h, W } = this;
        const out = Buffer.alloc(h * (w * 3 + 1));
        for (let y = 0; y < h; y++) {
            const o = y * (w * 3 + 1);
            out[o] = 0;
            for (let x = 0; x < w; x++) {
                for (let ch = 0; ch < 3; ch++) {
                    let s = 0;
                    for (let sy = 0; sy < SS; sy++)
                        for (let sx = 0; sx < SS; sx++) s += this.px[((y * SS + sy) * W + x * SS + sx) * 3 + ch];
                    out[o + 1 + x * 3 + ch] = Math.round(s / (SS * SS));
                }
            }
        }
        return encodePNG(w, h, out);
    }
}

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();
const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
};
function encodePNG(w, h, raw) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

function niceStep(range, ticks) {
    const rough = range / Math.max(1, ticks);
    const pow = 10 ** Math.floor(Math.log10(rough));
    const f = rough / pow;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

function makeScale(values, zeroBase) {
    const v = values.filter((x) => x !== null && x !== undefined && Number.isFinite(x));
    let lo = v.length ? Math.min(...v) : 0;
    let hi = v.length ? Math.max(...v) : 1;
    if (zeroBase) lo = 0;
    if (hi === lo) hi = lo + 1;
    if (!zeroBase) {
        const pad = (hi - lo) * 0.15;
        lo = Math.max(0, lo - pad);
        hi += pad;
    }
    const step = niceStep(hi - lo, 4);
    const min = Math.floor(lo / step) * step;
    const max = Math.ceil(hi / step) * step;
    const ticks = [];
    for (let t = min; t <= max + step / 1e6; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
    return { min, max, ticks };
}

const fmtNum = (n) => {
    if (n === null || n === undefined) return '';
    if (Math.abs(n) >= 10000) return `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}K`;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

const TS = 1.5;
const TT = 2;

function panelFrame(cv, box, { title, legend, scale, yFmt = fmtNum }) {
    const ml = 54,
        mr = 28,
        mt = 40,
        mb = 30;
    const plot = { x: box.x + ml, y: box.y + mt, w: box.w - ml - mr, h: box.h - mt - mb };
    cv.text(title, box.x + 14, box.y + 12, TT, C.ink);

    if (legend?.length > 1) {
        let lx = box.x + box.w - mr;
        for (const l of [...legend].reverse()) {
            const wText = l.name.length * 6 * TS;
            lx -= wText;
            cv.text(l.name, lx, box.y + 14, TS, C.ink2);
            lx -= 14;
            cv.rect(lx, box.y + 15, 9, 9, l.color);
            lx -= 18;
        }
    }

    const yOf = (v) => plot.y + plot.h - ((v - scale.min) / (scale.max - scale.min)) * plot.h;
    for (const t of scale.ticks) {
        const y = yOf(t);
        cv.rect(plot.x, y - 0.5, plot.w, 1, t === scale.min ? C.axis : C.grid, t === scale.min ? 1 : 0.7);
        cv.text(yFmt(t), plot.x - 8, y - 5, TS, C.muted, 'right');
    }
    return { plot, yOf };
}

function emptyPanel(cv, box, title) {
    cv.text(title, box.x + 14, box.y + 12, TT, C.ink);
    cv.text('BELUM ADA DATA', box.x + box.w / 2, box.y + box.h / 2 - 5, TT, C.muted, 'center');
}

function xLabels(cv, plot, labels, xAt, y) {
    const need = Math.ceil(
        (6 * TS * Math.max(...labels.map((l) => l.length)) + 14) / (plot.w / Math.max(1, labels.length)),
    );
    const every = Math.max(1, need);

    for (let i = labels.length - 1; i >= 0; i -= every) cv.text(labels[i], xAt(i), y, TS, C.muted, 'center');
}

function lineChart(cv, box, { title, labels, series, zeroBase = true, yFmt, area = false }) {
    const all = series.flatMap((s) => s.values);
    if (!all.some((v) => v !== null && v !== undefined)) return emptyPanel(cv, box, title);
    const scale = makeScale(all, zeroBase);
    const { plot, yOf } = panelFrame(cv, box, {
        title,
        legend: series.map((s) => ({ name: s.name, color: s.color })),
        scale,
        yFmt,
    });
    const n = labels.length;
    const xAt = (i) => (n === 1 ? plot.x + plot.w / 2 : plot.x + 10 + (i * (plot.w - 20)) / (n - 1));
    xLabels(cv, plot, labels, xAt, plot.y + plot.h + 9);

    series.forEach((s, si) => {
        let seg = [];
        const segs = [];
        s.values.forEach((v, i) => {
            if (v === null || v === undefined) {
                if (seg.length) segs.push(seg);
                seg = [];
            } else seg.push([xAt(i), yOf(v)]);
        });
        if (seg.length) segs.push(seg);
        for (const sg of segs) {
            if (area && series.length === 1 && sg.length > 1) cv.area(sg, plot.y + plot.h, s.color, 0.16);
            for (let i = 0; i < sg.length - 1; i++) cv.line(sg[i][0], sg[i][1], sg[i + 1][0], sg[i + 1][1], 2, s.color);
        }
        const showMarkers = n <= 31;
        if (showMarkers) {
            for (const sg of segs)
                for (const [x, y] of sg) {
                    cv.circle(x, y, 5, C.surface);
                    cv.circle(x, y, 3.5, s.color);
                }
        }

        const lastIdx = [...s.values.keys()].reverse().find((i) => s.values[i] !== null && s.values[i] !== undefined);
        if (lastIdx !== undefined && series.length === 1) {
            const v = s.values[lastIdx];
            cv.text(
                yFmt ? yFmt(v) : fmtNum(v),
                xAt(lastIdx),
                yOf(v) - 20,
                TS,
                C.ink,
                lastIdx > n * 0.8 ? 'right' : 'center',
            );
        }
    });
}

function barChart(cv, box, { title, labels, series, stacked = false, yFmt, valueLabels = [] }) {
    const totals = labels.map((_, i) =>
        stacked ? series.reduce((a, s) => a + (s.values[i] || 0), 0) : Math.max(...series.map((s) => s.values[i] || 0)),
    );
    if (!totals.some((t) => t > 0)) return emptyPanel(cv, box, title);
    const scale = makeScale(totals, true);
    const { plot, yOf } = panelFrame(cv, box, {
        title,
        legend: series.map((s) => ({ name: s.name, color: s.color })),
        scale,
        yFmt,
    });
    const n = labels.length;
    const slot = plot.w / n;
    const gapOuter = Math.max(2, slot * 0.2);
    const groupW = slot - gapOuter;
    const barW = stacked ? groupW : Math.max(2, (groupW - (series.length - 1) * 2) / series.length);
    const xAt = (i) => plot.x + slot * i + slot / 2;
    xLabels(cv, plot, labels, xAt, plot.y + plot.h + 9);

    for (let i = 0; i < n; i++) {
        const gx = plot.x + slot * i + gapOuter / 2;
        if (stacked) {
            let acc = 0;
            const active = series.filter((s) => (s.values[i] || 0) > 0);
            active.forEach((s, k) => {
                const v = s.values[i];
                const yTop = yOf(acc + v),
                    yBase = yOf(acc);
                const isTop = k === active.length - 1;
                const h = yBase - yTop - (k > 0 ? 2 : 0);
                if (isTop) cv.bar(gx, yTop, barW, h, s.color, 4);
                else cv.rect(gx, yTop, barW, h, s.color);
                acc += v;
            });
        } else {
            series.forEach((s, k) => {
                const v = s.values[i] || 0;
                if (v <= 0) return;
                const x = gx + k * (barW + 2);
                cv.bar(x, yOf(v), barW, plot.y + plot.h - yOf(v), s.color, 4);
            });
        }
        if (valueLabels.includes(i) && totals[i] > 0)
            cv.text(yFmt ? yFmt(totals[i]) : fmtNum(totals[i]), xAt(i), yOf(totals[i]) - 14, TS, C.ink, 'center');
    }
}

function render(panels, { width = 900, panelHeight = 300 } = {}) {
    const cv = new Canvas(width, panelHeight * panels.length);
    panels.forEach((p, i) => {
        const box = { x: 0, y: i * panelHeight, w: width, h: panelHeight };
        if (i > 0) cv.rect(14, box.y, width - 28, 1, C.grid, 0.8);
        (p.type === 'bar' ? barChart : lineChart)(cv, box, p);
    });
    return cv.toPNG();
}

module.exports = { render, C };
