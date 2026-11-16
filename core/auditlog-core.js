const fs = require('fs');
const path = require('path');
const { EmbedBuilder, escapeMarkdown } = require('discord.js');
const def = require('../defines');
const db = require('./query');
const { log } = require('../functions');

const cfg = {
  enabled: true, pollSeconds: 5, batchLimit: 40,
  channels: { command: '', vault: '', askreport: '' },
  ...(def.auditlog ?? {}),
};
cfg.channels = { command: '', vault: '', askreport: '', ...(def.auditlog?.channels ?? {}) };
const q = (sql, params) => new Promise((resolve, reject) => db.query(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
const stateFile = path.join(__dirname, '..', 'data', 'auditlog-state.json');
let state = { admin: null, vault: null, ask: null };
try { state = { ...state, ...JSON.parse(fs.readFileSync(stateFile, 'utf8')) }; } catch {}
function save() { try { fs.writeFileSync(stateFile + '.tmp', JSON.stringify(state)); fs.renameSync(stateFile + '.tmp', stateFile); } catch (e) { log(`AuditLog state gagal disimpan: ${e.message}`, 'err'); } }
const esc = v => escapeMarkdown(String(v ?? '-')).slice(0, 1000);
const money = v => `$${Number(v || 0).toLocaleString('en-US')}`;
const burstWindowMs = 5 * 60 * 1000;
const burstThreshold = 5;
const adminBursts = new Map();
function adminBurstEmbed(r) {
  const key = String(r.AdminUCP || r.Admin || 'unknown').toLowerCase();
  const now = Date.now();
  const prev = adminBursts.get(key) || { times: [], lastAlert: 0 };
  prev.times = prev.times.filter(t => now - t <= burstWindowMs);
  prev.times.push(now);
  let alert = null;
  if (prev.times.length >= burstThreshold && now - prev.lastAlert >= burstWindowMs) {
    prev.lastAlert = now;
    alert = new EmbedBuilder().setColor(0xe74c3c).setTitle('⚠️ Aktivitas Admin Tidak Biasa')
      .setDescription(`Admin **${esc(r.Admin)} (${esc(r.AdminUCP)})** melakukan **${prev.times.length} command** dalam 5 menit terakhir.`)
      .addFields({ name: 'Command terakhir', value: `/${esc(r.Prefix)}`, inline: true }, { name: 'Target terakhir', value: esc(r.UCPTarget), inline: true })
      .setFooter({ text: 'Peringatan otomatis — periksa konteks sebelum mengambil tindakan.' }).setTimestamp();
  }
  adminBursts.set(key, prev);
  return alert;
}
let lastErr = 0;
function err(msg) { if (Date.now() - lastErr > 60000) { lastErr = Date.now(); log(msg, 'err'); } }
async function send(client, key, embeds) {
  const id = cfg.channels[key]; if (!id || !embeds.length) return;
  const ch = await client.channels.fetch(id).catch(() => null);
  if (!ch?.isTextBased()) throw new Error(`Channel auditlog ${key} (${id}) tidak ditemukan`);
  for (let i = 0; i < embeds.length; i += 10) await ch.send({ embeds: embeds.slice(i, i + 10), allowedMentions: { parse: [] } });
}
async function pollTable(client, table, key, stateKey, sql, makeEmbed) {
  if (state[stateKey] === null) {
    const [r] = await q(`SELECT COALESCE(MAX(ID),0) AS m FROM ??`, [table]);
    state[stateKey] = Number(r.m); save();
    log(`AuditLog ${table}: mulai dari ID ${state[stateKey]} (data lama tidak dikirim).`, 'info'); return;
  }
  const rows = await q(sql, [table, state[stateKey], cfg.batchLimit]);
  if (!rows.length) return;
  await send(client, key, rows.map(makeEmbed));
  if (table === 'admin_logs' && cfg.channels.command) {
    const alerts = rows.map(adminBurstEmbed).filter(Boolean);
    if (alerts.length) await send(client, key, alerts);
  }
  state[stateKey] = Number(rows[rows.length - 1].ID); save();
}
async function poll(client) {
  if (poll.running) return; poll.running = true;
  try {
    await pollTable(client, 'admin_logs', 'command', 'admin',
      'SELECT ID, Prefix, Admin, AdminUCP, UCPTarget FROM ?? WHERE ID > ? ORDER BY ID ASC LIMIT ?', r =>
      new EmbedBuilder().setColor(0xe67e22).setTitle('🛡️ Aktivitas Command Admin')
        .addFields({ name: 'Command', value: `/${esc(r.Prefix)}`, inline: true }, { name: 'Admin', value: `${esc(r.Admin)} (${esc(r.AdminUCP)})`, inline: true }, { name: 'Target', value: esc(r.UCPTarget), inline: true }).setFooter({ text: `Admin Log #${r.ID}` }).setTimestamp());
    await pollTable(client, 'faction_vaultlogs', 'vault', 'vault',
      'SELECT ID, Name, UCP, Item, Quantity, Faction, Time FROM ?? WHERE ID > ? ORDER BY ID ASC LIMIT ?', r =>
      new EmbedBuilder().setColor(0x9b59b6).setTitle('🏦 Aktivitas Brankas Faction')
        .addFields({ name: 'Pemain', value: `${esc(r.Name)} (${esc(r.UCP)})`, inline: true }, { name: 'Faction', value: esc(r.Faction), inline: true }, { name: 'Item', value: esc(r.Item), inline: true }, { name: 'Jumlah', value: String(r.Quantity ?? 0), inline: true }, { name: 'Waktu', value: esc(r.Time), inline: true }).setFooter({ text: `Vault Log #${r.ID}` }));
    await pollTable(client, 'askreport_logs', 'askreport', 'ask',
      'SELECT ID, EventType, AskID, PlayerName, PlayerUCP, Question, AdminName, Answer, CreatedAt FROM ?? WHERE ID > ? ORDER BY ID ASC LIMIT ?', r => {
        const isAnswer = r.EventType === 'answer';
        const e = new EmbedBuilder().setColor(isAnswer ? 0x2ecc71 : 0xf1c40f).setTitle(isAnswer ? '💬 Ask Dijawab' : '📨 Ask Report Baru')
          .addFields({ name: 'Ask ID', value: String(r.AskID), inline: true }, { name: 'Pemain', value: `${esc(r.PlayerName)} (${esc(r.PlayerUCP)})`, inline: true }, { name: isAnswer ? 'Admin' : 'Pertanyaan', value: isAnswer ? esc(r.AdminName) : esc(r.Question) });
        if (isAnswer) e.addFields({ name: 'Pertanyaan', value: esc(r.Question) }, { name: 'Jawaban', value: esc(r.Answer) });
        return e.setFooter({ text: `Ask Log #${r.ID}` }).setTimestamp(r.CreatedAt ? new Date(r.CreatedAt) : new Date());
      });
  } catch (e) { err(`AuditLog gagal: ${e.message}`); }
  finally { poll.running = false; }
}
let timer;
function start(client) { if (cfg.enabled === false) return; if (timer) clearInterval(timer); log(`AuditLog aktif: ${cfg.pollSeconds} detik.`, 'done'); poll(client); timer = setInterval(() => poll(client), cfg.pollSeconds * 1000); }
module.exports = { start, poll, config: cfg };
