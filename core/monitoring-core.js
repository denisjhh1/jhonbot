const fs = require('fs');
const path = require('path');

const query = require('./samp-lite');
const { EmbedBuilder, escapeMarkdown } = require('discord.js');
const def = require('../defines');
const { log } = require('../functions');
const analytics = require('./analytics-core');

const cfg = def.monitoring ?? {};
const STATE_FILE = path.join(__dirname, '..', 'data', 'monitoring-state.json');

const MODE = cfg.testMode ? 'test' : 'production';
const INTERVAL_MS = cfg.testMode ? (cfg.testIntervalMs ?? 10 * 1000) : (cfg.intervalMs ?? 15 * 60 * 1000);
const QUERY_TIMEOUT_MS = cfg.queryTimeoutMs ?? 3000;
const FAIL_THRESHOLD = cfg.failThreshold ?? 1;

const BANNER_ONLINE = cfg.bannerOnline ?? 'https://i.imgur.com/LQTcL3p.jpeg';
const BANNER_OFFLINE = cfg.bannerOffline ?? 'https://i.imgur.com/LQTcL3p.jpeg';

let failCount = 0;
let lastKnown = null;
let timer = null;
let running = false;

const loadState = () => {
    try {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {
        return {};
    }
};
const saveState = (state) => {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (e) {
        log(e.message, 'err');
    }
};

const RETRIES = cfg.retries ?? 2;

const queryOnce = () =>
    new Promise((resolve) => {
        const started = Date.now();
        let done = false;
        let guard = null;
        const finish = (val) => {
            if (!done) {
                done = true;
                clearTimeout(guard);
                resolve(val);
            }
        };

        guard = setTimeout(() => finish({ ok: false }), QUERY_TIMEOUT_MS * 3 + 1500);

        try {
            query({ host: def.sserver.ip, port: Number(def.sserver.port), timeout: QUERY_TIMEOUT_MS }, (error, res) => {
                if (error || !res) return finish({ ok: false });
                finish({ ok: true, latency: Date.now() - started, data: res });
            });
        } catch {
            finish({ ok: false });
        }
    });

const querySamp = async () => {
    let res = { ok: false };
    for (let i = 0; i < RETRIES; i++) {
        res = await queryOnce();
        if (res.ok) return res;
    }
    return res;
};

const buildEmbed = (result) => {
    const address = `${def.sserver.ip}:${def.sserver.port}`;
    const online = result.ok;
    const d = result.data ?? lastKnown?.data;
    const now = Math.floor(Date.now() / 1000);

    let description;
    if (online) {
        const title = d.hostname ? `**${escapeMarkdown(d.hostname)}**` : '**Server sedang online**';
        description =
            `${title}\n` +
            `Server berjalan normal dan siap dimainkan. Data diperbarui otomatis tiap ${formatInterval(INTERVAL_MS)}.\n\n` +
            `📍 Alamat: \`${address}\`\n` +
            `🕒 Update terakhir: <t:${now}:R>`;
    } else {
        description =
            `**Server tidak merespon**\n` +
            `Server tidak merespon query. Mungkin sedang offline/restart/maintenance.\n\n` +
            `📍 Alamat: \`${address}\`\n` +
            `🕒 Update terakhir: <t:${now}:R>`;
        if (lastKnown) {
            description += `\n👁️ Terakhir online: <t:${Math.floor(lastKnown.time / 1000)}:R> (${lastKnown.data.online} pemain)`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle('📡 MONITORING SERVER')
        .setDescription(description)
        .setColor(online ? 'Green' : 'Red')
        .setThumbnail(def.icon?.thumbnail ?? null)
        .setFooter({ text: `Auto update tiap ${formatInterval(INTERVAL_MS)}`, iconURL: def.icon?.thumbnail })
        .setTimestamp();

    embed.addFields(
        { name: 'Status', value: online ? '🟢 ONLINE' : '🔴 OFFLINE', inline: true },
        { name: 'Pemain', value: online ? `**${d.online}** / ${d.maxplayers}` : '-', inline: true },
        { name: 'Latency', value: online ? `${result.latency} ms` : '-', inline: true },
    );

    if (online) {
        embed.addFields(
            { name: 'Gamemode', value: d.gamemode || '-', inline: true },
            { name: 'Map', value: d.mapname || '-', inline: true },
            { name: 'Password', value: d.passworded ? '🔒 Ya' : '🔓 Tidak', inline: true },
        );
    }

    embed.setImage(online ? BANNER_ONLINE : BANNER_OFFLINE);

    return embed;
};

const formatInterval = (ms) => (ms >= 60000 ? `${Math.round(ms / 60000)} menit` : `${Math.round(ms / 1000)} detik`);

async function update(client) {
    if (running) return;
    running = true;
    try {
        const channel = await client.channels.fetch(cfg.channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            return log('Monitoring: channel tidak ditemukan. Cek monitoring.channelId di defines.js', 'err');
        }

        const res = await querySamp();
        analytics.recordSample(res);
        if (res.ok) {
            failCount = 0;
            lastKnown = { data: res.data, time: Date.now() };
        } else {
            failCount++;

            if (failCount < FAIL_THRESHOLD && lastKnown) {
                log(`Monitoring: query gagal (${failCount}/${FAIL_THRESHOLD}), menunggu konfirmasi...`, 'warn');
                return;
            }
        }

        const payload = {
            content: '',
            embeds: [buildEmbed(res)],
            allowedMentions: { parse: [] },
        };

        const state = loadState();
        let msg = null;
        if (state.messageId && state.channelId === cfg.channelId) {
            try {
                msg = await channel.messages.fetch(state.messageId);
            } catch (e) {
                if (e?.code !== 10008) {
                    log(
                        `Monitoring: gagal mengambil pesan lama (${e?.message ?? e}), dicoba lagi putaran berikutnya.`,
                        'warn',
                    );
                    return;
                }
            }
        }

        if (msg) {
            await msg.edit(payload);
        } else {
            msg = await channel.send(payload);
            saveState({ channelId: cfg.channelId, messageId: msg.id });
        }
    } catch (err) {
        log(err.stack ?? err, 'err');
    } finally {
        running = false;
    }
}

function start(client) {
    if (cfg.enabled === false) return log('Monitoring dimatikan (monitoring.enabled = false).', 'warn');
    if (!cfg.channelId) return log('Monitoring: isi monitoring.channelId di defines.js dulu.', 'warn');
    if (timer) clearInterval(timer);

    log(
        `Monitoring aktif [mode ${MODE}] tiap ${formatInterval(INTERVAL_MS)} -> ${def.sserver.ip}:${def.sserver.port}`,
        'done',
    );
    update(client);
    timer = setInterval(() => update(client), INTERVAL_MS);
}

module.exports = { start, querySamp };
