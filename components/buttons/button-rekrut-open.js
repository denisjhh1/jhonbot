const { safe, setOpen } = require('../../core/rekrut-core');

module.exports = {
    customId: 'rekrut-open',
    run: safe((client, interaction) => setOpen(client, interaction, true)),
};
