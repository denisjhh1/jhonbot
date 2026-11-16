const { MessageFlags } = require('discord.js');
const { safe, checkLimits, categorySelect } = require('../../core/refund-core');
const { IntError } = require('../../functions');

module.exports = {
    customId: 'refund-open',
    run: safe(async (client, interaction) => {
        const limitMsg = checkLimits(interaction.user);
        if (limitMsg) return IntError(interaction, limitMsg);

        await interaction.reply({
            content:
                '## 💸 Ajukan Refund\n> Pilih **kategori** yang paling sesuai. Setelah itu kamu akan mengisi form dan melampirkan bukti.',
            components: [categorySelect()],
            flags: MessageFlags.Ephemeral,
        });
    }),
};
