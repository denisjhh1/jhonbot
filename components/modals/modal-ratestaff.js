const { MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { pending, drafts, DRAFT_TTL, stars, clean, cut } = require('../../core/ratestaff-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'modal-ratestaff',

    run: async (client, interaction) => {
        try {
            const p = pending.get(interaction.user.id);
            if (!p || p.expires < Date.now()) {
                pending.delete(interaction.user.id);
                return interaction.reply({
                    content: '⌛ Sesi penilaian kedaluwarsa. Klik **Rate Staff** lagi.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const starValue = Number(interaction.fields.getStringSelectValues('rs-stars')?.[0]);
            if (!Number.isInteger(starValue) || starValue < 1 || starValue > 5) {
                return interaction.reply({
                    content: '❌ Pilih jumlah bintang 1 sampai 5.',
                    flags: MessageFlags.Ephemeral,
                });
            }
            const reason = (interaction.fields.getTextInputValue('rs-reason') ?? '').trim();
            const anonymous = interaction.fields.getStringSelectValues('rs-anon')?.[0] === 'yes';

            drafts.set(interaction.user.id, {
                staff: p.staff,
                stars: starValue,
                reason,
                anonymous,
                expires: Date.now() + DRAFT_TTL,
            });
            pending.delete(interaction.user.id);

            const preview = new EmbedBuilder()
                .setTitle('📝 KONFIRMASI PENILAIAN')
                .setDescription(
                    [
                        `## ${clean(p.staff.name)}`,
                        `### ${stars(starValue)}  **${starValue} / 5**`,
                        '',
                        reason ? `> ${cut(reason, 500).replace(/\n/g, '\n> ')}` : '> *Tanpa komentar.*',
                        '',
                        anonymous ? '🕶️ Dikirim sebagai **anonim**.' : '👤 Nama kamu akan **ditampilkan**.',
                        '',
                        'Periksa kembali, lalu tekan **Kirim**.',
                    ].join('\n'),
                )
                .setColor('#F1C40F');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ratestaff-confirm')
                    .setLabel('Kirim Penilaian')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId('ratestaff-cancel')
                    .setLabel('Batal')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('✖️'),
            );

            return interaction.reply({ embeds: [preview], components: [row], flags: MessageFlags.Ephemeral });
        } catch (err) {
            log(err.stack ?? err, 'err');
        }
    },
};
