const { safe, reject, say } = require('../../core/req-core');

module.exports = {
    customId: 'modal-req-reject',
    run: safe(async (client, interaction) => {
        const num = Number(interaction.customId.split(':')[1]);
        const reason = interaction.fields.getTextInputValue('req-reject-reason').trim();
        if (!reason) return say(interaction, '❌ Alasan penolakan wajib diisi.');
        return reject(client, interaction, num, reason);
    }),
};
