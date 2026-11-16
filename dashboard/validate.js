const SNOW = /^\d{15,25}$/;

// -> { ok: true, value } | { ok: false, error }
function validate(f, v) {
    const bad = (error) => ({ ok: false, error: `${f.label}: ${error}` });
    switch (f.type) {
        case 'text':
        case 'textarea':
        case 'secret':
            if (typeof v !== 'string') return bad('harus teks');
            if (v.length > 4000) return bad('terlalu panjang');
            return { ok: true, value: f.type === 'textarea' ? v : v.trim() };
        case 'url':
            if (typeof v !== 'string') return bad('harus teks');
            v = v.trim();
            if (v && !/^https?:\/\/\S+$/i.test(v)) return bad('harus berupa URL http(s)');
            return { ok: true, value: v };
        case 'number': {
            const n = typeof v === 'number' ? v : Number(String(v).trim());
            if (v === '' || !Number.isFinite(n)) return bad('harus angka');
            if (f.min !== undefined && n < f.min) return bad(`minimal ${f.min}`);
            if (f.max !== undefined && n > f.max) return bad(`maksimal ${f.max}`);
            return { ok: true, value: n };
        }
        case 'bool':
            if (typeof v !== 'boolean') return bad('harus ya/tidak');
            return { ok: true, value: v };
        case 'select':
            if (!f.options.includes(v)) return bad('pilihan tidak valid');
            return { ok: true, value: v };
        case 'id':
            if (typeof v !== 'string') return bad('harus teks');
            v = v.trim();
            if (v && !SNOW.test(v)) return bad('ID Discord harus 15-25 digit angka');
            return { ok: true, value: v };
        case 'ids': {
            if (!Array.isArray(v)) return bad('harus daftar');
            const list = [...new Set(v.map((x) => String(x).trim()).filter(Boolean))];
            if (list.length > 100) return bad('terlalu banyak');
            if (list.some((x) => !SNOW.test(x))) return bad('ada ID yang tidak valid (harus 15-25 digit)');
            return { ok: true, value: !list.length && f.nullable ? null : list };
        }
        case 'strings': {
            if (!Array.isArray(v)) return bad('harus daftar');
            const list = v.map((x) => String(x).trim()).filter(Boolean);
            if (list.length > 50) return bad('terlalu banyak');
            return { ok: true, value: list };
        }
        case 'json':
            if (v === null || typeof v !== 'object') return bad('harus JSON objek/array');
            if (JSON.stringify(v).length > 20000) return bad('terlalu besar');
            return { ok: true, value: v };
        default:
            return bad('tipe tidak dikenal');
    }
}
module.exports = { validate };
