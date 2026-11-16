const { ModalSubmitInteraction } = require('discord.js');
const ExtendedClient = require('../../class/Client');

module.exports = {
    customId: 'modal-example',

    run: async (client, interaction) => {
        const nameInput = interaction.fields.getTextInputValue('name');

        await interaction.reply({
            content: `Hey **${nameInput}**, what's up?`,
        });
    },
};
