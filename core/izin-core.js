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
    StringSelectMenuBuilder,
    MessageFlags,
} = require('discord.js');

const def = require('../defines');
const { log } = require('../functions');

const DEFAULTS = {
    open: true,
    logChannelId: 'YOUR_DISCORD_ID',
    reminderChannelId: 'YOUR_DISCORD_ID',
    minDays: 1,
    maxDays: 7,
    allowNight: true,
    nightEndHour: 6,
    utcOffsetHours: def.dutyreport?.utcOffsetHours ?? 7,
    allowSelfApprove: false,
    checkIntervalMs: 30 * 1000,
    requesterRoleIds: null,
    approverRoleIds: null,
    pingRoleIds: null,
};

const cfg = { ...DEFAULTS, ...(def.izin ?? {}) };

const requesterRoleIds = () =>
    (
        cfg.requesterRoleIds ??
        (def.dutyreport?.roleIds?.length
            ? def.dutyreport.roleIds
            : [def.bugreport?.adminRoleId, def.bugreport?.developerRoleId])
    ).filter(Boolean);

const approverRoleIds = () =>
    [
        ...new Set([
            ...(cfg.approverRoleIds ?? def.dutyreport?.managerRoleIds ?? []),
            ...(def.dutyreport?.izinDutyRoleIds ?? []),
        ]),
    ].filter(Boolean);
const pingRoleIds = () => (cfg.pingRoleIds ?? approverRoleIds()).filter(Boolean);
const approverUserIds = () => [...[].concat(def.users?.ownerId ?? []), ...[].concat(def.users?.developers ?? [])];

const STATE_FILE = path.join(__dirname, '..', 'data', 'izin-state.json');
let state = { counter: 0, requests: {} };

try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state = { counter: s.counter ?? 0, requests: s.requests ?? {} };
} catch {}

function save() {
    try {
        const tmp = STATE_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
        fs.renameSync(tmp, STATE_FILE);
    } catch (e) {
        log(`Gagal menyimpan izin-state.json: ${e.message}`, 'err');
    }
}

const pad = (n) => String(n).padStart(4, '0');
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
const nowSec = () => Math.floor(Date.now() / 1000);
const getReq = (num) => state.requests[String(num)];
const NO_MENTIONS = { parse: [] };

const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });
const reply = (interaction, content) => interaction.reply(eph(content));

const safe = (fn) => async (client, interaction) => {
    try {
        await fn(client, interaction);
    } catch (err) {
        log(err.stack ?? String(err), 'err');
        const msg = eph(
            '### ❌ Terjadi Kesalahan\n> Sistem izin sedang mengalami kendala. Silakan coba beberapa saat lagi atau hubungi Developer.',
        );
        if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
        else await interaction.reply(msg).catch(() => {});
    }
};

const isApprover = (member) =>
    !!member && (approverUserIds().includes(member.id) || approverRoleIds().some((id) => member.roles?.cache?.has(id)));

const canRequest = (member) =>
    !!member && (isApprover(member) || requesterRoleIds().some((id) => member.roles?.cache?.has(id)));

function durationOptions() {
    const opts = [];
    if (cfg.allowNight) {
        opts.push({
            value: 'night',
            label: 'Malam ini saja',
            description: `Berlaku hingga pukul ${String(cfg.nightEndHour).padStart(2, '0')}:00 pagi`,
        });
    }
    for (let d = cfg.minDays; d <= cfg.maxDays; d++) {
        opts.push({
            value: String(d),
            label: d === 1 ? '1 hari' : `${d} hari`,
            description: `Berlaku selama ${d} x 24 jam sejak disetujui`,
        });
    }
    return opts;
}

const validDuration = (key) => durationOptions().some((o) => o.value === key);
const durationLabel = (key) => (key === 'night' ? 'Malam ini saja' : `${key} hari`);

function computeEnd(key, startSec) {
    if (key === 'night') {
        const off = cfg.utcOffsetHours * 3600;
        const local = startSec + off;
        const dayStart = local - (((local % 86400) + 86400) % 86400);
        let end = dayStart + cfg.nightEndHour * 3600;
        if (end <= local) end += 86400;
        return end - off;
    }
    return startSec + Number(key) * 86400;
}

const STATUS = {
    pending: { label: '⏳ Menunggu Persetujuan', color: 0xf59e0b },
    approved: { label: '✅ Disetujui', color: 0x22c55e },
    rejected: { label: '❌ Ditolak', color: 0xef4444 },
    cancelled: { label: '🚫 Dibatalkan Pemohon', color: 0x6b7280 },
    finished: { label: '🔙 Kembali Bertugas', color: 0x3b82f6 },
    expired: { label: '⌛ Masa Izin Habis', color: 0x9ca3af },
};

function openRequestFor(userId, now = nowSec()) {
    return Object.values(state.requests).find(
        (r) => r.userId === userId && (r.status === 'pending' || (r.status === 'approved' && r.endAt > now)),
    );
}

function buildEmbed(r) {
    const st = STATUS[r.status] ?? STATUS.pending;
    const e = new EmbedBuilder()
        .setTitle(`📨 Izin Administrator #${pad(r.num)}`)
        .setColor(st.color)
        .addFields(
            { name: '👤 Administrator', value: `<@${r.userId}>`, inline: true },
            { name: '⏳ Durasi Izin', value: durationLabel(r.durKey), inline: true },
            { name: '📌 Status', value: st.label, inline: true },
            { name: '📝 Alasan', value: cut(r.reason, 1024) },
            { name: '🕒 Diajukan Pada', value: `<t:${r.createdAt}:F>` },
        );

    if (r.status === 'approved' || r.status === 'expired' || r.status === 'finished') {
        const endLine =
            r.status === 'finished' && r.finishedAt
                ? `Kembali aktif <t:${r.finishedAt}:R> (jadwal awal berakhir <t:${r.endAt}:f>)`
                : `Berakhir <t:${r.endAt}:R>`;
        e.addFields(
            { name: '🗓️ Masa Berlaku', value: `<t:${r.startAt}:f> ➔ <t:${r.endAt}:f>\n${endLine}` },
            { name: '👮 Disetujui Oleh', value: `<@${r.decidedBy}>`, inline: true },
        );
    }
    if (r.status === 'rejected') {
        e.addFields(
            { name: '👮 Ditolak Oleh', value: `<@${r.decidedBy}>`, inline: true },
            { name: '💬 Alasan Penolakan', value: cut(r.rejectReason || '-', 1024) },
        );
    }
    e.setFooter({ text: `Expensive Roleplay • Izin #${pad(r.num)}` }).setTimestamp(new Date(r.createdAt * 1000));
    return e;
}

function buildComponents(r) {
    if (r.status === 'pending') {
        return [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`izin-approve:${r.num}`)
                    .setLabel('Setujui')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`izin-reject:${r.num}`)
                    .setLabel('Tolak')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌'),
                new ButtonBuilder()
                    .setCustomId(`izin-cancel:${r.num}`)
                    .setLabel('Batalkan')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🚫'),
            ),
        ];
    }
    if (r.status === 'approved') {
        return [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`izin-end:${r.num}`)
                    .setLabel('Aktif Kembali')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔙'),
            ),
        ];
    }
    return [];
}

const render = (r) => ({ embeds: [buildEmbed(r)], components: buildComponents(r) });

async function refreshMessage(client, r) {
    try {
        const ch = await client.channels.fetch(r.channelId);
        const msg = await ch.messages.fetch(r.messageId);
        await msg.edit({ ...render(r), allowedMentions: NO_MENTIONS });
        return true;
    } catch (e) {
        log(`Gagal memperbarui pesan izin #${pad(r.num)}: ${e.message}`, 'warn');
        return false;
    }
}

async function dmUser(client, r, title, lines, color) {
    try {
        const user = await client.users.fetch(r.userId);
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(color)
            .setDescription(lines.join('\n'))
            .setFooter({ text: 'Expensive Roleplay • Staff Portal' });
        await user.send({ embeds: [embed] });
    } catch {}
}

const messageLink = (r) =>
    r.guildId && r.channelId && r.messageId
        ? `https://discord.com/channels/${r.guildId}/${r.channelId}/${r.messageId}`
        : null;

function panelPayload(guild) {
    const name = guild.name;
    const icon = guild.iconURL?.({ dynamic: true }) ?? def.icon?.thumbnail;
    const fmtMax = `${cfg.maxDays} hari`;

    const embed = new EmbedBuilder()
        .setTitle(`📨 ${name.toUpperCase()} — PORTAL IZIN ADMINISTRATOR`)
        .setThumbnail(icon)
        .setColor(0x2b6cb0)
        .setDescription(
            [
                '### 📨 AJUKAN IZIN KETIDAKHADIRAN',
                'Berhalangan hadir atau bertugas? Ajukan permohonan izinmu secara resmi melalui panel interaktif di bawah tanpa perlu format manual .\n',
                '📝 **PANDUAN PENGAJUAN:**',
                '> **1️⃣** Klik tombol **Ajukan Izin** di bawah.',
                '> **2️⃣** Lengkapi **alasan** dan tentukan **durasi** yang diinginkan .',
                '> **3️⃣** Pengajuan akan langsung diteruskan ke Owner & Developer untuk ditinjau .',
                '> **4️⃣** Kamu akan menerima notifikasi via **DM** setelah keputusan diambil .\n',
                '⚠️ **KETENTUAN LAYANAN:**',
                `> • Pilihan durasi: **Malam ini saja**, atau antara **${cfg.minDays} hingga ${fmtMax}** .`,
                '> • Masa berlaku izin dihitung sejak pengajuan **disetujui** .',
                '> • Tidak dapat membuat pengajuan baru jika masih memiliki izin aktif atau tertunda .',
                '> • Pengajuan yang belum diputuskan dapat **dibatalkan mandiri** melalui pesan log .',
                '> • Sistem otomatis mengirimkan pengingat saat masa izinmu berakhir .',
            ].join('\n'),
        )
        .setFooter({ text: '© 2026 Expensive Roleplay • Staff Portal Management', iconURL: icon })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('izin-open')
            .setLabel('Ajukan Izin')
            .setStyle(ButtonStyle.Success)
            .setEmoji('📨'),
        new ButtonBuilder().setCustomId('izin-mine').setLabel('Izin Saya').setStyle(ButtonStyle.Primary).setEmoji('📋'),
    );
    return { embeds: [embed], components: [row] };
}

function requestModal() {
    return new ModalBuilder()
        .setCustomId('modal-izin')
        .setTitle('Formulir Pengajuan Izin')
        .addLabelComponents(
            new LabelBuilder()
                .setLabel('Alasan Izin')
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId('izin-reason')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Contoh: Keperluan mendesak / Acara keluarga')
                        .setMinLength(5)
                        .setMaxLength(500)
                        .setRequired(true),
                ),
            new LabelBuilder()
                .setLabel('Durasi Izin')
                .setDescription(`Pilih malam ini saja atau ${cfg.minDays}–${cfg.maxDays} hari .`)
                .setStringSelectMenuComponent(
                    new StringSelectMenuBuilder()
                        .setCustomId('izin-duration')
                        .setPlaceholder('Pilih durasi izin...')
                        .setMinValues(1)
                        .setMaxValues(1)
                        .setRequired(true)
                        .addOptions(durationOptions()),
                ),
        );
}

function rejectModal(num) {
    return new ModalBuilder()
        .setCustomId(`modal-izin-reject:${num}`)
        .setTitle(`Tolak Pengajuan #${pad(num)}`)
        .addLabelComponents(
            new LabelBuilder()
                .setLabel('Alasan Penolakan')
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId('izin-reject-reason')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Berikan alasan penolakan secara jelas...')
                        .setMinLength(3)
                        .setMaxLength(300)
                        .setRequired(true),
                ),
        );
}

const submitLocks = new Set();

async function submitRequest(client, interaction, reason, durKey) {
    const member = interaction.member;
    if (!cfg.open) return reply(interaction, '🔒 Pengajuan izin sedang ditutup sementara .');
    if (!canRequest(member))
        return reply(interaction, '🔒 **Akses Terbatas.** Panel ini hanya dapat diakses oleh tim administrator.');
    if (!validDuration(durKey)) return reply(interaction, '❌ Pilihan durasi tidak valid. Silakan coba kembali.');

    const existing = openRequestFor(interaction.user.id);
    if (existing) {
        const info =
            existing.status === 'pending'
                ? `pengajuan **#${pad(existing.num)}** masih menunggu keputusan `
                : `izin **#${pad(existing.num)}** masih aktif hingga <t:${existing.endAt}:F> `;
        return reply(interaction, `⚠️ Kamu belum dapat mengajukan izin baru karena ${info}.`);
    }

    if (submitLocks.has(interaction.user.id)) return reply(interaction, '⏳ Pengajuanmu sedang diproses.');
    submitLocks.add(interaction.user.id);

    try {
        const channel = await client.channels.fetch(cfg.logChannelId).catch(() => null);
        if (!channel?.isTextBased?.()) {
            log(`Channel log izin (${cfg.logChannelId}) tidak ditemukan.`, 'err');
            return reply(interaction, '❌ Channel log pengajuan tidak ditemukan. Hubungi Developer.');
        }

        const num = state.counter + 1;
        const r = {
            num,
            userId: interaction.user.id,
            reason,
            durKey,
            status: 'pending',
            createdAt: nowSec(),
            guildId: interaction.guildId,
            channelId: channel.id,
            messageId: null,
            startAt: null,
            endAt: null,
            decidedBy: null,
            decidedAt: null,
            rejectReason: null,
        };

        const roles = pingRoleIds();
        const msg = await channel.send({
            content: roles.length
                ? `${roles.map((id) => `<@&${id}>`).join(' ')} 🔔 Pengajuan izin baru dari <@${r.userId}>`
                : undefined,
            ...render(r),
            allowedMentions: { roles, users: [] },
        });

        r.messageId = msg.id;
        state.counter = num;
        state.requests[String(num)] = r;
        save();

        return reply(
            interaction,
            [
                `✅ **Pengajuan Izin #${pad(num)} Berhasil Dikirim**`,
                `> Durasi: **${durationLabel(durKey)}**`,
                `> Kamu akan segera menerima notifikasi DM setelah Owner/Developer mengambil keputusan .`,
            ].join('\n'),
        );
    } finally {
        submitLocks.delete(interaction.user.id);
    }
}

async function approve(client, interaction, num) {
    const r = getReq(num);
    if (!r) return reply(interaction, '❌ Data pengajuan tidak ditemukan.');
    if (!isApprover(interaction.member))
        return reply(
            interaction,
            '🔒 **Khusus Owner & Developer.** Hanya pihak berwenang yang dapat menyetujui izin .',
        );
    if (r.status !== 'pending')
        return reply(
            interaction,
            `ℹ️ Pengajuan ini telah diproses sebelumnya (${STATUS[r.status]?.label ?? r.status}).`,
        );
    if (r.userId === interaction.user.id && !cfg.allowSelfApprove)
        return reply(interaction, '🚫 Kamu tidak dapat menyetujui izinmu sendiri .');

    const now = nowSec();
    r.status = 'approved';
    r.startAt = now;
    r.endAt = computeEnd(r.durKey, now);
    r.decidedBy = interaction.user.id;
    r.decidedAt = now;
    save();

    await interaction.update({ ...render(r), allowedMentions: NO_MENTIONS });
    log(`Izin #${pad(r.num)} disetujui oleh ${interaction.user.tag}`, 'info');

    await dmUser(
        client,
        r,
        '✅ Izin Administrator Disetujui',
        [
            `Pengajuan izinmu **#${pad(r.num)}** telah **disetujui** oleh <@${r.decidedBy}>.`,
            `🗓️ Masa Berlaku: <t:${r.startAt}:f> ➔ <t:${r.endAt}:f>`,
            'Pastikan untuk kembali aktif bertugas setelah masa izinmu selesai.',
        ],
        STATUS.approved.color,
    );
}

async function startReject(client, interaction, num) {
    const r = getReq(num);
    if (!r) return reply(interaction, '❌ Data pengajuan tidak ditemukan.');
    if (!isApprover(interaction.member)) return reply(interaction, '🔒 **Khusus Owner & Developer.**');
    if (r.status !== 'pending')
        return reply(interaction, `ℹ️ Pengajuan ini telah diproses (${STATUS[r.status]?.label ?? r.status}).`);
    if (r.userId === interaction.user.id && !cfg.allowSelfApprove)
        return reply(interaction, '🚫 Gunakan tombol **Batalkan** jika ingin menarik pengajuanmu sendiri.');
    return interaction.showModal(rejectModal(num));
}

async function reject(client, interaction, num, reason) {
    const r = getReq(num);
    if (!r) return reply(interaction, '❌ Data pengajuan tidak ditemukan.');
    if (!isApprover(interaction.member)) return reply(interaction, '🔒 **Khusus Owner & Developer.**');
    if (r.status !== 'pending') return reply(interaction, `ℹ️ Pengajuan telah diproses.`);

    r.status = 'rejected';
    r.decidedBy = interaction.user.id;
    r.decidedAt = nowSec();
    r.rejectReason = reason;
    save();

    await refreshMessage(client, r);
    await reply(interaction, `❌ Pengajuan izin **#${pad(r.num)}** berhasil ditolak.`);
    log(`Izin #${pad(r.num)} ditolak oleh ${interaction.user.tag}`, 'info');

    await dmUser(
        client,
        r,
        '❌ Pengajuan Izin Ditolak',
        [
            `Mohon maaf, pengajuan izin **#${pad(r.num)}** **ditolak** oleh <@${r.decidedBy}>.`,
            `💬 Alasan: ${cut(reason, 300)}`,
            'Kamu dapat mengajukan kembali melalui panel utama jika diperlukan.',
        ],
        STATUS.rejected.color,
    );
}

async function cancel(client, interaction, num) {
    const r = getReq(num);
    if (!r) return reply(interaction, '❌ Data pengajuan tidak ditemukan.');
    if (r.userId !== interaction.user.id)
        return reply(interaction, '🔒 Hanya pemohon yang dapat membatalkan pengajuan ini.');
    if (r.status !== 'pending') return reply(interaction, `ℹ️ Pengajuan sudah diproses dan tidak dapat dibatalkan.`);

    r.status = 'cancelled';
    r.decidedAt = nowSec();
    save();
    await interaction.update({ ...render(r), allowedMentions: NO_MENTIONS });
}

async function endEarly(client, interaction, num) {
    const r = getReq(num);
    if (!r) return reply(interaction, '❌ Data izin tidak ditemukan.');
    if (r.userId !== interaction.user.id && !isApprover(interaction.member))
        return reply(interaction, '🔒 Hanya pemohon, Owner, atau Developer yang dapat mengakhiri izin ini.');
    if (r.status !== 'approved') return reply(interaction, `ℹ️ Izin ini sudah tidak aktif.`);

    r.status = 'finished';
    r.finishedAt = nowSec();
    r.finishedBy = interaction.user.id;
    save();
    await interaction.update({ ...render(r), allowedMentions: NO_MENTIONS });
}

function myRequestsEmbed(userId) {
    const mine = Object.values(state.requests)
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.num - a.num);
    const e = new EmbedBuilder().setTitle('📋 Riwayat Izin Saya').setColor(0x3b82f6);
    if (!mine.length) return e.setDescription('Kamu belum pernah mengajukan izin.');

    const open = openRequestFor(userId);
    if (open) {
        e.addFields({
            name: open.status === 'pending' ? '⏳ Menunggu Keputusan' : '✅ Izin Aktif Saat Ini',
            value:
                open.status === 'pending'
                    ? `#${pad(open.num)} • ${durationLabel(open.durKey)}\n${cut(open.reason, 200)}`
                    : `#${pad(open.num)} • Berakhir <t:${open.endAt}:F> (<t:${open.endAt}:R>)\n${cut(open.reason, 200)}`,
        });
    }
    e.addFields({
        name: 'Riwayat Terbaru',
        value: mine
            .slice(0, 5)
            .map(
                (r) =>
                    `**#${pad(r.num)}** • ${STATUS[r.status]?.label ?? r.status} • ${durationLabel(r.durKey)} • <t:${r.createdAt}:d>`,
            )
            .join('\n'),
    });
    return e;
}

function activeListEmbed() {
    const now = nowSec();
    const all = Object.values(state.requests);
    const active = all.filter((r) => r.status === 'approved' && r.endAt > now).sort((a, b) => a.endAt - b.endAt);
    const pending = all.filter((r) => r.status === 'pending').sort((a, b) => a.num - b.num);

    const line = (r, extra) => `• <@${r.userId}> — ${cut(r.reason, 60)} (${durationLabel(r.durKey)}) ${extra}`;
    const e = new EmbedBuilder().setTitle('📋 Daftar Status Izin Administrator').setColor(0x2b6cb0).setTimestamp();
    e.addFields(
        {
            name: `✅ Sedang Izin (${active.length})`,
            value: cut(
                active.length
                    ? active.map((r) => line(r, `— hingga <t:${r.endAt}:f> (<t:${r.endAt}:R>)`)).join('\n')
                    : '_Tidak ada_',
                1024,
            ),
        },
        {
            name: `⏳ Menunggu Keputusan (${pending.length})`,
            value: cut(
                pending.length ? pending.map((r) => line(r, `— <t:${r.createdAt}:R>`)).join('\n') : '_Tidak ada_',
                1024,
            ),
        },
    );
    return e;
}

async function sendExpiredNotice(client, r) {
    const channel = await client.channels.fetch(cfg.reminderChannelId).catch(() => null);
    if (!channel?.isTextBased?.()) {
        log(`Channel pengingat izin (${cfg.reminderChannelId}) tidak ditemukan.`, 'err');
        return false;
    }
    const link = messageLink(r);
    const embed = new EmbedBuilder()
        .setTitle('⏰ Masa Izin Administrator Telah Habis')
        .setColor(0xf97316)
        .setDescription(
            `Masa izin untuk <@${r.userId}> telah **berakhir**. Harap segera kembali aktif bertugas atau ajukan perpanjangan izin jika diperlukan .`,
        )
        .addFields(
            { name: '👤 Administrator', value: `<@${r.userId}>`, inline: true },
            { name: '⏳ Durasi', value: durationLabel(r.durKey), inline: true },
            { name: '🕒 Berakhir Pada', value: `<t:${r.endAt}:F>\n(<t:${r.endAt}:R>)`, inline: true },
            { name: '📝 Alasan Awal', value: cut(r.reason, 1024) },
        )
        .setFooter({ text: `Expensive Roleplay • Izin #${pad(r.num)}` })
        .setTimestamp();

    if (link) embed.addFields({ name: '🔗 Tautan Pengajuan', value: `[Lihat Detail Pengajuan](${link})` });

    await channel.send({ content: `<@${r.userId}>`, embeds: [embed], allowedMentions: { users: [r.userId] } });
    return true;
}

let checking = false;
async function checkExpired(client) {
    if (checking) return;
    checking = true;
    try {
        const now = nowSec();
        for (const r of Object.values(state.requests)) {
            if (r.status !== 'approved' || r.endAt > now) continue;
            r.status = 'expired';
            r.expiredAt = now;
            save();
            await refreshMessage(client, r);
            try {
                await sendExpiredNotice(client, r);
            } catch (e) {
                log(`Gagal mengirim pengingat izin #${pad(r.num)}: ${e.message}`, 'err');
            }
            log(`Izin #${pad(r.num)} kedaluwarsa, notifikasi terkirim.`, 'info');
        }
    } catch (e) {
        log(`checkExpired: ${e.stack ?? e.message}`, 'err');
    } finally {
        checking = false;
    }
}

let timer = null;
function start(client) {
    if (timer) return;
    setTimeout(() => checkExpired(client), 5 * 1000).unref?.();
    timer = setInterval(() => checkExpired(client), cfg.checkIntervalMs);
    timer.unref?.();
    log('Sistem pengingat izin admin aktif.', 'info');
}

module.exports = {
    cfg,
    state,
    save,
    getReq,
    STATUS,
    pad,
    cut,
    safe,
    reply,
    isApprover,
    canRequest,
    openRequestFor,
    durationOptions,
    validDuration,
    durationLabel,
    computeEnd,
    buildEmbed,
    buildComponents,
    render,
    panelPayload,
    requestModal,
    rejectModal,
    submitRequest,
    approve,
    startReject,
    reject,
    cancel,
    endEarly,
    myRequestsEmbed,
    activeListEmbed,
    checkExpired,
    sendExpiredNotice,
    start,
};
