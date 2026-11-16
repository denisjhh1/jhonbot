const { MessageFlags, EmbedBuilder } = require('discord.js');
const { getOrder, save, render, isStaff, sendLog, pad, rupiah, lineText } = require('../../core/donation-core');

module.exports = {
    customId: 'don-done',

    run: async (client, interaction) => {
        if (!isStaff(interaction.member))
            return interaction.reply({
                content: 'Hanya staff donasi yang bisa menandai pesanan terkirim.',
                flags: MessageFlags.Ephemeral,
            });
        const o = getOrder(interaction.channel.id);
        if (!o)
            return interaction.reply({ content: 'Data pesanan ini tidak ditemukan.', flags: MessageFlags.Ephemeral });
        if (o.status !== 'confirmed')
            return interaction.reply({
                content: 'Konfirmasi pembayaran dulu sebelum menandai terkirim.',
                flags: MessageFlags.Ephemeral,
            });

        o.status = 'delivered';
        o.deliveredBy = interaction.user.id;
        o.deliveredAt = Math.floor(Date.now() / 1000);
        save();
        await interaction.update(render(o));
        await interaction.channel.send({
            content: `📦 <@${o.userId}> pesananmu **sudah dikirim** oleh <@${interaction.user.id}>. Terima kasih sudah berdonasi! Silakan cek di dalam game, dan beri tahu staff kalau ada kendala.`,
            allowedMentions: { users: [o.userId] },
        });

        const receipt = new EmbedBuilder()
            .setColor('Green')
            .setTitle(`✅ Pesanan Donasi #${pad(o.num)} Selesai`)
            .setDescription(o.items.map(lineText).join('\n'))
            .addFields(
                { name: 'Total', value: o.total == null ? '-' : rupiah(o.total), inline: true },
                { name: 'Pemesan', value: `<@${o.userId}> (${o.ic})`, inline: true },
                { name: 'Dikirim oleh', value: `<@${interaction.user.id}>`, inline: true },
            )
            .setTimestamp();
        await sendLog(interaction.guild, receipt);
        const user = await client.users.fetch(o.userId).catch(() => null);
        await user
            ?.send({ embeds: [receipt.setTitle(`✅ Donasi #${pad(o.num)} Selesai — ${interaction.guild.name}`)] })
            .catch(() => {});
    },
};
