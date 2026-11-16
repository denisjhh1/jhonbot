const { MessageFlags } = require('discord.js');
const { ACTIONS, safe, getTicket, actionDenied, applyAction, noteModal, state } = require('../../core/refund-core');

module.exports = {
    customId: 'refund-act',
    run: safe(async (client, interaction) => {
        const key = interaction.customId.split(':')[1];
        const a = ACTIONS[key];
        const ticket = getTicket(interaction.channel);
        if (!a || !ticket) return;

        const denied = actionDenied(interaction.member, ticket, key);
        if (denied) return interaction.reply({ content: denied, flags: MessageFlags.Ephemeral });

        const rec = state.requests[ticket.num];
        if (rec && !a.from.includes(rec.status))
            return interaction.reply({
                content: '⚠️ Status pengajuan sudah berubah. Muat ulang tiketmu.',
                flags: MessageFlags.Ephemeral,
            });

        if (a.ask) return interaction.showModal(noteModal(key));
        return applyAction(interaction, key);
    }),
};
