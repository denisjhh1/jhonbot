const { MessageFlags, EmbedBuilder } = require('discord.js');
const { isStaff, activeDiscounts, categories } = require('../../core/donation-core');

module.exports = {
    customId: 'disc-list',

    run: async (client, interaction) => {
        if (!isStaff(interaction.member))
            return interaction.reply({
                content: 'Hanya staff donasi yang bisa melihat pengaturan diskon.',
                flags: MessageFlags.Ephemeral,
            });

        const list = activeDiscounts();
        if (!list.length)
            return interaction.reply({ content: 'Tidak ada diskon yang sedang aktif.', flags: MessageFlags.Ephemeral });

        const lines = list.map(
            (d) =>
                `**${d.label || 'PROMO DISKON'} −${d.percent}%** \`${d.id}\`\n` +
                `Kategori: ${d.cats === 'all' ? 'semua' : d.cats.map((c) => categories[c]?.label ?? c).join(', ')}\n` +
                `${d.until ? `Berakhir <t:${d.until}:R>` : 'Tanpa batas waktu'} • dibuat oleh <@${d.by}>`,
        );
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Orange')
                    .setTitle('📋 Diskon Aktif')
                    .setDescription(lines.join('\n\n').slice(0, 4000)),
            ],
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    },
};
