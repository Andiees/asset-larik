// =========================================================================
// lic-config.js - SISTEM LISENSI CENTRALIZED
// by Andi | disatu.web.id
// =========================================================================

const LIC_SETTINGS = {
  MASTER_ID: "1tasyRF3BlNgZriFf6DcFh-dpA9mFLON2V7T3vQj5Tg0",
  CACHE_TTL: 604800 // Durasi cache 7 hari (dalam detik)
};

async function checkLicense(SHEET_ID, host, pageCache, ctx, force = false) {
    // Definisi key cache yang unik berdasarkan host dan sheet_id pembeli
    const licCacheKey = new Request(`https://lic-verify.local/license-v1?id=${SHEET_ID}&host=${host}`, { method: 'GET' });
    
    // 1. Jika BUKAN force refresh, cek apakah ada data di cache edge Cloudflare
    if (!force) {
        let cached = await pageCache.match(licCacheKey);
        if (cached) {
            const cachedStatus = await cached.text();
            return cachedStatus === 'OK';
        }
    }

    // 2. Jika force refresh atau cache kosong, ambil data langsung dari Master Google Sheets
    try {
        // Encode query untuk mencari: Kolom A (Host) dan Kolom B (Sheet ID)
        const query = encodeURIComponent(`SELECT C WHERE A = '${host}' AND B = '${SHEET_ID}' LIMIT 1`);
        
        // Tambahkan cb=${Date.now()} agar fetch ke Google Sheets tidak terkena cache internal Google
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${LIC_SETTINGS.MASTER_ID}/gviz/tq?tqx=out:json&sheet=Licenses&tq=${query}&cb=${Date.now()}`;
        
        const res = await fetch(sheetUrl, { cache: 'no-store' });
        const text = await res.text();
        
        // Extract JSON dari format response Google visualization
        const jsonStr = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/);
        
        let valid = false;
        if (jsonStr && jsonStr[1]) {
            const json = JSON.parse(jsonStr[1]);
            // Periksa apakah ada baris yang ditemukan dan kolom C bernilai 'Aktif'
            if (json.table?.rows?.length > 0 && json.table.rows[0].c[0]?.v === 'Aktif') {
                valid = true;
            }
        }

        // 3. Simpan hasil verifikasi terbaru ke dalam cache edge Cloudflare
        const responseToCache = new Response(valid ? 'OK' : 'FAIL', { 
            headers: { 
                'Content-Type': 'text/plain', 
                'Cache-Control': `public, max-age=${LIC_SETTINGS.CACHE_TTL}` 
            } 
        });
        
        ctx.waitUntil(pageCache.put(licCacheKey, responseToCache));
        
        return valid;
    } catch (e) {
        // Fallback: Jika Google Sheets bermasalah, izinkan akses agar user tidak terganggu
        console.error("Master License Fetch Error:", e);
        return true; 
    }
}
