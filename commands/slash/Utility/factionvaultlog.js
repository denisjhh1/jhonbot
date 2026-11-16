const { MessageFlags, SlashCommandBuilder, ChannelType } = require('discord.js');
const factionVaultLog = require('../../../core/factionvaultlog-core');
const { log } = require('../../../functions');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('factionvaultlog')
        .setDescription('Pasang panel Log Brankas Faction dari database.')
        .addChannelOption((o) =>
            o.setName('channel')
                .setDescription('Channel tujuan panel')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),

    // Tidak memakai ownerOnly/developers berbasis User ID.
    // Akses channel tetap mengikuti permission Discord dan bot.
    run: async (client, interaction) => {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const channel =
                interaction.options.getChannel('channel') ??
                (factionVaultLog.config.channelId
                    ? await client.channels.fetch(factionVaultLog.config.channelId).catch(() => null)
                    : interaction.channel);

            if (!channel?.isTextBased()) {
                return interaction.editReply('❌ Channel tujuan tidak ditemukan. Pilih channel melalui opsi `channel`.');
            }

            const me = await channel.guild.members.fetchMe();
            const perms = channel.permissionsFor(me);
            if (!perms?.has('ViewChannel') || !perms?.has('SendMessages') ||
                !perms?.has('EmbedLinks') || !perms?.has('ReadMessageHistory')) {
                return interaction.editReply(
                    '❌ Bot belum memiliki izin View Channel, Send Messages, Embed Links, dan Read Message History di channel tersebut.',
                );
            }

            const msg = await factionVaultLog.ensurePanel(client, { channel, force: true });
            if (!msg) {
                return interaction.editReply(
                    '❌ Panel gagal dipasang. Periksa console bot dan pastikan tabel `faction_vaultlogs` tersedia.',
                );
            }
            return interaction.editReply(`✅ Panel Log Brankas Faction berhasil dipasang di <#${channel.id}>.`);
        } catch (error) {
            log(`panelfactionvaultlog gagal: ${error.stack ?? error}`, 'err');
            const message = `❌ Gagal menjalankan command: ${String(error.message ?? error).slice(0, 1200)}`;
            if (interaction.deferred || interaction.replied) return interaction.editReply(message).catch(() => null);
            return interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => null);
        }
    },
};
