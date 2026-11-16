const { SlashCommandBuilder, AttachmentBuilder, MessageFlags, InteractionContextType } = require('discord.js');
const idcard = require('../../../core/idcard-core');
const { log } = require('../../../functions');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('idcard')
        .setDescription('Buat kartu identitas digital karakter (KTP / SIM / Paspor) berformat gambar PNG.')
        .setContexts(InteractionContextType.Guild)
        .addStringOption((o) =>
            o
                .setName('jenis')
                .setDescription('Jenis kartu')
                .setRequired(true)
                .addChoices(
                    { name: 'KTP (Kartu Tanda Penduduk)', value: 'ktp' },
                    { name: 'SIM (Surat Izin Mengemudi)', value: 'sim' },
                    { name: 'Paspor', value: 'paspor' },
                ),
        )
        .addStringOption((o) =>
            o
                .setName('karakter')
                .setDescription('Karakter yang dibuatkan kartu (kosong = karaktermu kalau hanya punya satu)')
                .setAutocomplete(true),
        )
        .addAttachmentOption((o) =>
            o.setName('foto').setDescription('Foto karakter sendiri (PNG/JPG). Kosong = foto skin karakter'),
        )
        .addBooleanOption((o) =>
            o.setName('privat').setDescription('Kartu hanya terlihat olehmu (bawaan: terlihat semua orang di channel)'),
        ),
    options: {
        cooldown: 10000,
    },

    run: async (client, interaction) => {
        if (idcard.config.enabled === false) {
            return interaction.reply({ content: '❌ Fitur ID Card sedang dimatikan.', flags: MessageFlags.Ephemeral });
        }
        const privat = interaction.options.getBoolean('privat') ?? false;
        await interaction.deferReply(privat ? { flags: MessageFlags.Ephemeral } : {});

        try {
            const kind = interaction.options.getString('jenis', true);
            const result = await idcard.generate(
                interaction,
                kind,
                interaction.options.getString('karakter'),
                interaction.options.getAttachment('foto'),
            );
            if (result.error) return interaction.editReply({ content: `❌ ${result.error}` });

            const name = String(result.char.Char_Name).replace(/_/g, ' ');
            return interaction.editReply({
                content: `🪪 **${result.label}** milik **${name}**`,
                files: [new AttachmentBuilder(result.png, { name: result.fileName })],
                allowedMentions: { parse: [] },
            });
        } catch (err) {
            log(err.stack ?? err, 'err');
            return interaction.editReply({
                content: '❌ Gagal membuat kartu. Coba lagi sebentar lagi, atau hubungi staff kalau terus terjadi.',
            });
        }
    },
};
