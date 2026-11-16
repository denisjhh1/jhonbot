const { AutocompleteInteraction } = require('discord.js');
const ExtendedClient = require('../../class/Client');
const idcard = require('../../core/idcard-core');

module.exports = {
    commandName: 'idcard',
    options: {
        public: true,
    },

    run: async (client, interaction) => {
        try {
            const term = String(interaction.options.getFocused() ?? '').trim();
            let rows = await idcard.ownCharacters(interaction.user.id, term, 25);
            if (!rows.length && term.length >= 2 && idcard.isStaff(interaction))
                rows = await idcard.searchCharacters(term, 25);
            await interaction.respond(
                rows.map((r) => ({
                    name: String(r.name).replace(/_/g, ' ').slice(0, 100),
                    value: String(r.name).slice(0, 100),
                })),
            );
        } catch {
            await interaction.respond([]).catch(() => null);
        }
    },
};
