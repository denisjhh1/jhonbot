const fs = require('fs');
const path = require('path');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    LabelBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
} = require('discord.js');

const def = require('../defines');
const { log } = require('../functions');
const { benefits } = require('../catalog/benefit-catalog');

const DEFAULTS = {
    open: true,
    categoryId: 'YOUR_DISCORD_ID',
    claimChannelId: 'YOUR_DISCORD_ID',
    pingRoleIds: null,
    pingUserIds: ['YOUR_DISCORD_ID'],
    cooldownSeconds: 60,
};
const cfg = { ...DEFAULTS, ...(def.benefit ?? {}) };
const pingRoleIds = () => (cfg.pingRoleIds ?? def.donation?.staffRoleIds ?? []).filter(Boolean);
const pingUserIds = () => [...new Set(cfg.pingUserIds ?? [])].filter(Boolean);

const GOLD = 0xd4af37;
const LINE = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

const STATE_FILE = path.join(__dirname, '..', 'data', 'benefit-state.json');
let state = { counter: 0, claims: {} };
try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state = { counter: s.counter ?? 0, claims: s.claims ?? {} };
} catch {}
function save() {
    try {
        const tmp = STATE_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
        fs.renameSync(tmp, STATE_FILE);
    } catch (e) {
        log(`Gagal menyimpan benefit-state.json: ${e.message}`, 'err');
    }
}

const pad = (n) => String(n).padStart(4, '0');
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
const clean = (s) =>
    String(s ?? '')
        .replace(/`/g, "'")
        .trim();
const getBenefit = (id) => benefits.find((b) => b.id === id);
const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });

const safe = (fn) => async (client, interaction) => {
    try {
        await fn(client, interaction);
    } catch (err) {
        log(err.stack ?? String(err), 'err');
        const msg = eph(
            '## ❌ Terjadi Kesalahan\n> *Sistem benefit sedang mengalami kendala. Coba lagi sebentar atau hubungi staff.*',
        );
        if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
        else await interaction.reply(msg).catch(() => {});
    }
};

const selectRow = () =>
    new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('benefit-select')
            .setPlaceholder('✨ Pilih Benefit untuk Melihat Detail')
            .addOptions(
                benefits.map((b) => ({ label: b.name, value: b.id, emoji: b.emoji, description: cut(b.tagline, 100) })),
            ),
    );

const panelButtons = () =>
    new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('benefit-claim')
            .setLabel('Claim Benefit Sekarang')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎁'),
    );

function panelPayload(guild) {
    const name = guild.name.toUpperCase();
    const icon = guild.iconURL?.({ dynamic: true }) ?? def.icon?.thumbnail;
    const sections = [];
    for (const b of benefits) {
        const g = b.group ?? null;
        let sec = sections[sections.length - 1];
        if (!sec || sec.group !== g) sections.push((sec = { group: g, items: [] }));
        sec.items.push(`> ${b.emoji} **${b.name}**\n> └ *${b.tagline}*`);
    }
    const list = sections
        .map((sec) => (sec.group ? `### 👑 ${sec.group}\n` : '') + sec.items.join('\n> \n'))
        .join('\n\n');

    const description = [
        `# 👑 PRIVILEGE & BENEFIT EKSKLUSIF`,
        `## ✦ ${name} ✦`,
        '*Selamat datang di pusat layanan benefit eksklusif. Nikmati fasilitas istimewa dan tingkatkan pengalaman bermainmu dengan kemewahan terbaik.*',
        '',
        LINE,
        '## 💎 KATALOG BENEFIT EKSKLUSIF',
        list,
        '',
        LINE,
        '## 📜 PETUNJUK KLAIM BENEFIT',
        '> **` 1 `** **Pilih Benefit** di menu dropdown di bawah untuk melihat rincian lengkap.',
        '> **` 2 `** Klik tombol **🎁 Claim Benefit Sekarang**.',
        '> **` 3 `** Lengkapi formulir pendaftaran dengan data **Karakter** & **UCP** yang valid.',
        `> **\` 4 \`** Permintaanmu akan otomatis dikirim ke <#${cfg.claimChannelId}> untuk diverifikasi Staff.`,
        '',
        LINE,
        '-# ⚠️ *Pastikan data yang kamu masukkan benar. Data yang salah dapat menghambat atau membatalkan proses verifikasi.*',
    ].join('\n');

    const embed = new EmbedBuilder()
        .setColor(GOLD)
        .setAuthor({ name: `${guild.name} • Privilege Lounge`, iconURL: icon })
        .setThumbnail(icon)
        .setDescription(description)
        .setFooter({ text: 'Expensive Roleplay • Management Benefit Center © 2026', iconURL: icon })
        .setTimestamp();

    return { embeds: [embed], components: [selectRow(), panelButtons()] };
}

function detailPayload(b) {
    const embed = new EmbedBuilder()
        .setColor(b.color ?? GOLD)
        .setDescription(
            [
                `# ${b.emoji} ${b.name.toUpperCase()}`,
                `*${b.tagline}*`,
                '',
                LINE,
                '## ✨ FASILITAS & HAK EKSKLUSIF',
                b.perks.map((p) => `> ✦ **${p}**`).join('\n'),
                ...(b.note ? ['', '## 📌 CATATAN PENTING', `> ${b.note}`] : []),
                '',
                LINE,
                '### 🎁 Siap Mengklaim Benefit Ini?',
                '> Klik tombol di bawah ini untuk langsung mengisi formulir pendaftaran.',
            ].join('\n'),
        )
        .setFooter({ text: 'Expensive Privilege Lounge • Benefit Center' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`benefit-claim:${b.id}`)
            .setLabel(`Claim ${b.name}`)
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎁'),
    );
    return { embeds: [embed], components: [row], flags: MessageFlags.Ephemeral };
}

function claimModal(preselect) {
    const options = benefits.map((b) => ({
        label: b.name,
        value: b.id,
        emoji: b.emoji,
        description: cut(b.tagline, 100),
        default: b.id === preselect,
    }));
    return new ModalBuilder()
        .setCustomId('modal-benefit')
        .setTitle('Formulir Klaim Benefit')
        .addLabelComponents(
            new LabelBuilder()
                .setLabel('Nama Karakter (IC)')
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId('benefit-char')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Contoh: Firstname_Lastname')
                        .setMinLength(3)
                        .setMaxLength(40)
                        .setRequired(true),
                ),
            new LabelBuilder()
                .setLabel('Nama Akun UCP')
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId('benefit-ucp')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Masukkan nama akun UCP kamu')
                        .setMinLength(3)
                        .setMaxLength(30)
                        .setRequired(true),
                ),
            new LabelBuilder()
                .setLabel('Pilihan Benefit')
                .setStringSelectMenuComponent(
                    new StringSelectMenuBuilder()
                        .setCustomId('benefit-pick')
                        .setPlaceholder('Pilih benefit yang ingin di-claim')
                        .setMinValues(1)
                        .setMaxValues(1)
                        .setRequired(true)
                        .addOptions(options),
                ),
            new LabelBuilder()
                .setLabel('Detail Permintaan & Catatan Tambahan')
                .setDescription('Tuliskan rincian kendaraan, nama family/faction, atau informasi pendukung lainnya.')
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId('benefit-detail')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Contoh: Pilihan kendaraan Sultan 3 insu, nama family: Tokyo Drift')
                        .setMinLength(3)
                        .setMaxLength(1000)
                        .setRequired(true),
                ),
        );
}

const lastClaim = new Map();
const locks = new Set();

async function submitClaim(client, interaction, { char, ucp, benefitId, detail }) {
    if (!cfg.open)
        return interaction.reply(
            eph('## 🔒 Layanan Ditutup\n> Mohon maaf, klaim benefit sedang ditutup sementara oleh Management.'),
        );
    const b = getBenefit(benefitId);
    if (!b)
        return interaction.reply(
            eph('## ❌ Pilihan Tidak Valid\n> Pilihan benefit tidak ditemukan. Silakan coba lagi.'),
        );

    const wait = cfg.cooldownSeconds * 1000 - (Date.now() - (lastClaim.get(interaction.user.id) ?? 0));
    if (wait > 0)
        return interaction.reply(
            eph(
                `## ⏳ Cooldown Active\n> Harap tunggu **${Math.ceil(wait / 1000)} detik** lagi sebelum melakukan klaim berikutnya.`,
            ),
        );
    if (locks.has(interaction.user.id))
        return interaction.reply(
            eph('## ⏳ Sedang Diproses\n> Klaim kamu sedang diproses oleh sistem. Mohon tunggu sejenak.'),
        );
    locks.add(interaction.user.id);

    try {
        const channel = await client.channels.fetch(cfg.claimChannelId).catch(() => null);
        if (!channel?.isTextBased?.()) {
            log(`Channel claim benefit (${cfg.claimChannelId}) tidak ditemukan atau bukan channel teks.`, 'err');
            return interaction.reply(
                eph('## ❌ Channel Terputus\n> Channel klaim tidak ditemukan. Silakan laporkan masalah ini ke Staff.'),
            );
        }

        const num = state.counter + 1;
        const ts = Math.floor(Date.now() / 1000);

        const user = interaction.user;
        const embed = new EmbedBuilder()
            .setColor(b.color ?? GOLD)
            .setAuthor({ name: user.username, iconURL: user.displayAvatarURL?.() ?? undefined })
            .setTitle(`🎁 KLAIM BENEFIT #${pad(num)}`)
            .setDescription(
                [
                    `## ${b.emoji} ${b.name.toUpperCase()}`,
                    `> 👤 **Pemain:** <@${user.id}>`,
                    `> 🎮 **Karakter:** \`${clean(char) || '-'}\``,
                    `> 🔑 **UCP:** \`${clean(ucp) || '-'}\``,
                ].join('\n'),
            )
            .addFields(
                { name: '📝 Detail Permintaan', value: cut(`>>> ${clean(detail) || '-'}`, 1024) },
                { name: '✨ Fasilitas Benefit', value: cut(b.perks.map((p) => `✦ ${p}`).join('\n'), 1024) },
                ...(b.note ? [{ name: '📌 Catatan', value: cut(b.note, 1024) }] : []),
            )
            .setFooter({
                text: `Claim #${pad(num)} • Management Review`,
                iconURL: interaction.guild?.iconURL?.() ?? undefined,
            })
            .setTimestamp(ts * 1000);

        const roles = pingRoleIds();
        const users = pingUserIds();
        const mentions = [...roles.map((id) => `<@&${id}>`), ...users.map((id) => `<@${id}>`)];
        const msg = await channel.send({
            content: mentions.length ? `${mentions.join(' ')} 📥 **Pengajuan Claim Benefit Baru!**` : undefined,
            embeds: [embed],
            allowedMentions: { roles, users },
        });

        state.counter = num;
        state.claims[String(num)] = {
            num,
            userId: interaction.user.id,
            benefitId: b.id,
            char: clean(char),
            ucp: clean(ucp),
            detail: clean(detail),
            ts,
            channelId: channel.id,
            messageId: msg.id,
        };
        save();
        lastClaim.set(interaction.user.id, Date.now());

        return interaction.reply(
            eph(
                [
                    `# ✅ Pengajuan Claim #${pad(num)} Berhasil!`,
                    `> Benefit: ${b.emoji} **${b.name}**`,
                    '',
                    `> Data kamu telah berhasil dikirim ke <#${channel.id}>. Tim Staff akan segera memproses pengajuanmu. Terima kasih atas dukunganmu!`,
                ].join('\n'),
            ),
        );
    } finally {
        locks.delete(interaction.user.id);
    }
}

module.exports = {
    cfg,
    state,
    save,
    benefits,
    getBenefit,
    pad,
    cut,
    clean,
    safe,
    selectRow,
    panelButtons,
    panelPayload,
    detailPayload,
    claimModal,
    submitClaim,
};
