const { MessageFlags } = require('discord.js');
const { log } = require('../../functions');
const familylog = require('../../core/familylog-core');

module.exports = {
    customId: familylog.PAGE_ID,

    run: async (client, interaction) => {
        try {
            if (!familylog.canView(interaction.member)) {
                return await interaction.reply({
                    content: '❌ Kamu tidak punya akses untuk melihat log families.',
                    flags: MessageFlags.Ephemeral,
                });
            }
            const [, famId, page] = interaction.customId.split(':');
            await interaction.update(await familylog.logPayload(famId, Number(page)));
        } catch (err) {
            log(err.stack ?? err, 'err');
            if (!interaction.replied && !interaction.deferred) {
                await interaction
                    .reply({ content: '❌ Gagal membaca log families.', flags: MessageFlags.Ephemeral })
                    .catch(() => null);
            }
        }
    },
};
