const { MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
    drafts,
    DRAFT_TTL,
    canUpdate,
    normalizeVersion,
    versionExists,
    buildEmbed,
} = require('../../core/changelog-core');
const { log } = require('../../functions');

module.exports = {
    customId: 'modal-changelog',

    run: async (client, interaction) => {
        try {
            if (!canUpdate(interaction)) {
                return interaction.reply({
                    content: '❌ Kamu tidak punya izin untuk menambahkan changelog.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const rawVersion = interaction.fields.getTextInputValue('cl-version');
            const title = interaction.fields.getTextInputValue('cl-title').trim();
            const changes = interaction.fields.getTextInputValue('cl-changes').trim();

            const version = normalizeVersion(rawVersion);
            if (!version) {
                return interaction.reply({
                    content: `❌ Format versi **${rawVersion}** tidak valid. Gunakan format seperti \`v1.0.0\`.`,
                    flags: MessageFlags.Ephemeral,
                });
            }
            if (versionExists(version)) {
                return interaction.reply({
                    content: `❌ Versi **${version}** sudah pernah dirilis. Gunakan nomor versi yang baru.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            drafts.set(interaction.user.id, { version, title, changes, expires: Date.now() + DRAFT_TTL });

            const { embed: preview, files } = await buildEmbed({
                version,
                title,
                changes,
                authorId: interaction.user.id,
                timestamp: Date.now(),
            });

            const info = new EmbedBuilder()
                .setColor('Orange')
                .setDescription(
                    '📋 **Pratinjau changelog.** Periksa kembali. Setelah dikonfirmasi, pesan akan dikirim ke channel changelog dan waktu update dicatat saat itu.',
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('changelog-confirm')
                    .setLabel('Konfirmasi & Kirim')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId('changelog-cancel')
                    .setLabel('Batal')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('✖️'),
            );

            return interaction.reply({
                embeds: [info, preview],
                files,
                components: [row],
                flags: MessageFlags.Ephemeral,
            });
        } catch (err) {
            log(err.stack ?? err, 'err');
        }
    },
};
