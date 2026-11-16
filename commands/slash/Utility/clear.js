const { MessageFlags, SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');

const ALLOWED_ROLE_IDS = ['YOUR_DISCORD_ID'];
const MAX_AGE = 14 * 24 * 60 * 60 * 1000;

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Hapus sejumlah pesan terakhir di channel ini.')
        .setContexts(InteractionContextType.Guild)
        .addIntegerOption((o) =>
            o
                .setName('jumlah')
                .setDescription('Jumlah pesan yang dihapus (1-100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true),
        )
        .addUserOption((o) =>
            o.setName('user').setDescription('Hanya hapus pesan milik user ini (opsional)').setRequired(false),
        ),
    options: {
        cooldown: 3000,
    },

    run: async (client, interaction) => {
        const member = interaction.member;
        const allowed =
            member.permissions.has(PermissionFlagsBits.Administrator) ||
            member.permissions.has(PermissionFlagsBits.ManageMessages) ||
            ALLOWED_ROLE_IDS.some((id) => member.roles.cache.has(id));
        if (!allowed)
            return interaction.reply({
                content: '### 🔒 Khusus Staff\n> Kamu tidak punya izin untuk memakai perintah ini.',
                flags: MessageFlags.Ephemeral,
            });

        const channel = interaction.channel;
        if (!channel?.isTextBased() || typeof channel.bulkDelete !== 'function')
            return interaction.reply({
                content: '### ❌ Channel Tidak Didukung\n> Perintah ini hanya bisa dipakai di channel teks.',
                flags: MessageFlags.Ephemeral,
            });

        const me = interaction.guild.members.me ?? (await interaction.guild.members.fetchMe());
        if (
            !channel
                .permissionsFor(me)
                ?.has([PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory])
        )
            return interaction.reply({
                content:
                    '### ❌ Bot Tidak Punya Izin\n> Bot butuh izin **Manage Messages** dan **Read Message History** di channel ini.',
                flags: MessageFlags.Ephemeral,
            });

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const amount = interaction.options.getInteger('jumlah', true);
        const target = interaction.options.getUser('user');

        try {
            const fetched = await channel.messages.fetch({ limit: 100 });
            let pool = [...fetched.values()].filter((m) => !m.pinned);
            if (target) pool = pool.filter((m) => m.author.id === target.id);

            const eligible = pool.filter((m) => Date.now() - m.createdTimestamp < MAX_AGE - 60 * 1000);
            const toDelete = eligible.slice(0, amount);

            if (!toDelete.length)
                return interaction.editReply({
                    content:
                        '### ℹ️ Tidak Ada yang Dihapus\n> Tidak ada pesan yang memenuhi syarat (pesan yang di-pin atau lebih dari 14 hari tidak bisa dihapus).',
                });

            const deleted = await channel.bulkDelete(toDelete, true);

            const lines = [
                '### 🧹 Pesan Dibersihkan',
                `> **${deleted.size}** pesan${target ? ` milik <@${target.id}>` : ''} berhasil dihapus.`,
            ];
            if (deleted.size < amount) {
                lines.push(
                    target
                        ? '> ℹ️ Pencarian hanya mencakup **100 pesan terakhir**, dan pesan yang di-pin atau lebih dari 14 hari dilewati.'
                        : '> ℹ️ Pesan yang di-pin atau lebih dari 14 hari dilewati, atau channel memang tidak punya pesan sebanyak itu.',
                );
            }
            await interaction.editReply({ content: lines.join('\n'), allowedMentions: { parse: [] } });
        } catch (err) {
            console.error('[CLEAR]', err);
            await interaction.editReply({ content: `### ❌ Gagal Menghapus\n> ${String(err.message).slice(0, 300)}` });
        }
    },
};
