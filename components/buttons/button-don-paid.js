const { MessageFlags } = require('discord.js');
const { getOrder, save, render, cfg } = require('../../core/donation-core');

module.exports = {
    customId: 'don-paid',

    run: async (client, interaction) => {
        const o = getOrder(interaction.channel.id);
        if (!o)
            return interaction.reply({ content: 'Data pesanan ini tidak ditemukan.', flags: MessageFlags.Ephemeral });
        if (interaction.user.id !== o.userId)
            return interaction.reply({
                content: 'Hanya pemesan yang bisa memakai tombol ini.',
                flags: MessageFlags.Ephemeral,
            });
        if (o.status !== 'awaiting' || o.total == null)
            return interaction.reply({
                content: 'Tombol ini tidak tersedia untuk status pesanan saat ini.',
                flags: MessageFlags.Ephemeral,
            });

        o.status = 'paid';
        o.paidAt = Math.floor(Date.now() / 1000);
        save();
        await interaction.update(render(o));

        const roles = (cfg.staffRoleIds ?? []).filter(Boolean);
        await interaction.channel.send({
            content: `${roles.map((id) => `<@&${id}>`).join(' ')} 💸 <@${o.userId}> menandai pesanan **sudah dibayar**. Mohon periksa bukti pembayaran lalu klik **Konfirmasi Pembayaran**.`,
            allowedMentions: { roles },
        });
    },
};
