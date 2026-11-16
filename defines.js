// Nilai di bawah adalah DEFAULT. Ubah lewat dashboard web (data/settings.json menimpa nilai di sini).
const base = {
    client: {
        token: '',
        id: '',
        guild: '',
    },

    icon: {
        thumbnail: 'https://i.imgur.com/JH2whR3.png',
        image: 'https://i.imgur.com/JH2whR3.png',
    },

    mysql: {
        connectionLimit: 5,
        host: '',
        port: 3306,
        user: '',
        password: '',
        database: '',
    },

    sserver: {
        ip: 'YOUR_SAMP_SERVER_IP',
        port: '7008',
    },

    idrole: {
        ucp: 'YOUR_DISCORD_ID',
    },

    bugreport: {
        categoryId: 'YOUR_DISCORD_ID',
        adminRoleId: 'YOUR_DISCORD_ID',
        developerRoleId: 'YOUR_DISCORD_ID',
    },

    dutyreport: {
        forumChannelId: 'YOUR_DISCORD_ID',
        roleIds: ['YOUR_DISCORD_ID'],
        managerRoleIds: ['YOUR_DISCORD_ID'],

        izinDutyRoleIds: ['YOUR_DISCORD_ID'],
        minDutyMinutes: 30,
        requireProof: true,
        utcOffsetHours: 7,
    },

    donation: {
        panelChannelId: 'YOUR_DISCORD_ID',
        categoryId: 'YOUR_DISCORD_ID',
        staffRoleIds: ['YOUR_DISCORD_ID'],
        pingUserIds: ['YOUR_DISCORD_ID'],
        logChannelId: 'YOUR_DISCORD_ID',
        announceChannelId: 'YOUR_DISCORD_ID',
        maxOpenPerUser: 2,
        qrisFile: 'assets/qris.jpg',
    },

    statusserver: {
        channelId: 'YOUR_DISCORD_ID',
        pingEveryone: false,
        roleIds: [],
        banners: {
            online: 'https://i.imgur.com/aRNEWht.jpeg',
            offline: 'https://i.imgur.com/xshEn6S.jpeg',
            maintenance: 'https://i.imgur.com/UdcWXFm.jpeg',
        },
    },

    refund: {
        open: true,
        categoryId: 'YOUR_DISCORD_ID',
        logChannelId: 'YOUR_DISCORD_ID',
        adminRoleId: 'YOUR_DISCORD_ID',
        managerRoleIds: ['YOUR_DISCORD_ID'],
        maxOpenPerUser: 2,
        cooldownSeconds: 60,
        maxFiles: 5,
    },

    izin: {
        open: true,
        logChannelId: 'YOUR_DISCORD_ID',
        reminderChannelId: 'YOUR_DISCORD_ID',
        minDays: 1,
        maxDays: 7,
        allowNight: true,
        nightEndHour: 6,
        allowSelfApprove: false,
    },

    benefit: {
        open: true,
        categoryId: 'YOUR_DISCORD_ID',
        claimChannelId: 'YOUR_DISCORD_ID',
        cooldownSeconds: 60,
    },

    rekrutmen: {
        categoryId: 'YOUR_DISCORD_ID',
        channelId: 'YOUR_DISCORD_ID',
        openByDefault: true,
        allowSelfDecide: false,
        banner: 'https://i.imgur.com/4gwPYuC.png',
        draftMinutes: 30,
    },

    ai: {
        apiKey: '',
        model: 'gemini-3.5-flash-lite',
        cooldownSeconds: 60,
        staffBypassCooldown: true,
        globalPerMinute: 10,
        channelIds: ['YOUR_DISCORD_ID'],
    },

    handler: {
        prefix: '!',
        deploy: true,
        commands: {
            prefix: true,
            slash: true,
            user: true,
            message: true,
        },
    },

    users: {
        developers: ['YOUR_DISCORD_ID', 'YOUR_DISCORD_ID', 'YOUR_DISCORD_ID'],
        ownerId: ['YOUR_DISCORD_ID'],
    },

    development: {
        enabled: false,
        guild: 'YOUR_DISCORD_ID',
    },

    messageSettings: {
        ownerMessage: 'Pengembang bot memiliki satu-satunya izin untuk menggunakan perintah ini.',
        developerMessage: 'Anda tidak berwenang untuk menggunakan perintah ini.',
        cooldownMessage: 'Pelan-pelan sobat! Anda terlalu cepat untuk menggunakan perintah ini ({cooldown}s).',
        globalCooldownMessage: 'Pelan-pelan sobat! Perintah ini berada pada cooldown global ({cooldown}s).',
        notHasPermissionMessage: 'Anda tidak memiliki izin untuk menggunakan perintah ini.',
        notHasPermissionComponent: 'Anda tidak memiliki izin untuk menggunakan komponen ini.',
        missingDevIDsMessage:
            'Ini adalah perintah khusus pengembang, tetapi tidak dapat dijalankan karena ID pengguna tidak ada di file konfigurasi.',
    },

    monitoring: {
        enabled: true,
        channelId: 'YOUR_DISCORD_ID',
        testMode: false,
        testIntervalMs: 10 * 1000,
        intervalMs: 60 * 1000,
        queryTimeoutMs: 3000,
        failThreshold: 2,
        bannerOnline: 'https://i.imgur.com/LQTcL3p.jpeg',
        bannerOffline: 'https://i.imgur.com/LQTcL3p.jpeg',
    },

    stats: {
        allowedRoleIds: ['YOUR_DISCORD_ID'],
        allowEveryone: false,
        ephemeral: true,
        columns: {
            name: 'Char_Name',
            job: 'Char_Job',
            faction: 'Char_Faction',
            family: 'Char_Family',
            lastLogin: 'Char_LastLogin',
        },
    },

    analytics: {
        enabled: true,
        utcOffsetHours: 7,
        allowedRoleIds: ['YOUR_DISCORD_ID'],
        ephemeral: false,
    },

    suggestion: {
        categoryId: 'YOUR_DISCORD_ID',
        channels: {
            fitur: 'YOUR_DISCORD_ID',
            mapingan: 'YOUR_DISCORD_ID',
            textdraw: 'YOUR_DISCORD_ID',
            fiturdc: 'YOUR_DISCORD_ID',
        },
        staffRoleIds: [],
    },

    req: {
        open: true,
        maxImages: 4,
        draftMinutes: 15,
        allowSelfApprove: false,
        claimBenefitChannelId: 'YOUR_DISCORD_ID',
        logChannelId: 'YOUR_DISCORD_ID',
        approverRoleIds: ['YOUR_DISCORD_ID'],
    },

    // Pemetaan kolom untuk database server ini (lihat juga core/schema.js)
    topadmin: {
        // database ini tidak punya kolom admin point / ask point; Char_ReportPoints dipakai sebagai point
        columns: { point: 'Char_ReportPoints', ask: '', report: '' },
    },
    toponline: {
        timeUnit: 'hours',
        columns: { time: 'Char_Hours' },
    },
    delchar: {
        // ban_expire = 0 artinya permanen
        banTable: { table: 'player_bans', nameColumn: 'name', expireColumn: 'ban_expire', zeroIsPermanent: true },
    },

    // Website pengaturan (dashboard)
    dashboard: {
        enabled: true,
        host: '0.0.0.0',
        port: 3000,
    },
};

module.exports = require('./dashboard/settings').apply(base);
