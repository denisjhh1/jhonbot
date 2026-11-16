const { MessageFlags, EmbedBuilder } = require('discord.js');
const { getOrder, save, isStaff, sendLog, pad, STATUS } = require('../../core/donation-core');

module.exports = {
    customId: 'don-close',

    run: async (client, interaction) => {
        const o = getOrder(interaction.channel.id);
        if (!o)
            return interaction.reply({ content: 'Data pesanan ini tidak ditemukan.', flags: MessageFlags.Ephemeral });
        if (!isStaff(interaction.member))
            return interaction.reply({
                content: 'Hanya staff donasi yang bisa menutup tiket.',
                flags: MessageFlags.Ephemeral,
            });

        if (o.status !== 'delivered' && o.status !== 'cancelled') {
            o.status = 'cancelled';
            o.cancelledBy = interaction.user.id;
        }
        o.closedAt = Math.floor(Date.now() / 1000);
        save();

        await sendLog(
            interaction.guild,
            new EmbedBuilder()
                .setColor('Grey')
                .setTitle(`🔒 Tiket Donasi #${pad(o.num)} ditutup`)
                .setDescription(
                    `Pemesan: <@${o.userId}> (${o.ic})\nStatus akhir: ${STATUS[o.status].label}\nDitutup oleh: <@${interaction.user.id}>`,
                )
                .setTimestamp(),
        );

        await interaction.reply({ content: '🔒 Tiket akan dihapus dalam 5 detik...' });
        setTimeout(
            () => interaction.channel.delete(`Tiket donasi ditutup oleh ${interaction.user.tag}`).catch(() => {}),
            5000,
        );
    },
};
