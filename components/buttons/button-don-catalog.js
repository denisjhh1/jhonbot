const { MessageFlags, EmbedBuilder } = require('discord.js');
const { categorySelect, promoSummary } = require('../../core/donation-core');

module.exports = {
    customId: 'don-catalog',

    run: async (client, interaction) => {
        const embed = new EmbedBuilder()
            .setColor('Gold')
            .setTitle('📖 Katalog Donasi')
            .setDescription(
                'Pilih kategori untuk melihat daftar harga dan isinya.' +
                    (promoSummary() ? '\n\n' + promoSummary() : ''),
            );
        return interaction.reply({
            embeds: [embed],
            components: [categorySelect('don-cat:view')],
            flags: MessageFlags.Ephemeral,
        });
    },
};
