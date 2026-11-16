const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { panelPayload } = require('../../../core/req-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panelreq')
        .setDescription('Memasang panel utama Request Area (VIP / Ladies / Faction / Streamer / Workshop).')
        .addChannelOption((o) =>
            o.setName('channel').setDescription('Channel tujuan panel (kosong = channel ini)').setRequired(false),
        ),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        const channel = interaction.options.getChannel('channel') ?? interaction.channel;
        if (!channel?.isTextBased?.() || !channel.send)
            return interaction.reply({
                content: '❌ Channel tujuan harus berupa channel teks.',
                flags: MessageFlags.Ephemeral,
            });

        await channel.send(panelPayload(interaction.guild));
        return interaction.reply({
            content: `✅ Panel Request Area berhasil terpasang di <#${channel.id}>!`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
