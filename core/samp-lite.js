const dgram = require('dgram');
const dns = require('dns').promises;

const request = (host, port, op, timeout) =>
    new Promise((resolve, reject) => {
        const s = dgram.createSocket('udp4');
        const pkt = Buffer.concat([
            Buffer.from('SAMP'),
            Buffer.from(host.split('.').map(Number)),
            Buffer.from([port & 0xff, (port >> 8) & 0xff]),
            Buffer.from(op),
        ]);
        const t = setTimeout(() => {
            s.close();
            reject(new Error(`timeout paket '${op}'`));
        }, timeout);
        s.once('error', (e) => {
            clearTimeout(t);
            try {
                s.close();
            } catch {}
            reject(e);
        });
        s.once('message', (m) => {
            clearTimeout(t);
            s.close();
            resolve(m);
        });
        s.send(pkt, port, host, (e) => {
            if (e) {
                clearTimeout(t);
                s.close();
                reject(e);
            }
        });
    });

const str32 = (b, o) => {
    const n = b.readUInt32LE(o);
    return [b.toString('latin1', o + 4, o + 4 + n), o + 4 + n];
};

function parseInfo(b) {
    let o = 11;
    const passworded = b.readUInt8(o++) === 1;
    const online = b.readUInt16LE(o);
    o += 2;
    const maxplayers = b.readUInt16LE(o);
    o += 2;
    let hostname, gamemode, language;
    [hostname, o] = str32(b, o);
    [gamemode, o] = str32(b, o);
    [language, o] = str32(b, o);
    return { passworded, online, maxplayers, hostname, gamemode, language };
}

function parseRules(b) {
    let o = 11;
    const rules = {};
    const n = b.readUInt16LE(o);
    o += 2;
    for (let i = 0; i < n; i++) {
        const kl = b.readUInt8(o++);
        const k = b.toString('latin1', o, o + kl);
        o += kl;
        const vl = b.readUInt8(o++);
        const v = b.toString('latin1', o, o + vl);
        o += vl;
        rules[k] = v;
    }
    return rules;
}

function parsePlayers(b) {
    let o = 11;
    const players = [];
    const n = b.readUInt16LE(o);
    o += 2;
    for (let i = 0; i < n; i++) {
        const nl = b.readUInt8(o++);
        const name = b.toString('latin1', o, o + nl);
        o += nl;
        const score = b.readInt32LE(o);
        o += 4;
        players.push({ name, score });
    }
    return players;
}

module.exports = function sampLite({ host, port, timeout = 3000 }, cb) {
    (async () => {
        if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(String(host)))
            host = (await dns.lookup(String(host), { family: 4 })).address;
        port = Number(port);
        const info = parseInfo(await request(host, port, 'i', timeout));
        let mapname = '';
        try {
            mapname = parseRules(await request(host, port, 'r', timeout)).mapname || '';
        } catch {}
        let players = [];
        if (info.online <= 100) {
            try {
                players = parsePlayers(await request(host, port, 'c', timeout));
            } catch {}
        }
        return { ...info, mapname, players };
    })().then(
        (res) => cb(null, res),
        (err) => cb(err),
    );
};
