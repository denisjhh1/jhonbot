const core = require('../../core/renamecat-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'rnk-ok',

    run: async (client, interaction) => {
        try {
            await interaction.update({ content: 'Sedang mengganti nama channel...', embeds: [], components: [] });
            const res = await core.execute(interaction, interaction.customId.split(':')[1]);
            if (res.error) return interaction.editReply({ content: `❌ ${res.error}` });

            const failed = res.failed
                .slice(0, 10)
                .map((f) => `• \`${f.name}\`: ${f.error}`)
                .join('\n');
            return interaction.editReply({
                content:
                    `✅ Selesai. **${res.ok}** diganti, **${res.skipped}** tidak berubah, **${res.failed.length}** gagal.` +
                    (failed
                        ? `\n${failed}${res.failed.length > 10 ? `\n+${res.failed.length - 10} lainnya` : ''}`
                        : ''),
            });
        } catch (err) {
            log(err.stack ?? String(err), 'err');
            await interaction.editReply({ content: '❌ Terjadi kesalahan. Cek console bot.' }).catch(() => {});
        }
    },
};
