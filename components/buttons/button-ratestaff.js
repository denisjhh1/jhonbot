const { MessageFlags, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getStaff, levelName, cut } = require('../../core/ratestaff-core');
const { log } = require('../../functions');

const PER_MENU = 25;
const MAX_MENUS = 4;

module.exports = {
    customId: 'button-ratestaff',

    run: async (client, interaction) => {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const staff = (await getStaff()).slice(0, PER_MENU * MAX_MENUS);
            if (!staff.length) {
                return interaction.editReply({ content: '⚠️ Belum ada data staff yang bisa dinilai.' });
            }

            const rows = [];
            for (let i = 0; i * PER_MENU < staff.length; i++) {
                const chunk = staff.slice(i * PER_MENU, (i + 1) * PER_MENU);
                rows.push(
                    new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`ratestaff-select-${i}`)
                            .setPlaceholder(`Pilih staff (${i * PER_MENU + 1} – ${i * PER_MENU + chunk.length})`)
                            .addOptions(
                                chunk.map((s) => ({
                                    label: cut(s.name, 100),
                                    description: cut(`${levelName(s.level)} • ${s.charName}`, 100),
                                    value: s.id,
                                    emoji: '🛡️',
                                })),
                            ),
                    ),
                );
            }

            const embed = new EmbedBuilder()
                .setColor('#F1C40F')
                .setDescription(
                    '## ⭐ Pilih Staff\n### Staff mana yang ingin kamu nilai?\nPilih namanya dari daftar di bawah ini.',
                );

            return interaction.editReply({ embeds: [embed], components: rows });
        } catch (err) {
            log(err.stack ?? err, 'err');
            return interaction.editReply({ content: '❌ Gagal mengambil daftar staff dari database.' }).catch(() => {});
        }
    },
};
