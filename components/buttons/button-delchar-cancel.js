module.exports = {
    customId: 'delchar-cancel',

    run: async (client, interaction) => {
        await interaction.update({ content: 'Ditutup.', embeds: [], components: [] }).catch(() => {});
    },
};
