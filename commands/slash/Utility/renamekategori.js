const { SlashCommandBuilder, ChannelType, MessageFlags, PermissionFlagsBits } = require('discord.js');
const core = require('../../../core/renamecat-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('renamekategori')
        .setDescription('Ganti nama semua channel di satu kategori sesuai format (ada pratinjau dulu).')
        .addChannelOption((o) =>
            o
                .setName('kategori')
                .setDescription('Kategori yang channel-nya mau diganti')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true),
        )
        .addStringOption((o) =>
            o
                .setName('emoji')
                .setDescription(
                    `Emoji untuk {emoji}, contoh: 🧾. Kosongkan = emoji lama tiap channel tidak diubah (bawaan ${core.DEFAULT_EMOJI})`,
                )
                .setMaxLength(16),
        )
        .addStringOption((o) =>
            o
                .setName('format')
                .setDescription(`Bawaan: ${core.DEFAULT_FORMAT}  (kode: {emoji} dan {nama})`)
                .setMaxLength(80),
        )
        .addStringOption((o) =>
            o
                .setName('pemisah')
                .setDescription(`Pengganti "-" / spasi di nama. Bawaan: ${core.DEFAULT_SEP}`)
                .setMaxLength(3),
        ),
    options: {
        developers: true,
        cooldown: 5000,
    },

    run: async (client, interaction) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const category = interaction.options.getChannel('kategori');
        const emoji = (interaction.options.getString('emoji') ?? '').trim();
        const format = interaction.options.getString('format')?.trim() || core.DEFAULT_FORMAT;
        const sep = interaction.options.getString('pemisah') || core.DEFAULT_SEP;

        if (!category?.children) return interaction.editReply('❌ Pilih sebuah KATEGORI (bukan channel biasa).');
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.editReply('❌ Bot tidak punya izin **Manage Channels** di server ini.');
        }
        if (!format.includes('{nama}')) return interaction.editReply('❌ Format harus mengandung `{nama}`.');

        const plan = core.createPlan(category, { format, emoji, sep });
        if (!plan.length) return interaction.editReply('❌ Kategori itu tidak punya channel.');

        const token = core.register(interaction.user.id, category.id, plan);
        const note = emoji
            ? `Emoji: ${emoji} (emoji lama dibuang, hanya teks yang dipakai ulang)`
            : 'Emoji dikosongkan: emoji lama tiap channel dipertahankan.';
        return interaction.editReply(core.previewPayload(token, category, plan, note));
    },
};
