const { MessageFlags, EmbedBuilder } = require('discord.js');
const { state, STATUS, pad, rupiah } = require('../../core/donation-core');

module.exports = {
    customId: 'don-orders',

    run: async (client, interaction) => {
        const mine = Object.values(state.orders)
            .filter((o) => o.userId === interaction.user.id)
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 10);
        if (!mine.length)
            return interaction.reply({ content: 'Kamu belum punya pesanan donasi.', flags: MessageFlags.Ephemeral });

        const lines = mine.map((o) => {
            const open = interaction.guild.channels.cache.has(o.channelId);
            return `**#${pad(o.num)}** • ${STATUS[o.status].label}\n${o.items.map((i) => i.name + (i.qty > 1 ? ` ×${i.qty}` : '')).join(', ')} • ${o.total == null ? 'harga menyusul' : rupiah(o.total)}${open ? ` • <#${o.channelId}>` : ''}`;
        });
        const embed = new EmbedBuilder()
            .setTitle('🧾 Pesanan Saya')
            .setDescription(lines.join('\n\n').slice(0, 4000))
            .setColor('Gold');
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
