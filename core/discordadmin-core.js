const def = require('../defines');
const db = require('./query');
const { log } = require('../functions');
const gamelog = require('./gamelog-core');
const online = require('./online');
const ucpDb = require('./ucp-db');
const S = require('./schema');

const cfg = {
    enabled: true,

    jailRoleIds: ['YOUR_DISCORD_ID', 'YOUR_DISCORD_ID'],

    banRoleIds: ['YOUR_DISCORD_ID'],
    logChannelId: '',
    table: 'player_characters',
    actionsTable: 'discord_actions',
    sweepSeconds: 15,
    pendingFallbackSeconds: 120,
    ...(def.discordadmin ?? {}),
};

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

const cut = (s, n) => {
    s = String(s ?? '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
};
const fmtMoney = (n) => `$${Number(n ?? 0).toLocaleString('en-US')}`;
const normName = (s) =>
    String(s ?? '')
        .trim()
        .replace(/\s+/g, '_');

const isOwnerOrDev = (userId) => [].concat(def.users?.ownerId ?? [], def.users?.developers ?? []).includes(userId);

function hasRole(interaction, ids) {
    const roles = interaction.member?.roles?.cache;
    return !!roles && ids.some((id) => roles.has(id));
}
const canJail = (i) => isOwnerOrDev(i.user.id) || hasRole(i, cfg.jailRoleIds);
const canBan = (i) => isOwnerOrDev(i.user.id) || hasRole(i, cfg.banRoleIds);
const canUnjail = (i) => isOwnerOrDev(i.user.id) || hasRole(i, cfg.jailRoleIds);
const canUnban = (i) => isOwnerOrDev(i.user.id) || hasRole(i, cfg.banRoleIds);

let tableReady = null;
function ensureTable() {
    tableReady ??= q(
        'CREATE TABLE IF NOT EXISTS ?? (' +
            '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,' +
            '`action` VARCHAR(16) NOT NULL,' +
            '`target_name` VARCHAR(32) NOT NULL,' +
            '`minutes` INT NOT NULL DEFAULT 0,' +
            '`amount` INT NOT NULL DEFAULT 0,' +
            '`days` INT NOT NULL DEFAULT 0,' +
            "`reason` VARCHAR(128) NOT NULL DEFAULT '-'," +
            "`admin` VARCHAR(64) NOT NULL DEFAULT 'Discord'," +
            '`status` TINYINT NOT NULL DEFAULT 0,' +
            '`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,' +
            'KEY `idx_status` (`status`)' +
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
        [cfg.actionsTable],
    ).catch((e) => {
        tableReady = null;
        throw e;
    });
    return tableReady;
}

async function findChar(input) {
    const name = normName(input);
    const rows = await q(
        'SELECT `pID`, `Char_Name`, `Char_UCP`, `Char_Admin`, `Char_IP`, `Char_Money` FROM ?? WHERE `Char_Name` = ? LIMIT 1',
        [cfg.table, name],
    );
    if (rows.length) return { char: rows[0] };
    const like = await q('SELECT `Char_Name` FROM ?? WHERE `Char_Name` LIKE ? LIMIT 5', [cfg.table, `%${name}%`]);
    return { suggestions: like.map((r) => r.Char_Name), name };
}

async function resolveAdmin(user) {
    try {
        const rows = await q(
            'SELECT c.`Char_Name`, c.`Char_AdminName`, c.`Char_Admin`, c.`Char_UCP` FROM ?? u ' +
                'JOIN ?? c ON c.`Char_UCP` = u.?? WHERE u.?? = ? AND c.`Char_Admin` > 0 ' +
                'ORDER BY c.`Char_Admin` DESC LIMIT 1',
            [S.ucp.table, cfg.table, S.ucp.ucp, S.ucp.discord, String(user.id)],
        );
        if (rows.length) {
            const r = rows[0];
            const adminName = r.Char_AdminName && r.Char_AdminName !== 'None' ? r.Char_AdminName : r.Char_Name;
            return {
                linked: true,
                adminName,
                charName: r.Char_Name,
                ucp: r.Char_UCP ?? 'Discord',
                level: Number(r.Char_Admin),
            };
        }
    } catch (e) {
        log(`DiscordAdmin: gagal mencari identitas admin (${e.message})`, 'warn');
    }
    return {
        linked: false,
        adminName: `Discord:${user.username}`,
        charName: `Discord:${user.username}`,
        ucp: 'Discord',
        level: 0,
    };
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const p2 = (n) => String(n).padStart(2, '0');
// Format yang dipakai gamemode: Date = "17/09/2026", Date_Time = "Kam 17 Sep 2026, 08:14:16"
function gameDate(offsetHours = def.dutyreport?.utcOffsetHours ?? 7) {
    const d = new Date(Date.now() + offsetHours * 3600 * 1000);
    return {
        date: `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`,
        dateTime: `${HARI[d.getUTCDay()]} ${p2(d.getUTCDate())} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`,
    };
}

async function writeWarningLog(pID, type, sender, reason) {
    const W = S.warnLog;
    const t = gameDate();
    const cols = [W.owner, W.date, W.dateTime, W.issuer, W.type, W.reason];
    await q(`INSERT INTO ?? (${cols.map(() => '??').join(', ')}) VALUES (?, ?, ?, ?, ?, ?)`, [
        W.table,
        ...cols,
        pID,
        t.date,
        t.dateTime,
        cut(sender, 24),
        type,
        cut(reason, 64),
    ]);
}

// admin_logs di database ini: Prefix (perintah), Admin, AdminUCP, UCPTarget
async function writeAdminLog(admin, text, meta = {}) {
    const A = S.adminLog;
    const cols = [A.cmd, A.admin, A.ucp, A.target];
    await q(`INSERT INTO ?? (${cols.map(() => '??').join(', ')}) VALUES (?, ?, ?, ?)`, [
        A.table,
        ...cols,
        cut(meta.cmd ?? text, 32),
        cut(admin.adminName ?? admin.charName, 32),
        cut(admin.ucp, 24),
        cut(meta.target ?? '', 24),
    ]);
}

async function applyJailToDb({ pID, minutes, denda, reason, admin }) {
    // Kolom jail disesuaikan dengan player_characters milik server ini (lihat core/schema.js).
    // Denda disimpan di kolom fine (gamemode yang menagihnya), uang tidak dipotong langsung.
    const J = S.jail;
    const sets = [
        [J.knock, 0],
        [J.knockTime, 0],
        [J.jailed, 1],
        [J.cell, -1],
        [J.time, minutes * 60],
        [J.duration, minutes],
        [J.reason, cut(reason, 59)],
        [J.admin, cut(admin, 23)],
        [J.fine, denda],
    ].filter(([col]) => !!col);
    // Sama seperti /jail di gamemode: denda langsung memotong uang di tangan (tidak di bawah 0).
    await q(
        `UPDATE ?? SET ${sets.map(() => '?? = ?').join(', ')}, \`Char_Money\` = GREATEST(\`Char_Money\` - ?, 0) WHERE \`pID\` = ?`,
        [cfg.table, ...sets.flat(), denda, pID],
    );
}

async function jail({ interaction, nameInput, minutes, denda, reason }) {
    await ensureTable();
    const found = await findChar(nameInput);
    if (!found.char) return { error: notFoundText(found) };
    const target = found.char;
    const admin = await resolveAdmin(interaction.user);
    const isOnline = await online.isOnline(target.Char_Name);

    if (isOnline) {
        await q(
            "INSERT INTO ?? (`action`, `target_name`, `minutes`, `amount`, `reason`, `admin`) VALUES ('jail', ?, ?, ?, ?, ?)",
            [cfg.actionsTable, target.Char_Name, minutes, denda, cut(reason, 125), cut(admin.adminName, 63)],
        );
    } else {
        await applyJailToDb({ pID: target.pID, minutes, denda, reason, admin: admin.adminName });
    }

    await writeWarningLog(target.pID, 2, admin.adminName, reason);
    gamelog.enqueue({
        type: 'jail',
        actor: admin.charName,
        target: target.Char_Name,
        amount: minutes,
        amount2: denda,
        info: 'Discord',
        reason,
    });
    await writeAdminLog(
        admin,
        `Menggunakan cmd /jail (Discord) kepada pemain ${target.Char_Name} selama ${minutes} menit + ${fmtMoney(denda)} denda`,
        { cmd: 'jail (Discord)', target: target.Char_Name },
    );
    return { target, admin, online: isOnline };
}

async function activeBan(name) {
    const rows = await q(
        'SELECT `id`, `ban_expire`, `admin`, `reason` FROM `player_bans` WHERE `name` = ? AND (`ban_expire` = 0 OR `ban_expire` > UNIX_TIMESTAMP()) LIMIT 1',
        [name],
    );
    return rows[0] ?? null;
}

async function ban({ interaction, nameInput, days, reason }) {
    await ensureTable();
    const found = await findChar(nameInput);
    if (!found.char) return { error: notFoundText(found) };
    const target = found.char;
    const admin = await resolveAdmin(interaction.user);

    const targetAdmin = Number(target.Char_Admin) || 0;
    if (targetAdmin > 0 && !isOwnerOrDev(interaction.user.id) && !(admin.linked && admin.level >= targetAdmin)) {
        return {
            error: `❌ \`${target.Char_Name}\` adalah admin (level ${targetAdmin}). Kamu tidak bisa mem-ban admin dengan level lebih tinggi dari akunmu.`,
        };
    }

    const existing = await activeBan(target.Char_Name);
    if (existing) {
        return {
            error: `⚠️ \`${target.Char_Name}\` sudah dalam keadaan di-ban (ban #${existing.id}, oleh ${existing.admin}).`,
        };
    }

    const isOnline = await online.isOnline(target.Char_Name);
    const now = Math.floor(Date.now() / 1000);
    const expire = days > 0 ? now + days * 86400 : 0;

    await q(
        'INSERT INTO `player_bans` (`name`, `ip`, `admin`, `reason`, `ban_date`, `ban_expire`) VALUES (?, ?, ?, ?, ?, ?)',
        [target.Char_Name, target.Char_IP || 'None', cut(admin.adminName, 40), cut(reason, 128), now, expire],
    );
    if (isOnline) {
        await q("INSERT INTO ?? (`action`, `target_name`, `days`, `reason`, `admin`) VALUES ('ban', ?, ?, ?, ?)", [
            cfg.actionsTable,
            target.Char_Name,
            days,
            cut(reason, 125),
            cut(admin.adminName, 63),
        ]);
    }

    await writeWarningLog(target.pID, 3, admin.adminName, reason);
    gamelog.enqueue({
        type: 'ban',
        actor: admin.charName,
        target: target.Char_Name,
        amount: days,
        info: 'Karakter',
        reason,
    });
    await writeAdminLog(
        admin,
        `Menggunakan cmd /ban (Discord) kepada ${target.Char_Name} selama ${days > 0 ? `${days} hari` : 'permanent'} dengan alasan ${reason}`,
        { cmd: 'ban (Discord)', target: target.Char_Name },
    );
    return { target, admin, online: isOnline, expire };
}

async function applyUnjailToDb({ pID }) {
    const J = S.jail;
    await q('UPDATE ?? SET ?? = 0, ?? = 0 WHERE `pID` = ?', [cfg.table, J.jailed, J.time, pID]);
}

async function unjail({ interaction, nameInput, reason }) {
    await ensureTable();
    const found = await findChar(nameInput);
    if (!found.char) return { error: notFoundText(found) };
    const target = found.char;

    const [st] = await q('SELECT ?? AS jailed, ?? AS jailTime FROM ?? WHERE `pID` = ? LIMIT 1', [
        S.jail.jailed,
        S.jail.time,
        cfg.table,
        target.pID,
    ]);
    if (!st || (!Number(st.jailed) && !Number(st.jailTime))) {
        return { error: `⚠️ \`${target.Char_Name}\` tidak sedang di-jail.` };
    }

    const admin = await resolveAdmin(interaction.user);
    const isOnline = await online.isOnline(target.Char_Name);

    if (isOnline) {
        await q("INSERT INTO ?? (`action`, `target_name`, `reason`, `admin`) VALUES ('unjail', ?, ?, ?)", [
            cfg.actionsTable,
            target.Char_Name,
            cut(reason, 125),
            cut(admin.adminName, 63),
        ]);
    } else {
        await applyUnjailToDb({ pID: target.pID });
    }

    gamelog.enqueue({ type: 'unjail', actor: admin.charName, target: target.Char_Name, info: 'Discord', reason });
    await writeAdminLog(admin, `Menggunakan cmd /unjail (Discord) kepada ${target.Char_Name} dengan alasan ${reason}`, {
        cmd: 'unjail (Discord)',
        target: target.Char_Name,
    });
    return { target, admin, online: isOnline };
}

async function unban({ interaction, nameInput, reason }) {
    const found = await findChar(nameInput);

    const name = found.char ? found.char.Char_Name : normName(nameInput);
    const bans = await q(
        'SELECT `id`, `ban_expire`, `admin`, `reason` FROM `player_bans` WHERE `name` = ? AND (`ban_expire` = 0 OR `ban_expire` > UNIX_TIMESTAMP())',
        [name],
    );
    if (!bans.length) {
        if (!found.char) return { error: notFoundText(found) };
        return { error: `⚠️ \`${name}\` tidak sedang di-ban.` };
    }

    const admin = await resolveAdmin(interaction.user);

    await q('DELETE FROM `player_bans` WHERE `name` = ?', [name]);

    gamelog.enqueue({ type: 'unban', actor: admin.charName, target: name, info: 'Karakter', reason });
    await writeAdminLog(admin, `Menggunakan cmd /unban (Discord) kepada ${name} dengan alasan ${reason}`, {
        cmd: 'unban (Discord)',
        target: name,
    });
    return {
        target: found.char ?? { Char_Name: name, Char_UCP: null },
        admin,
        removed: bans.length,
        previous: bans[0],
    };
}

function notFoundText(found) {
    const saran = found.suggestions?.length
        ? `\nMungkin maksudmu: ${found.suggestions.map((n) => `\`${n}\``).join(', ')}`
        : '';
    return `❌ Karakter \`${found.name}\` tidak ditemukan.${saran}`;
}

let sweeping = false;
let lastWarnAt = 0;
async function sweep() {
    if (sweeping) return;
    sweeping = true;
    try {
        const rows = await q(
            'SELECT * FROM ?? WHERE `status` = 2 OR (`status` = 0 AND `created_at` < NOW() - INTERVAL ? SECOND) ORDER BY `id` ASC LIMIT 20',
            [cfg.actionsTable, cfg.pendingFallbackSeconds],
        );
        for (const r of rows) {
            if (r.action === 'jail') {
                const [c] = await q('SELECT `pID` FROM ?? WHERE `Char_Name` = ? LIMIT 1', [cfg.table, r.target_name]);
                if (!c) {
                    await q('UPDATE ?? SET `status` = 3 WHERE `id` = ?', [cfg.actionsTable, r.id]);
                    continue;
                }
                if (r.status === 0 && (await online.isOnline(r.target_name))) {
                    if (Date.now() - lastWarnAt > 5 * 60 * 1000) {
                        lastWarnAt = Date.now();
                        log(
                            `DiscordAdmin: perintah #${r.id} (${r.action} ${r.target_name}) belum diproses gamemode >${cfg.pendingFallbackSeconds}s. Pastikan pawn/discord_actions.pwn terpasang.`,
                            'warn',
                        );
                    }
                    continue;
                }
                await applyJailToDb({
                    pID: c.pID,
                    minutes: r.minutes,
                    denda: r.amount,
                    reason: r.reason,
                    admin: r.admin,
                });
            }
            if (r.action === 'unjail') {
                const [c] = await q('SELECT `pID` FROM ?? WHERE `Char_Name` = ? LIMIT 1', [cfg.table, r.target_name]);
                if (!c) {
                    await q('UPDATE ?? SET `status` = 3 WHERE `id` = ?', [cfg.actionsTable, r.id]);
                    continue;
                }
                if (r.status === 0 && (await online.isOnline(r.target_name))) continue;
                await applyUnjailToDb({ pID: c.pID });
            }

            await q('UPDATE ?? SET `status` = 3 WHERE `id` = ?', [cfg.actionsTable, r.id]);
        }
    } catch (e) {
        if (Date.now() - lastWarnAt > 60 * 1000) {
            lastWarnAt = Date.now();
            log(`DiscordAdmin sweeper gagal: ${e.message}`, 'err');
        }
    } finally {
        sweeping = false;
    }
}

let timer = null;
async function start() {
    if (cfg.enabled === false) return;
    try {
        await ensureTable();
    } catch (e) {
        return log(`DiscordAdmin tidak aktif: gagal menyiapkan tabel ${cfg.actionsTable} (${e.message}).`, 'err');
    }
    if (timer) clearInterval(timer);
    timer = setInterval(sweep, cfg.sweepSeconds * 1000);
    log('DiscordAdmin (/jail, /ban) aktif.', 'done');
}

module.exports = { start, jail, ban, unjail, unban, canJail, canBan, canUnjail, canUnban, config: cfg, fmtMoney };
