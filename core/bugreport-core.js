const {
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
} = require('discord.js');
const def = require('../defines');
const { log } = require('../functions');
const analytics = require('./analytics-core');

const cfg = def.bugreport ?? {};

const drafts = new Map();
const DRAFT_TTL = 10 * 60 * 1000;
const MAX_OPEN_PER_USER = 2;
const TOPIC_PREFIX = 'bugreport:';

setInterval(() => {
    for (const [k, v] of drafts) if (v.expires < Date.now()) drafts.delete(k);
}, 60 * 1000).unref();

let queue = Promise.resolve();
const enqueue = (fn) => (queue = queue.then(fn, fn));

let cachedCategoryId = cfg.categoryId || null;

const staffRoleIds = () => [...new Set([cfg.adminRoleId, cfg.developerRoleId].filter(Boolean))];
const isStaff = (member) =>
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    staffRoleIds().some((id) => member.roles.cache.has(id));

async function getCategory(guild) {
    const me = guild.members.me ?? (await guild.members.fetchMe());
    if (cachedCategoryId) {
        const c =
            guild.channels.cache.get(cachedCategoryId) ??
            (await guild.channels.fetch(cachedCategoryId).catch(() => null));
        if (c && c.type === ChannelType.GuildCategory) return c;
    }
    const overwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
            id: me.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageRoles,
            ],
        },
        ...staffRoleIds().map((id) => ({ id, allow: [PermissionFlagsBits.ViewChannel] })),
    ];
    const cat = await guild.channels.create({
        name: 'BUG REPORTS',
        type: ChannelType.GuildCategory,
        permissionOverwrites: overwrites,
    });
    cachedCategoryId = cat.id;
    log(
        `Kategori BUG REPORTS dibuat otomatis (${cat.id}). Isi def.bugreport.categoryId agar tidak dibuat ulang saat bot restart.`,
        'warn',
    );
    return cat;
}

function reportChannels(guild, category) {
    return guild.channels.cache.filter((c) => c.parentId === category.id && c.type === ChannelType.GuildText);
}

const countOpenByUser = (guild, category, userId) =>
    reportChannels(guild, category).filter((c) => c.topic?.startsWith(`${TOPIC_PREFIX}${userId}`)).size;

function nextNumber(guild, category) {
    let max = 0;
    for (const c of reportChannels(guild, category).values()) {
        const m = c.name.match(/(\d{4})/);
        if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return max + 1;
}

const slug = (s) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 20) || 'player';
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function staffButtons(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('bug-process')
            .setLabel('Tandai Diproses')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🛠️')
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('bug-resolve')
            .setLabel('Tandai Selesai')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('bug-close')
            .setLabel('Tutup Channel')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒'),
    );
}

async function createReport(interaction, draft) {
    return enqueue(async () => {
        const guild = interaction.guild;
        const user = interaction.user;
        const category = await getCategory(guild);
        const me = guild.members.me ?? (await guild.members.fetchMe());

        if (countOpenByUser(guild, category, user.id) >= MAX_OPEN_PER_USER)
            throw new Error(
                `Kamu masih punya ${MAX_OPEN_PER_USER} laporan yang belum ditutup. Tunggu tim kami menyelesaikannya dulu ya.`,
            );

        const num = String(nextNumber(guild, category)).padStart(4, '0');

        const overwrites = [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
                id: user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks,
                ],
            },
            {
                id: me.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.ManageMessages,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.ReadMessageHistory,
                ],
            },
            ...staffRoleIds().map((id) => ({
                id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ManageMessages,
                ],
            })),
        ];

        const channel = await guild.channels.create({
            name: `bug-${num}-${slug(user.username)}`,
            type: ChannelType.GuildText,
            parent: category.id,
            topic: `${TOPIC_PREFIX}${user.id} | #${num} | ${cut(draft.title, 80)}`,
            permissionOverwrites: overwrites,
            reason: `Bug report #${num} oleh ${user.tag}`,
        });
        analytics.track('bug');

        const files = [];
        const failedLinks = [];
        for (const [i, f] of draft.files.entries()) {
            try {
                const res = await fetch(f.url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const buf = Buffer.from(await res.arrayBuffer());
                const ext = (f.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? 'png').toLowerCase();
                files.push(new AttachmentBuilder(buf, { name: `bug-${num}-${i + 1}.${ext}` }));
            } catch (e) {
                log(`Gagal mengunduh lampiran ${f.name}: ${e.message}`, 'warn');
                failedLinks.push(f.url);
            }
        }

        const firstImage = files.find((a) => /\.(png|jpe?g|gif|webp)$/i.test(a.name));

        const embed = new EmbedBuilder()
            .setTitle(`🐞 Bug Report #${num}`)
            .setDescription(`**${cut(draft.title, 200)}**\n\n${cut(draft.desc, 3500)}`)
            .addFields(
                { name: '👤 Pelapor', value: `<@${user.id}> (\`${user.username}\`)`, inline: true },
                { name: '📌 Status', value: '🟡 Menunggu', inline: true },
                { name: '🕒 Dilaporkan', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
            )
            .setColor('Yellow')
            .setFooter({ text: guild.name })
            .setTimestamp();
        if (draft.steps) embed.addFields({ name: '🔁 Langkah Menemukan BUG', value: cut(draft.steps, 1024) });
        if (failedLinks.length)
            embed.addFields({ name: '📎 Lampiran (gagal diunggah ulang)', value: cut(failedLinks.join('\n'), 1024) });
        if (firstImage) embed.setImage(`attachment://${firstImage.name}`);

        const pings = [...staffRoleIds().map((id) => `<@&${id}>`), `<@${user.id}>`].join(' ');
        await channel.send({
            content: `${pings}\nLaporan bug baru telah dibuat. Tim akan segera memeriksanya. Kamu bisa menambah info/gambar tambahan langsung di channel ini.`,
            embeds: [embed],
            files,
            components: [staffButtons()],
            allowedMentions: { roles: staffRoleIds(), users: [user.id] },
        });

        return { channel, num };
    });
}

module.exports = { drafts, DRAFT_TTL, cfg, isStaff, createReport, staffButtons, TOPIC_PREFIX, cut };
