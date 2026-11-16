// Auto-setup channel log: cocokkan nama channel Discord (mis. "logs-jail") dengan pengaturan bot,
// dan (opsional) buat channel log yang belum ada dengan izin disalin dari channel log yang sudah ada.
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const def = require('../defines');
const settings = require('./settings');
const { FIELDS } = require('./schema');
const { log } = require('../functions');

// alias = bagian nama setelah "logs-"; create = nama channel bila belum ada (null = jangan dibuat)
const RULES = [
    { path: 'gamelog.channels.jail', label: 'Game log: jail', alias: ['jail'], create: 'logs-jail' },
    { path: 'gamelog.channels.unjail', label: 'Game log: unjail', alias: ['unjail'], create: 'logs-unjail' },
    { path: 'gamelog.channels.ban', label: 'Game log: ban', alias: ['banned', 'ban'], create: 'logs-banned' },
    { path: 'gamelog.channels.unban', label: 'Game log: unban', alias: ['unband', 'unban', 'unbanned'], create: 'logs-unband' },
    { path: 'gamelog.channels.setbank', label: 'Game log: setbank', alias: ['setbankmoney', 'setbank'], create: 'logs-setbankmoney' },
    { path: 'gamelog.channels.transfer', label: 'Game log: transfer / pay', alias: ['pay', 'transfer'], create: 'logs-pay' },
    { path: 'gamelog.channels.kill', label: 'Game log: kill / death', alias: ['death', 'kill'], create: 'logs-death' },
    { path: 'gamelog.channels.giveweap', label: 'Game log: giveweap', alias: ['givegun', 'giveweap'], create: 'logs-givegun' },
    { path: 'gamelog.channels.default', label: 'Game log: lainnya', alias: ['command'], create: 'logs-command' },
    { path: 'auditlog.channels.command', label: 'Audit command admin', alias: ['command'], create: 'logs-command' },
    { path: 'auditlog.channels.vault', label: 'Brankas faction', alias: ['brankas-faction', 'brankas'], create: 'logs-brankas-faction' },
    { path: 'auditlog.channels.askreport', label: 'Ask report', alias: ['askreport', 'ask-report'], create: 'logs-askreport' },
    { path: 'moneylog.channelId', label: 'Money log (uang besar)', alias: ['activitasmoney', 'activitymoney', 'moneylog'], create: 'logs-activitasmoney' },
    { path: 'adminmonitor.autoChannelId', label: 'Admin monitor: laporan otomatis', alias: ['admin-monitor', 'adminmonitor'], create: 'logs-admin-monitor' },
    { path: 'adminmonitor.commandChannelId', label: 'Admin monitor: command', alias: ['admin-monitor', 'adminmonitor'], create: 'logs-admin-monitor' },
    { path: 'donation.logChannelId', label: 'Donasi: log', alias: ['donate', 'donasi'], create: 'logs-donate' },
    { path: 'refund.logChannelId', label: 'Refund: log', alias: ['reffund', 'refund'], create: 'logs-refund' },
    { path: 'incomelog.channelId', label: 'Income log', alias: ['income', 'incomelog'], create: 'logs-income' },
    { path: 'familylog.channelId', label: 'Family log (panel)', alias: ['family-log', 'familylog'], create: 'logs-family' },
    { path: 'discordadmin.logChannelId', label: 'Admin via Discord: log aksi', alias: ['discord-admin'], create: 'logs-discord-admin' },
    { path: 'delchar.logChannelId', label: 'Hapus karakter: log', alias: ['hapus-karakter', 'delchar'], create: 'logs-hapus-karakter' },
    { path: 'ratestaff.logChannelId', label: 'Rate staff: log', alias: ['rate-staff', 'ratestaff'], create: 'logs-rate-staff' },
    { path: 'izin.logChannelId', label: 'Izin admin: log', alias: ['izin'], create: 'logs-izin' },
    { path: 'report.logChannelId', label: 'Report pemain: log', alias: ['report'], create: 'logs-report' },
];

const slugOf = (name) => {
    const n = String(name).toLowerCase().replace(/[｜|]/g, ' ');
    const m = /logs?[-_ ]?(.+)$/.exec(n);
    return (m ? m[1] : n).trim().replace(/\s+/g, '-');
};

const currentOf = (path) => {
    const v = settings.getPath(def, path);
    return v === undefined || v === null || v === '' ? (FIELDS.get(path)?.def ?? '') : v;
};

async function getGuild(client) {
    if (!client?.isReady?.()) throw new Error('Bot belum online.');
    const gid = def.client?.guild;
    const guild = client.guilds.cache.get(gid) ?? (await client.guilds.fetch(gid).catch(() => null));
    if (!guild) throw new Error('Guild ID salah atau bot belum masuk server.');
    await guild.channels.fetch().catch(() => {});
    return guild;
}

const textChannels = (guild) => [...guild.channels.cache.values()].filter((c) => c.type !== ChannelType.GuildCategory && c.isTextBased?.());

async function preview(client) {
    const guild = await getGuild(client);
    const chans = textChannels(guild);
    const bySlug = new Map();
    for (const c of chans) if (!bySlug.has(slugOf(c.name))) bySlug.set(slugOf(c.name), c);
    const rows = RULES.map((r) => {
        const cur = String(currentOf(r.path) || '');
        const curCh = cur ? guild.channels.cache.get(cur) : null;
        const hit = r.alias.map((a) => bySlug.get(a)).find(Boolean) ?? null;
        let status;
        if (hit && curCh && hit.id === curCh.id) status = 'ok';
        else if (hit) status = 'assign';
        else if (curCh) status = 'filled';
        else status = 'create';
        return {
            path: r.path, label: r.label, status,
            current: cur, currentName: curCh?.name ?? null,
            match: hit ? { id: hit.id, name: hit.name } : null,
            createName: r.create,
            // dipilih otomatis: cocok tapi beda, atau kosong/tidak valid & belum ada channelnya
            checked: status === 'assign' || (status === 'create' && !!r.create),
        };
    });
    return { guild: guild.name, rows };
}

function templateOverwrites(guild, tpl) {
    const me = guild.members.me;
    const list = tpl
        ? [...tpl.permissionOverwrites.cache.values()].map((o) => ({ id: o.id, type: o.type, allow: o.allow, deny: o.deny }))
        : [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }];
    const meIdx = list.findIndex((o) => o.id === me.id);
    const allow = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
    if (meIdx === -1) list.push({ id: me.id, allow });
    return list;
}

// body.items: [{ path, mode: 'assign'|'create', channelId? }]
async function apply(client, body, saveFn) {
    const guild = await getGuild(client);
    const pv = await preview(client);
    const byPath = new Map(pv.rows.map((r) => [r.path, r]));
    const template = pv.rows.find((r) => r.path === 'gamelog.channels.jail')?.match;
    const tplCh = template ? guild.channels.cache.get(template.id) : (pv.rows.find((r) => r.match)?.match ? guild.channels.cache.get(pv.rows.find((r) => r.match).match.id) : null);
    const parentId = /^\d{15,25}$/.test(String(body.categoryId ?? '')) ? String(body.categoryId) : (tplCh?.parentId ?? null);

    const changes = {};
    const created = new Map(); // nama -> channel (dipakai bersama bila beberapa pengaturan butuh channel yang sama)
    const report = [];
    for (const it of body.items ?? []) {
        const row = byPath.get(it.path);
        const rule = RULES.find((r) => r.path === it.path);
        if (!row || !rule) { report.push(`❌ ${it.path}: tidak dikenal`); continue; }
        try {
            if (it.mode === 'assign') {
                const id = String(it.channelId ?? row.match?.id ?? '');
                if (!guild.channels.cache.has(id)) throw new Error('channel tidak ditemukan');
                changes[it.path] = id;
                report.push(`✅ ${row.label} → #${guild.channels.cache.get(id).name}`);
            } else if (it.mode === 'create') {
                let ch = created.get(rule.create) ?? chans(guild).find((c) => slugOf(c.name) === slugOf(rule.create));
                if (!ch) {
                    // ikuti gaya nama channel log yang sudah ada (mis. awalan emoji "🔒｜")
                    const prefix = /^(.*?)logs?[-_ ]/i.exec(tplCh?.name ?? '')?.[1] ?? '';
                    ch = await guild.channels.create({
                        name: prefix + rule.create, type: ChannelType.GuildText, parent: parentId || undefined,
                        permissionOverwrites: templateOverwrites(guild, tplCh), reason: 'Auto-setup log (dashboard)',
                    });
                    log(`Dashboard: channel #${ch.name} dibuat`, 'done');
                    report.push(`🆕 #${ch.name} dibuat`);
                }
                created.set(rule.create, ch);
                changes[it.path] = ch.id;
                report.push(`✅ ${row.label} → #${ch.name}`);
            }
        } catch (e) {
            const hint = /Missing Permissions/i.test(e.message) ? ' (bot butuh izin Manage Channels)' : '';
            report.push(`❌ ${row?.label ?? it.path}: ${e.message}${hint}`);
        }
    }
    const saved = Object.keys(changes).length ? saveFn({ changes }) : { ok: true };
    if (!saved.ok) report.push(...saved.errors.map((e) => `❌ ${e}`));
    return { ok: saved.ok, report, saved: Object.keys(changes).length };
}
const chans = textChannels;

module.exports = { RULES, preview, apply, slugOf };
