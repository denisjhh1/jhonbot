const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    MessageFlags,
    escapeMarkdown,
} = require('discord.js');
const am = require('../adminMonitor');
const { log } = require('../functions');

const NOTE_ID = 'adminmon-text';
const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });
const pidOf = (interaction) => Number(interaction.customId.split(':')[1]);

function wrap(fn) {
    return async (client, interaction) => {
        try {
            await fn(client, interaction);
        } catch (e) {
            log(`AdminMonitor aksi gagal: ${e.stack ?? e}`, 'err');
            const msg = eph(`Terjadi kesalahan: ${e.message ?? e}`);
            if (interaction.deferred || interaction.replied) await interaction.followUp(msg).catch(() => null);
            else await interaction.reply(msg).catch(() => null);
        }
    };
}

function modal(customId, title, label, { required, placeholder }) {
    return new ModalBuilder()
        .setCustomId(customId)
        .setTitle(title.slice(0, 45))
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId(NOTE_ID)
                    .setLabel(label)
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(required)
                    .setMaxLength(500)
                    .setPlaceholder(placeholder),
            ),
        );
}

const openKlarif = wrap(async (client, interaction) => {
    if (!am.canAct(interaction))
        return interaction.reply(eph('Kamu tidak memiliki izin untuk menggunakan tombol ini.'));
    const a = await am.getAdminByPid(pidOf(interaction));
    if (!a) return interaction.reply(eph('Data admin tidak ditemukan.'));
    if (!a.discordId)
        return interaction.reply(
            eph(`Admin ${a.adminName} belum menghubungkan akun Discord, tidak bisa dikirimi pesan.`),
        );
    return interaction.showModal(
        modal(`modal-adminmon-klarif:${a.pID}`, `Klarifikasi: ${a.adminName}`, 'Catatan tambahan (opsional)', {
            required: false,
            placeholder: 'Contoh: harap balas paling lambat besok.',
        }),
    );
});

const openDemote = wrap(async (client, interaction) => {
    if (!am.canAct(interaction))
        return interaction.reply(eph('Kamu tidak memiliki izin untuk menggunakan tombol ini.'));
    const a = await am.getAdminByPid(pidOf(interaction));
    if (!a) return interaction.reply(eph('Data admin tidak ditemukan.'));
    if (a.level <= 0) return interaction.reply(eph(`${a.adminName} sudah bukan admin.`));
    return interaction.showModal(
        modal(`modal-adminmon-demote:${a.pID}`, `Demote: ${a.adminName}`, 'Alasan demote (wajib)', {
            required: true,
            placeholder: 'Contoh: tidak aktif lebih dari 2 hari tanpa izin.',
        }),
    );
});

async function markMessage(interaction, pID, line, { klarifDone, allDone, color }) {
    if (!interaction.message) return;
    const embed = EmbedBuilder.from(interaction.message.embeds[0]);
    if (color) embed.setColor(color);
    const prev = embed.data.fields ?? [];
    const idx = prev.findIndex((f) => f.name === 'Tindak Lanjut');
    const text = ((idx >= 0 ? prev[idx].value + '\n' : '') + line).slice(-1000);
    if (idx >= 0) prev[idx].value = text;
    else embed.addFields({ name: 'Tindak Lanjut', value: text });
    await interaction.message.edit({
        embeds: [embed],
        components: [am.buildButtons(pID, { klarifDone, disabled: allDone })],
    });
}

const tag = (u) => `${escapeMarkdown(u.username)} (<t:${Math.floor(Date.now() / 1000)}:f>)`;

const submitKlarif = wrap(async (client, interaction) => {
    if (!am.canAct(interaction)) return interaction.reply(eph('Kamu tidak memiliki izin.'));
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const pID = pidOf(interaction);
    const note = interaction.fields.getTextInputValue(NOTE_ID).trim();
    const a = await am.getAdminByPid(pID);
    if (!a?.discordId) return interaction.editReply('Admin tidak ditemukan atau Discord belum terhubung.');

    const days = a.last ? Math.floor((Date.now() - a.last) / 86400000) : null;
    const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle('Permintaan Klarifikasi Admin')
        .setDescription(
            `Kamu tercatat tidak login ke server ${days === null ? 'dalam waktu yang lama' : `selama ${days} hari`}` +
                `${a.last ? ` (login terakhir <t:${Math.floor(a.last / 1000)}:F>)` : ''}.\n` +
                'Mohon berikan klarifikasi kepada management.',
        )
        .addFields({ name: 'Diminta oleh', value: escapeMarkdown(interaction.user.username), inline: true })
        .setTimestamp();
    if (note) embed.addFields({ name: 'Catatan', value: escapeMarkdown(note) });

    try {
        const user = await client.users.fetch(a.discordId);
        await user.send({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (e) {
        return interaction.editReply(`Gagal mengirim DM ke ${a.adminName} (DM ditutup atau user tidak ditemukan).`);
    }
    am.recordKlarif(pID, interaction.user.username);
    await markMessage(interaction, pID, `Klarifikasi diminta oleh ${tag(interaction.user)}`, { klarifDone: true });
    return interaction.editReply(`Permintaan klarifikasi sudah dikirim lewat DM ke ${a.adminName}.`);
});

async function sendDemoteNotice(client, interaction, a, reason) {
    const channelId = am.config.demoteNotifyChannelId;
    const roleId = am.config.demoteNotifyRoleId;
    if (!channelId) return 'Notifikasi channel tidak diatur';
    try {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel?.isTextBased()) return `Notifikasi gagal: channel ${channelId} tidak ditemukan / tidak ada akses`;

        const now = Math.floor(Date.now() / 1000);
        const embed = new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Admin Telah Di-Demote')
            .addFields(
                { name: 'Admin', value: `${escapeMarkdown(a.adminName)}\n\`${a.charName}\``, inline: true },
                {
                    name: 'Discord',
                    value: a.discordId ? `<@${a.discordId}> (\`${a.discordId}\`)` : 'Belum terhubung',
                    inline: true,
                },
                { name: 'Level Sebelumnya', value: String(a.level), inline: true },
                { name: 'Alasan', value: escapeMarkdown(reason).slice(0, 1000) },
                {
                    name: 'Di-demote Oleh',
                    value: `${escapeMarkdown(interaction.user.username)} (<@${interaction.user.id}>)`,
                    inline: true,
                },
                { name: 'Waktu', value: `<t:${now}:F>`, inline: true },
                {
                    name: 'Tindak Lanjut',
                    value: '1. Hapus role admin dari Discord yang bersangkutan.\n2. Perbarui list admin.',
                },
            )
            .setTimestamp();

        await channel.send({
            content: roleId
                ? `<@&${roleId}> admin **${escapeMarkdown(a.adminName)}** telah di-demote. Mohon hapus role-nya dan perbarui list admin.`
                : undefined,
            embeds: [embed],
            allowedMentions: { roles: roleId ? [roleId] : [], users: [] },
        });
        return 'Notifikasi terkirim';
    } catch (e) {
        log(`AdminMonitor: notifikasi demote gagal: ${e.message}`, 'err');
        return 'Notifikasi gagal terkirim';
    }
}

const submitDemote = wrap(async (client, interaction) => {
    if (!am.canAct(interaction)) return interaction.reply(eph('Kamu tidak memiliki izin.'));
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const pID = pidOf(interaction);
    const reason = interaction.fields.getTextInputValue(NOTE_ID).trim();
    if (!reason) return interaction.editReply('Alasan wajib diisi.');
    const a = await am.getAdminByPid(pID);
    if (!a) return interaction.editReply('Data admin tidak ditemukan.');
    if (a.level <= 0) return interaction.editReply(`${a.adminName} sudah bukan admin.`);

    const res = await am.demoteUcp(a.ucp);
    if (res.online)
        return interaction.editReply(
            `${a.adminName} sedang online di server, demote dibatalkan. Coba lagi setelah dia keluar.`,
        );
    if (!res.changed) return interaction.editReply('Tidak ada karakter admin yang diubah.');

    await am.writeAdminLog(
        `Discord:${interaction.user.username}`,
        `Demote admin ${a.charName} (UCP ${a.ucp}, level ${a.level}) lewat /adminmonitor, alasan: ${reason}`,
        { cmd: 'demote (Discord)', target: a.charName },
    );

    let dm = 'DM terkirim';
    if (a.discordId) {
        try {
            const user = await client.users.fetch(a.discordId);
            await user.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xed4245)
                        .setTitle('Jabatan Admin Dicabut')
                        .setDescription(`Level admin kamu (level ${a.level}) telah dicabut.`)
                        .addFields(
                            { name: 'Alasan', value: escapeMarkdown(reason) },
                            { name: 'Oleh', value: escapeMarkdown(interaction.user.username), inline: true },
                        )
                        .setTimestamp(),
                ],
                allowedMentions: { parse: [] },
            });
        } catch {
            dm = 'DM gagal terkirim';
        }
    } else dm = 'Discord belum terhubung, DM tidak dikirim';

    const notify = await sendDemoteNotice(client, interaction, a, reason);

    await markMessage(
        interaction,
        pID,
        `Demote (level ${a.level} -> 0) oleh ${tag(interaction.user)}\nAlasan: ${reason.slice(0, 200)}\n${dm}\n${notify}`,
        { klarifDone: true, allDone: true, color: 0x747f8d },
    );
    return interaction.editReply(`${a.adminName} telah di-demote (${res.changed} karakter). ${dm}. ${notify}.`);
});

module.exports = { openKlarif, openDemote, submitKlarif, submitDemote };
