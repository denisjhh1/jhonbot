const { ACTIONS, safe, applyAction } = require('../../core/refund-core');

module.exports = {
    customId: 'refund-act',
    run: safe(async (client, interaction) => {
        const key = interaction.customId.split(':')[1];
        if (!ACTIONS[key]?.ask) return;
        const note = (interaction.fields.getTextInputValue('note') ?? '').trim();
        return applyAction(interaction, key, note);
    }),
};
