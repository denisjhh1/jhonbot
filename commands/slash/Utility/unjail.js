const { SlashCommandBuilder, EmbedBuilder, MessageFlags, escapeMarkdown } = require('discord.js');
const core = require('../../../core/discordadmin-core');
const { log } = require('../../../functions');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('unjail')
        .setDescription('Bebaskan pemain dari jail lewat Discord.')
        .addStringOption((o) =>
            o.setName('nama').setDescription('Nama karakter, contoh: Aldo_Romano').setRequired(true),
        )
        .addStringOption((o) =>
            o.setName('alasan').setDescription('Alasan unjail').setMaxLength(120).setRequired(true),
        ),
    options: {
        cooldown: 3000,
    },

    run: async (client, interaction) => {
        if (!core.canUnjail(interaction)) {
            return interaction.reply({
                content: '❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply();
        const nameInput = interaction.options.getString('nama');
        const reason = interaction.options.getString('alasan').trim();

        try {
            const res = await core.unjail({ interaction, nameInput, reason });
            if (res.error) return interaction.editReply(res.error);

            const { target, admin, online } = res;
            const lines = [
                `**Pemain:** ${escapeMarkdown(`${target.Char_Name}(${target.Char_UCP ?? '?'})`)}`,
                `**Alasan:** ${escapeMarkdown(reason)}`,
                `**Oleh:** ${escapeMarkdown(admin.adminName)}`,
                `**Status:** ${online ? 'Pemain sedang online, dikirim ke server (diproses beberapa detik).' : 'Pemain offline, jail sudah dicabut dari data karakter.'}`,
            ];
            const embed = new EmbedBuilder()
                .setTitle('🔓 Unjail')
                .setDescription(lines.join('\n'))
                .setColor('Green')
                .setFooter({ text: 'Management Server' })
                .setTimestamp();

            const logId = core.config.logChannelId;
            if (logId)
                client.channels
                    .fetch(logId)
                    .then((ch) => ch?.isTextBased() && ch.send({ embeds: [embed], allowedMentions: { parse: [] } }))
                    .catch(() => null);
            return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
        } catch (err) {
            log(err.stack ?? err, 'err');
            return interaction.editReply('❌ Terjadi kesalahan saat memproses unjail. Cek console bot.');
        }
    },
};
