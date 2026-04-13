const LIC_SETTINGS = {
  MASTER_ID: "1tasyRF3BlNgZriFf6DcFh-dpA9mFLON2V7T3vQj5Tg0",
  CACHE_TTL: 604800 
};

async function checkLicense(SHEET_ID, host, pageCache, ctx, force = false) {
    const licCacheKey = new Request(`https://lic-verify.local/license-v1?id=${SHEET_ID}&host=${host}`, { method: 'GET' });
    
    if (!force) {
        let cached = await pageCache.match(licCacheKey);
        if (cached) return (await cached.text()) === 'OK';
    }

    try {
        const query = encodeURIComponent(`SELECT C WHERE A = '${host}' AND B = '${SHEET_ID}' LIMIT 1`);
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${LIC_SETTINGS.MASTER_ID}/gviz/tq?tqx=out:json&sheet=Licenses&tq=${query}&cb=${Date.now()}`;
        
        const res = await fetch(sheetUrl);
        const text = await res.text();
        const jsonStr = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/);
        
        let valid = false;
        if (jsonStr && jsonStr[1]) {
            const json = JSON.parse(jsonStr[1]);
            if (json.table?.rows?.length > 0 && json.table.rows[0].c[0]?.v === 'Aktif') {
                valid = true;
            }
        }

        ctx.waitUntil(pageCache.put(licCacheKey, new Response(valid ? 'OK' : 'FAIL', { 
            headers: { 'Content-Type': 'text/plain', 'Cache-Control': `public, max-age=${LIC_SETTINGS.CACHE_TTL}` } 
        })));
        
        return valid;
    } catch (e) {
        return true; 
    }
}
