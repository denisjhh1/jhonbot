const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const def = require('../../../defines');
const { cfg, isLeader, getStaff, statsFor, stars, clean, cut } = require('../../../core/ratestaff-core');
const { log } = require('../../../functions');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('ratingstaff')
        .setDescription('Melihat rincian rating seorang staff (khusus pimpinan).')
        .addStringOption((o) =>
            o.setName('nama').setDescription('Nama admin atau nama karakter staff').setRequired(true),
        ),
    options: { cooldown: 5000 },

    run: async (client, interaction) => {
        if (!isLeader(interaction)) {
            return interaction.reply({
                content: '❌ Perintah ini hanya untuk pimpinan.',
                flags: MessageFlags.Ephemeral,
            });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const input = interaction.options.getString('nama').trim().toLowerCase();
            const staff = await getStaff();
            const matches = staff.filter(
                (s) =>
                    s.name.toLowerCase().includes(input) ||
                    s.charName.toLowerCase().includes(input.replace(/\s+/g, '_')),
            );

            if (!matches.length) return interaction.editReply(`❌ Staff \`${clean(input)}\` tidak ditemukan.`);
            if (matches.length > 1) {
                const exact = matches.find((s) => s.name.toLowerCase() === input || s.charName.toLowerCase() === input);
                if (!exact)
                    return interaction.editReply(
                        `⚠️ Ada beberapa hasil, tulis lebih spesifik:\n${matches
                            .slice(0, 10)
                            .map((s) => `• ${clean(s.name)} (\`${clean(s.charName)}\`)`)
                            .join('\n')}`,
                    );
                matches.splice(0, matches.length, exact);
            }

            const s = matches[0];
            const st = statsFor(s.id);
            if (!st.count) return interaction.editReply(`ℹ️ **${clean(s.name)}** belum menerima ulasan.`);

            const bar = (n) => '▰'.repeat(Math.round((n / st.count) * 10)).padEnd(10, '▱');
            const dist = [5, 4, 3, 2, 1].map((n) => `\`${n}⭐\` ${bar(st.dist[n])} **${st.dist[n]}**`).join('\n');

            const recent = st.list
                .slice(-5)
                .reverse()
                .map((e) => {
                    const who = e.anonymous ? '🕶️ Anonim' : `<@${e.raterId}>`;
                    const when = `<t:${Math.floor(e.timestamp / 1000)}:R>`;
                    return `**${e.stars}⭐** • ${who} • ${when}\n> ${e.reason ? cut(e.reason, 150).replace(/\n/g, ' ') : '*tanpa komentar*'}`;
                })
                .join('\n\n');

            const embed = new EmbedBuilder()
                .setTitle('📊  RATING STAFF')
                .setDescription(
                    [
                        `## ${clean(s.name)}`,
                        `Karakter: \`${clean(s.charName)}\``,
                        '',
                        `# ${st.avg.toFixed(2)} / 5`,
                        `### ${stars(st.avg)}`,
                        `💬 **${st.count}** ulasan`,
                        '',
                        '### Sebaran Bintang',
                        dist,
                        '',
                        '### Ulasan Terbaru',
                        recent,
                    ].join('\n'),
                )
                .setColor(cfg.color)
                .setFooter({ text: 'Management Server • Khusus Pimpinan', iconURL: def.icon?.thumbnail })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
        } catch (err) {
            log(err.stack ?? err, 'err');
            return interaction.editReply('❌ Terjadi kesalahan saat mengambil data.');
        }
    },
};
