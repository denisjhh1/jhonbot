const fs = require('fs');
const path = require('path');
const {
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    AttachmentBuilder,
} = require('discord.js');
const def = require('../defines');
const { log } = require('../functions');

const cfg = def.suggestion ?? {};

const TOPIC_PREFIX = 'saran:';
const DRAFT_TTL = 10 * 60 * 1000;
const POST_COOLDOWN = 60 * 1000;
const MAX_COMMENTS = 100;

const CATS = {
    fitur: {
        label: 'Saran Fitur',
        emoji: '💡',
        color: 'Gold',
        channelName: 'saran-fitur',
        titlePh: 'Contoh: Tambah fitur sewa kendaraan antar warga',
        bodyPh: 'Jelaskan fitur yang kamu usulkan dan cara kerjanya.',
        extraLabel: 'Manfaat untuk server (opsional)',
    },
    mapingan: {
        label: 'Saran Mapingan',
        emoji: '🗺️',
        color: 'Green',
        channelName: 'saran-mapingan',
        titlePh: 'Contoh: Tambah area parkir di depan balai kota',
        bodyPh: 'Jelaskan mapingan / lokasi yang diusulkan.',
        extraLabel: 'Lokasi / koordinat (opsional)',
    },
    textdraw: {
        label: 'Saran Textdraw',
        emoji: '🎨',
        color: 'Purple',
        channelName: 'saran-textdraw',
        titlePh: 'Contoh: Ubah tampilan HUD speedometer',
        bodyPh: 'Jelaskan textdraw / tampilan yang diusulkan.',
        extraLabel: 'Referensi / contoh tampilan (opsional)',
    },
    fiturdc: {
        label: 'Saran Fitur DC',
        emoji: '🤖',
        color: 'Blurple',
        channelName: 'saran-fitur-dc',
        titlePh: 'Contoh: Tambah bot musik di voice channel',
        bodyPh: 'Jelaskan fitur Discord (bot / channel / role) yang diusulkan.',
        extraLabel: 'Manfaat untuk member (opsional)',
    },
};

const STATUS = {
    waiting: { label: '⏳ Menunggu', color: 'Yellow' },
    considered: { label: '👀 Dipertimbangkan', color: 'Blue' },
    accepted: { label: '✅ Diterima', color: 'Green' },
    working: { label: '🚧 Sedang dikerjakan', color: 'Orange' },
    done: { label: '🎉 Selesai', color: 'DarkGreen' },
    rejected: { label: '❌ Ditolak', color: 'Red' },
};

const STATE_FILE = path.join(__dirname, '..', 'data', 'suggestion-state.json');
let state = { counters: {}, posts: {} };
try {
    const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state = { counters: saved.counters ?? {}, posts: saved.posts ?? {} };
} catch {}

function save() {
    try {
        const tmp = STATE_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(state));
        fs.renameSync(tmp, STATE_FILE);
    } catch (e) {
        log(`Gagal menyimpan suggestion-state.json: ${e.message}`, 'err');
    }
}

const getPost = (messageId) => state.posts[messageId];
const nextNumber = (key) => (state.counters[key] = (state.counters[key] ?? 0) + 1);

const drafts = new Map();
const lastPost = new Map();

setInterval(() => {
    for (const [k, v] of drafts) if (v.expires < Date.now()) drafts.delete(k);
}, 60 * 1000).unref();

const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const isImageName = (n) => /\.(png|jpe?g|gif|webp)$/i.test(n ?? '');

const staffRoleIds = () => [
    ...new Set(
        (cfg.staffRoleIds?.length
            ? cfg.staffRoleIds
            : [def.bugreport?.adminRoleId, def.bugreport?.developerRoleId]
        ).filter(Boolean),
    ),
];
const isStaff = (member) =>
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    staffRoleIds().some((id) => member.roles.cache.has(id));
const canManage = (member, post) => isStaff(member) || member.id === post.authorId;

const pendingChannels = new Map();

function getChannel(guild, key) {
    if (pendingChannels.has(key)) return pendingChannels.get(key);
    const p = resolveChannel(guild, key).finally(() => pendingChannels.delete(key));
    pendingChannels.set(key, p);
    return p;
}

async function resolveChannel(guild, key) {
    const cat = CATS[key];
    const fixedId = cfg.channels?.[key];
    if (fixedId) {
        const c = guild.channels.cache.get(fixedId) ?? (await guild.channels.fetch(fixedId).catch(() => null));
        if (c?.isTextBased()) return c;
    }

    const parentId = cfg.categoryId || null;

    const topicRe = new RegExp(`^${TOPIC_PREFIX}${key}(\\s|\\||$)`);
    const found = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildText && c.parentId === parentId && topicRe.test(c.topic ?? ''),
    );
    if (found) return found;

    if (parentId) {
        const parent = guild.channels.cache.get(parentId) ?? (await guild.channels.fetch(parentId).catch(() => null));
        if (!parent || parent.type !== ChannelType.GuildCategory)
            throw new Error(`Kategori saran (${parentId}) tidak ditemukan. Periksa def.suggestion.categoryId.`);
    }

    const me = guild.members.me ?? (await guild.members.fetchMe());
    const channel = await guild.channels.create({
        name: cat.channelName,
        type: ChannelType.GuildText,
        parent: parentId,
        topic: `${TOPIC_PREFIX}${key} | ${cat.label} — klik tombol di panel untuk mengirim saran, klik 💬 pada saran untuk berkomentar.`,
        permissionOverwrites: [
            {
                id: guild.roles.everyone.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                deny: [
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.CreatePublicThreads,
                    PermissionFlagsBits.CreatePrivateThreads,
                    PermissionFlagsBits.AddReactions,
                ],
            },
            {
                id: me.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ManageMessages,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ReadMessageHistory,
                ],
            },
            ...staffRoleIds().map((id) => ({
                id,
                allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages],
            })),
        ],
        reason: `Channel ${cat.label} dibuat otomatis`,
    });
    log(
        `Channel ${cat.channelName} dibuat otomatis (${channel.id}). Isi def.suggestion.channels.${key} agar tidak dicari ulang.`,
        'warn',
    );
    return channel;
}

function buildEmbed(post, guildName) {
    const cat = CATS[post.category];
    const st = STATUS[post.status] ?? STATUS.waiting;

    const embed = new EmbedBuilder()
        .setTitle(`${cat.emoji} ${cut(post.title, 200)}`)
        .setDescription(cut(post.body, 3500))
        .setColor(st.color)
        .addFields(
            { name: '👤 Pengusul', value: `<@${post.authorId}>`, inline: true },
            { name: '📌 Status', value: st.label + (post.statusBy ? `\noleh <@${post.statusBy}>` : ''), inline: true },
            { name: '🕒 Diajukan', value: `<t:${post.createdAt}:R>`, inline: true },
        )
        .setFooter({
            text: `#${String(post.num).padStart(4, '0')} • ${cat.label}${post.edited ? ' • diedit' : ''}${guildName ? ` • ${guildName}` : ''}`,
        });

    if (post.extra)
        embed.addFields({ name: `📝 ${cat.extraLabel.replace(/\s*\(opsional\)/i, '')}`, value: cut(post.extra, 1024) });
    if (post.failedLinks?.length)
        embed.addFields({ name: '📎 Lampiran (gagal diunggah ulang)', value: cut(post.failedLinks.join('\n'), 1024) });

    if (post.comments.length) {
        const lines = post.comments.slice(-3).map((c) => `**<@${c.userId}>** • <t:${c.ts}:R>\n${cut(c.text, 220)}`);
        const hidden = post.comments.length - lines.length;
        embed.addFields({
            name: `💬 Komentar (${post.comments.length})`,
            value: cut(
                (hidden > 0 ? `_…${hidden} komentar sebelumnya, klik **Lihat Komentar**_\n` : '') + lines.join('\n\n'),
                1024,
            ),
        });
    }
    if (post.image) embed.setImage(`attachment://${post.image}`);
    return embed;
}

function postComponents(post) {
    const up = post.votes.up.length,
        down = post.votes.down.length;
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('saran-comment')
                .setLabel('Komentar')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('💬'),
            new ButtonBuilder()
                .setCustomId('saran-vote:up')
                .setLabel(String(up))
                .setStyle(ButtonStyle.Success)
                .setEmoji('👍'),
            new ButtonBuilder()
                .setCustomId('saran-vote:down')
                .setLabel(String(down))
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👎'),
            new ButtonBuilder()
                .setCustomId('saran-comments-all')
                .setLabel(`Lihat Komentar (${post.comments.length})`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📖'),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('saran-edit')
                .setLabel('Edit')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('✏️'),
            new ButtonBuilder()
                .setCustomId('saran-delete')
                .setLabel('Hapus')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️'),
        ),
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('saran-status')
                .setPlaceholder('Ubah status (khusus Admin/Developer)')
                .addOptions(
                    Object.entries(STATUS).map(([value, s]) => ({
                        label: s.label.replace(/^\S+\s/, ''),
                        value,
                        emoji: s.label.split(' ')[0],
                        default: value === post.status,
                    })),
                ),
        ),
    ];
}

const render = (post, guildName) => ({ embeds: [buildEmbed(post, guildName)], components: postComponents(post) });

async function createPost(interaction, draft) {
    const guild = interaction.guild;
    const user = interaction.user;
    const cat = CATS[draft.key];
    const channel = await getChannel(guild, draft.key);

    const num = nextNumber(draft.key);

    const files = [];
    const failedLinks = [];
    for (const [i, f] of draft.files.entries()) {
        try {
            const res = await fetch(f.url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buf = Buffer.from(await res.arrayBuffer());
            const ext = (f.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? 'png').toLowerCase();
            files.push(new AttachmentBuilder(buf, { name: `saran-${draft.key}-${num}-${i + 1}.${ext}` }));
        } catch (e) {
            log(`Gagal mengunduh lampiran ${f.name}: ${e.message}`, 'warn');
            failedLinks.push(f.url);
        }
    }

    const post = {
        category: draft.key,
        num,
        authorId: user.id,
        title: draft.title,
        body: draft.body,
        extra: draft.extra || '',
        image: files.find((a) => isImageName(a.name))?.name ?? null,
        failedLinks,
        status: 'waiting',
        statusBy: null,
        createdAt: Math.floor(Date.now() / 1000),
        edited: false,
        votes: { up: [], down: [] },
        comments: [],
    };

    const msg = await channel.send({
        ...render(post, guild.name),
        files,
        allowedMentions: { parse: [] },
    });

    post.channelId = channel.id;
    state.posts[msg.id] = post;
    save();
    lastPost.set(user.id, Date.now());

    return { msg, channel, num, cat };
}

module.exports = {
    cfg,
    CATS,
    STATUS,
    TOPIC_PREFIX,
    DRAFT_TTL,
    POST_COOLDOWN,
    MAX_COMMENTS,
    drafts,
    lastPost,
    cut,
    isImageName,
    isStaff,
    canManage,
    getPost,
    save,
    state,
    buildEmbed,
    postComponents,
    render,
    createPost,
    getChannel,
};
