const { MessageFlags } = require('discord.js');
const { getOrder, save, render, isStaff } = require('../../core/donation-core');

module.exports = {
    customId: 'don-cancelorder',

    run: async (client, interaction) => {
        const o = getOrder(interaction.channel.id);
        if (!o)
            return interaction.reply({ content: 'Data pesanan ini tidak ditemukan.', flags: MessageFlags.Ephemeral });

        const staff = isStaff(interaction.member);
        const owner = interaction.user.id === o.userId;
        if (!staff && !owner)
            return interaction.reply({
                content: 'Hanya pemesan atau staff yang bisa membatalkan pesanan.',
                flags: MessageFlags.Ephemeral,
            });
        if (o.status === 'delivered' || o.status === 'cancelled')
            return interaction.reply({ content: 'Pesanan ini sudah selesai.', flags: MessageFlags.Ephemeral });
        if (!staff && o.status === 'confirmed')
            return interaction.reply({
                content: 'Pembayaran sudah dikonfirmasi. Hubungi staff di tiket ini kalau ingin membatalkan.',
                flags: MessageFlags.Ephemeral,
            });

        o.status = 'cancelled';
        o.cancelledBy = interaction.user.id;
        save();
        await interaction.update(render(o));
        await interaction.channel.send({
            content: `🚫 Pesanan dibatalkan oleh <@${interaction.user.id}>. Staff dapat menutup tiket ini.`,
            allowedMentions: { parse: [] },
        });
    },
};
