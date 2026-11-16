const fs = require('fs');
const path = require('path');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    LabelBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    ChannelFlags,
    MessageFlags,
} = require('discord.js');

const def = require('../defines');
const { log } = require('../functions');
const analytics = require('./analytics-core');
const form = require('./rekrut-form');

const DEFAULTS = {
    categoryId: 'YOUR_DISCORD_ID',
    channelId: 'YOUR_DISCORD_ID',
    openByDefault: true,
    staffRoleIds: null,
    pingRoleIds: null,
    allowSelfDecide: false,
    banner: 'https://i.imgur.com/4gwPYuC.png',
    draftMinutes: 30,
};
const cfg = { ...DEFAULTS, ...(def.rekrutmen ?? {}) };

const GOLD = 0xd4af37;
const RED = 0xb91c1c;
const staffRoleIds = () => (cfg.staffRoleIds ?? def.dutyreport?.managerRoleIds ?? []).filter(Boolean);
const pingRoleIds = () => (cfg.pingRoleIds ?? staffRoleIds()).filter(Boolean);
const staffUserIds = () => [...[].concat(def.users?.ownerId ?? []), ...[].concat(def.users?.developers ?? [])];

const STATE_FILE = path.join(__dirname, '..', 'data', 'rekrut-state.json');
let state = {
    open: cfg.openByDefault,
    changedBy: null,
    changedAt: null,
    counter: 0,
    panels: [],
    controlPanels: [],
    apps: {},
};
try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state = {
        open: s.open ?? cfg.openByDefault,
        changedBy: s.changedBy ?? null,
        changedAt: s.changedAt ?? null,
        counter: s.counter ?? 0,
        panels: s.panels ?? [],
        controlPanels: s.controlPanels ?? [],
        apps: s.apps ?? {},
    };
} catch {}
function save() {
    try {
        const tmp = STATE_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
        fs.renameSync(tmp, STATE_FILE);
    } catch (e) {
        log(`Gagal menyimpan rekrut-state.json: ${e.message}`, 'err');
    }
}

const pad = (n) => String(n).padStart(4, '0');
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
const clean = (s) =>
    String(s ?? '')
        .replace(/`/g, "'")
        .trim();
const nowSec = () => Math.floor(Date.now() / 1000);
const getApp = (num) => state.apps[String(num)];
const NO_MENTIONS = { parse: [] };
const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });
const reply = (interaction, content) => interaction.reply(eph(content));

const isStaff = (member) =>
    !!member && (staffUserIds().includes(member.id) || staffRoleIds().some((id) => member.roles?.cache?.has(id)));

const safe = (fn) => async (client, interaction) => {
    try {
        await fn(client, interaction);
    } catch (err) {
        log(err.stack ?? String(err), 'err');
        const msg = eph(
            '## ❌ Terjadi Kesalahan\n> *Sistem rekrutmen sedang mengalami kendala. Coba lagi sebentar atau hubungi Developer.*',
        );
        if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
        else await interaction.reply(msg).catch(() => {});
    }
};

const stepNumbers = () => [...new Set(form.fields.map((f) => f.step))].sort((a, b) => a - b);
const fieldsOfStep = (step) => form.fields.filter((f) => f.step === step);

function stepModal(step) {
    const total = stepNumbers().length;
    const modal = new ModalBuilder()
        .setCustomId(`modal-rekrut:${step}`)
        .setTitle(`Rekrutmen Admin • Bagian ${step}/${total}`);
    modal.addLabelComponents(
        ...fieldsOfStep(step).map((f) => {
            const input = new TextInputBuilder()
                .setCustomId(f.id)
                .setStyle(f.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
                .setMinLength(f.min ?? 1)
                .setMaxLength(f.max ?? 100)
                .setRequired(true);
            if (f.ph) input.setPlaceholder(f.ph);
            const label = new LabelBuilder().setLabel(f.label).setTextInputComponent(input);
            if (f.desc) label.setDescription(f.desc);
            return label;
        }),
    );
    return modal;
}

const drafts = new Map();
setInterval(() => {
    for (const [k, v] of drafts) if (v.expires < Date.now()) drafts.delete(k);
}, 60 * 1000).unref?.();

function panelPayload(guild) {
    const name = guild.name.toUpperCase();
    const icon = guild.iconURL?.({ dynamic: true }) ?? def.icon?.thumbnail;
    const open = state.open;

    const description = [
        '# 🛡️ REKRUTMEN ADMINISTRATOR',
        `## ✦ ${name} ✦`,
        '*Bergabunglah bersama tim terbaik kami. Jadilah bagian dari mereka yang menjaga dan membangun kota ini.*',
        '',
        '## 📡 STATUS REKRUTMEN',
        open ? '# 🟢 DIBUKA' : '# 🔴 DITUTUP',
        state.changedBy ? `-# Diperbarui oleh <@${state.changedBy}> • <t:${state.changedAt}:R>` : '',
        '',
        '## 📋 SYARAT',
        form.requirements.map((r) => `> ✦ ${r}`).join('\n'),
        form.note ? `\n> 📌 ${form.note}` : '',
        '',
        '## 📜 ALUR PENDAFTARAN',
        '> **`1`** Tekan **Isi Formulir** saat rekrutmen dibuka.',
        `> **\`2\`** Lengkapi formulir (${stepNumbers().length} bagian singkat).`,
        '> **`3`** Lamaranmu masuk ke tim Management untuk ditinjau.',
        '> **`4`** Kamu mendapat **DM** begitu ada keputusan.',
        '',
        '-# ⚠️ Isi dengan jujur. Data palsu atau tidak lengkap akan langsung ditolak.',
        '-# Sudah mengirim lamaran? Tekan **Lihat Pendaftaran Saya** untuk cek status, atau **Batal Daftar** untuk membatalkan.',
    ]
        .filter((l) => l !== undefined)
        .join('\n');

    const embed = new EmbedBuilder()
        .setColor(open ? GOLD : RED)
        .setAuthor({ name: `${guild.name} • Recruitment Center`, iconURL: icon })
        .setThumbnail(icon)
        .setDescription(description)
        .setImage(cfg.banner)
        .setFooter({ text: 'Expensive Roleplay • Management Recruitment © 2026', iconURL: icon })
        .setTimestamp();

    const applyRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('rekrut-apply')
            .setLabel(open ? 'Isi Formulir' : 'Rekrutmen Ditutup')
            .setStyle(ButtonStyle.Success)
            .setEmoji(open ? '📝' : '🔒')
            .setDisabled(!open),
        new ButtonBuilder()
            .setCustomId('rekrut-mine')
            .setLabel('Lihat Pendaftaran Saya')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📄'),
        new ButtonBuilder()
            .setCustomId('rekrut-cancel')
            .setLabel('Batal Daftar')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🚫'),
    );

    return { embeds: [embed], components: [applyRow] };
}

function controlPayload() {
    const open = state.open;
    const embed = new EmbedBuilder()
        .setColor(open ? GOLD : RED)
        .setTitle('🛠️ Kontrol Rekrutmen (Owner/Developer)')
        .setDescription(
            [
                `**Status saat ini:** ${open ? '🟢 DIBUKA' : '🔴 DITUTUP'}`,
                state.changedBy ? `-# Terakhir diubah oleh <@${state.changedBy}> • <t:${state.changedAt}:R>` : '',
                '',
                '> Tombol di bawah hanya berfungsi untuk Owner/Developer.',
                '> Perubahan langsung diterapkan ke semua panel rekrutmen yang terpasang.',
            ]
                .filter((l) => l !== undefined)
                .join('\n'),
        );
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('rekrut-open')
            .setLabel('Buka Rekrutmen')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🟢')
            .setDisabled(open),
        new ButtonBuilder()
            .setCustomId('rekrut-close')
            .setLabel('Tutup Rekrutmen')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔴')
            .setDisabled(!open),
    );
    return { embeds: [embed], components: [row] };
}

async function refreshPanels(client, exceptMessageId) {
    const keep = [];
    for (const p of state.panels) {
        if (p.messageId === exceptMessageId) {
            keep.push(p);
            continue;
        }
        try {
            const ch = await client.channels.fetch(p.channelId);
            const msg = await ch.messages.fetch(p.messageId);
            await msg.edit({ ...panelPayload(ch.guild), allowedMentions: NO_MENTIONS });
            keep.push(p);
        } catch (e) {
            log(`Panel rekrutmen ${p.messageId} tidak bisa diperbarui (dihapus?): ${e.message}`, 'warn');
        }
    }
    state.panels = keep;

    const keepCtl = [];
    for (const p of state.controlPanels) {
        if (p.messageId === exceptMessageId) {
            keepCtl.push(p);
            continue;
        }
        try {
            const ch = await client.channels.fetch(p.channelId);
            const msg = await ch.messages.fetch(p.messageId);
            await msg.edit({ ...controlPayload(), allowedMentions: NO_MENTIONS });
            keepCtl.push(p);
        } catch (e) {
            log(`Panel kontrol rekrutmen ${p.messageId} tidak bisa diperbarui (dihapus?): ${e.message}`, 'warn');
        }
    }
    state.controlPanels = keepCtl;
    save();
}

function registerControlPanel(message) {
    if (!state.controlPanels.some((p) => p.messageId === message.id)) {
        state.controlPanels.push({ channelId: message.channelId ?? message.channel?.id, messageId: message.id });
        save();
    }
}

function registerPanel(message) {
    if (!state.panels.some((p) => p.messageId === message.id)) {
        state.panels.push({ channelId: message.channelId ?? message.channel?.id, messageId: message.id });
        save();
    }
}

async function setOpen(client, interaction, open) {
    if (!isStaff(interaction.member))
        return reply(
            interaction,
            '🔒 **Khusus Staff.** Hanya Owner/Developer yang bisa membuka atau menutup rekrutmen.',
        );
    if (state.open === open) return reply(interaction, `ℹ️ Rekrutmen sudah **${open ? 'dibuka' : 'ditutup'}**.`);

    state.open = open;
    state.changedBy = interaction.user.id;
    state.changedAt = nowSec();
    save();
    const fromControl = state.controlPanels.some((p) => p.messageId === interaction.message?.id);
    if (fromControl) {
        await interaction.update({ ...controlPayload(), allowedMentions: NO_MENTIONS });
        await refreshPanels(client, interaction.message.id);
    } else {
        registerPanel(interaction.message);
        await interaction.update({ ...panelPayload(interaction.guild), allowedMentions: NO_MENTIONS });
        await refreshPanels(client, interaction.message.id);
    }
    log(`Rekrutmen ${open ? 'DIBUKA' : 'DITUTUP'} oleh ${interaction.user.tag}`, 'info');
}

function existingBlock(userId) {
    const mine = Object.values(state.apps).filter((a) => a.userId === userId);
    const pending = mine.find((a) => a.status === 'pending');
    if (pending)
        return `⚠️ Lamaran **#${pad(pending.num)}** milikmu masih menunggu keputusan. Tunggu hasilnya dulu ya.`;
    const approved = mine.find((a) => a.status === 'approved');
    if (approved)
        return `✅ Lamaran **#${pad(approved.num)}** milikmu sudah **disetujui**. Tunggu arahan interview dari staff.`;
    return null;
}

async function startApply(client, interaction) {
    if (!state.open)
        return reply(
            interaction,
            '## 🔒 Rekrutmen Ditutup\n> Mohon maaf, rekrutmen admin sedang **ditutup**. Pantau terus informasi dari Management.',
        );
    const block = existingBlock(interaction.user.id);
    if (block) return reply(interaction, block);
    drafts.set(interaction.user.id, {
        answers: {},
        done: new Set(),
        expires: Date.now() + cfg.draftMinutes * 60 * 1000,
    });
    return interaction.showModal(stepModal(1));
}

async function openStep(client, interaction, step) {
    const d = drafts.get(interaction.user.id);
    if (!state.open)
        return reply(interaction, '## 🔒 Rekrutmen Ditutup\n> Rekrutmen baru saja ditutup oleh Management.');
    if (!d || (step > 1 && !d.done.has(step - 1)))
        return reply(interaction, '⌛ Sesi formulir habis. Silakan tekan **Isi Formulir** di panel untuk mengulang.');
    return interaction.showModal(stepModal(step));
}

async function submitStep(client, interaction, step) {
    const d = drafts.get(interaction.user.id);
    if (!d || (step > 1 && !d.done.has(step - 1)))
        return reply(interaction, '⌛ Sesi formulir habis. Silakan tekan **Isi Formulir** di panel untuk mengulang.');

    for (const f of fieldsOfStep(step)) {
        const v = clean(interaction.fields.getTextInputValue(f.id));
        if (!v) return reply(interaction, `❌ Isian **${f.label}** tidak boleh kosong. Silakan ulangi bagian ini.`);
        d.answers[f.id] = v;
    }
    d.done.add(step);
    d.expires = Date.now() + cfg.draftMinutes * 60 * 1000;

    const steps = stepNumbers();
    if (step < steps[steps.length - 1]) {
        const next = steps[steps.indexOf(step) + 1];
        const embed = new EmbedBuilder()
            .setColor(GOLD)
            .setDescription(
                [
                    `## ✅ Bagian ${step}/${steps.length} Tersimpan`,
                    `> Lanjutkan ke **bagian ${next}** untuk menyelesaikan lamaranmu.`,
                    '',
                    `-# Sesi berlaku ${cfg.draftMinutes} menit.`,
                ].join('\n'),
            );
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`rekrut-next:${next}`)
                .setLabel(`Lanjut ke Bagian ${next}`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('➡️'),
        );
        return interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
    }

    if (!steps.every((s) => d.done.has(s)))
        return reply(interaction, '⌛ Formulir belum lengkap. Silakan mulai ulang dari panel.');
    return submitApplication(client, interaction, d.answers);
}

const APP_STATUS = {
    pending: { label: '⏳ Menunggu keputusan', color: 0xf59e0b },
    approved: { label: '✅ Disetujui', color: 0x22c55e },
    rejected: { label: '❌ Ditolak', color: 0xef4444 },
    cancelled: { label: '🚫 Dibatalkan pelamar', color: 0x6b7280 },
};

function appEmbed(a) {
    const st = APP_STATUS[a.status] ?? APP_STATUS.pending;
    const ans = a.answers;
    const e = new EmbedBuilder()
        .setColor(st.color)
        .setAuthor({ name: a.username, iconURL: a.avatar || undefined })
        .setTitle(`🛡️ LAMARAN ADMIN #${pad(a.num)}`)
        .setDescription(
            [
                `## 🙋 ${cut(ans.nama ?? a.username, 60)}`,
                `> 👤 **Discord:** <@${a.userId}>`,
                `> 📌 **Status:** ${st.label}`,
            ].join('\n'),
        );

    for (const sec of form.sections) {
        const shorts = form.fields.filter((f) => f.section === sec.name && f.style !== 'paragraph');
        if (shorts.length) {
            e.addFields({
                name: `${sec.emoji} ${sec.name}`,
                value: cut(shorts.map((f) => `**${f.label}:** ${cut(ans[f.id] ?? '-', 150)}`).join('\n'), 1024),
            });
        }
        for (const f of form.fields.filter((x) => x.section === sec.name && x.style === 'paragraph')) {
            e.addFields({ name: cut(`❓ ${f.label}`, 256), value: cut(`>>> ${ans[f.id] ?? '-'}`, 1024) });
        }
    }

    if (a.status === 'approved') {
        e.addFields({
            name: '✅ Disetujui oleh',
            value: `<@${a.decidedBy}> • <t:${a.decidedAt}:R>${a.note ? `\n>>> ${cut(a.note, 800)}` : ''}`,
        });
    } else if (a.status === 'rejected') {
        e.addFields({
            name: '❌ Ditolak oleh',
            value: `<@${a.decidedBy}> • <t:${a.decidedAt}:R>\n>>> ${cut(a.note || '-', 800)}`,
        });
    } else if (a.status === 'cancelled') {
        e.addFields({ name: '🚫 Dibatalkan oleh pelamar', value: `<@${a.userId}> • <t:${a.decidedAt}:R>` });
    }
    return e.setFooter({ text: `Lamaran #${pad(a.num)} • Management Review` }).setTimestamp(a.createdAt * 1000);
}

function appComponents(a) {
    if (a.status !== 'pending') return [];
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`rekrut-approve:${a.num}`)
                .setLabel('Disetujui')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId(`rekrut-reject:${a.num}`)
                .setLabel('Ditolak')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌'),
        ),
    ];
}

const renderApp = (a) => ({ embeds: [appEmbed(a)], components: appComponents(a) });

async function submitApplication(client, interaction, answers) {
    if (!state.open)
        return reply(interaction, '## 🔒 Rekrutmen Ditutup\n> Rekrutmen baru saja ditutup oleh Management.');
    const block = existingBlock(interaction.user.id);
    if (block) return reply(interaction, block);

    const channel = await client.channels.fetch(cfg.channelId).catch(() => null);
    if (!channel) {
        log(`Channel rekrutmen (${cfg.channelId}) tidak ditemukan.`, 'err');
        return reply(interaction, '❌ Channel rekrutmen tidak ditemukan. Silakan hubungi Staff.');
    }

    const isForum = channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildMedia;
    if (!isForum && !channel.isTextBased?.()) {
        log(`Channel rekrutmen (${cfg.channelId}) bukan forum atau channel teks.`, 'err');
        return reply(interaction, '❌ Channel rekrutmen tidak valid. Silakan hubungi Staff.');
    }

    const num = state.counter + 1;
    const a = {
        num,
        userId: interaction.user.id,
        username: interaction.user.username,
        avatar: interaction.user.displayAvatarURL?.() ?? null,
        answers,
        status: 'pending',
        createdAt: nowSec(),
        guildId: interaction.guildId,
        channelId: null,
        messageId: null,
        decidedBy: null,
        decidedAt: null,
        note: null,
    };

    const roles = pingRoleIds();
    const content = `${roles.map((id) => `<@&${id}>`).join(' ')} 📥 **Lamaran Admin Baru!**`.trim();
    const allowedMentions = { roles, users: [] };

    if (isForum) {
        const opts = {
            name: cut(`LAMARAN #${pad(num)} | ${answers.nama_ic ?? interaction.user.username}`, 100),
            message: { content, ...renderApp(a), allowedMentions },
            reason: `Lamaran admin dari ${interaction.user.tag}`,
        };
        if (channel.flags?.has?.(ChannelFlags.RequireTag) && channel.availableTags?.length)
            opts.appliedTags = [channel.availableTags[0].id];
        const thread = await channel.threads.create(opts);
        const starter = await thread.fetchStarterMessage?.().catch(() => null);
        a.channelId = thread.id;
        a.messageId = starter?.id ?? thread.id;
    } else {
        const msg = await channel.send({ content, ...renderApp(a), allowedMentions });
        a.channelId = channel.id;
        a.messageId = msg.id;
    }

    state.counter = num;
    state.apps[String(num)] = a;
    save();
    analytics.track('rekrut');
    drafts.delete(interaction.user.id);

    const embed = new EmbedBuilder()
        .setColor(GOLD)
        .setDescription(
            [
                `# ✅ Lamaran #${pad(num)} Terkirim`,
                '> Terima kasih sudah melamar. Lamaranmu sudah diterima tim Management.',
                '> Hasilnya akan kami kabari lewat **DM**. Pastikan DM kamu terbuka.',
            ].join('\n'),
        );
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

const myLatestApp = (userId) =>
    Object.values(state.apps)
        .filter((a) => a.userId === userId)
        .sort((x, y) => y.num - x.num)[0] ?? null;
const myPendingApp = (userId) =>
    Object.values(state.apps).find((a) => a.userId === userId && a.status === 'pending') ?? null;

async function showMine(client, interaction) {
    const a = myLatestApp(interaction.user.id);
    if (!a) return reply(interaction, '📭 Kamu belum pernah mengirim lamaran. Tekan **Isi Formulir** untuk mendaftar.');
    const payload = {
        content: `## 📄 Pendaftaran Saya\n> Status lamaran **#${pad(a.num)}**: ${APP_STATUS[a.status]?.label ?? a.status}`,
        embeds: [appEmbed(a)],
        flags: MessageFlags.Ephemeral,
    };
    if (a.status === 'pending') {
        payload.components = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('rekrut-cancel')
                    .setLabel('Batalkan Pendaftaran Ini')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🚫'),
            ),
        ];
    } else if (a.status === 'cancelled' || a.status === 'rejected') {
        payload.content += state.open ? '\n> Kamu bisa mendaftar lagi lewat tombol **Isi Formulir**.' : '';
    }
    return interaction.reply(payload);
}

async function askCancel(client, interaction) {
    const a = myPendingApp(interaction.user.id);
    if (!a) {
        const last = myLatestApp(interaction.user.id);
        if (last?.status === 'approved')
            return reply(
                interaction,
                `✅ Lamaran **#${pad(last.num)}** sudah **disetujui**, jadi tidak bisa dibatalkan lewat tombol ini. Hubungi staff bila perlu.`,
            );
        drafts.delete(interaction.user.id);
        return reply(interaction, 'ℹ️ Kamu tidak punya lamaran yang sedang menunggu keputusan.');
    }
    const embed = new EmbedBuilder()
        .setColor(RED)
        .setDescription(
            [
                `## 🚫 Batalkan Lamaran #${pad(a.num)}?`,
                '> Lamaranmu akan ditandai **dibatalkan** dan tidak diproses staff.',
                '> Setelah itu kamu bisa mengisi formulir lagi dari awal.',
                '',
                '-# Abaikan pesan ini bila tidak jadi membatalkan.',
            ].join('\n'),
        );
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`rekrut-cancel-confirm:${a.num}`)
            .setLabel('Ya, Batalkan')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('✅'),
    );
    return interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
}

async function confirmCancel(client, interaction, num) {
    const a = getApp(num);
    if (!a || a.userId !== interaction.user.id)
        return reply(interaction, '❌ Lamaran ini bukan milikmu atau tidak ditemukan.');
    if (a.status !== 'pending')
        return reply(
            interaction,
            `ℹ️ Lamaran ini sudah tidak menunggu keputusan (${APP_STATUS[a.status]?.label ?? a.status}).`,
        );

    a.status = 'cancelled';
    a.decidedBy = interaction.user.id;
    a.decidedAt = nowSec();
    save();
    drafts.delete(interaction.user.id);

    const embed = new EmbedBuilder()
        .setColor(GOLD)
        .setDescription(
            [
                `## ✅ Lamaran #${pad(a.num)} Dibatalkan`,
                state.open
                    ? '> Kamu bisa mendaftar lagi kapan saja lewat tombol **Isi Formulir**.'
                    : '> Rekrutmen sedang ditutup, tunggu sampai dibuka kembali untuk mendaftar lagi.',
            ].join('\n'),
        );
    await interaction.update({ embeds: [embed], components: [] });
    await refreshApp(client, a);
    log(`Lamaran rekrutmen #${pad(a.num)} dibatalkan oleh ${interaction.user.tag}`, 'info');
}

async function refreshApp(client, a) {
    try {
        const ch = await client.channels.fetch(a.channelId);
        if (ch.isThread?.() && ch.archived) await ch.setArchived(false).catch(() => {});
        const msg = await ch.messages.fetch(a.messageId);
        await msg.edit({ ...renderApp(a), allowedMentions: NO_MENTIONS });
        return true;
    } catch (e) {
        log(`Gagal memperbarui kartu lamaran #${pad(a.num)}: ${e.message}`, 'warn');
        return false;
    }
}

async function dmApplicant(client, a, title, lines, color) {
    try {
        const user = await client.users.fetch(a.userId);
        await user.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle(title)
                    .setColor(color)
                    .setDescription(lines.join('\n'))
                    .setFooter({ text: `Lamaran #${pad(a.num)}` }),
            ],
        });
    } catch {}
}

function checkDecider(interaction, a) {
    if (!a) return '❌ Data lamaran ini tidak ditemukan.';
    if (!isStaff(interaction.member)) return '🔒 **Khusus Staff.** Hanya Owner/Developer yang bisa memutuskan lamaran.';
    if (a.status !== 'pending') return `ℹ️ Lamaran ini sudah diputuskan (${APP_STATUS[a.status]?.label ?? a.status}).`;
    if (a.userId === interaction.user.id && !cfg.allowSelfDecide)
        return '🚫 Kamu tidak bisa memutuskan lamaranmu sendiri. Minta staff lain.';
    return null;
}

function decisionModal(kind, num) {
    const approve = kind === 'approve';
    return new ModalBuilder()
        .setCustomId(`modal-rekrut-${kind}:${num}`)
        .setTitle(`${approve ? 'Setujui' : 'Tolak'} Lamaran #${pad(num)}`)
        .addLabelComponents(
            new LabelBuilder()
                .setLabel(approve ? 'Catatan / jadwal interview' : 'Alasan penolakan')
                .setDescription(
                    approve
                        ? 'Opsional. Contoh: Interview besok 18.30 WIB dengan Administrator.'
                        : 'Wajib diisi. Akan dikirim ke pelamar lewat DM.',
                )
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId('rekrut-note')
                        .setStyle(TextInputStyle.Paragraph)
                        .setMaxLength(500)
                        .setMinLength(approve ? 0 : 3)
                        .setRequired(!approve),
                ),
        );
}

async function startDecision(client, interaction, num, kind) {
    const err = checkDecider(interaction, getApp(num));
    if (err) return reply(interaction, err);
    return interaction.showModal(decisionModal(kind, num));
}

async function finishDecision(client, interaction, num, kind, note) {
    const a = getApp(num);
    const err = checkDecider(interaction, a);
    if (err) return reply(interaction, err);

    const approve = kind === 'approve';
    a.status = approve ? 'approved' : 'rejected';
    a.decidedBy = interaction.user.id;
    a.decidedAt = nowSec();
    a.note = clean(note) || null;
    save();

    await refreshApp(client, a);
    await reply(
        interaction,
        approve ? `✅ Lamaran **#${pad(num)}** disetujui.` : `❌ Lamaran **#${pad(num)}** ditolak.`,
    );
    log(`Lamaran #${pad(num)} ${approve ? 'disetujui' : 'ditolak'} oleh ${interaction.user.tag}`, 'info');

    if (approve) {
        await dmApplicant(
            client,
            a,
            '✅ Lamaran Admin Disetujui',
            [
                `Selamat! Lamaran admin kamu **#${pad(num)}** telah **disetujui** oleh <@${a.decidedBy}>.`,
                a.note ? `\n📌 **Catatan:**\n>>> ${cut(a.note, 500)}` : '\nTunggu arahan interview dari staff ya.',
            ],
            APP_STATUS.approved.color,
        );
    } else {
        await dmApplicant(
            client,
            a,
            '❌ Lamaran Admin Ditolak',
            [
                `Mohon maaf, lamaran admin kamu **#${pad(num)}** **ditolak** oleh <@${a.decidedBy}>.`,
                `\n💬 **Alasan:**\n>>> ${cut(a.note || '-', 500)}`,
                '\nJangan berkecil hati. Kamu bisa melamar lagi saat rekrutmen dibuka kembali.',
            ],
            APP_STATUS.rejected.color,
        );
    }
}

module.exports = {
    cfg,
    state,
    save,
    getApp,
    pad,
    cut,
    clean,
    safe,
    reply,
    isStaff,
    stepNumbers,
    stepModal,
    panelPayload,
    controlPayload,
    registerPanel,
    registerControlPanel,
    setOpen,
    refreshPanels,
    startApply,
    openStep,
    submitStep,
    submitApplication,
    showMine,
    askCancel,
    confirmCancel,
    appEmbed,
    appComponents,
    renderApp,
    startDecision,
    finishDecision,
    decisionModal,
    form,
};
