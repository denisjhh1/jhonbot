const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { postPanel } = require('../../../core/ratestaff-core');
const { log } = require('../../../functions');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('panelratestaff')
        .setDescription('Memasang panel Rate Staff beserta leaderboard yang selalu ter-update.'),
    options: {
        ownerOnly: true,
        developers: true,
    },

    run: async (client, interaction) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            await postPanel(interaction.channel);
            return interaction.editReply(
                '✅ Panel Rate Staff terpasang. Leaderboard di dalamnya akan ter-update otomatis setiap ada penilaian baru.',
            );
        } catch (err) {
            log(err.stack ?? err, 'err');
            return interaction.editReply(`❌ Gagal memasang panel: ${err.message}`);
        }
    },
};
