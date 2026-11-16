const db = require('./query');

const DEFAULTS = {
    charTable: 'player_characters',
    charNameColumn: 'Char_Name',
    charUcpColumn: 'Char_UCP',
    charMaskColumn: 'Char_MaskID',
    charOnlineColumn: 'Char_Online',
};

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

function parseMaskId(name) {
    const m = /^\W*mask\W*[_\s-]*(\d{1,10})\W*$/i.exec(String(name ?? '').trim());
    return m ? Number(m[1]) : null;
}

async function lookupUcps(names, opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    const map = new Map();
    map.chars = new Map();
    const unique = [...new Set([...names].map((n) => String(n ?? '')).filter(Boolean))];
    if (!unique.length) return map;

    const masks = new Map();
    const plain = [];
    for (const n of unique) {
        const id = parseMaskId(n);
        if (id === null) {
            plain.push(n);
            continue;
        }
        if (!masks.has(id)) masks.set(id, []);
        masks.get(id).push(n);
        plain.push(n);
    }

    if (plain.length) {
        const rows = await q('SELECT ?? AS name, ?? AS ucp FROM ?? WHERE ?? IN (?)', [
            o.charNameColumn,
            o.charUcpColumn,
            o.charTable,
            o.charNameColumn,
            plain,
        ]);
        for (const r of rows) if (r.ucp) map.set(String(r.name).toLowerCase(), String(r.ucp));
    }

    if (masks.size) {
        let rows = [];
        try {
            rows = await q('SELECT ?? AS mask, ?? AS name, ?? AS ucp FROM ?? WHERE ?? IN (?) ORDER BY ?? ASC', [
                o.charMaskColumn,
                o.charNameColumn,
                o.charUcpColumn,
                o.charTable,
                o.charMaskColumn,
                [...masks.keys()],
                o.charOnlineColumn,
            ]);
        } catch {
            try {
                rows = await q('SELECT ?? AS mask, ?? AS name, ?? AS ucp FROM ?? WHERE ?? IN (?)', [
                    o.charMaskColumn,
                    o.charNameColumn,
                    o.charUcpColumn,
                    o.charTable,
                    o.charMaskColumn,
                    [...masks.keys()],
                ]);
            } catch {
                rows = []; // database ini tidak punya kolom mask -> abaikan
            }
        }
        for (const r of rows) {
            if (!r.ucp) continue;
            for (const logged of masks.get(Number(r.mask)) ?? []) {
                map.set(logged.toLowerCase(), String(r.ucp));
                map.chars.set(logged.toLowerCase(), String(r.name));
            }
        }
    }
    return map;
}

module.exports = { lookupUcps, parseMaskId };
