const path = require('path');
let key = process.env.GEMINI_API_KEY;
if (!key) {
    try {
        key = require(path.join(__dirname, '..', 'defines.js')).ai?.apiKey;
    } catch {}
}
if (!key) {
    console.log('API key tidak ditemukan (isi env GEMINI_API_KEY atau ai.apiKey di defines.js)');
    process.exit(1);
}

const models = [
    'gemini-flash-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-2.5-flash-lite',
];

(async () => {
    for (const m of models) {
        const t = Date.now();
        try {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: 'Jawab satu kata: halo' }] }],
                    generationConfig: { maxOutputTokens: 200 },
                }),
                signal: AbortSignal.timeout(40000),
            });
            const j = await r.json().catch(() => ({}));
            const txt = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? j.error?.message ?? '';
            console.log(
                `${m.padEnd(24)} HTTP ${r.status}  ${((Date.now() - t) / 1000).toFixed(1)}s  ${String(txt).slice(0, 70).replace(/\n/g, ' ')}`,
            );
        } catch (e) {
            console.log(`${m.padEnd(24)} GAGAL   ${((Date.now() - t) / 1000).toFixed(1)}s  ${e.message}`);
        }
    }
})();
