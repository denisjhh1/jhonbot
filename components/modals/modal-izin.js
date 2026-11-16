const { safe, submitRequest, reply } = require('../../core/izin-core');

module.exports = {
    customId: 'modal-izin',
    run: safe(async (client, interaction) => {
        const reason = interaction.fields.getTextInputValue('izin-reason').trim();
        const durKey = interaction.fields.getStringSelectValues('izin-duration')?.[0];
        if (!reason || !durKey) return reply(interaction, '❌ Form belum lengkap. Silakan ajukan ulang.');
        return submitRequest(client, interaction, reason, durKey);
    }),
};
