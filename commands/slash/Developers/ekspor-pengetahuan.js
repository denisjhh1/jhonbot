const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const ai = require('../../../core/ai-core');
const def = require('../../../defines');
const { log } = require('../../../functions');

const MAX_PER_CHANNEL_CHARS = 60000;

const slug = (n) =>
    n
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-') || 'channel';

function cleanText(text, guild) {
    return String(text ?? '')
        .replace(/<@&(\d+)>/g, (_, id) => `@${guild.roles.cache.get(id)?.name ?? 'role'}`)
        .replace(/<#(\d+)>/g, (_, id) => `#${guild.channels.cache.get(id)?.name ?? 'channel'}`)
        .replace(/<@!?\d+>/g, '@pengguna')
        .replace(/<a?:(\w+):\d+>/g, ':$1:')
        .replace(/@(everyone|here)/g, '@​$1')
        .trim();
}

function messageToText(m, guild) {
    const parts = [];
    const c = cleanText(m.content, guild);
    if (c) parts.push(c);
    for (const e of m.embeds ?? []) {
        const lines = [];
        if (e.title) lines.push(`**${cleanText(e.title, guild)}**`);
        if (e.description) lines.push(cleanText(e.description, guild));
        for (const f of e.fields ?? []) lines.push(`${cleanText(f.name, guild)}: ${cleanText(f.value, guild)}`);
        if (lines.length) parts.push(lines.join('\n'));
    }
    return parts.join('\n').trim();
}

async function exportChannel(channel, limit) {
    const guild = channel.guild;
    const all = [];
    let before;
    while (all.length < limit) {
        const batch = await channel.messages.fetch({
            limit: Math.min(100, limit - all.length),
            ...(before ? { before } : {}),
        });
        if (!batch.size) break;
        all.push(...batch.values());
        before = batch.last().id;
        if (batch.size < 100) break;
    }
    all.reverse();

    let emptyWithContent = 0;
    const texts = [];
    for (const m of all) {
        const t = messageToText(m, guild);
        if (t) texts.push(t);
        else if (!m.system && !m.author?.bot) emptyWithContent++;
    }

    let body = texts.join('\n\n');
    let truncated = false;
    if (body.length > MAX_PER_CHANNEL_CHARS) {
        body = body.slice(0, MAX_PER_CHANNEL_CHARS);
        truncated = true;
    }

    const file = path.join(ai.knowledgeDirPath(), `discord-${slug(channel.name)}.md`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `# Channel #${channel.name} (diekspor dari Discord)\n\n${body}\n`, 'utf8');

    return {
        name: channel.name,
        messages: all.length,
        used: texts.length,
        chars: body.length,
        truncated,
        blank: emptyWithContent,
        file: path.basename(file),
    };
}

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('ekspor-pengetahuan')
        .setDescription('Salin isi channel info Discord ke pengetahuan AI (/tanya).')
        .addChannelOption((o) =>
            o
                .setName('channel')
                .setDescription('Channel yang diekspor (kosongkan = pakai ai.knowledgeChannelIds di defines.js)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        )
        .addIntegerOption((o) =>
            o
                .setName('jumlah')
                .setDescription('Maksimal pesan terbaru per channel (default 300, maks 1000)')
                .setMinValue(10)
                .setMaxValue(1000),
        ),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const limit = interaction.options.getInteger('jumlah') ?? 300;
        const picked = interaction.options.getChannel('channel');
        const ids = picked ? [picked.id] : [].concat(def.ai?.knowledgeChannelIds ?? []);
        if (!ids.length) {
            return interaction.editReply(
                '❌ Pilih `channel` di command ini, atau isi `ai.knowledgeChannelIds` di defines.js.',
            );
        }

        const lines = [];
        let blankTotal = 0,
            usedTotal = 0;
        for (const id of ids) {
            try {
                const ch = await client.channels.fetch(id);
                if (!ch?.isTextBased() || !ch.guild) {
                    lines.push(`⚠️ <#${id}>: bukan channel teks server`);
                    continue;
                }
                const r = await exportChannel(ch, limit);
                blankTotal += r.blank;
                usedTotal += r.used;
                lines.push(
                    `✅ <#${id}> → \`${r.file}\` • ${r.used}/${r.messages} pesan • ${r.chars.toLocaleString('id-ID')} karakter${r.truncated ? ' (dipotong)' : ''}`,
                );
            } catch (e) {
                log(`ekspor-pengetahuan ${id}: ${e.message}`, 'warn');
                lines.push(`❌ <#${id}>: ${e.message} (cek izin bot: View Channel + Read Message History)`);
            }
        }

        const total = ai.reloadKnowledge();
        let note = '';
        if (blankTotal > 0 && usedTotal === 0)
            note =
                '\n\n⚠️ Semua pesan teks terbaca **kosong**. Aktifkan **Message Content Intent** di Discord Developer Portal → Bot, lalu jalankan lagi.';
        else if (blankTotal > 0)
            note = `\n\nℹ️ ${blankTotal} pesan teks terbaca kosong (kemungkinan Message Content Intent belum aktif, atau pesannya hanya gambar).`;

        return interaction.editReply({
            content: `${lines.join('\n')}${note}\n\n🧠 Pengetahuan AI dimuat ulang (${total} potongan). Buka file di folder \`knowledge/\` untuk merapikan isinya bila perlu.`,
            allowedMentions: { parse: [] },
        });
    },
};
