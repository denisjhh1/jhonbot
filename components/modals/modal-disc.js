const { EmbedBuilder, MessageFlags } = require('discord.js');
const { state, save, isStaff, categories, parseSpan, nowSec, cfg } = require('../../core/donation-core');
const { IntError, log } = require('../../functions');

function getText(fields, id) {
    try {
        return (fields.getTextInputValue(id) ?? '').trim();
    } catch {
        return '';
    }
}

function getSelect(fields, id) {
    try {
        if (typeof fields.getStringSelectValues === 'function') {
            return [...(fields.getStringSelectValues(id) ?? [])];
        }
    } catch {}

    try {
        const comp = fields.fields?.get(id);
        return [...(comp?.values ?? [])];
    } catch {
        return [];
    }
}

module.exports = {
    customId: 'modal-disc',

    run: async (client, interaction) => {
        try {
            if (!isStaff(interaction.member)) {
                return IntError(interaction, '❌ Hanya staff donasi yang memiliki akses untuk mengatur promo diskon.');
            }

            const raw = getText(interaction.fields, 'disc-percent');
            const percent = /^\d{1,2}$/.test(raw) ? parseInt(raw, 10) : NaN;
            if (!(percent >= 1 && percent <= 90)) {
                return IntError(interaction, '❌ Persentase diskon harus berupa angka bulat antara **1 sampai 90**.');
            }

            const label = getText(interaction.fields, 'disc-label');
            const spanRaw = getText(interaction.fields, 'disc-span');
            const span = spanRaw ? parseSpan(spanRaw) : null;
            if (span === undefined) {
                return IntError(
                    interaction,
                    `❌ Durasi **"${spanRaw}"** tidak valid. Gunakan format seperti: \`3 hari\`, \`12 jam\`, \`1 hari 12 jam\` (minimal 1 menit, maksimal 90 hari).`,
                );
            }

            const picked = getSelect(interaction.fields, 'disc-cats').filter((k) => categories[k]);
            const cats = picked.length && picked.length < Object.keys(categories).length ? picked : 'all';

            const discount = {
                id: Date.now().toString(36).slice(-6),
                percent,
                label,
                cats,
                until: span ? nowSec() + span : null,
                by: interaction.user.id,
                createdAt: nowSec(),
            };

            if (!Array.isArray(state.discounts)) state.discounts = [];
            state.discounts.push(discount);
            save();
            log(
                `Diskon ${percent}% (${cats === 'all' ? 'semua' : cats.join(',')}) berhasil dibuat oleh ${interaction.user.tag}`,
                'done',
            );

            const scopeFormatted =
                cats === 'all'
                    ? '> 🌐 **Semua Kategori Paket Donasi**'
                    : cats.map((c) => `> ${categories[c]?.emoji ?? '📦'} **${categories[c]?.label ?? c}**`).join('\n');

            const guildIcon = interaction.guild.iconURL() ?? null;

            const embedStaff = new EmbedBuilder()
                .setTitle('🎫 DISKON BERHASIL DIAKTIFKAN')
                .setDescription(
                    [
                        `### 🔥 ${label || 'PROMO SPECIAL'} — POTONGAN ${percent}%`,
                        `> Promo diskon baru telah terpasang ke dalam database dan langsung aktif pada katalog bot.\n`,
                        `📌 **DETAIL PROMO:**`,
                        `> • **ID Diskon:** \`${discount.id}\``,
                        `> • **Besar Diskon:** \`${percent}%\``,
                        `> • **Dibuat Oleh:** <@${interaction.user.id}>`,
                        `> • **Masa Berlaku:** ${discount.until ? `<t:${discount.until}:F> (<t:${discount.until}:R>)` : '`Sampai Dihapus Manual`'}\n`,
                        `🎯 **KATEGORI TERDAMPAK:**`,
                        scopeFormatted,
                    ].join('\n'),
                )
                .setColor('#FFD700')
                .setFooter({ text: `Staff Control Center • Diskon ID: ${discount.id}` })
                .setTimestamp();
            if (guildIcon) embedStaff.setThumbnail(guildIcon);

            await interaction.reply({ embeds: [embedStaff], flags: MessageFlags.Ephemeral });

            if (cfg.announceChannelId) {
                const ch =
                    interaction.guild.channels.cache.get(cfg.announceChannelId) ??
                    (await interaction.guild.channels.fetch(cfg.announceChannelId).catch(() => null));

                if (ch?.isTextBased()) {
                    const panelChannelPing = cfg.panelChannelId
                        ? `<#${cfg.panelChannelId}>`
                        : 'channel **Panel Donasi**';

                    const announceEmbed = new EmbedBuilder()
                        .setTitle(`🎉 PROMO SPECIAL DONASI — POTONGAN ${percent}%!`)
                        .setDescription(
                            [
                                `### ⚡ ${label || 'EVENT DISKON SPECIAL'} HAS ARRIVED!`,
                                `Kesempatan emas untuk mendapatkan benefit & item eksklusif dengan harga yang jauh lebih terjangkau! Jangan sampai terlewatkan.\n`,
                                `🎯 **KATEGORI PROMO:**`,
                                scopeFormatted,
                                '',
                                `⏳ **BATAS WAKTU PROMO:**`,
                                `> ${discount.until ? `Berakhir pada: <t:${discount.until}:F> (**<t:${discount.until}:R>**)` : '🔥 **Promo Terbatas (Tanpa Batas Waktu Tentu)!**'}\n`,
                                `🛒 **CARA MEMESAN:**`,
                                `> Langsung buka ${panelChannelPing}, klik tombol **Beli Donasi** atau **Lihat Katalog**. Harga item pada sistem sudah **otomatis terpotong diskon ${percent}%**!`,
                            ].join('\n'),
                        )
                        .setColor('#FFD700')
                        .setFooter({
                            text: `${interaction.guild.name} • Official Donation Event`,
                            ...(guildIcon ? { iconURL: guildIcon } : {}),
                        })
                        .setTimestamp();
                    if (guildIcon) announceEmbed.setThumbnail(guildIcon);
                    if (cfg.banner) announceEmbed.setImage(cfg.banner);

                    await ch
                        .send({
                            content: '@everyone',
                            embeds: [announceEmbed],
                            allowedMentions: { parse: ['everyone'] },
                        })
                        .catch((e) => log(`Gagal mengumumkan diskon: ${e.message}`, 'warn'));
                }
            }
        } catch (err) {
            console.error('[modal-disc] ERROR:', err);
            const msg = {
                content: `❌ Terjadi error saat memproses diskon: \`${err.message}\``,
                flags: MessageFlags.Ephemeral,
            };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
            else await interaction.reply(msg).catch(() => {});
        }
    },
};
