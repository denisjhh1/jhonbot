const q = require('./samp-lite');
q({ host: 'YOUR_SAMP_SERVER_IP', port: 7786, timeout: 3000 }, (e, r) => console.log(e || r));
