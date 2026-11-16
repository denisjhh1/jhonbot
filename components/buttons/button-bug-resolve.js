const { MessageFlags, EmbedBuilder } = require('discord.js');
const { isStaff, staffButtons, TOPIC_PREFIX } = require('../../core/bugreport-core');

module.exports = {
    customId: 'bug-resolve',

    run: async (client, interaction) => {
        if (!interaction.channel?.topic?.startsWith(TOPIC_PREFIX)) return;
        if (!isStaff(interaction.member))
            return interaction.reply({
                content: 'Hanya Admin/Developer yang bisa memakai tombol ini.',
                flags: MessageFlags.Ephemeral,
            });

        const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor('Green');
        const f = embed.data.fields.find((x) => x.name.includes('Status'));
        if (f) f.value = `🟢 Selesai oleh <@${interaction.user.id}>`;
        await interaction.update({ embeds: [embed], components: [staffButtons(true)] });
        await interaction.channel.send(
            '✅ Laporan ini ditandai **selesai**. Klik **Tutup Channel** jika sudah tidak diperlukan.',
        );
        interaction.channel.setName(interaction.channel.name.replace(/^bug-/, 'solved-')).catch(() => {});
    },
};
