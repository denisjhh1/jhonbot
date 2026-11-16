const { EmbedBuilder } = require('discord.js');
const { drafts, canUpdate, versionExists, publish } = require('../../core/changelog-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'changelog-confirm',

    run: async (client, interaction) => {
        try {
            if (!canUpdate(interaction)) {
                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setDescription('❌ Kamu tidak punya izin untuk menambahkan changelog.'),
                    ],
                    components: [],
                });
            }

            const draft = drafts.get(interaction.user.id);
            if (!draft || draft.expires < Date.now()) {
                drafts.delete(interaction.user.id);
                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setDescription('⌛ Draft sudah kedaluwarsa. Klik tombol **Update** lagi.'),
                    ],
                    components: [],
                });
            }

            if (versionExists(draft.version)) {
                drafts.delete(interaction.user.id);
                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setDescription(`❌ Versi **${draft.version}** sudah pernah dirilis.`),
                    ],
                    components: [],
                });
            }

            await interaction.update({
                embeds: [new EmbedBuilder().setColor('Blue').setDescription('⏳ Mengirim changelog...')],
                components: [],
            });
            drafts.delete(interaction.user.id);

            try {
                const { channel, message, entry } = await publish(client, interaction, draft);
                log(`Changelog ${entry.version} dikirim oleh ${interaction.user.tag}`, 'done');
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Green')
                            .setDescription(
                                `✅ Changelog **${entry.version}** berhasil dikirim ke <#${channel.id}>.\n[Lihat pesan](${message.url})`,
                            ),
                    ],
                });
            } catch (err) {
                log(err.stack ?? err, 'err');
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setDescription(
                                `❌ Gagal mengirim changelog.\n\n**Penyebab:**\n\`\`\`${String(err.message).slice(0, 800)}\`\`\``,
                            ),
                    ],
                });
            }
        } catch (err) {
            log(err.stack ?? err, 'err');
        }
    },
};
