const { EmbedBuilder } = require('discord.js');
const { drafts, submit, cooldownLeft, stars, clean } = require('../../core/ratestaff-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'ratestaff-confirm',

    run: async (client, interaction) => {
        try {
            const draft = drafts.get(interaction.user.id);
            if (!draft || draft.expires < Date.now()) {
                drafts.delete(interaction.user.id);
                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setDescription('⌛ Sesi sudah kedaluwarsa. Klik **Rate Staff** lagi.'),
                    ],
                    components: [],
                });
            }

            drafts.delete(interaction.user.id);

            if (cooldownLeft(interaction.user.id, draft.staff.id) > 0) {
                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setDescription('⏳ Kamu sudah menilai staff ini baru-baru ini.'),
                    ],
                    components: [],
                });
            }

            await interaction.update({
                embeds: [new EmbedBuilder().setColor('Blue').setDescription('⏳ Mengirim penilaian...')],
                components: [],
            });

            const { entry } = await submit(client, interaction, draft);
            log(`Rate Staff #${entry.id}: ${entry.staffName} ${entry.stars}★ oleh ${interaction.user.tag}`, 'done');

            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Green')
                        .setDescription(
                            [
                                '## ✅ Terima kasih!',
                                `### Penilaianmu untuk **${clean(entry.staffName)}** sudah terkirim.`,
                                `${stars(entry.stars)}  **${entry.stars} / 5**`,
                            ].join('\n'),
                        ),
                ],
            });
        } catch (err) {
            log(err.stack ?? err, 'err');
            return interaction
                .editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setDescription('❌ Gagal menyimpan penilaian. Coba lagi nanti.'),
                    ],
                })
                .catch(() => {});
        }
    },
};
