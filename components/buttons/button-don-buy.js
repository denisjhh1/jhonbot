const { MessageFlags, EmbedBuilder } = require('discord.js');
const { categorySelect, promoSummary } = require('../../core/donation-core');

module.exports = {
    customId: 'don-buy',

    run: async (client, interaction) => {
        const embed = new EmbedBuilder()
            .setColor('Gold')
            .setTitle('🛒 Beli Donasi')
            .setDescription(
                'Pilih kategori donasi yang kamu inginkan.' + (promoSummary() ? '\n\n' + promoSummary() : ''),
            );
        return interaction.reply({
            embeds: [embed],
            components: [categorySelect('don-cat:buy')],
            flags: MessageFlags.Ephemeral,
        });
    },
};
