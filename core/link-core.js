const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    MessageFlags,
} = require('discord.js');
const def = require('../defines');

const BANNER = 'https://i.imgur.com/4gwPYuC.png';
const GOLD = 0xd4af37;

const links = [
    {
        id: 'server',
        emoji: '🏛️',
        name: 'Discord Server',
        desc: 'Berisi link Discord resmi server Expensive Roleplay',
        url: 'https://discord.gg/MdJRQMstje',
        color: 0xd4af37,
    },
    {
        id: 'pedagang',
        emoji: '🛒',
        name: 'Discord Pedagang',
        desc: 'Berisi link Discord Pedagang',
        url: 'Progres Masih Tahap',
        color: 0x22c55e,
    },
    {
        id: 'Organisasi Papua Expensive Roleplay',
        emoji: '🛡️',
        name: 'Organisasi Organisasi Papua Expensive',
        desc: 'Berisi link Discord Organisasi Papua Expensive',
        url: 'Sedang Tahap Pengembangan',
        color: 0x3b82f6,
    },
    {
        id: 'darkside',
        emoji: '🌑',
        name: 'Darkside',
        desc: 'Berisi link Discord Darkside',
        url: 'https://discord.gg/z6seBpEDC',
        color: 0x7c3aed,
    },
    {
        id: 'police',
        emoji: '👮',
        name: 'Discord Police',
        desc: 'Berisi link Discord Police',
        url: 'https://discord.gg/4Sthmtqdw',
        color: 0x1d4ed8,
    },
    {
        id: 'Apra',
        emoji: '🪖',
        name: 'Discord Apra',
        desc: 'Berisi link Discord Apra',
        url: 'tahap pengembangan',
        color: 0x4d7c0f,
    },
    {
        id: 'medis',
        emoji: '🚑',
        name: 'Discord Medis',
        desc: 'Berisi link Discord Medis',
        url: 'https://discord.gg/vgqPFdggm',
        color: 0xef4444,
    },
    {
        id: 'news',
        emoji: '📰',
        name: 'Discord News',
        desc: 'Berisi link Discord News',
        url: 'Proses Masij Tahap',
        color: 0x0ea5e9,
    },
    {
        id: 'mekanik',
        emoji: '🔧',
        name: 'Discord Mekanik',
        desc: 'Berisi link Discord Mekanik',
        url: 'https://discord.gg/nwguvNXYR',
        color: 0xf97316,
    },
];

const getLink = (id) => links.find((l) => l.id === id);
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));

const selectRow = () =>
    new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('link-select')
            .setPlaceholder('🔗 Pilih Discord yang ingin kamu masuki')
            .addOptions(
                links.map((l) => ({ label: l.name, value: l.id, emoji: l.emoji, description: cut(l.desc, 100) })),
            ),
    );

function panelPayload(guild) {
    const name = guild.name.toUpperCase();
    const icon = guild.iconURL?.({ dynamic: true }) ?? def.icon?.thumbnail;

    const list = links.map((l) => `> ${l.emoji} **${l.name}**\n> └ *${l.desc}*`).join('\n> \n');

    const description = [
        '# 🔗 LINK DISCORD OFFICIAL',
        `## ✦ ${name} ✦`,
        '*Pusat link Discord resmi komunitas kami. Semua link di sini dijamin asli dan dikelola langsung oleh Management.*',
        '',
        '## 🌐 DAFTAR DISCORD',
        list,
        '',
        '## 📜 CARA MENGGUNAKAN',
        '> **`1`** Buka menu pilihan di bagian bawah panel.',
        '> **`2`** Pilih Discord yang ingin kamu masuki.',
        '> **`3`** Tekan tombol **Gabung** untuk langsung masuk.',
        '',
        '-# ⚠️ Waspada link palsu. Hanya percaya link yang muncul dari panel resmi ini.',
    ].join('\n');

    const embed = new EmbedBuilder()
        .setColor(GOLD)
        .setAuthor({ name: `${guild.name} • Official Links`, iconURL: icon })
        .setThumbnail(icon)
        .setDescription(description)
        .setImage(BANNER)
        .setFooter({ text: 'Expensive Roleplay • Official Discord Directory', iconURL: icon })
        .setTimestamp();

    return { embeds: [embed], components: [selectRow()] };
}

function linkPayload(l) {
    const embed = new EmbedBuilder()
        .setColor(l.color ?? GOLD)
        .setDescription(
            [
                `# ${l.emoji} ${l.name.toUpperCase()}`,
                `*${l.desc}*`,
                '',
                '### 🔗 LINK DISCORD',
                `> ${l.url}`,
                '',
                '-# Tekan tombol **Gabung** di bawah, atau salin link di atas.',
            ].join('\n'),
        )
        .setFooter({ text: 'Expensive Roleplay • Official Discord Directory' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel(`Gabung ${l.name}`.slice(0, 80))
            .setStyle(ButtonStyle.Link)
            .setURL(l.url)
            .setEmoji('🚀'),
    );
    return { embeds: [embed], components: [row], flags: MessageFlags.Ephemeral };
}

module.exports = { links, getLink, selectRow, panelPayload, linkPayload, BANNER };
