const { Message } = require('discord.js');
const ExtendedClient = require('../../../class/Client');

module.exports = {
    structure: {
        name: 'ping',
        description: 'Replies with Pong!',
        aliases: ['p'],
        permissions: 'Administrator',
        cooldown: 5000,
    },

    run: async (client, message, args) => {
        await message.reply({
            content: 'Pong! ' + client.ws.ping,
        });
    },
};
