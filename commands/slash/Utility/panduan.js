const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { TOPICS, payload } = require('../../../core/panduan-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panduan')
        .setDescription('Menampilkan panduan penggunaan fitur-fitur bot.')
        .addStringOption((o) =>
            o
                .setName('topik')
                .setDescription('Langsung buka topik tertentu (opsional)')
                .setRequired(false)
                .addChoices(...Object.entries(TOPICS).map(([value, t]) => ({ name: t.label, value }))),
        ),
    options: {
        cooldown: 5000,
    },

    run: async (client, interaction) => {
        const topic = interaction.options.getString('topik') ?? 'home';
        return interaction.reply({ ...payload(topic), flags: MessageFlags.Ephemeral });
    },
};
