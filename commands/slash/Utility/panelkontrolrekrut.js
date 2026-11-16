const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { controlPayload, registerControlPanel } = require('../../../core/rekrut-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panelkontrolrekrut')
        .setDescription('Memasang panel Buka/Tutup Rekrutmen di channel ini (pasang di channel staff).'),
    options: {
        developers: true,
    },

    run: async (client, interaction) => {
        const msg = await interaction.channel.send(controlPayload());
        registerControlPanel(msg);
        return interaction.reply({
            content: '✅ Panel Kontrol Rekrutmen terpasang. Pastikan channel ini hanya bisa dilihat Owner/Developer.',
            flags: MessageFlags.Ephemeral,
        });
    },
};
