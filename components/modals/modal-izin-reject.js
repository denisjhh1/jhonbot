const { safe, reject, reply } = require('../../core/izin-core');

module.exports = {
    customId: 'modal-izin-reject',
    run: safe(async (client, interaction) => {
        const num = Number(interaction.customId.split(':')[1]);
        const reason = interaction.fields.getTextInputValue('izin-reject-reason').trim();
        if (!reason) return reply(interaction, '❌ Alasan penolakan wajib diisi.');
        return reject(client, interaction, num, reason);
    }),
};
