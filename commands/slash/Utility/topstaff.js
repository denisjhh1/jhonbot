const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const def = require('../../../defines');
const { cfg, isLeader, rankStaff, stars, clean } = require('../../../core/ratestaff-core');
const { log } = require('../../../functions');

const medals = ['🥇', '🥈', '🥉'];

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('topstaff')
        .setDescription('Peringkat staff berdasarkan rating dari pemain (khusus pimpinan).'),
    options: { cooldown: 10000 },

    run: async (client, interaction) => {
        if (!isLeader(interaction)) {
            return interaction.reply({
                content: '❌ Perintah ini hanya untuk pimpinan.',
                flags: MessageFlags.Ephemeral,
            });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const { ranked, total } = await rankStaff(10);

            if (!ranked.length) {
                return interaction.editReply(
                    `⚠️ Belum ada staff dengan minimal **${cfg.minReviews} ulasan**. Total ulasan masuk: **${total}**.`,
                );
            }

            const lines = ranked.map((s, i) =>
                [
                    `### ${medals[i] ?? `\`#${i + 1}\``} **${clean(s.name)}**`,
                    `> ${stars(s.avg)}  **${s.avg.toFixed(2)} / 5**`,
                    `> 💬 ${s.count} ulasan`,
                ].join('\n'),
            );

            const embed = new EmbedBuilder()
                .setTitle('🏆  LEADERBOARD RATING STAFF')
                .setDescription(`Minimal **${cfg.minReviews} ulasan** agar masuk peringkat.\n\n${lines.join('\n\n')}`)
                .setColor(cfg.color)
                .setFooter({ text: 'Management Server • Khusus Pimpinan', iconURL: def.icon?.thumbnail })
                .setTimestamp();
            if (def.icon?.thumbnail) embed.setThumbnail(def.icon.thumbnail);

            return interaction.editReply({ embeds: [embed] });
        } catch (err) {
            log(err.stack ?? err, 'err');
            return interaction.editReply('❌ Terjadi kesalahan saat menghitung peringkat.');
        }
    },
};
