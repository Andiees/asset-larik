// lic-config.js di repository Andiees/asset-larik
export const LIC_SETTINGS = {
  MASTER_ID: "1tasyRF3BlNgZriFf6DcFh-dpA9mFLON2V7T3vQj5Tg0",
  CACHE_TTL: 604800 
};

export async function checkLicense(SHEET_ID, host, pageCache, ctx, force = false) {
    const licCacheKey = new Request(`https://lic-verify.local/license-v1?id=${SHEET_ID}&host=${host}`, { method: 'GET' });
    
    // JIKA TIDAK FORCE, cek cache dulu
    if (!force) {
        let cached = await pageCache.match(licCacheKey);
        if (cached) {
            const status = await cached.text();
            return status === 'OK';
        }
    }

    // JIKA FORCE atau CACHE KOSONG, ambil data terbaru dari Google Sheets
    try {
        const query = encodeURIComponent(`SELECT C WHERE A = '${host}' AND B = '${SHEET_ID}' LIMIT 1`);
        // Tambahkan cb (cache buster) pada URL Google Sheets juga
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${LIC_SETTINGS.MASTER_ID}/gviz/tq?tqx=out:json&sheet=Licenses&tq=${query}&cb=${Date.now()}`;
        
        const res = await fetch(sheetUrl);
        const text = await res.text();
        const jsonStr = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/);
        
        let valid = false;
        if (jsonStr && jsonStr[1]) {
            const json = JSON.parse(jsonStr[1]);
            // Cek kolom C (index 0 karena kita hanya ambil 1 baris) apakah nilainya "Aktif"
            if (json.table?.rows?.length > 0 && json.table.rows[0].c[0]?.v === 'Aktif') {
                valid = true;
            }
        }

        // Simpan hasil verifikasi ke cache edge
        ctx.waitUntil(pageCache.put(licCacheKey, new Response(valid ? 'OK' : 'FAIL', { 
            headers: { 
                'Content-Type': 'text/plain', 
                'Cache-Control': `public, max-age=${LIC_SETTINGS.CACHE_TTL}` 
            } 
        })));
        
        return valid;
    } catch (e) {
        // Jika Google Sheets error, anggap valid (opsional, tergantung kebijakan Andi)
        return true; 
    }
}
