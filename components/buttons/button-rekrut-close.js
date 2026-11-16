const { safe, setOpen } = require('../../core/rekrut-core');

module.exports = {
    customId: 'rekrut-close',
    run: safe((client, interaction) => setOpen(client, interaction, false)),
};
