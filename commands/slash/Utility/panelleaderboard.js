const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const leaderboard = require('../../../core/leaderboard-core');
const { log } = require('../../../functions');

const TEXT = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const NAMES = { money: 'Top Harta', admin: 'Top Admin', online: 'Top Online' };

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panelleaderboard')
        .setDescription('Pasang panel Top Harta, Top Admin & Top Online yang diperbarui otomatis tiap 1 jam.')
        .addChannelOption((o) =>
            o
                .setName('harta')
                .setDescription('Channel untuk Top Harta (money)')
                .addChannelTypes(...TEXT),
        )
        .addChannelOption((o) =>
            o
                .setName('admin')
                .setDescription('Channel untuk Top Admin')
                .addChannelTypes(...TEXT),
        )
        .addChannelOption((o) =>
            o
                .setName('online')
                .setDescription('Channel untuk Top Online (playtime)')
                .addChannelTypes(...TEXT),
        ),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const picked = {
            money: interaction.options.getChannel('harta'),
            admin: interaction.options.getChannel('admin'),
            online: interaction.options.getChannel('online'),
        };
        const targets = Object.values(picked).some(Boolean)
            ? picked
            : { money: interaction.channel, admin: interaction.channel, online: interaction.channel };
        try {
            const done = await leaderboard.installPanels(client, targets);
            const lines = done.map((k) => `• ${NAMES[k]} → <#${targets[k].id}>`);
            return interaction.editReply(
                `✅ Panel terpasang dan akan diedit otomatis tiap ${leaderboard.config.intervalMinutes} menit (bukan kirim ulang):\n${lines.join('\n')}`,
            );
        } catch (err) {
            log(err.stack ?? err, 'err');
            return interaction.editReply(
                '❌ Gagal memasang panel. Pastikan bot bisa melihat & mengirim pesan di channel tujuan.',
            );
        }
    },
};
