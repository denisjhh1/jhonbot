const { MessageFlags } = require('discord.js');
const { safe, getTicket, canInvite, STAFF_ONLY } = require('../../core/report-core');

module.exports = {
    customId: 'report-invite-select',
    run: safe(async (client, interaction) => {
        const ticket = getTicket(interaction.channel);
        if (!ticket) return;
        if (!canInvite(interaction.member, ticket))
            return interaction.reply({ content: STAFF_ONLY, flags: MessageFlags.Ephemeral });

        const users = interaction.users.filter((u) => !u.bot);
        if (!users.size)
            return interaction.update({
                content: '### ❌ Tidak Bisa Mengundang Bot\n> Pilih pemain atau staff.',
                components: [],
            });

        for (const user of users.values()) {
            await interaction.channel.permissionOverwrites.edit(
                user.id,
                {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    AttachFiles: true,
                    EmbedLinks: true,
                },
                { reason: `Invite to case oleh ${interaction.user.tag}` },
            );
        }

        const mentions = users.map((u) => `<@${u.id}>`).join(', ');
        await interaction.update({
            content: `### ✅ Undangan Berhasil\n> ${mentions} sekarang punya akses ke case ini.`,
            components: [],
        });
        await interaction.channel.send({
            content: `### 👥 Anggota Baru di Case\n> ${mentions} diundang oleh <@${interaction.user.id}>.\n> Mereka sekarang dapat melihat dan menulis di channel ini.`,
            allowedMentions: { users: users.map((u) => u.id) },
        });
    }),
};
