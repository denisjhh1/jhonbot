const fs = require('fs');
const path = require('path');
const { EmbedBuilder, MessageFlags, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const def = require('../defines');
const { log } = require('../functions');

const cfg = def.statusserver ?? {};
const bugCfg = def.bugreport ?? {};
const COOLDOWN_MS = 10 * 1000;
let lastSent = 0;

const TYPES = {
    online: {
        banner: 'banner_online.png',
        color: 'Green',
        title: '📢 SERVER STATUS UPDATE',
        head: '🟢 SERVER TELAH KEMBALI ONLINE',
        body: 'Halo <@&YOUR_DISCORD_ID>,\n\nKami informasikan bahwa pemeliharaan server telah selesai dan **kota/server sudah resmi kembali dibuka**. Kalian semua sudah bisa kembali beraktivitas seperti biasa.\n\nTerima kasih banyak atas kesabaran kalian selama penanganan berlangsung. Jika selama bermain kalian menemukan adanya bug atau masalah teknis, silakan laporkan di channel <#YOUR_DISCORD_ID> agar bisa segera ditangani oleh tim developer.\n\nSelamat kembali ke kota dan nikmati alur roleplay kalian!',
        fields: [
            ['Status Server', '🟢 ONLINE'],
            ['Akses Server', '✅ DIBUKA'],
        ],
    },
    offline: {
        banner: 'banner_offline.png',
        color: 'Red',
        title: '📢 SERVER STATUS UPDATE',
        head: '🔴 SERVER SEDANG OFFLINE',
        body: 'Halo <@&YOUR_DISCORD_ID>,\n\nSaat ini server **sedang mengalami kendala dan dalam kondisi offline**, sehingga akses masuk untuk sementara waktu ditutup.\n\nTim teknis kami sedang bergerak cepat untuk mengidentifikasi serta memperbaiki masalah yang terjadi. Mohon bersabar sejenak, pembaruan informasi selanjutnya akan langsung kami sampaikan di channel ini begitu kondisi membaik.\n\nTerima kasih atas pengertiannya, Warga.',
        fields: [
            ['Status Server', '🔴 OFFLINE'],
            ['Akses Server', '⛔ DITUTUP SEMENTARA'],
        ],
    },
    maintenance: {
        banner: 'banner_maintenance.png',
        color: 'Orange',
        title: '📢 SERVER STATUS UPDATE',
        head: '🟠 SERVER DALAM MAINTENANCE',
        body: 'Halo <@&YOUR_DISCORD_ID>,\n\nSaat ini kota sedang dalam masa **maintenance rutin** untuk optimasi sistem dan peningkatan kualitas bermain agar makin lancar.\n\nSelama proses pemeliharaan berlangsung, akses server tidak dapat dimasuki. Bagi kalian yang sempat menemukan kendala sebelum maintenance dimulai, bisa tetap drop laporannya di <#YOUR_DISCORD_ID>.\n\nTerima kasih atas kesabaran dan dukungan kalian semua!',
        fields: [
            ['Status Server', '🟠 MAINTENANCE'],
            ['Akses Server', '⛔ DITUTUP SEMENTARA'],
        ],
    },
};

const isAllowed = (member) =>
    [].concat(def.users?.ownerId ?? []).includes(member.id) ||
    [].concat(def.users?.developers ?? []).includes(member.id) ||
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    [bugCfg.adminRoleId, bugCfg.developerRoleId, ...(cfg.roleIds ?? [])]
        .filter(Boolean)
        .some((id) => member.roles.cache.has(id));

async function sendStatus(interaction, type) {
    const reply = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

    if (!isAllowed(interaction.member)) return reply('Hanya staf yang bisa memakai tombol ini.');
    if (!cfg.channelId) return reply('❌ `statusserver.channelId` belum diisi di defines.js.');

    const wait = COOLDOWN_MS - (Date.now() - lastSent);
    if (wait > 0) return reply(`⏳ Tunggu ${Math.ceil(wait / 1000)} detik sebelum mengirim status lagi.`);

    const channel = await interaction.guild.channels.fetch(cfg.channelId).catch(() => null);
    if (!channel || !channel.isTextBased())
        return reply('❌ Channel status tidak ditemukan. Cek `statusserver.channelId` di defines.js.');

    const t = TYPES[type];
    const embed = new EmbedBuilder()
        .setTitle(t.title)
        .setDescription(`**${t.head}**\n\n${t.body}`)
        .addFields(...t.fields.map(([name, value]) => ({ name, value, inline: true })))
        .setColor(t.color)
        .setThumbnail(def.icon.thumbnail)
        .setFooter({ text: 'Management Server', iconURL: def.icon.thumbnail })
        .setTimestamp();
    if (def.sserver?.ip)
        embed.addFields({ name: 'Alamat Server', value: `\`${def.sserver.ip}:${def.sserver.port}\``, inline: false });

    const files = [];
    const bannerUrl = (cfg.banners ?? def.banners)?.[type];
    if (bannerUrl) {
        embed.setImage(bannerUrl);
    } else {
        const bannerPath = path.join(__dirname, '..', 'banners', t.banner);
        if (fs.existsSync(bannerPath)) {
            files.push(new AttachmentBuilder(bannerPath, { name: t.banner }));
            embed.setImage(`attachment://${t.banner}`);
        } else {
            log(`Banner untuk "${type}" tidak diatur (isi statusserver.banners.${type} di defines.js).`, 'warn');
        }
    }

    try {
        await channel.send({
            content: cfg.pingEveryone ? '@everyone' : undefined,
            embeds: [embed],
            files,
            allowedMentions: cfg.pingEveryone ? { parse: ['everyone'] } : { parse: [] },
        });
    } catch (err) {
        log(err.stack ?? err, 'err');
        return reply(`❌ Gagal mengirim ke <#${cfg.channelId}>.\n\`\`\`${String(err.message).slice(0, 300)}\`\`\``);
    }

    lastSent = Date.now();
    log(`Status server "${type}" dikirim oleh ${interaction.user.tag}`, 'done');
    return reply(`✅ Status **${type.toUpperCase()}** terkirim ke <#${cfg.channelId}>.`);
}

module.exports = { sendStatus };
