const { SlashCommandBuilder, EmbedBuilder, MessageFlags, escapeMarkdown } = require('discord.js');
const core = require('../../../core/discordadmin-core');
const { log } = require('../../../functions');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('jail')
        .setDescription('Jail pemain dari Discord (untuk menangani report).')
        .addStringOption((o) =>
            o.setName('nama').setDescription('Nama karakter, contoh: Aldo_Romano').setRequired(true),
        )
        .addIntegerOption((o) =>
            o.setName('menit').setDescription('Lama jail (menit)').setMinValue(1).setMaxValue(100000).setRequired(true),
        )
        .addStringOption((o) => o.setName('alasan').setDescription('Alasan jail').setMaxLength(120).setRequired(true))
        .addIntegerOption((o) =>
            o
                .setName('denda')
                .setDescription('Denda dalam $ (0 / kosong = tanpa denda)')
                .setMinValue(0)
                .setMaxValue(1000000000),
        ),
    options: {
        cooldown: 3000,
    },

    run: async (client, interaction) => {
        if (!core.canJail(interaction)) {
            return interaction.reply({
                content: '❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply();
        const nameInput = interaction.options.getString('nama');
        const minutes = interaction.options.getInteger('menit');
        const reason = interaction.options.getString('alasan').trim();
        const denda = interaction.options.getInteger('denda') ?? 0;

        try {
            const res = await core.jail({ interaction, nameInput, minutes, denda, reason });
            if (res.error) return interaction.editReply(res.error);

            const { target, admin, online } = res;
            const lines = [
                `**Pemain:** ${escapeMarkdown(`${target.Char_Name}(${target.Char_UCP ?? '?'})`)}`,
                `**Durasi:** ${minutes} menit`,
                `**Denda:** ${denda > 0 ? core.fmtMoney(denda) : 'Tanpa denda'}`,
                `**Alasan:** ${escapeMarkdown(reason)}`,
                `**Oleh:** ${escapeMarkdown(admin.adminName)}`,
                `**Status:** ${online ? 'Pemain sedang online, dikirim ke server (diproses beberapa detik).' : 'Pemain offline, jail akan aktif saat login.'}`,
            ];
            const embed = new EmbedBuilder()
                .setTitle('🔒 Jail')
                .setDescription(lines.join('\n'))
                .setColor('Orange')
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
            return interaction.editReply('❌ Terjadi kesalahan saat memproses jail. Cek console bot.');
        }
    },
};
