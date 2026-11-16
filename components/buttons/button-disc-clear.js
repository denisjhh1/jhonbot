const { MessageFlags, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { isStaff, activeDiscounts } = require('../../core/donation-core');

module.exports = {
    customId: 'disc-clear',

    run: async (client, interaction) => {
        if (!isStaff(interaction.member))
            return interaction.reply({
                content: 'Hanya staff donasi yang bisa menghapus diskon.',
                flags: MessageFlags.Ephemeral,
            });

        const list = activeDiscounts();
        if (!list.length)
            return interaction.reply({ content: 'Tidak ada diskon yang sedang aktif.', flags: MessageFlags.Ephemeral });

        const options = [
            ...list.slice(0, 24).map((d) => ({
                label: `${d.label || 'PROMO DISKON'} −${d.percent}%`.slice(0, 100),
                value: d.id,
                description: `ID ${d.id}`,
            })),
            { label: 'Hapus SEMUA diskon', value: '__all', emoji: '🗑️' },
        ];
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('disc-remove')
                .setPlaceholder('Pilih diskon yang dihapus...')
                .addOptions(options),
        );
        return interaction.reply({
            content: 'Pilih diskon yang ingin dihentikan:',
            components: [row],
            flags: MessageFlags.Ephemeral,
        });
    },
};
