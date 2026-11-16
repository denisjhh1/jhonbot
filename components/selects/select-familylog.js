const { MessageFlags } = require('discord.js');
const { log } = require('../../functions');
const familylog = require('../../core/familylog-core');

module.exports = {
    customId: familylog.SELECT_ID,

    run: async (client, interaction) => {
        try {
            if (!familylog.canView(interaction.member)) {
                return await interaction.reply({
                    content: '❌ Kamu tidak punya akses untuk melihat log families.',
                    flags: MessageFlags.Ephemeral,
                });
            }
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            await interaction.editReply(await familylog.logPayload(interaction.values[0], 0));

            interaction.message.edit({ components: interaction.message.components }).catch(() => null);
        } catch (err) {
            log(err.stack ?? err, 'err');
            const msg = {
                content: '❌ Gagal membaca log families. Coba lagi sebentar lagi.',
                flags: MessageFlags.Ephemeral,
            };
            if (interaction.deferred || interaction.replied)
                await interaction.editReply({ content: msg.content, embeds: [], components: [] }).catch(() => null);
            else await interaction.reply(msg).catch(() => null);
        }
    },
};
