const { safe, handleModal } = require('../../core/req-core');

module.exports = {
    customId: 'modal-req',
    run: safe(async (client, interaction) => {
        const [, type, step] = interaction.customId.split(':');
        return handleModal(client, interaction, type, Number(step));
    }),
};
