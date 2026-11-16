const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const ai = require('../../../core/ai-core');

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('tanya')
        .setDescription('Tanya AI (Gemini). Tiap akun punya jeda antar pertanyaan.')
        .addStringOption((o) =>
            o
                .setName('pertanyaan')
                .setDescription('Apa yang ingin kamu tanyakan?')
                .setRequired(true)
                .setMaxLength(ai.cfg.maxPromptChars),
        )
        .addBooleanOption((o) => o.setName('privat').setDescription('Jawaban hanya terlihat olehmu (default: tidak)')),

    run: async (client, interaction) => {
        const eph = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

        if (!ai.cfg.enabled) return eph('🔒 Fitur AI sedang dinonaktifkan.');
        if (!ai.getKey()) return eph('❌ AI belum dikonfigurasi. Hubungi Developer.');
        if (ai.cfg.channelIds?.length && !ai.cfg.channelIds.includes(interaction.channelId))
            return eph(`💬 Fitur AI hanya bisa dipakai di ${ai.cfg.channelIds.map((id) => `<#${id}>`).join(', ')}.`);

        const prompt = interaction.options.getString('pertanyaan', true).trim();
        const privat = interaction.options.getBoolean('privat') ?? false;
        if (!prompt) return eph('❌ Pertanyaan tidak boleh kosong.');

        const lim = ai.precheck(interaction.user.id);
        if (!lim.ok) return eph(lim.msg);

        await interaction.deferReply(privat ? { flags: MessageFlags.Ephemeral } : {});
        const result = await ai.ask(interaction.user.id, prompt);

        if (!result.ok) return interaction.editReply({ content: result.msg });

        const header = `> 💬 **${interaction.user.displayName ?? interaction.user.username}:** ${ai.cut(prompt.replace(/\n/g, ' '), 200)}\n\n`;
        return interaction.editReply({
            content: header + ai.cut(result.text, 2000 - header.length),
            allowedMentions: { parse: [] },
        });
    },
};
