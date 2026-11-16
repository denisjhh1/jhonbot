const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');
const { log } = require('../functions');

const DEFAULT_FORMAT = '{emoji}〢{nama}';
const DEFAULT_SEP = '・';
const DEFAULT_EMOJI = '💬';
const EXPIRE_MS = 5 * 60 * 1000;
const RENAME_TIMEOUT_MS = 20 * 1000;
const MAX_PREVIEW = 40;

const EMOJI_UNIT = '(?:\\p{Extended_Pictographic}[\\uFE0E\\uFE0F]?[\\u{1F3FB}-\\u{1F3FF}]?)';
const EMOJI_SEQ = `(?:\\p{Regional_Indicator}{2}|[0-9#*]\\uFE0F?\\u20E3|${EMOJI_UNIT}(?:\\u200D${EMOJI_UNIT})*)`;
const EMOJI_RE = new RegExp(EMOJI_SEQ, 'u');
const EMOJI_ALL_RE = new RegExp(
    `${EMOJI_SEQ}|<a?:\\w+:\\d+>|[\\uFE0E\\uFE0F\\u200D\\u20E3\\u{1F3FB}-\\u{1F3FF}\\p{Regional_Indicator}]`,
    'gu',
);
const BAR_RE = /[｜|〢┃│┆┇║丨❘❙❚‖︱ǀ]+/;

function firstEmoji(name) {
    return String(name).match(EMOJI_RE)?.[0] ?? null;
}

function extractText(name) {
    let t = String(name).replace(EMOJI_ALL_RE, ' ');

    const parts = t
        .split(BAR_RE)
        .map((x) => x.trim())
        .filter((x) => /[\p{L}\p{N}]/u.test(x));
    if (parts.length) t = parts[parts.length - 1];
    return t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function buildName(oldName, { format, emoji, sep }) {
    const text = extractText(oldName) || String(oldName).replace(EMOJI_ALL_RE, '').trim() || 'channel';
    const nama = text
        .replace(/[\s_\-・･·•]+/g, sep)
        .replace(new RegExp(`(?:${escapeRe(sep)})+`, 'g'), sep)
        .replace(new RegExp(`^${escapeRe(sep)}|${escapeRe(sep)}$`, 'g'), '');
    const useEmoji = emoji || firstEmoji(oldName) || DEFAULT_EMOJI;
    return format
        .replace(/\{emoji\}/g, useEmoji)
        .replace(/\{nama\}/g, nama)
        .slice(0, 100);
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function childrenOf(category) {
    return [...category.children.cache.values()].sort((a, b) => a.rawPosition - b.rawPosition);
}

function createPlan(category, opts) {
    return childrenOf(category).map((ch) => ({ id: ch.id, oldName: ch.name, newName: buildName(ch.name, opts) }));
}

function previewPayload(token, category, plan, note = '') {
    const changes = plan.filter((p) => p.oldName !== p.newName);
    const lines = changes.slice(0, MAX_PREVIEW).map((p) => `\`${p.oldName}\` → \`${p.newName}\``);
    const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle(`Pratinjau • ${category.name}`)
        .setDescription(
            (lines.join('\n') || 'Tidak ada nama yang berubah.') +
                (changes.length > MAX_PREVIEW ? `\n+${changes.length - MAX_PREVIEW} lainnya` : ''),
        )
        .addFields({
            name: 'Ringkasan',
            value: `${changes.length} channel akan diganti, ${plan.length - changes.length} tidak berubah.${note ? `\n${note}` : ''}`,
        })
        .setFooter({ text: 'Pratinjau berlaku 5 menit' });
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`rnk-ok:${token}`)
            .setLabel('Konfirmasi')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!changes.length),
        new ButtonBuilder().setCustomId(`rnk-cancel:${token}`).setLabel('Batal').setStyle(ButtonStyle.Secondary),
    );
    return { embeds: [embed], components: [row], flags: MessageFlags.Ephemeral };
}

const pending = new Map();

function register(userId, categoryId, plan) {
    const token = Math.random().toString(36).slice(2, 10);
    pending.set(token, { userId, categoryId, plan, expires: Date.now() + EXPIRE_MS });
    for (const [k, v] of pending) if (v.expires < Date.now()) pending.delete(k);
    return token;
}

const withTimeout = (promise, ms) =>
    Promise.race([
        promise,
        new Promise((_, rej) =>
            setTimeout(() => rej(new Error('tertahan batas Discord (2x ganti nama / 10 menit)')), ms),
        ),
    ]);

async function execute(interaction, token) {
    const job = pending.get(token);
    if (!job || job.expires < Date.now()) return { error: 'Pratinjau sudah kadaluarsa. Jalankan ulang command-nya.' };
    if (job.userId !== interaction.user.id) return { error: 'Pratinjau ini bukan milikmu.' };
    pending.delete(token);

    const me = interaction.guild.members.me;
    const result = { ok: 0, skipped: 0, failed: [] };
    for (const step of job.plan) {
        if (step.oldName === step.newName) {
            result.skipped++;
            continue;
        }
        const ch = await interaction.guild.channels.fetch(step.id).catch(() => null);
        if (!ch) {
            result.failed.push({ name: step.oldName, error: 'channel tidak ditemukan' });
            continue;
        }
        if (!ch.permissionsFor(me)?.has(PermissionFlagsBits.ManageChannels)) {
            result.failed.push({ name: step.oldName, error: 'bot tidak punya izin Manage Channels' });
            continue;
        }
        try {
            await withTimeout(
                ch.setName(step.newName, `Rename kategori oleh ${interaction.user.tag}`),
                RENAME_TIMEOUT_MS,
            );
            result.ok++;
        } catch (e) {
            result.failed.push({ name: step.oldName, error: e.message });
        }
    }
    log(`RenameKategori: ${result.ok} berhasil, ${result.failed.length} gagal (oleh ${interaction.user.tag})`, 'done');
    return result;
}

const cancel = (token, userId) => {
    const job = pending.get(token);
    if (job && job.userId === userId) pending.delete(token);
};

module.exports = {
    DEFAULT_FORMAT,
    DEFAULT_SEP,
    DEFAULT_EMOJI,
    extractText,
    firstEmoji,
    buildName,
    createPlan,
    previewPayload,
    register,
    execute,
    cancel,
};
