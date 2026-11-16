const fs = require('fs');
const path = require('path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { renderChangelogImage, parseItems } = require('./changelog-image');
const def = require('../defines');

const cfg = {
    channelId: 'YOUR_DISCORD_ID',
    banner: 'https://i.imgur.com/k6Xkkpv.jpeg',
    firstVersion: 'v1.0.0',
    extraRoleIds: [],
    color: '#0b0b0c',
    timeZone: 'Asia/Jakarta',
    ...(def.changelog ?? {}),
};

const STATE_FILE = path.join(__dirname, '..', 'data', 'changelog-state.json');
const DRAFT_TTL = 15 * 60 * 1000;
const drafts = new Map();

const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.]+)?$/i;

function load() {
    try {
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        return Array.isArray(data.entries) ? data : { entries: [] };
    } catch {
        return { entries: [] };
    }
}

function save(data) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
}

function normalizeVersion(input) {
    const v = String(input ?? '').trim();
    if (!VERSION_RE.test(v)) return null;
    return v.toLowerCase().startsWith('v') ? 'v' + v.slice(1) : 'v' + v;
}

function suggestNextVersion() {
    const { entries } = load();
    if (!entries.length) return cfg.firstVersion;
    const last = entries[entries.length - 1].version;
    const m = last.match(VERSION_RE);
    if (!m) return cfg.firstVersion;
    return `v${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

function versionExists(version) {
    return load().entries.some((e) => e.version.toLowerCase() === version.toLowerCase());
}

function canUpdate(interaction) {
    const id = interaction.user.id;
    if ([].concat(def.users?.ownerId ?? []).includes(id)) return true;
    if ([].concat(def.users?.developers ?? []).includes(id)) return true;
    const roles = interaction.member?.roles?.cache;
    const roleIds = [def.bugreport?.developerRoleId, ...cfg.extraRoleIds].filter(Boolean);
    return !!roles && roleIds.some((r) => roles.has(r));
}

function cut(text, max) {
    const s = String(text);
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function dateLabel(timestamp) {
    const p = new Intl.DateTimeFormat('en-GB', {
        timeZone: cfg.timeZone,
        day: '2-digit',
        month: '2-digit',
    }).formatToParts(new Date(timestamp));
    const get = (t) => p.find((x) => x.type === t).value;
    return `${get('day')}/${get('month')}`;
}

async function buildEmbed({ version, title, changes, authorId, timestamp }) {
    const unix = Math.floor(timestamp / 1000);
    const fileName = `update-${version.replace(/[^0-9A-Za-z.-]/g, '')}.png`;
    let png = null;
    try {
        png = await renderChangelogImage({ dateText: dateLabel(timestamp), items: parseItems(changes) });
    } catch (e) {
        console.error('Changelog: gagal membuat gambar, memakai daftar teks.', e.message);
    }

    const embed = new EmbedBuilder()
        .setTitle(`🚀 PATCH NOTES • ${version}`)
        .setDescription(cut(`**${title}**`, 4000))
        .addFields(
            { name: 'Waktu Rilis', value: `<t:${unix}:F>\n(<t:${unix}:R>)`, inline: true },
            { name: 'Dipublish Oleh', value: `<@${authorId}>`, inline: true },
        )
        .setColor(cfg.color)
        .setFooter({ text: `Expensive Roleplay Management • ${version}` })
        .setTimestamp(timestamp);

    if (!png) {
        embed.setDescription(
            cut(
                `**${title}**\n\n${parseItems(changes)
                    .map((l) => `- ${l}`)
                    .join('\n')}`,
                4000,
            ),
        );
        return { embed, files: [] };
    }
    embed.setImage(`attachment://${fileName}`);
    return { embed, files: [new AttachmentBuilder(png, { name: fileName })] };
}

async function publish(client, interaction, draft) {
    const channel = await client.channels.fetch(cfg.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel changelog (${cfg.channelId}) tidak ditemukan atau bukan channel teks.`);
    }

    const entry = {
        version: draft.version,
        title: draft.title,
        changes: draft.changes,
        authorId: interaction.user.id,
        authorTag: interaction.user.tag,
        timestamp: Date.now(),
    };

    const { embed, files } = await buildEmbed(entry);
    const msg = await channel.send({
        embeds: [embed],
        files,
        allowedMentions: { parse: [] },
    });

    entry.messageId = msg.id;
    const data = load();
    data.entries.push(entry);
    save(data);

    return { channel, message: msg, entry };
}

module.exports = {
    cfg,
    drafts,
    DRAFT_TTL,
    normalizeVersion,
    suggestNextVersion,
    versionExists,
    canUpdate,
    cut,
    buildEmbed,
    publish,
};
