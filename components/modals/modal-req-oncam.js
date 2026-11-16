const { safe, callOncam, say } = require('../../core/req-core');

module.exports = {
    customId: 'modal-req-oncam',
    run: safe(async (client, interaction) => {
        const num = Number(interaction.customId.split(':')[1]);
        const text = interaction.fields.getTextInputValue('req-oncam-note').trim();
        if (!text) return say(interaction, '❌ Catatan wajib diisi.');
        return callOncam(client, interaction, num, text);
    }),
};
