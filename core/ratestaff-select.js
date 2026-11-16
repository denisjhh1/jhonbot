const {
    MessageFlags,
    ModalBuilder,
    LabelBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require('discord.js');
const { pending, DRAFT_TTL, getStaff, cooldownLeft, cfg, cut } = require('./ratestaff-core');
const { log } = require('../functions');

const STAR_LABELS = [
    ['5', '⭐⭐⭐⭐⭐  Aku Cinta Admin Expensive'],
    ['4', '⭐⭐⭐⭐  Baik'],
    ['3', '⭐⭐⭐  Cukup Kali'],
    ['2', '⭐⭐  Kureng'],
    ['1', '⭐  Jelek'],
];

function makeSelectHandler(index) {
    return {
        customId: `ratestaff-select-${index}`,

        run: async (client, interaction) => {
            try {
                const staffId = interaction.values[0];
                const staff = (await getStaff()).find((s) => s.id === staffId);
                if (!staff) {
                    return interaction.reply({
                        content: '❌ Staff tidak ditemukan. Klik **Rate Staff** lagi.',
                        flags: MessageFlags.Ephemeral,
                    });
                }

                const left = cooldownLeft(interaction.user.id, staff.id);
                if (left > 0) {
                    const hours = Math.ceil(left / 3600000);
                    return interaction.reply({
                        content: `⏳ Kamu sudah menilai **${staff.name}** baru-baru ini. Coba lagi sekitar **${hours} jam** lagi.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }

                pending.set(interaction.user.id, { staff, expires: Date.now() + DRAFT_TTL });

                const modal = new ModalBuilder()
                    .setCustomId('modal-ratestaff')
                    .setTitle(cut(`Rate: ${staff.name}`, 45))
                    .addLabelComponents(
                        new LabelBuilder().setLabel('Berapa bintang untuk staff ini?').setStringSelectMenuComponent(
                            new StringSelectMenuBuilder()
                                .setCustomId('rs-stars')
                                .setPlaceholder('Pilih bintang')
                                .addOptions(
                                    STAR_LABELS.map(([v, l]) =>
                                        new StringSelectMenuOptionBuilder().setValue(v).setLabel(l),
                                    ),
                                ),
                        ),
                        new LabelBuilder()
                            .setLabel('Alasan / Komentar (opsional)')
                            .setDescription('Ceritakan pengalamanmu dengan staff ini.')
                            .setTextInputComponent(
                                new TextInputBuilder()
                                    .setCustomId('rs-reason')
                                    .setStyle(TextInputStyle.Paragraph)
                                    .setPlaceholder('Contoh: Ramah, cepat menangani laporan, solusi jelas.')
                                    .setMaxLength(500)
                                    .setRequired(false),
                            ),
                        new LabelBuilder()
                            .setLabel('Kirim sebagai anonim?')
                            .setStringSelectMenuComponent(
                                new StringSelectMenuBuilder()
                                    .setCustomId('rs-anon')
                                    .setPlaceholder('Pilih')
                                    .addOptions(
                                        new StringSelectMenuOptionBuilder()
                                            .setValue('no')
                                            .setLabel('Tidak, tampilkan nama saya')
                                            .setDefault(true),
                                        new StringSelectMenuOptionBuilder()
                                            .setValue('yes')
                                            .setLabel('Ya, sembunyikan nama saya'),
                                    ),
                            ),
                    );

                await interaction.showModal(modal);
            } catch (err) {
                log(err.stack ?? err, 'err');
            }
        },
    };
}

module.exports = { makeSelectHandler, cfg };
