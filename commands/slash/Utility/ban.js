const { SlashCommandBuilder, EmbedBuilder, MessageFlags, escapeMarkdown } = require('discord.js');
const core = require('../../../core/discordadmin-core');
const { log } = require('../../../functions');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban akun pemain dari Discord (untuk menangani report).')
        .addStringOption((o) =>
            o.setName('nama').setDescription('Nama karakter, contoh: Aldo_Romano').setRequired(true),
        )
        .addIntegerOption((o) =>
            o
                .setName('hari')
                .setDescription('Lama ban dalam hari (0 = permanent)')
                .setMinValue(0)
                .setMaxValue(3650)
                .setRequired(true),
        )
        .addStringOption((o) => o.setName('alasan').setDescription('Alasan ban').setMaxLength(120).setRequired(true)),
    options: {
        cooldown: 3000,
    },

    run: async (client, interaction) => {
        if (!core.canBan(interaction)) {
            return interaction.reply({
                content: '❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply();
        const nameInput = interaction.options.getString('nama');
        const days = interaction.options.getInteger('hari');
        const reason = interaction.options.getString('alasan').trim();

        try {
            const res = await core.ban({ interaction, nameInput, days, reason });
            if (res.error) return interaction.editReply(res.error);

            const { target, admin, online, expire } = res;
            const lines = [
                `**Pemain:** ${escapeMarkdown(`${target.Char_Name}(${target.Char_UCP ?? '?'})`)}`,
                `**Durasi:** ${days > 0 ? `${days} hari (berakhir <t:${expire}:F>)` : 'Permanent'}`,
                `**Alasan:** ${escapeMarkdown(reason)}`,
                `**Oleh:** ${escapeMarkdown(admin.adminName)}`,
                `**Status:** ${online ? 'Pemain sedang online, perintah kick dikirim ke server.' : 'Pemain offline, tidak bisa login selama ban aktif.'}`,
            ];
            const embed = new EmbedBuilder()
                .setTitle('🔨 Ban')
                .setDescription(lines.join('\n'))
                .setColor('Red')
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
            return interaction.editReply('❌ Terjadi kesalahan saat memproses ban. Cek console bot.');
        }
    },
};
