const { MessageFlags, ActionRowBuilder, UserSelectMenuBuilder } = require('discord.js');
const { safe, getTicket, canInvite, STAFF_ONLY } = require('../../core/report-core');

module.exports = {
    customId: 'report-invite',
    run: safe(async (client, interaction) => {
        const ticket = getTicket(interaction.channel);
        if (!ticket) return;
        if (!canInvite(interaction.member, ticket))
            return interaction.reply({ content: STAFF_ONLY, flags: MessageFlags.Ephemeral });

        const row = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId('report-invite-select')
                .setPlaceholder('Pilih orang yang ingin diundang ke case ini...')
                .setMinValues(1)
                .setMaxValues(10),
        );
        await interaction.reply({
            content:
                '## 👥 Invite to Case\n> Pilih satu atau lebih orang (maksimal 10). Mereka akan **bisa melihat dan menulis** di channel ini, termasuk melihat lampiran.',
            components: [row],
            flags: MessageFlags.Ephemeral,
        });
    }),
};
