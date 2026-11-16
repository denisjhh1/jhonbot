const fs = require('fs');
const path = require('path');
const def = require('../defines');
const { log } = require('../functions');

const cfg = {
    enabled: true,

    utcOffsetHours: def.dutyreport?.utcOffsetHours ?? 7,

    sampleIntervalMs: 60 * 1000,

    growthIntervalMs: 60 * 60 * 1000,

    hourlyRetentionDays: 180,

    baselineHours: 24,

    ucpTable: require('./schema').ucp.table,

    allowedRoleIds: def.stats?.allowedRoleIds ?? [],
    ephemeral: false,

    ...(def.analytics ?? {}),
};

const DATA_FILE = path.join(__dirname, '..', 'data', 'analytics-data.json');
const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

const TICKET_LABELS = {
    donasi: 'Donasi',
    refund: 'Refund',
    bug: 'Bug Report',
    report: 'Report',
    rekrut: 'Rekrutmen',
};

const localISO = (ms) => new Date(ms + cfg.utcOffsetHours * HOUR_MS).toISOString();
const dayKey = (ms = Date.now()) => localISO(ms).slice(0, 10);
const hourKey = (ms = Date.now()) => localISO(ms).slice(0, 13);
const dayKeyToMs = (key) => Date.parse(`${key}T00:00:00Z`) - cfg.utcOffsetHours * HOUR_MS;

let data = null;
let saveTimer = null;
let dirty = false;

const emptyData = () => ({
    version: 1,
    startedAt: Date.now(),
    hourly: {},
    daily: {},
    firstSeen: {},
});

function load() {
    if (data) return data;
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        data = JSON.parse(raw);
        data.hourly ??= {};
        data.daily ??= {};
        data.firstSeen ??= {};
        data.startedAt ??= Date.now();
    } catch (e) {
        if (e.code !== 'ENOENT') {
            try {
                const bak = `${DATA_FILE}.corrupt-${Date.now()}`;
                fs.renameSync(DATA_FILE, bak);
                log(`Analytics: Data rusak (${e.message}), disalin ke ${path.basename(bak)} & direset.`, 'err');
            } catch {}
        }
        data = emptyData();
    }
    return data;
}

function writeNow() {
    if (!data || !dirty) return;
    dirty = false;
    try {
        const tmp = `${DATA_FILE}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(data));
        fs.renameSync(tmp, DATA_FILE);
    } catch (e) {
        dirty = true;
        log(`Analytics: Gagal menyimpan data: ${e.message}`, 'err');
    }
}

function saveSoon() {
    dirty = true;
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        writeNow();
    }, 3000);
    saveTimer.unref?.();
}

const flushOnExit = () => {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    writeNow();
};

process.on('exit', flushOnExit);
for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
        flushOnExit();
        process.exit(0);
    });
}

let uniqSet = null;
let uniqDay = null;

function finalizeOldDays(today) {
    for (const [k, d] of Object.entries(data.daily)) {
        if (k !== today && d.uniqNames) {
            d.uniq = d.uniqNames.length;
            delete d.uniqNames;
        }
    }
}

function getDay(key = dayKey()) {
    const d = load();
    if (!d.daily[key]) {
        d.daily[key] = { n: 0, sum: 0, max: 0, maxAt: 0, down: 0, uniq: 0, newGame: 0, regs: 0, tickets: {} };
        finalizeOldDays(key);
        pruneHourly();
    }
    return d.daily[key];
}

function getHour(key = hourKey()) {
    const d = load();
    return (d.hourly[key] ??= { n: 0, sum: 0, max: 0, min: null, down: 0 });
}

let lastPrune = '';
function pruneHourly() {
    const d = load();
    const today = dayKey();
    if (lastPrune === today) return;
    lastPrune = today;
    const cutoff = hourKey(Date.now() - cfg.hourlyRetentionDays * DAY_MS);
    for (const k of Object.keys(d.hourly)) {
        if (k < cutoff) delete d.hourly[k];
    }
}

function recordSample(res, now = Date.now()) {
    if (cfg.enabled === false) return;
    try {
        const d = load();
        const day = getDay(dayKey(now));
        const hour = getHour(hourKey(now));

        if (!res?.ok || !res.data) {
            day.down++;
            hour.down++;
            return saveSoon();
        }

        const online = Number(res.data.online) || 0;
        day.n++;
        day.sum += online;
        if (online >= day.max) {
            day.max = online;
            day.maxAt = now;
        }

        hour.n++;
        hour.sum += online;
        if (online > hour.max) hour.max = online;
        hour.min = hour.min === null ? online : Math.min(hour.min, online);

        const names = (res.data.players ?? []).map((p) => String(p.name ?? '').trim()).filter(Boolean);
        if (names.length) {
            const key = dayKey(now);
            if (uniqDay !== key) {
                uniqSet = new Set(day.uniqNames ?? []);
                uniqDay = key;
            }
            const baselineMs = cfg.baselineHours * HOUR_MS;
            for (const name of names) {
                uniqSet.add(name);
                if (!(name in d.firstSeen)) {
                    d.firstSeen[name] = now;
                    if (now - d.startedAt >= baselineMs) day.newGame++;
                }
            }
            day.uniqNames = [...uniqSet];
            day.uniq = uniqSet.size;
        }
        saveSoon();
    } catch (e) {
        log(`Analytics: Gagal mencatat sampel: ${e.message}`, 'err');
    }
}

function track(type, now = Date.now()) {
    if (cfg.enabled === false) return;
    try {
        const day = getDay(dayKey(now));
        day.tickets[type] = (day.tickets[type] ?? 0) + 1;
        saveSoon();
    } catch (e) {
        log(`Analytics: Gagal mencatat tiket: ${e.message}`, 'err');
    }
}

function trackRegistration(now = Date.now()) {
    if (cfg.enabled === false) return;
    try {
        getDay(dayKey(now)).regs++;
        saveSoon();
    } catch (e) {
        log(`Analytics: Gagal mencatat registrasi: ${e.message}`, 'err');
    }
}

async function snapshotGrowth(client) {
    const day = getDay();

    try {
        const guild = await client.guilds.fetch({ guild: def.client.guild, withCounts: true });
        const count = guild.approximateMemberCount ?? guild.memberCount;
        if (count) day.members = count;
        if (guild.approximatePresenceCount) {
            day.discordOnline = Math.max(day.discordOnline ?? 0, guild.approximatePresenceCount);
        }
    } catch (e) {
        log(`Analytics: Gagal mengambil member Discord: ${e.message}`, 'warn');
    }

    try {
        const db = require('./query');
        const rows = await new Promise((resolve, reject) => {
            db.query('SELECT COUNT(*) AS c FROM ??', [cfg.ucpTable], (err, r) => (err ? reject(err) : resolve(r)));
        });
        const c = Number(rows?.[0]?.c);
        if (Number.isFinite(c)) day.ucp = c;
    } catch (e) {
        log(`Analytics: Gagal menghitung akun UCP: ${e.message}`, 'warn');
    }

    saveSoon();
}

let timers = [];

function start(client) {
    if (cfg.enabled === false) return log('Analytics dimatikan (analytics.enabled = false).', 'warn');

    timers.forEach(clearInterval);
    timers = [];
    load();
    getDay();

    snapshotGrowth(client);
    timers.push(setInterval(() => snapshotGrowth(client), cfg.growthIntervalMs));

    if (def.monitoring?.enabled === false) {
        const { querySamp } = require('./monitoring-core');
        const tick = async () => recordSample(await querySamp());
        tick();
        timers.push(setInterval(tick, cfg.sampleIntervalMs));
    }

    timers.forEach((t) => t.unref?.());
    log(
        `Analytics aktif (Zona Waktu UTC${cfg.utcOffsetHours >= 0 ? '+' : ''}${cfg.utcOffsetHours}), File: ${path.basename(DATA_FILE)}`,
        'done',
    );
}

function getSeries(days) {
    const d = load();
    const todayStart = dayKeyToMs(dayKey());
    const out = [];
    let lastMembers = null;
    let lastUcp = null;

    const windowStartKey = dayKey(todayStart - (days - 1) * DAY_MS);
    for (const k of Object.keys(d.daily).sort()) {
        if (k >= windowStartKey) break;
        if (d.daily[k].members) lastMembers = d.daily[k].members;
        if (d.daily[k].ucp) lastUcp = d.daily[k].ucp;
    }

    for (let i = days - 1; i >= 0; i--) {
        const ms = todayStart - i * DAY_MS + 12 * HOUR_MS;
        const key = dayKey(ms);
        const r = d.daily[key];
        if (r?.members) lastMembers = r.members;
        if (r?.ucp) lastUcp = r.ucp;
        const total = (r?.n ?? 0) + (r?.down ?? 0);

        out.push({
            date: key,
            hasData: !!r && (r.n > 0 || r.down > 0),
            peak: r && r.n ? r.max : null,
            peakAt: r?.maxAt || null,
            avg: r && r.n ? r.sum / r.n : null,
            uniq: r && r.uniq ? r.uniq : null,
            newGame: r?.newGame ?? null,
            regs: r?.regs ?? 0,
            tickets: r?.tickets ?? {},
            ticketTotal: Object.values(r?.tickets ?? {}).reduce((a, b) => a + b, 0),
            members: lastMembers,
            ucp: lastUcp,
            uptime: total ? (r.n / total) * 100 : null,
        });
    }
    return out;
}

function getHourProfile(days) {
    const d = load();
    const fromKey = hourKey(Date.now() - days * DAY_MS);
    const sum = Array(24).fill(0);
    const cnt = Array(24).fill(0);
    const max = Array(24).fill(0);

    for (const [k, h] of Object.entries(d.hourly)) {
        if (k < fromKey || !h.n) continue;
        const hr = Number(k.slice(11, 13));
        sum[hr] += h.sum / h.n;
        cnt[hr]++;
        max[hr] = Math.max(max[hr], h.max);
    }

    const avg = sum.map((s, i) => (cnt[i] ? s / cnt[i] : null));
    const ranked = avg
        .map((v, h) => ({ hour: h, avg: v, max: max[h] }))
        .filter((x) => x.avg !== null)
        .sort((a, b) => b.avg - a.avg);

    return {
        avg,
        max,
        samples: cnt,
        top: ranked.slice(0, 3),
        quietest: ranked.length > 3 ? ranked[ranked.length - 1] : null,
    };
}

function getLast24h() {
    const d = load();
    const out = [];
    for (let i = 23; i >= 0; i--) {
        const k = hourKey(Date.now() - i * HOUR_MS);
        const h = d.hourly[k];
        out.push({
            key: k,
            hour: Number(k.slice(11, 13)),
            avg: h?.n ? h.sum / h.n : null,
            max: h?.n ? h.max : null,
        });
    }
    return out;
}

function getSummary(days) {
    const series = getSeries(days);
    const withPlayers = series.filter((s) => s.peak !== null);
    const sumOf = (fn) => series.reduce((a, s) => a + (fn(s) || 0), 0);

    const tickets = {};
    for (const s of series) {
        for (const [t, n] of Object.entries(s.tickets)) {
            tickets[t] = (tickets[t] ?? 0) + n;
        }
    }

    const best = withPlayers.reduce((b, s) => (!b || s.peak > b.peak ? s : b), null);
    const uniqDays = series.filter((s) => s.uniq);
    const memberPts = series.filter((s) => s.members);
    const ucpPts = series.filter((s) => s.ucp);
    const upDays = series.filter((s) => s.uptime !== null);

    const delta = (pts, key) => (pts.length >= 2 ? pts[pts.length - 1][key] - pts[0][key] : null);

    return {
        days,
        daysWithData: series.filter((s) => s.hasData).length,
        trackingSince: load().startedAt,
        avgPeak: withPlayers.length ? withPlayers.reduce((a, s) => a + s.peak, 0) / withPlayers.length : null,
        bestDay: best,
        avgUniq: uniqDays.length ? uniqDays.reduce((a, s) => a + s.uniq, 0) / uniqDays.length : null,
        todayUniq: series[series.length - 1]?.uniq ?? null,
        newGame: sumOf((s) => s.newGame),
        regs: sumOf((s) => s.regs),
        tickets,
        ticketTotal: Object.values(tickets).reduce((a, b) => a + b, 0),
        members: memberPts.length ? memberPts[memberPts.length - 1].members : null,
        memberDelta: delta(memberPts, 'members'),
        memberStart: memberPts[0]?.members ?? null,
        ucp: ucpPts.length ? ucpPts[ucpPts.length - 1].ucp : null,
        ucpDelta: delta(ucpPts, 'ucp'),
        ucpStart: ucpPts[0]?.ucp ?? null,
        uptime: upDays.length ? upDays.reduce((a, s) => a + s.uptime, 0) / upDays.length : null,
        series,
    };
}

function canUse(interaction) {
    const id = interaction.user.id;
    if ([].concat(def.users?.ownerId ?? []).includes(id)) return true;
    if ([].concat(def.users?.developers ?? []).includes(id)) return true;
    const roles = interaction.member?.roles?.cache;
    return !!roles && [].concat(cfg.allowedRoleIds ?? []).some((r) => roles.has(r));
}

module.exports = {
    cfg,
    TICKET_LABELS,
    start,
    recordSample,
    track,
    trackRegistration,
    snapshotGrowth,
    getSeries,
    getHourProfile,
    getLast24h,
    getSummary,
    canUse,
    flush: flushOnExit,
    _internals: { dayKey, hourKey, load, DATA_FILE },
};
