const { MessageFlags, EmbedBuilder } = require('discord.js');
const { getCat, categoryEmbed, categorySelect, itemSelect } = require('../../core/donation-core');

module.exports = {
    customId: 'don-cat',

    run: async (client, interaction) => {
        const mode = interaction.customId.split(':')[1];
        const key = interaction.values[0];
        if (!getCat(key))
            return interaction.reply({ content: 'Kategori tidak dikenal.', flags: MessageFlags.Ephemeral });

        if (mode === 'view')
            return interaction.update({
                embeds: [categoryEmbed(key)],
                components: [categorySelect('don-cat:view', 'Lihat kategori lain...')],
            });

        const embed = categoryEmbed(key).setFooter({ text: 'Pilih item yang ingin kamu beli di menu bawah.' });
        return interaction.update({
            embeds: [embed],
            components: [itemSelect(key), categorySelect('don-cat:buy', 'Ganti kategori...')],
        });
    },
};
