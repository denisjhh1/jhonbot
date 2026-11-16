const { SlashCommandBuilder, EmbedBuilder, MessageFlags, escapeMarkdown } = require('discord.js');
const core = require('../../../core/discordadmin-core');
const { log } = require('../../../functions');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Cabut ban akun pemain dari Discord.')
        .addStringOption((o) =>
            o.setName('nama').setDescription('Nama karakter, contoh: Aldo_Romano').setRequired(true),
        )
        .addStringOption((o) => o.setName('alasan').setDescription('Alasan unban').setMaxLength(120).setRequired(true)),
    options: {
        cooldown: 3000,
    },

    run: async (client, interaction) => {
        if (!core.canUnban(interaction)) {
            return interaction.reply({
                content: '❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply();
        const nameInput = interaction.options.getString('nama');
        const reason = interaction.options.getString('alasan').trim();

        try {
            const res = await core.unban({ interaction, nameInput, reason });
            if (res.error) return interaction.editReply(res.error);

            const { target, admin, removed, previous } = res;
            const lines = [
                `**Pemain:** ${escapeMarkdown(`${target.Char_Name}(${target.Char_UCP ?? '?'})`)}`,
                `**Ban sebelumnya:** ${previous.ban_expire > 0 ? `sampai <t:${previous.ban_expire}:F>` : 'Permanent'} oleh ${escapeMarkdown(String(previous.admin))}`,
                `**Alasan ban awal:** ${escapeMarkdown(String(previous.reason))}`,
                `**Alasan unban:** ${escapeMarkdown(reason)}`,
                `**Oleh:** ${escapeMarkdown(admin.adminName)}`,
                `**Status:** ${removed} ban aktif dicabut, pemain sudah bisa login kembali.`,
            ];
            const embed = new EmbedBuilder()
                .setTitle('🔓 Unban')
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
            return interaction.editReply('❌ Terjadi kesalahan saat memproses unban. Cek console bot.');
        }
    },
};
