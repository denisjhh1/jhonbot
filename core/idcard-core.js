const fs = require('fs');
const path = require('path');
const def = require('../defines');
const db = require('./query');
const { log } = require('../functions');
const { renderCard, decodeImage, clean } = require('./idcard-render');

const cfg = {
    enabled: true,
    serverName: 'EXPENSIVE ROLEPLAY',
    province: 'PROVINSI SAN ANDREAS',
    city: 'KOTA LOS SANTOS',
    passportCountry: 'REPUBLIK SAN ANDREAS',
    nikRegion: '317401',
    utcOffsetHours: def.analytics?.utcOffsetHours ?? 7,
    requireKtp: false,
    passportYears: 5,
    staffRoleIds: [],
    table: 'player_characters',
    houseTable: require('./schema').house.table,
    ucpTable: require('./schema').ucp.table,
    ucpColumn: require('./schema').ucp.ucp,
    discordColumn: require('./schema').ucp.discord,
    skinImageUrl: def.stats?.skinImageUrl ?? 'https://assets.open.mp/assets/images/skins/{id}.png',
    fetchTimeoutMs: 8000,
    maxPhotoBytes: 8 * 1024 * 1024,
    ...(def.idcard ?? {}),
};

const CACHE_DIR = path.join(__dirname, '..', 'data', 'idcard-cache');

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

// [kolom di database, nama yang dipakai kode]. Sesuaikan lewat dashboard: idcard.charColumns
// Default di bawah memetakan ke player_characters milik server ini.
// CATATAN: SIM A/B/C dipetakan ke lisensi gamemode (GVL1 = mobil, GVL2 = kendaraan besar, MB = motor).
const CHAR_MAP = {
    pID: 'pID',
    Char_Name: 'Char_Name',
    Char_UCP: 'Char_UCP',
    Char_Gender: 'Char_Gender',
    Char_Birthday: 'Char_Age',
    Char_Origin: 'Char_Origin',
    Char_Skin: 'Char_Skin',
    Char_BodyHeight: 'Char_BodyHeight',
    Char_BodyWeight: 'Char_BodyWeight',
    Char_RegisterDate: 'Char_RegisterDate',
    Char_KTP: 'Char_Ktp',
    Char_KTPTime: 'Char_KtpTime',
    Char_GVL1Lic: 'Char_SimA',
    Char_GVL1LicTime: 'Char_SimATime',
    Char_GVL2Lic: 'Char_SimB',
    Char_GVL2LicTime: 'Char_SimBTime',
    Char_MBLic: 'Char_SimC',
    Char_MBLicTime: 'Char_SimCTime',
    ...(def.idcard?.charColumns ?? {}),
};
const CHAR_COLS = Object.keys(CHAR_MAP);
const CHAR_SELECT = CHAR_COLS.map(() => '?? AS ??').join(', ');
const CHAR_PARAMS = CHAR_COLS.flatMap((c) => [c, CHAR_MAP[c]]);

function isStaff(interaction) {
    const id = interaction.user.id;
    if ([].concat(def.users?.ownerId ?? []).includes(id) || (def.users?.developers ?? []).includes(id)) return true;
    if (interaction.memberPermissions?.has('Administrator')) return true;
    const roles = interaction.member?.roles?.cache;
    return !!roles && cfg.staffRoleIds.some((r) => roles.has(r));
}

async function ownCharacters(discordId, term = '', limit = 25) {
    const rows = await q(
        'SELECT ?? AS id, ?? AS name FROM ?? WHERE ?? IN (SELECT ?? FROM ?? WHERE ?? = ?) AND ?? LIKE ? ORDER BY ?? ASC LIMIT ?',
        [
            'pID',
            'Char_Name',
            cfg.table,
            'Char_UCP',
            cfg.ucpColumn,
            cfg.ucpTable,
            cfg.discordColumn,
            String(discordId),
            'Char_Name',
            `%${String(term).replace(/[%_]/g, '')}%`,
            'Char_Name',
            limit,
        ],
    );
    return rows;
}

async function searchCharacters(term, limit = 25) {
    return q('SELECT ?? AS id, ?? AS name FROM ?? WHERE ?? LIKE ? ORDER BY ?? ASC LIMIT ?', [
        'pID',
        'Char_Name',
        cfg.table,
        'Char_Name',
        `%${String(term).replace(/[%_]/g, '')}%`,
        'Char_Name',
        limit,
    ]);
}

async function fetchCharacter(where, params) {
    const rows = await q(`SELECT ${CHAR_SELECT} FROM ?? WHERE ${where} LIMIT 1`, [
        ...CHAR_PARAMS,
        cfg.table,
        ...params,
    ]);
    return rows[0] ?? null;
}

async function resolveCharacter(interaction, name) {
    const staff = isStaff(interaction);
    const own = await ownCharacters(interaction.user.id, '', 50);
    const wanted = String(name ?? '').trim();

    if (!wanted) {
        if (own.length === 1) return { char: await fetchCharacter('?? = ?', ['pID', own[0].id]) };
        if (!own.length)
            return {
                error: 'Akun Discord-mu belum terhubung dengan UCP yang punya karakter. Daftar dulu lewat panel registrasi.',
            };
        return {
            error: `Kamu punya ${own.length} karakter. Pilih salah satu di opsi **karakter**: ${own
                .slice(0, 8)
                .map((c) => `\`${c.name}\``)
                .join(', ')}.`,
        };
    }

    const mine = own.find((c) => c.name.toLowerCase() === wanted.toLowerCase().replace(/ /g, '_'));
    if (mine) return { char: await fetchCharacter('?? = ?', ['pID', mine.id]) };
    if (!staff) return { error: 'Karakter itu bukan milik akunmu.' };

    const found = await fetchCharacter('?? = ?', ['Char_Name', wanted.replace(/ /g, '_')]);
    return found ? { char: found } : { error: `Karakter \`${wanted}\` tidak ditemukan.` };
}

const pad = (n, len) => String(Math.max(0, Math.floor(Number(n) || 0))).padStart(len, '0');
const fmtDate = (d) => `${pad(d.getUTCDate(), 2)}-${pad(d.getUTCMonth() + 1, 2)}-${d.getUTCFullYear()}`;
const toMs = (t) => {
    const n = Number(t) || 0;
    return n > 1e11 ? n : n * 1000;
};
const shift = (ms) => new Date(ms + cfg.utcOffsetHours * 3600 * 1000);

function parseBirth(s) {
    const m = /^\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4})\s*$/.exec(String(s ?? ''));
    if (!m) return null;
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
    return { d, m: mo, y };
}

const COUNTRY_CODES = {
    'indonesia': 'IDN',
    'malaysia': 'MYS',
    'singapore': 'SGP',
    'united states of america': 'USA',
    'united states': 'USA',
    'usa': 'USA',
    'united kingdom': 'GBR',
    'japan': 'JPN',
    'china': 'CHN',
    'south korea': 'KOR',
    'australia': 'AUS',
    'germany': 'DEU',
    'france': 'FRA',
    'italy': 'ITA',
    'spain': 'ESP',
    'brazil': 'BRA',
    'russia': 'RUS',
    'mexico': 'MEX',
    'canada': 'CAN',
    'netherlands': 'NLD',
    'thailand': 'THA',
    'philippines': 'PHL',
    'vietnam': 'VNM',
    'india': 'IND',
    'turkey': 'TUR',
    'saudi arabia': 'SAU',
    'egypt': 'EGY',
    'colombia': 'COL',
    'argentina': 'ARG',
    'portugal': 'PRT',
    'ukraine': 'UKR',
};
const countryCode = (origin) =>
    COUNTRY_CODES[String(origin).toLowerCase().trim()] ??
    clean(origin)
        .replace(/[^A-Z]/g, '')
        .padEnd(3, 'X')
        .slice(0, 3);

function cityOf(x, y) {
    if (y > 600 && x > 800) return 'LAS VENTURAS';
    if (x < -1000 && y > -1200 && y < 1700) return 'SAN FIERRO';
    if (x > 0 && y < -400) return 'LOS SANTOS';
    return 'SAN ANDREAS';
}

async function addressOf(char) {
    const H = require('./schema').house;
    const R = require('./schema').rusun;
    try {
        const rows = await q('SELECT ?? AS `ID`, ?? AS x, ?? AS y FROM ?? WHERE ?? = ? ORDER BY ?? ASC LIMIT 1', [
            H.id,
            H.x,
            H.y,
            cfg.houseTable,
            H.owner,
            char.pID,
            H.id,
        ]);
        if (rows.length) return `RUMAH NO. ${rows[0].ID}, ${cityOf(Number(rows[0].x), Number(rows[0].y))}`;
    } catch (e) {
        log(`IDCard: gagal membaca alamat rumah (${e.message})`, 'warn');
    }
    try {
        if (R.table) {
            const rows = await q('SELECT ?? AS `ID` FROM ?? WHERE ?? = ? ORDER BY ?? ASC LIMIT 1', [
                R.id,
                R.table,
                R.owner,
                char.pID,
                R.id,
            ]);
            if (rows.length) return `RUSUN NO. ${rows[0].ID}, LOS SANTOS`;
        }
    } catch (e) {
        log(`IDCard: gagal membaca alamat rusun (${e.message})`, 'warn');
    }
    return 'BELUM MEMILIKI TEMPAT TINGGAL TETAP';
}

function mrzCheck(s) {
    const w = [7, 3, 1];
    let sum = 0;
    [...s].forEach((c, i) => {
        const v = c === '<' ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55;
        sum += v * w[i % 3];
    });
    return String(sum % 10);
}
const mrzText = (s, len) =>
    clean(s)
        .replace(/ /g, '<')
        .replace(/[^A-Z0-9<]/g, '')
        .padEnd(len, '<')
        .slice(0, len);

function buildMrz({ surname, given, issuer, number, nationality, dob, sex, expiry, personal }) {
    const l1 = `P<${issuer}${mrzText(surname, 38).replace(/<+$/, '')}<<${mrzText(given, 38).replace(/<+$/, '')}`
        .padEnd(44, '<')
        .slice(0, 44);
    const num = mrzText(number, 9);
    const per = mrzText(personal, 14);
    const body = `${num}${mrzCheck(num)}${nationality}${dob}${mrzCheck(dob)}${sex}${expiry}${mrzCheck(expiry)}${per}${mrzCheck(per)}`;
    const l2 = `${body}${mrzCheck(num + mrzCheck(num) + dob + mrzCheck(dob) + expiry + mrzCheck(expiry) + per + mrzCheck(per))}`;
    return [l1, l2];
}

async function buildCardData(kind, char, { hasCustomPhoto = false } = {}) {
    const now = Date.now();
    const rawName = String(char.Char_Name ?? '');
    const [first, ...rest] = rawName.split('_');
    const givenNames = clean(first);
    const surname = clean(rest.join(' ')) || givenNames;
    const fullName = clean(rawName);

    const birth = parseBirth(char.Char_Age);
    const female = Number(char.Char_Gender) === 2;
    const male = Number(char.Char_Gender) === 1;
    const origin = clean(char.Char_Origin) || 'TIDAK DIKETAHUI';
    const isLocal = origin === 'INDONESIA';
    const birthDate = birth ? `${pad(birth.d, 2)}-${pad(birth.m, 2)}-${birth.y}` : clean(char.Char_Age) || '-';
    const pid = Number(char.pID) || 0;

    const registered = (() => {
        const t = Date.parse(String(char.Char_RegisterDate ?? '').replace(' ', 'T') + 'Z');
        return Number.isFinite(t) ? t - cfg.utcOffsetHours * 3600 * 1000 : now;
    })();
    const issue = shift(registered);

    const nik = birth
        ? `${cfg.nikRegion}${pad(birth.d + (female ? 40 : 0), 2)}${pad(birth.m, 2)}${pad(birth.y % 100, 2)}${pad(pid % 10000, 4)}`
        : `${cfg.nikRegion}${pad(pid, 10)}`;

    const data = {
        kind,
        serverName: clean(cfg.serverName),
        province: clean(cfg.province),
        city: clean(cfg.city),
        passportCountry: clean(cfg.passportCountry),
        name: fullName,
        surname,
        givenNames,
        birthPlace: origin,
        birthDate,
        gender: female ? 'PEREMPUAN' : male ? 'LAKI-LAKI' : '-',
        sex: female ? 'F' : male ? 'M' : 'X',
        height: Number(char.Char_BodyHeight) || '-',
        nationality: isLocal ? 'WNI (INDONESIA)' : `WNA (${origin})`,
        nationalityLong: isLocal ? 'INDONESIA (WNI)' : `${origin} (WNA)`,
        address: clean(await addressOf(char)),
        issueDate: fmtDate(issue),
        photoFocus: hasCustomPhoto ? 0.3 : 0,
        nik,
    };

    if (kind === 'ktp') {
        const t = toMs(char.Char_KtpTime);
        data.validUntil = Number(char.Char_Ktp) === 1 && t > now ? fmtDate(shift(t)) : 'SEUMUR HIDUP';
    }

    if (kind === 'sim') {
        const classes = [];
        for (const c of ['A', 'B', 'C']) {
            if (Number(char[`Char_Sim${c}`]) !== 1) continue;
            const t = toMs(char[`Char_Sim${c}Time`]);
            classes.push({ cls: c, until: t ? fmtDate(shift(t)) : '-', expired: t > 0 && t < now });
        }
        data.simClasses = classes;
        data.simNumber = `${pad(issue.getUTCFullYear() % 100, 2)}${pad(issue.getUTCMonth() + 1, 2)}${pad(pid, 8)}`;
    }

    if (kind === 'paspor') {
        const expiry = new Date(issue.getTime());
        expiry.setUTCFullYear(expiry.getUTCFullYear() + cfg.passportYears);
        data.passportNumber = `A${pad(pid, 7)}`;
        data.passportExpiry = fmtDate(expiry);
        data.countryCode = countryCode(char.Char_Origin);
        const ymd = (y, m, d) => `${pad(y % 100, 2)}${pad(m, 2)}${pad(d, 2)}`;
        data.mrz = buildMrz({
            surname,
            given: givenNames,
            issuer: 'SAN'.slice(0, 3),
            number: data.passportNumber,
            nationality: data.countryCode,
            dob: birth ? ymd(birth.y, birth.m, birth.d) : '000000',
            sex: female ? 'F' : male ? 'M' : '<',
            expiry: ymd(expiry.getUTCFullYear(), expiry.getUTCMonth() + 1, expiry.getUTCDate()),
            personal: nik.slice(6, 16),
        });
    }
    return data;
}

async function download(url, maxBytes) {
    const res = await fetch(url, { signal: AbortSignal.timeout(cfg.fetchTimeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len && len > maxBytes) throw new Error('file terlalu besar');
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new Error('file terlalu besar');
    return buf;
}

async function skinPhoto(skinId) {
    const id = Number(skinId);
    if (!Number.isInteger(id) || id < 0 || id > 311 || !cfg.skinImageUrl) return null;
    const file = path.join(CACHE_DIR, `skin-${id}.png`);
    try {
        if (fs.existsSync(file)) return await decodeImage(fs.readFileSync(file));
    } catch {}
    try {
        const buf = await download(cfg.skinImageUrl.replace('{id}', String(id)), cfg.maxPhotoBytes);
        const bmp = await decodeImage(buf);
        if (bmp) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
            fs.writeFileSync(file, buf);
        }
        return bmp;
    } catch (e) {
        log(`IDCard: foto skin ${id} tidak bisa diambil (${e.message}); memakai siluet.`, 'warn');
        return null;
    }
}

async function uploadedPhoto(attachment) {
    const type = String(attachment.contentType ?? '').toLowerCase();
    if (!/^image\/(png|jpe?g)/.test(type) && !/\.(png|jpe?g)$/i.test(attachment.name ?? ''))
        throw new Error('Foto harus berformat PNG atau JPG.');
    if (attachment.size > cfg.maxPhotoBytes) throw new Error('Foto terlalu besar (maksimal 8 MB).');
    const bmp = await decodeImage(await download(attachment.url, cfg.maxPhotoBytes));
    if (!bmp) throw new Error('Foto tidak bisa dibaca. Gunakan PNG atau JPG biasa (bukan WebP/GIF).');
    return bmp;
}

const KINDS = { ktp: 'KTP', sim: 'SIM', paspor: 'Paspor' };

async function generate(interaction, kind, characterName, attachment) {
    if (!KINDS[kind]) return { error: 'Jenis kartu tidak dikenal.' };
    const { char, error } = await resolveCharacter(interaction, characterName);
    if (error) return { error };
    if (!char) return { error: 'Data karakter tidak ditemukan.' };

    if (kind === 'ktp' && cfg.requireKtp && Number(char.Char_Ktp) !== 1) {
        return {
            error: `**${String(char.Char_Name).replace(/_/g, ' ')}** belum punya KTP di server. Urus dulu lewat pemerintahan, lalu coba lagi.`,
        };
    }
    const data = await buildCardData(kind, char, { hasCustomPhoto: !!attachment });
    if (kind === 'sim' && !data.simClasses.length) {
        return { error: `**${String(char.Char_Name).replace(/_/g, ' ')}** belum punya SIM (A/B/C) di server.` };
    }

    let photo = null;
    if (attachment) {
        try {
            photo = await uploadedPhoto(attachment);
        } catch (e) {
            return { error: e.message };
        }
    } else {
        photo = await skinPhoto(char.Char_Skin);
    }

    const png = await renderCard(kind, data, photo);
    const slug = String(char.Char_Name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    return { png, fileName: `${kind}-${slug}.png`, label: KINDS[kind], char };
}

module.exports = {
    generate,
    ownCharacters,
    searchCharacters,
    isStaff,
    buildCardData,
    parseBirth,
    buildMrz,
    mrzCheck,
    config: cfg,
    KINDS,
};
