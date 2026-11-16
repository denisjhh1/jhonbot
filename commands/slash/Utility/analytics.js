const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const def = require('../../../defines');
const analytics = require('../../../core/analytics-core');
const chart = require('../../../core/analytics-chart');
const { log } = require('../../../functions');

const { cfg, TICKET_LABELS } = analytics;
const S = chart.C.series;

const tzName =
    { 7: 'WIB', 8: 'WITA', 9: 'WIT' }[cfg.utcOffsetHours] ??
    `UTC${cfg.utcOffsetHours >= 0 ? '+' : ''}${cfg.utcOffsetHours}`;

const num = (n, d = 0) =>
    n === null || n === undefined
        ? '-'
        : Number(n).toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: d });
const signed = (n) => (n === null || n === undefined ? '-' : `${n > 0 ? '+' : ''}${num(n)}`);
const pct = (delta, base) =>
    delta === null || !base ? '' : ` (${delta >= 0 ? '+' : ''}${((delta / base) * 100).toFixed(1).replace('.', ',')}%)`;
const hh = (h) => `${String(h).padStart(2, '0')}:00`;
const dm = (key) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

const VIEWS = {
    ringkasan: 'Ringkasan semua statistik',
    pemain: 'Pemain harian, pemain unik & pemain baru',
    jam: 'Jam ramai (rata-rata pemain tiap jam)',
    tiket: 'Jumlah tiket per jenis',
    pertumbuhan: 'Pertumbuhan komunitas (Discord & akun UCP)',
};

const playersPanel = (sum) => ({
    type: 'line',
    title: 'PEMAIN HARIAN',
    labels: sum.series.map((s) => dm(s.date)),
    series: [
        { name: 'PUNCAK', color: S[0], values: sum.series.map((s) => s.peak) },
        {
            name: 'RATA-RATA',
            color: S[1],
            values: sum.series.map((s) => (s.avg === null ? null : Math.round(s.avg * 10) / 10)),
        },
        { name: 'UNIK', color: S[2], values: sum.series.map((s) => s.uniq) },
    ],
});

const newPlayersPanel = (sum) => ({
    type: 'bar',
    title: 'PEMAIN BARU PER HARI',
    labels: sum.series.map((s) => dm(s.date)),
    series: [
        { name: 'REGISTRASI UCP', color: S[0], values: sum.series.map((s) => s.regs) },
        { name: 'PERTAMA MASUK GAME', color: S[2], values: sum.series.map((s) => s.newGame ?? 0) },
    ],
});

const hoursPanel = (profile, days) => {
    const top = profile.top.slice(0, 1).map((t) => t.hour);
    return {
        type: 'bar',
        title: `JAM RAMAI - RATA-RATA PEMAIN ${days} HARI ${tzName}`,
        labels: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')),
        series: [
            { name: 'PEMAIN', color: S[0], values: profile.avg.map((v) => (v === null ? 0 : Math.round(v * 10) / 10)) },
        ],
        valueLabels: top,
    };
};

const ticketsPanel = (sum) => {
    const types = Object.keys(TICKET_LABELS);
    return {
        type: 'bar',
        stacked: true,
        title: 'TIKET DIBUAT PER HARI',
        labels: sum.series.map((s) => dm(s.date)),
        series: types.map((t, i) => ({
            name: TICKET_LABELS[t],
            color: S[i % S.length],
            values: sum.series.map((s) => s.tickets[t] ?? 0),
        })),
    };
};

const growthPanels = (sum) => [
    {
        type: 'line',
        area: true,
        zeroBase: false,
        title: 'MEMBER DISCORD',
        labels: sum.series.map((s) => dm(s.date)),
        series: [{ name: 'MEMBER', color: S[0], values: sum.series.map((s) => s.members) }],
    },
    {
        type: 'line',
        area: true,
        zeroBase: false,
        title: 'AKUN UCP TERDAFTAR',
        labels: sum.series.map((s) => dm(s.date)),
        series: [{ name: 'UCP', color: S[2], values: sum.series.map((s) => s.ucp) }],
    },
];

function ticketLines(sum) {
    const lines = Object.entries(TICKET_LABELS).map(([k, label]) => `${label}: **${num(sum.tickets[k] ?? 0)}**`);
    return lines.join('\n');
}

function buildEmbed(view, sum, profile) {
    const e = new EmbedBuilder()
        .setColor('Blurple')
        .setThumbnail(def.icon?.thumbnail ?? null)
        .setImage('attachment://analytics.png')
        .setTimestamp();

    const since = Math.floor(sum.trackingSince / 1000);
    const days = sum.days;
    const topHours = profile.top.length
        ? profile.top
              .map((t) => `**${hh(t.hour)}-${hh((t.hour + 1) % 24)}** (rata-rata ${num(t.avg, 1)} pemain)`)
              .join('\n')
        : '_Belum cukup data._';

    const growthText = (label, now, delta, start) =>
        now === null
            ? `${label}: _belum ada data_`
            : `${label}: **${num(now)}** ${delta === null ? '' : `\n${signed(delta)}${pct(delta, start)} dalam ${days} hari`}`;

    if (view === 'ringkasan') {
        e.setTitle(`📊 EXPENSIVE ANALYTICS - ${days} HARI TERAKHIR`).addFields(
            {
                name: '👥 Pemain',
                value: `Puncak rata-rata: **${num(sum.avgPeak, 1)}**\nRekor: **${sum.bestDay ? `${num(sum.bestDay.peak)}** (${dm(sum.bestDay.date)})` : '-**'}\nUnik/hari: **${num(sum.avgUniq, 1)}**`,
                inline: true,
            },
            {
                name: '🆕 Pemain Baru',
                value: `Registrasi UCP: **${num(sum.regs)}**\nPertama masuk game: **${num(sum.newGame)}**`,
                inline: true,
            },
            { name: '🎫 Tiket', value: `Total: **${num(sum.ticketTotal)}**\n${ticketLines(sum)}`, inline: true },
            { name: '🕘 Jam Ramai', value: topHours, inline: true },
            {
                name: '📈 Pertumbuhan',
                value: `${growthText('Discord', sum.members, sum.memberDelta, sum.memberStart)}\n${growthText('Akun UCP', sum.ucp, sum.ucpDelta, sum.ucpStart)}`,
                inline: true,
            },
            {
                name: '🟢 Uptime Server',
                value: sum.uptime === null ? '-' : `**${sum.uptime.toFixed(1).replace('.', ',')}%**`,
                inline: true,
            },
        );
    } else if (view === 'pemain') {
        e.setTitle(`👥 STATISTIK PEMAIN - ${days} HARI`).addFields(
            { name: 'Puncak rata-rata', value: `**${num(sum.avgPeak, 1)}** pemain/hari`, inline: true },
            {
                name: 'Rekor',
                value: sum.bestDay ? `**${num(sum.bestDay.peak)}** pada ${dm(sum.bestDay.date)}` : '-',
                inline: true,
            },
            { name: 'Pemain unik/hari', value: `**${num(sum.avgUniq, 1)}**`, inline: true },
            { name: 'Registrasi UCP baru', value: `**${num(sum.regs)}**`, inline: true },
            { name: 'Pertama kali masuk game', value: `**${num(sum.newGame)}**`, inline: true },
            { name: 'Unik hari ini', value: `**${num(sum.todayUniq)}**`, inline: true },
        );
    } else if (view === 'jam') {
        e.setTitle(`🕘 JAM RAMAI - ${days} HARI (${tzName})`).setDescription(
            `**3 jam tersibuk**\n${topHours}${profile.quietest ? `\n\n**Paling sepi**\n${hh(profile.quietest.hour)}-${hh((profile.quietest.hour + 1) % 24)} (rata-rata ${num(profile.quietest.avg, 1)} pemain)` : ''}`,
        );
    } else if (view === 'tiket') {
        e.setTitle(`🎫 STATISTIK TIKET - ${days} HARI`).setDescription(
            `Total tiket dibuat: **${num(sum.ticketTotal)}**\n\n${ticketLines(sum)}`,
        );
    } else {
        e.setTitle(`📈 PERTUMBUHAN KOMUNITAS - ${days} HARI`).addFields(
            {
                name: 'Member Discord',
                value: growthText('Sekarang', sum.members, sum.memberDelta, sum.memberStart),
                inline: true,
            },
            { name: 'Akun UCP', value: growthText('Sekarang', sum.ucp, sum.ucpDelta, sum.ucpStart), inline: true },
        );
    }

    const note =
        sum.daysWithData < days
            ? `Data baru tercatat ${sum.daysWithData} dari ${days} hari (analytics aktif sejak <t:${since}:D>). Grafik makin lengkap seiring waktu.`
            : `Analytics aktif sejak <t:${since}:D>.`;
    e.addFields({ name: '​', value: `*${note}*` });
    e.setFooter({ text: 'Expensive Analytics', iconURL: def.icon?.thumbnail });
    return e;
}

module.exports = {
    structure: new SlashCommandBuilder()
        .setName('analytics')
        .setDescription('Statistik komunitas: pemain harian, jam ramai, pemain baru, tiket & pertumbuhan.')
        .addStringOption((o) =>
            o
                .setName('tampilan')
                .setDescription('Bagian statistik yang ditampilkan (default: ringkasan)')
                .addChoices(
                    ...Object.entries(VIEWS).map(([value, name]) => ({
                        name: `${value} - ${name}`.slice(0, 100),
                        value,
                    })),
                ),
        )
        .addIntegerOption((o) =>
            o
                .setName('hari')
                .setDescription('Rentang waktu (default 14 hari)')
                .addChoices(
                    { name: '7 hari', value: 7 },
                    { name: '14 hari', value: 14 },
                    { name: '30 hari', value: 30 },
                    { name: '90 hari', value: 90 },
                ),
        ),
    options: {
        cooldown: 5000,
    },

    run: async (client, interaction) => {
        if (!analytics.canUse(interaction)) {
            return interaction.reply({
                content: 'Kamu tidak memiliki izin untuk menggunakan perintah ini.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags: cfg.ephemeral ? MessageFlags.Ephemeral : undefined });

        try {
            const view = interaction.options.getString('tampilan') ?? 'ringkasan';
            const days = interaction.options.getInteger('hari') ?? 14;

            const sum = analytics.getSummary(days);
            const profile = analytics.getHourProfile(days);

            const panels = {
                ringkasan: () => [playersPanel(sum), growthPanels(sum)[0]],
                pemain: () => [playersPanel(sum), newPlayersPanel(sum)],
                jam: () => [hoursPanel(profile, days)],
                tiket: () => [ticketsPanel(sum)],
                pertumbuhan: () => growthPanels(sum),
            }[view]();

            const png = chart.render(panels, { panelHeight: view === 'jam' ? 340 : 300 });
            const file = new AttachmentBuilder(png, { name: 'analytics.png' });

            return interaction.editReply({
                embeds: [buildEmbed(view, sum, profile)],
                files: [file],
                allowedMentions: { parse: [] },
            });
        } catch (err) {
            log(err.stack ?? err, 'err');
            return interaction.editReply('❌ Terjadi kesalahan saat membuat statistik.');
        }
    },
};
