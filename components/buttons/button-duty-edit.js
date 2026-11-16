const { ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const { getReport, canManage, fmtDur } = require('../../core/dutyreport-core');

module.exports = {
    customId: 'duty-edit',

    run: async (client, interaction) => {
        const r = getReport(interaction.message.id);
        if (!r)
            return interaction.reply({ content: 'Data laporan ini tidak ditemukan.', flags: MessageFlags.Ephemeral });
        if (!canManage(interaction.member, r))
            return interaction.reply({
                content: 'Hanya pemilik laporan atau Management yang bisa mengedit.',
                flags: MessageFlags.Ephemeral,
            });

        const input = (id, style, min, max, required, value) => {
            const t = new TextInputBuilder().setCustomId(id).setStyle(style).setMaxLength(max).setRequired(required);
            if (min) t.setMinLength(min);
            if (value) t.setValue(value);
            return t;
        };

        const modal = new ModalBuilder()
            .setCustomId(`modal-duty-edit:${interaction.message.id}`)
            .setTitle('Edit Laporan Duty')
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Pangkat')
                    .setTextInputComponent(input('duty-rank', TextInputStyle.Short, 0, 50, true, r.rank)),
                new LabelBuilder()
                    .setLabel('Durasi Duty')
                    .setTextInputComponent(input('duty-time', TextInputStyle.Short, 0, 30, true, fmtDur(r.minutes))),
                new LabelBuilder()
                    .setLabel('Aktivitas')
                    .setTextInputComponent(
                        input('duty-activity', TextInputStyle.Paragraph, 10, 1500, true, r.activity),
                    ),
                new LabelBuilder()
                    .setLabel('Catatan (opsional)')
                    .setTextInputComponent(input('duty-note', TextInputStyle.Paragraph, 0, 500, false, r.note)),
            );

        await interaction.showModal(modal);
    },
};
