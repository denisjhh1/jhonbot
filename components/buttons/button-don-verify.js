const { MessageFlags } = require('discord.js');
const { getOrder, save, render, isStaff } = require('../../core/donation-core');

module.exports = {
    customId: 'don-verify',

    run: async (client, interaction) => {
        if (!isStaff(interaction.member))
            return interaction.reply({
                content: 'Hanya staff donasi yang bisa mengonfirmasi pembayaran.',
                flags: MessageFlags.Ephemeral,
            });
        const o = getOrder(interaction.channel.id);
        if (!o)
            return interaction.reply({ content: 'Data pesanan ini tidak ditemukan.', flags: MessageFlags.Ephemeral });
        if (o.status !== 'awaiting' && o.status !== 'paid')
            return interaction.reply({
                content: 'Pesanan ini tidak bisa dikonfirmasi pada statusnya sekarang.',
                flags: MessageFlags.Ephemeral,
            });

        o.status = 'confirmed';
        o.confirmedBy = interaction.user.id;
        save();
        await interaction.update(render(o));
        await interaction.channel.send({
            content: `✅ <@${o.userId}> pembayaranmu **dikonfirmasi** oleh <@${interaction.user.id}>. Pesananmu sedang diproses, staff akan menandai setelah item dikirim.`,
            allowedMentions: { users: [o.userId] },
        });
    },
};
