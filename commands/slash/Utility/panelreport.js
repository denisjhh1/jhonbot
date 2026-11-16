const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { TYPES, panelPayload } = require('../../../core/report-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panelreport')
        .setDescription('Menampilkan panel Report (admin / player / faction / bug).')
        .addStringOption((o) =>
            o
                .setName('jenis')
                .setDescription('Jenis panel report yang ingin dipasang di channel ini')
                .setRequired(true)
                .addChoices(...Object.entries(TYPES).map(([value, t]) => ({ name: t.label, value }))),
        ),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        const type = interaction.options.getString('jenis');
        await interaction.channel.send(panelPayload(type, interaction.guild));
        return interaction.reply({
            content: `✅ Panel ${TYPES[type].label} berhasil terpasang!`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
