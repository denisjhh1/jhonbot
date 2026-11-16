const { MessageFlags, SlashCommandBuilder, ChannelType } = require('discord.js');
const familylog = require('../../../core/familylog-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panelfamilylog')
        .setDescription('Pasang ulang panel Log Families (pilih family -> lihat isi familieslogs).')
        .addChannelOption((o) =>
            o
                .setName('channel')
                .setDescription('Channel tujuan (kosong = channel yang diatur di defines.js / default panel)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const channel =
            interaction.options.getChannel('channel') ??
            (await client.channels.fetch(familylog.config.channelId).catch(() => null));
        if (!channel) return interaction.editReply('❌ Channel tujuan tidak ditemukan.');
        const msg = await familylog.ensurePanel(client, { channel, force: true });
        return interaction.editReply(
            msg
                ? `✅ Panel Log Families terpasang di <#${channel.id}>.`
                : '❌ Gagal memasang panel. Pastikan bot bisa melihat & mengirim pesan di channel itu, dan tabel `families` bisa dibaca.',
        );
    },
};
