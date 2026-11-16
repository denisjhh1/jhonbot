const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, escapeMarkdown } = require('discord.js');
const def = require('./defines');
const db = require('./core/query');
const { log } = require('./functions');

const online = require('./core/online');
const S = require('./core/schema');

const cfg = {
    enabled: true,
    reportUserId: 'YOUR_DISCORD_ID',
    commandChannelId: 'YOUR_DISCORD_ID',
    autoChannelId: 'YOUR_DISCORD_ID',
    maxOfflineDays: 2,
    checkEveryHours: 6,
    runOnStart: true,
    table: 'player_characters',
    ucpTable: require('./core/schema').ucp.table,
    ucpColumn: require('./core/schema').ucp.ucp,
    discordColumn: require('./core/schema').ucp.discord,

    actionRoleIds: ['YOUR_DISCORD_ID'],
    actionUserIds: ['YOUR_DISCORD_ID'],

    demoteNotifyChannelId: 'YOUR_DISCORD_ID',
    demoteNotifyRoleId: 'YOUR_DISCORD_ID',
    lastLoginUtcOffsetHours: def.stats?.lastLoginUtcOffsetHours ?? 0,
    ...(def.adminmonitor ?? {}),
};
cfg.columns = {
    id: 'pID',
    name: 'Char_Name',
    adminName: 'Char_AdminName',
    level: 'Char_Admin',
    lastLogin: 'Char_LastLogin',
    ucp: null,
    ...(def.adminmonitor?.columns ?? {}),
};

const DAY_MS = 24 * 60 * 60 * 1000;

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

let schemaCache = { time: 0, value: null };

async function getSchema() {
    if (schemaCache.value && Date.now() - schemaCache.time < 10 * 60 * 1000) return schemaCache.value;

    const list = (await q('SHOW COLUMNS FROM ??', [cfg.table])).map((r) => r.Field);
    const find = (wanted) =>
        wanted ? (list.find((c) => c.toLowerCase() === String(wanted).toLowerCase()) ?? null) : null;

    const name = find(cfg.columns.name);
    const level = find(cfg.columns.level);
    const lastLogin = find(cfg.columns.lastLogin);
    const id = find(cfg.columns.id);
    const adminName = find(cfg.columns.adminName);
    let ucp = find(cfg.columns.ucp);
    if (!ucp) {
        for (const c of ['UCP', 'Char_UCP', 'Char_Ucp', 'AccountName', 'Char_Account', 'Char_Owner', 'Username']) {
            ucp = find(c);
            if (ucp) break;
        }
        ucp = ucp ?? list.find((c) => /ucp/i.test(c)) ?? null;
    }

    const missing = [
        ['ID karakter', id],
        ['nama karakter', name],
        ['level admin', level],
        ['last login', lastLogin],
        ['UCP', ucp],
    ]
        .filter(([, v]) => !v)
        .map(([k]) => k);
    if (missing.length) {
        throw new Error(
            `kolom ${missing.join(', ')} tidak ditemukan di ${cfg.table}. Isi adminmonitor.columns di defines.js. Kolom tersedia: ${list.join(', ')}`,
        );
    }

    const value = { id, name, level, lastLogin, adminName, ucp };
    schemaCache = { time: Date.now(), value };
    return value;
}

function parseLastLogin(v) {
    if (v === null || v === undefined || v === '' || v === 0 || v === '0') return null;
    if (v instanceof Date) return isNaN(v) ? null : v.getTime();
    if (/^\d+$/.test(String(v))) {
        const n = Number(v);
        return n > 1e12 ? n : n * 1000;
    }
    const m = String(v).match(/^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d):(\d\d)/);
    if (m) {
        if (+m[1] === 0) return null;
        const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
        return utc - cfg.lastLoginUtcOffsetHours * 3600 * 1000;
    }
    const t = new Date(String(v)).getTime();
    return isNaN(t) ? null : t;
}

async function fetchAdmins() {
    const s = await getSchema();
    const sql =
        `SELECT c.\`${s.id}\` AS pID, c.\`${s.level}\` AS level, c.\`${s.name}\` AS charName, ` +
        `${s.adminName ? `c.\`${s.adminName}\`` : 'NULL'} AS adminName, ` +
        `c.\`${s.ucp}\` AS ucp, c.\`${s.lastLogin}\` AS lastLogin, ` +
        `u.\`${cfg.discordColumn}\` AS discordId ` +
        `FROM \`${cfg.table}\` c ` +
        `LEFT JOIN \`${cfg.ucpTable}\` u ON u.\`${cfg.ucpColumn}\` = c.\`${s.ucp}\` ` +
        `WHERE c.\`${s.level}\` > 0`;
    return q(sql);
}

async function buildOfflineList(client) {
    const rows = await fetchAdmins();
    const now = Date.now();

    const byAdmin = new Map();
    for (const r of rows) {
        const key = String(r.ucp ?? r.charName);
        const last = parseLastLogin(r.lastLogin);
        const cur = byAdmin.get(key);
        if (!cur || (last ?? -1) > (cur.last ?? -1)) byAdmin.set(key, { ...r, last });
    }

    const offline = [];
    for (const r of byAdmin.values()) {
        const diffMs = r.last ? now - r.last : null;
        if (r.last && diffMs <= cfg.maxOfflineDays * DAY_MS) continue;

        let discord = '-';
        const did = String(r.discordId ?? '').trim();
        if (/^\d{15,25}$/.test(did)) {
            let name = null;
            try {
                const u = await client.users.fetch(did, { force: true });
                name = u.globalName || u.username;
            } catch {}

            discord = name ? `${escapeMarkdown(name)} (\`${did}\`)` : `Tidak ditemukan (\`${did}\`)`;
        } else if (did) {
            discord = `ID tidak valid (\`${did.slice(0, 30)}\`)`;
        } else {
            discord = 'Belum terhubung (DiscordID kosong di tabel whitelists)';
        }

        const shown = r.adminName && String(r.adminName) !== 'None' ? r.adminName : r.charName;
        offline.push({
            pID: r.pID,
            level: Number(r.level) || 0,
            discordId: /^\d{15,25}$/.test(did) ? did : null,
            discord,
            adminName: String(shown ?? r.ucp ?? '-').replace(/_/g, ' '),
            charName: String(r.charName ?? '-'),
            last: r.last,
            diffDays: r.last ? Math.floor(diffMs / DAY_MS) : null,
        });
    }

    return offline.sort((a, b) => (a.last ?? -Infinity) - (b.last ?? -Infinity));
}

const STATE_FILE = path.join(__dirname, 'data', 'adminmonitor-state.json');
let state = { reports: {}, actions: {} };
try {
    const j = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state = { reports: j.reports ?? {}, actions: j.actions ?? {} };
} catch {}
function saveState() {
    try {
        const tmp = STATE_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(state));
        fs.renameSync(tmp, STATE_FILE);
    } catch (e) {
        log(`AdminMonitor: gagal menyimpan state (${e.message})`, 'warn');
    }
}

function recordKlarif(pID, by) {
    state.actions[pID] = { klarifBy: String(by), klarifAt: Math.floor(Date.now() / 1000) };
    saveState();
}
const followUpText = (act) => `Klarifikasi diminta oleh ${escapeMarkdown(act.klarifBy)} (<t:${act.klarifAt}:f>)`;

function buildButtons(pID, { klarifDone = false, disabled = false } = {}) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`adminmon-klarif:${pID}`)
            .setLabel(klarifDone ? 'Klarifikasi Diminta' : 'Minta Klarifikasi')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled || klarifDone),
        new ButtonBuilder()
            .setCustomId(`adminmon-demote:${pID}`)
            .setLabel('Demote')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled),
    );
}

function buildEmbeds(offline) {
    return offline.map((a) => {
        const sec = a.last ? Math.floor(a.last / 1000) : null;
        const embed = new EmbedBuilder()
            .setTitle('🔴 Admin Tidak Aktif')
            .setColor(0xed4245)
            .addFields(
                { name: 'Nama Discord', value: a.discord.slice(0, 1024) },
                { name: 'Nama Admin', value: `${a.adminName}\n\`${a.charName}\``.slice(0, 1024) },
                {
                    name: 'Login Terakhir',
                    value: sec
                        ? `<t:${sec}:F>\n(${a.diffDays} hari lalu • <t:${sec}:R>)`
                        : 'Belum pernah / tidak tercatat',
                },
                { name: 'Level Admin', value: String(a.level), inline: true },
            );
        const act = state.actions[a.pID];
        if (act) embed.addFields({ name: 'Tindak Lanjut', value: followUpText(act) });
        return embed;
    });
}

async function resolveTarget(client, channel) {
    if (channel) return channel;
    if (cfg.autoChannelId) {
        const ch = await client.channels.fetch(cfg.autoChannelId).catch(() => null);
        if (ch?.isTextBased()) return ch;
        log(`AdminMonitor: channel otomatis ${cfg.autoChannelId} tidak ditemukan, laporan dikirim lewat DM.`, 'warn');
    }
    return client.users.fetch(cfg.reportUserId);
}

async function deleteOld(target, ids) {
    for (const id of ids ?? []) await target.messages?.delete(id).catch(() => null);
}

async function sendReport(client, { channel = null, force = false } = {}) {
    const offline = await buildOfflineList(client);
    const target = await resolveTarget(client, channel);
    const isChannel = typeof target.messages?.delete === 'function';
    const sent = [];
    const post = async (payload) => {
        const m = await target.send({ allowedMentions: { parse: [] }, ...payload });
        sent.push(m.id);
    };

    const still = new Set(offline.map((o) => String(o.pID)));
    for (const k of Object.keys(state.actions)) if (!still.has(k)) delete state.actions[k];

    if (offline.length === 0) {
        log('AdminMonitor: semua admin aktif, tidak ada laporan.', 'info');
        if (force) {
            await post({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x57f287)
                        .setTitle('🟢 Semua Admin Aktif')
                        .setDescription(`Tidak ada admin yang offline lebih dari ${cfg.maxOfflineDays} hari.`),
                ],
            });
        }
    } else {
        const embeds = buildEmbeds(offline);
        await post({ content: `**${offline.length} admin tidak login lebih dari ${cfg.maxOfflineDays} hari**` });

        for (let i = 0; i < embeds.length; i++) {
            const done = !!state.actions[offline[i].pID];
            await post({ embeds: [embeds[i]], components: [buildButtons(offline[i].pID, { klarifDone: done })] });
        }
        log(`AdminMonitor: laporan terkirim (${offline.length} admin).`, 'done');
    }

    if (isChannel) {
        await deleteOld(target, state.reports[target.id]);
        state.reports[target.id] = sent;
    }
    saveState();
    return offline;
}

let timer = null;
let running = false;

function start(client) {
    if (cfg.enabled === false) return log('AdminMonitor dimatikan (adminmonitor.enabled = false).', 'warn');
    if (timer) clearInterval(timer);

    const run = async () => {
        if (running) return;
        running = true;
        try {
            await sendReport(client);
        } catch (e) {
            log(`AdminMonitor gagal: ${e.message ?? e}`, 'err');
        } finally {
            running = false;
        }
    };

    log(`AdminMonitor aktif: cek tiap ${cfg.checkEveryHours} jam, batas ${cfg.maxOfflineDays} hari.`, 'done');
    if (cfg.runOnStart) run();
    timer = setInterval(run, cfg.checkEveryHours * 60 * 60 * 1000);
}

async function getAdminByPid(pID) {
    const s = await getSchema();
    const rows = await q(
        `SELECT c.\`${s.id}\` AS pID, c.\`${s.name}\` AS charName, ` +
            `${s.adminName ? `c.\`${s.adminName}\`` : 'NULL'} AS adminName, c.\`${s.ucp}\` AS ucp, ` +
            `c.\`${s.level}\` AS level, c.\`${s.lastLogin}\` AS lastLogin, ` +
            `u.\`${cfg.discordColumn}\` AS discordId ` +
            `FROM \`${cfg.table}\` c LEFT JOIN \`${cfg.ucpTable}\` u ON u.\`${cfg.ucpColumn}\` = c.\`${s.ucp}\` ` +
            `WHERE c.\`${s.id}\` = ? LIMIT 1`,
        [pID],
    );
    if (!rows.length) return null;
    const r = rows[0];
    const did = String(r.discordId ?? '').trim();
    return {
        pID: r.pID,
        charName: String(r.charName),
        adminName: r.adminName && String(r.adminName) !== 'None' ? String(r.adminName) : String(r.charName),
        ucp: r.ucp,
        level: Number(r.level) || 0,
        last: parseLastLogin(r.lastLogin),
        discordId: /^\d{15,25}$/.test(did) ? did : null,
    };
}

async function demoteUcp(ucp) {
    const s = await getSchema();
    const chars = await q(`SELECT \`${s.name}\` AS n FROM \`${cfg.table}\` WHERE \`${s.ucp}\` = ? AND \`${s.level}\` > 0`, [
        ucp,
    ]);
    if (await online.anyOnline(chars.map((c) => c.n))) return { online: true, changed: 0 };
    const res = await q(`UPDATE \`${cfg.table}\` SET \`${s.level}\` = 0 WHERE \`${s.ucp}\` = ? AND \`${s.level}\` > 0`, [
        ucp,
    ]);
    return { online: false, changed: res.affectedRows };
}

async function writeAdminLog(name, text, meta = {}) {
    const A = S.adminLog;
    await q(`INSERT INTO ?? (??, ??, ??, ??) VALUES (?, ?, ?, ?)`, [
        A.table,
        A.cmd,
        A.admin,
        A.ucp,
        A.target,
        String(meta.cmd ?? text).slice(0, 32),
        String(name).slice(0, 32),
        'Discord',
        String(meta.target ?? '').slice(0, 24),
    ]);
}

function canAct(interaction) {
    const id = interaction.user.id;
    if ([].concat(def.users?.ownerId ?? [], def.users?.developers ?? []).includes(id)) return true;
    if ((cfg.actionUserIds ?? []).includes(id)) return true;
    const roles = interaction.member?.roles?.cache;
    return !!roles && cfg.actionRoleIds.some((r) => roles.has(r));
}

module.exports = {
    start,
    startAdminMonitor: start,
    sendReport,
    buildOfflineList,
    config: cfg,
    buildButtons,
    getAdminByPid,
    demoteUcp,
    writeAdminLog,
    canAct,
    recordKlarif,
};
