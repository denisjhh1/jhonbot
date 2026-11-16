const { MessageFlags } = require('discord.js');
const def = require('../../defines');

module.exports = {
    customId: 'ip-copy',

    run: async (client, interaction) => {
        const { ip, port } = def.sserver;

        await interaction.reply({
            content: `📋 **IP Server**\n\`\`\`\n${ip}:${port}\n\`\`\``,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    },
};
