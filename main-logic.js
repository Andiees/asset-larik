// _worker.js - VERSI CMS GOD MODE ULTIMATE (SERVER-SIDE PAGINATION + SITEMAP INDEX)
// Arsitektur: Enterprise SQL Limits + Real-Time Fetch + Auto Schema + CSS Isolated
// by Andi | disatu.web.id

async function fetchSheetData(sheetId, sheetName, query = '') {
    const antiCache = new Date().getTime(); 
    let url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${sheetName}&headers=1&t=${antiCache}`;
    if (query) url += `&tq=${encodeURIComponent(query)}`;
    
    try {
        const res = await fetch(url);
        const text = await res.text();
        
        const startIdx = text.indexOf('{');
        const endIdx = text.lastIndexOf('}');
        
        if (startIdx !== -1 && endIdx !== -1) {
            const data = JSON.parse(text.substring(startIdx, endIdx + 1));
            if (!data.table || !data.table.rows) return [];
            
            return data.table.rows.map(row => {
                if (!row.c) return [];
                return row.c.map(col => {
                    if (!col) return '';
                    if (col.f !== undefined && col.f !== null) return String(col.f);
                    return (col.v !== null && col.v !== undefined) ? col.v : '';
                });
            });
        }
    } catch (e) { 
        console.error("Error fetching sheet:", e); 
    }
    return [];
}

function parseDateSafe(dateInput) {
    if (!dateInput) return { iso: new Date().toISOString(), formatted: '', short: new Date().toISOString().split('T')[0] };
    let tempDate = NaN;
    if (typeof dateInput === 'string' && dateInput.includes('/')) {
        const parts = dateInput.split('/');
        if (parts.length === 3) tempDate = new Date(`${parts[2].trim()}-${parts[1].trim().padStart(2, '0')}-${parts[0].trim().padStart(2, '0')}`);
    } else { tempDate = new Date(dateInput); }

    if (!isNaN(tempDate.getTime())) {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        return { iso: tempDate.toISOString(), formatted: `${days[tempDate.getDay()]}, ${dateInput}`, short: tempDate.toISOString().split('T')[0] };
    }
    return { iso: new Date().toISOString(), formatted: dateInput, short: new Date().toISOString().split('T')[0] };
}

function slugify(text) {
    return (text || '').toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');
}

function safeJson(text) {
    if (!text) return '';
    return String(text).replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\r/g, '');
}

function generateAnchorId(text) {
    return slugify(text.replace(/<[^>]*>/g, ''));
}

function generateAutoTOC(content, title = 'Daftar Isi') {
    if (!content) return '';
    const headingRegex = /<(h[23])([^>]*)>(.*?)<\/\1>/gi;
    const headings = []; let match;
    while ((match = headingRegex.exec(content)) !== null) {
        const tag = match[1]; const attrs = match[2] || ''; const text = match[3].trim();
        const id = attrs.match(/id=["']([^"']+)["']/) ? attrs.match(/id=["']([^"']+)["']/)[1] : generateAnchorId(text);
        headings.push({ tag, text, id, level: parseInt(tag.charAt(1)) });
    }
    if (headings.length === 0) return '';
    
    let tocHtml = `<div class="bg-slate-50 border border-slate-200 rounded-2xl mb-8 overflow-hidden"><button onclick="toggleTOC()" class="w-full flex items-center justify-between px-5 py-4 bg-slate-100 hover:bg-slate-200 transition-colors font-bold text-slate-800 text-left"><span>${title}</span><svg id="toc-icon" class="w-5 h-5 transform transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></button><nav id="toc-content" class="p-5 border-t border-slate-200"><ul class="space-y-2 text-sm toc-list">`;
    let lastLevel = 2;
    headings.forEach((h) => {
        if (h.level > lastLevel) tocHtml += '<ul class="ml-4 mt-1 space-y-1 toc-list">';
        else if (h.level < lastLevel) tocHtml += '</ul>'.repeat(lastLevel - h.level);
        tocHtml += `<li><a href="#${h.id}" class="text-slate-600 hover:text-blue-600 hover:underline transition-colors flex items-start gap-2"><span class="text-blue-500 mt-1">•</span><span>${h.text}</span></a></li>`;
        lastLevel = h.level;
    });
    tocHtml += '</ul>'.repeat(Math.max(0, lastLevel - 2)) + '</nav></div>';
    tocHtml += `<script>function toggleTOC() { const content = document.getElementById('toc-content'); const icon = document.getElementById('toc-icon'); if (content.style.display === 'none') { content.style.display = 'block'; icon.style.transform = 'rotate(0deg)'; } else { content.style.display = 'none'; icon.style.transform = 'rotate(-90deg)'; } }<\/script>`;
    return tocHtml;
}

function injectHeadingAnchors(content) {
    if (!content) return content;
    return content.replace(/<(h[23])([^>]*)>(.*?)<\/\1>/gi, (match, tag, attrs, text) => {
        if (attrs.match(/id=["']/)) return match;
        const id = generateAnchorId(text);
        const newAttrs = attrs ? `${attrs} id="${id}"` : ` id="${id}"`;
        return `<${tag}${newAttrs}>${text}</${tag}>`;
    });
}

function generateBacaJuga(currentSlug, currentCategory, postsMeta, count = 3, s, BLOG_SLUG) {
    if (!postsMeta || postsMeta.length === 0) return '';
    
    const currentCats = (currentCategory || '').split(',').map(c => slugify(c.trim()));
    
    const related = postsMeta
        .filter(p => p[1] !== currentSlug && p[3] && p[3].split(',').some(c => currentCats.includes(slugify(c.trim()))))
        .slice(0, count);
    
    if (related.length === 0) return '';
    
    let html = `<div class="mt-12 pt-6 border-t border-slate-200">
        <h3 class="text-sm font-semibold text-slate-600 mb-3">Baca Juga:</h3>
        <ul class="space-y-1.5 baca-juga-list">`;
    
    related.forEach(p => {
        html += `
            <li class="flex items-center gap-2">
                <span class="text-slate-400 text-xs flex-shrink-0">►</span>
                <a href="/${BLOG_SLUG}/${p[1]}" class="text-slate-600 hover:text-blue-600 transition-colors text-sm hover:underline">${p[2]}</a>
            </li>`;
    });
    
    html += '</ul></div>';
    return html;
}

function getSmartIcon(key, classes = "w-4 h-4") {
    let s = `<svg class="${classes}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" `;
    if(key.match(/lokasi|alamat|area/)) return s + `d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>`;
    if(key.match(/luas|lt|lb|dimensi/)) return s + `d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l-5 5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>`;
    if(key.match(/kamar-tidur|kt|kasur/)) return s + `d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>`;
    if(key.match(/kamar-mandi|km|wc|toilet/)) return s + `d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>`;
    if(key.match(/kapasitas|penumpang|seat|kursi|kuota|siswa/)) return s + `d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`;
    if(key.match(/transmisi|mesin|bbm|cc|warna/)) return s + `d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>`;
    if(key.match(/akreditasi|jurusan|prodi|kurikulum|guru|dosen|pendidikan/)) return s + `d="M12 14l9-5-9-5-9 5 9 5z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 14v7"></path></svg>`;
    if(key.match(/jadwal|durasi|waktu|jam|tahun|berangkat/)) return s + `d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`;
    if(key.match(/maskapai|penerbangan/)) return s + `d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    if(key.match(/hotel|penginapan|asrama|kampus/)) return s + `d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>`;
    return s + `d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname.replace(/\/$/, '') || '/';
        const reqSiteUrl = url.origin;

        if (path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/) && path !== '/config.js') { 
            return env.ASSETS.fetch(request); 
        }

        if (path === '/config.js') {
            const dest = request.headers.get('Sec-Fetch-Dest');
            const fetchMode = request.headers.get('Sec-Fetch-Mode');
            const accept = request.headers.get('Accept') || '';
            const referer = request.headers.get('Referer') || '';
            if (dest === 'document' || fetchMode === 'navigate' || accept.includes('text/html') || !referer.includes(url.hostname)) {
                return new Response("🔒 403 Forbidden", { status: 403, headers: { 'Content-Type': 'text/plain' } });
            }
            const assetRes = await env.ASSETS.fetch(request);
            const securedRes = new Response(assetRes.body, assetRes);
            securedRes.headers.set('Cache-Control', 'no-store, max-age=0');
            return securedRes;
        }

        let SHEET_ID = ''; let GAS_URL = '';
        try {
            const configReq = new Request(reqSiteUrl + '/config.js');
            const configRes = await env.ASSETS.fetch(configReq);
            if (configRes.ok) {
                const configText = await configRes.text();
                const sheetMatch = configText.match(/SHEET_ID:\s*["']([^"']+)["']/);
                const gasMatch = configText.match(/GAS_URL:\s*["']([^"']+)["']/);
                if (sheetMatch) SHEET_ID = sheetMatch[1];
                if (gasMatch) GAS_URL = gasMatch[1];
            }
        } catch (e) {}

        const pageCache = caches.default;
        const pageCacheKey = new Request(url.toString(), { method: 'GET' });
        
        let contentType = "text/html;charset=UTF-8";
        if (path.endsWith('.xml')) contentType = "text/xml;charset=UTF-8";
        else if (path.endsWith('.txt')) contentType = "text/plain;charset=UTF-8";
        else if (path === '/api') contentType = "application/json";

        const isSearchQuery = url.searchParams.has('q');

        // ✨ PROTEKSI DDOS/SPAM RINGAN (10 Detik Edge Cache)
        if (!isSearchQuery && path !== '/api') {
            const cachedResponse = await pageCache.match(pageCacheKey);
            if (cachedResponse) {
                return new Response(cachedResponse.body, { 
                    headers: { "Content-Type": contentType, "X-Cache-Status": "HIT (Real-Time Protect)" } 
                });
            }
        }

        const cacheAndRespond = (contentString) => {
            const clientHeaders = { 
                "Content-Type": contentType, 
                "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                "X-Cache-Status": "DYNAMIC (Direct to Sheet)"
            };
            
            if (!isSearchQuery && path !== '/api') {
                const serverCacheHeaders = { "Content-Type": contentType, "Cache-Control": "s-maxage=10" };
                ctx.waitUntil(pageCache.put(pageCacheKey, new Response(contentString, { headers: serverCacheHeaders }))); 
            }
            
            return new Response(contentString, { headers: clientHeaders });
        };

        // =========================================================================
        // ✨ SISTEM LISENSI (LOGIKA DI WORKER, CACHE LAYERING)
        // by Andi | disatu.web.id
        // =========================================================================
        let isLicenseValid = false;
        const forceLicenseRefresh = url.searchParams.has('li') || url.searchParams.get('li') === '1';

        if (SHEET_ID && SHEET_ID !== 'ID_SPREADSHEET_PEMBELI_DISINI' && SHEET_ID !== '') {
            try {
                // 1. MANAJEMEN MASTER ID DENGAN CACHE
                let MASTER_LICENSE_SHEET_ID = "1tasyRF3BlNgZriFf6DcFh-dpA9mFLON2V7T3vQj5Tg0"; // Default Fallback
                const masterIdCacheKey = new Request(`https://lic-verify.local/master-id`, { method: 'GET' });
                
                if (forceLicenseRefresh) {
                    // HANYA dipanggil saat Admin nge-klik Refresh (?li=1)
                    // Bebas rate limit karena requestnya manual dan sangat jarang
                    const configUrl = `https://raw.githubusercontent.com/Andiees/asset-larik/main/lic-config.js?t=${Date.now()}`;
                    const configRes = await fetch(configUrl, { cache: 'no-store' });
                    
                    if (configRes.ok) {
                        const configText = await configRes.text();
                        const idMatch = configText.match(/MASTER_ID:\s*["']([^"']+)["']/i);
                        if (idMatch) {
                            MASTER_LICENSE_SHEET_ID = idMatch[1];
                            // Simpan ID baru ke memori Edge untuk visitor selanjutnya (tahan 7 hari)
                            await pageCache.put(masterIdCacheKey, new Response(MASTER_LICENSE_SHEET_ID, { headers: { 'Cache-Control': 'public, max-age=604800' }}));
                        }
                    }
                } else {
                    // VISITOR BIASA: 0 Request ke GitHub. Ambil langsung dari memori super cepat.
                    const cachedMasterId = await pageCache.match(masterIdCacheKey);
                    if (cachedMasterId) {
                        MASTER_LICENSE_SHEET_ID = await cachedMasterId.text();
                    }
                }

                // 2. LOGIKA VERIFIKASI KE GOOGLE SHEETS
                const licCacheKey = new Request(`https://lic-verify.local/license-v1?id=${SHEET_ID}&host=${url.hostname}`, { method: 'GET' });
                
                if (forceLicenseRefresh) {
                    await pageCache.delete(licCacheKey);
                }

                let cachedLic = null;
                if (!forceLicenseRefresh) {
                    cachedLic = await pageCache.match(licCacheKey);
                }
                
                if (cachedLic) {
                    // VISITOR BIASA: 0 Request ke Google Sheets.
                    if (await cachedLic.text() === 'OK') isLicenseValid = true;
                } else {
                    // Cek status ke Google Sheets (Hanya saat cache habis atau ?li=1)
                    const query = encodeURIComponent(`SELECT C WHERE A = '${url.hostname}' AND B = '${SHEET_ID}' LIMIT 1`);
                    const sheetUrl = `https://docs.google.com/spreadsheets/d/${MASTER_LICENSE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=Licenses&tq=${query}&t=${Date.now()}`;
                    
                    const res = await fetch(sheetUrl, { cache: 'no-store' });
                    const text = await res.text();
                    const jsonStr = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/);
                    
                    if (jsonStr && jsonStr[1]) {
                        const json = JSON.parse(jsonStr[1]);
                        if (json.table?.rows?.length > 0 && json.table.rows[0].c[0]?.v === 'Aktif') {
                            isLicenseValid = true;
                        }
                    }
                    
                    // Simpan status valid/invalid ke cache
                    ctx.waitUntil(pageCache.put(licCacheKey, new Response(isLicenseValid ? 'OK' : 'FAIL', { 
                        headers: { 'Content-Type': 'text/plain', 'Cache-Control': `public, max-age=604800` } 
                    })));
                }

            } catch (e) {
                console.error("Sistem Lisensi Error:", e);
                isLicenseValid = true; // Fallback jika sistem down
            }
        }

        // 3. TAMPILAN JIKA LISENSI TIDAK VALID
        if (!isLicenseValid) {
            if (!SHEET_ID || SHEET_ID === 'ID_SPREADSHEET_PEMBELI_DISINI') {
                return new Response("⚙️ SISTEM BELUM SIAP: Silakan masukkan Sheet ID Anda di config.js", { status: 200 });
            }
            return new Response(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Lisensi Tidak Valid</title><style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff1f2;color:#9f1239;text-align:center;}h1{font-weight:900;}p{opacity:0.8;margin-bottom:20px;line-height:1.6;}.footer{margin-top:30px;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;}.btn{background:#e11d48;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;}</style></head><body><h1>LISENSI BELUM AKTIF</h1><p>Domain: <strong>${url.hostname}</strong><br>ID: <strong>${SHEET_ID}</strong></p><a href="?li=1" class="btn">REFRESH LISENSI</a><div class="footer">&copy; 2026 AKTIVASI LICENSI DI | LARIK.WEB.ID </div></body></html>`, { status: 403, headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
        }
        // =========================================================================
        
        if (SHEET_ID && (path === "/robots.txt" || path === "/ads.txt")) {
            const settingsRaw = await fetchSheetData(SHEET_ID, 'Settings');
            let content = path === "/robots.txt" ? `User-agent: *\nAllow: /\nSitemap: ${reqSiteUrl}/sitemap.xml` : "";
            settingsRaw.forEach(row => { 
                if (row[0] === 'robots_txt' && row[1] && path === "/robots.txt") content = row[1];
                if (row[0] === 'ads_txt' && row[1] && path === "/ads.txt") content = row[1];
            });
            return cacheAndRespond(content);
        }

        if (path === "/api") {
          if (!GAS_URL) return new Response("GAS_URL tidak ditemukan", { status: 500 });
          return new Response(await (await fetch(GAS_URL, { method: request.method, body: await request.text(), headers: { "Content-Type": "text/plain;charset=utf-8" } })).text(), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
        }

        let settingsRaw = []; let s = {};
        if (SHEET_ID) {
            settingsRaw = await fetchSheetData(SHEET_ID, 'Settings');
            settingsRaw.forEach(row => { if(row && row[0]) s[row[0]] = row[1]; });
        }
        
        const BLOG_SLUG = s.blog_slug || 'blog';
        const CATEGORY_SLUG = s.category_slug || 'kategori';

        // ✨ SITEMAP INDEX & CHUNKING
        if (path === "/sitemap.xml") {
            if (!SHEET_ID) return new Response("SHEET_ID tidak ditemukan", { status: 500 });
            
            const countRaw = await fetchSheetData(SHEET_ID, 'Posts', 'SELECT count(B) WHERE B IS NOT NULL');
            const totalRows = (countRaw[0] && countRaw[0][0]) ? parseInt(countRaw[0][0]) : 0;
            const totalChunks = Math.ceil(totalRows / 1000) || 1;
            
            let sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
            for (let i = 1; i <= totalChunks; i++) {
                sitemapIndex += `<sitemap><loc>${reqSiteUrl}/sitemap-${i}.xml</loc></sitemap>`;
            }
            sitemapIndex += `</sitemapindex>`;
            return cacheAndRespond(sitemapIndex);
        }

        const sitemapMatch = path.match(/^\/sitemap-(\d+)\.xml$/);
        if (sitemapMatch) {
            if (!SHEET_ID) return new Response("SHEET_ID tidak ditemukan", { status: 500 });
            const chunkIndex = parseInt(sitemapMatch[1]);
            const limit = 1000;
            const offset = (chunkIndex - 1) * limit;

            const postsData = await fetchSheetData(SHEET_ID, 'Posts', `SELECT B, D, G WHERE B IS NOT NULL ORDER BY G DESC LIMIT ${limit} OFFSET ${offset}`);
            
            let sitemapUrls = '';
            
            if (chunkIndex === 1) {
                sitemapUrls += `<url><loc>${reqSiteUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url><url><loc>${reqSiteUrl}/${BLOG_SLUG}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`;
            }

            const uniqueCats = new Set();
            postsData.forEach(post => { 
                if (post[0]) sitemapUrls += `<url><loc>${reqSiteUrl}/${BLOG_SLUG}/${post[0]}</loc><lastmod>${parseDateSafe(post[2]).short}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`; 
                if (post[1]) {
                    post[1].split(',').forEach(c => {
                        const clean = c.trim();
                        if(clean) uniqueCats.add(slugify(clean));
                    });
                }
            });
            uniqueCats.forEach(cat => { sitemapUrls += `<url><loc>${reqSiteUrl}/${CATEGORY_SLUG}/${cat}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`; });
            
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls}</urlset>`;
            return cacheAndRespond(xmlContent);
        }

        const generateSeoMetaTags = (seoData, s) => {
            return `<title>${seoData.title}</title><meta name="description" content="${seoData.description}"><meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="${seoData.url}">${s.google_site_verification ? `<meta name="google-site-verification" content="${s.google_site_verification}">` : ''}${s.bing_site_verification ? `<meta name="msvalidate.01" content="${s.bing_site_verification}">` : ''}<meta property="og:locale" content="id_ID"><meta property="og:type" content="${seoData.type}"><meta property="og:title" content="${seoData.title}"><meta property="og:description" content="${seoData.description}"><meta property="og:image" content="${seoData.image}"><meta property="og:url" content="${seoData.url}"><meta property="og:site_name" content="${s.site_name || 'Website'}">${seoData.publishedTime ? `<meta property="article:published_time" content="${seoData.publishedTime}">` : ''}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${seoData.title}"><meta name="twitter:description" content="${seoData.description}"><meta name="twitter:image" content="${seoData.image}">`.trim();
        };

        const REGEX_SHORTCODES = /\[([a-zA-Z0-9\-]+)=([^\]"']+)\]/gi;
        const safeExcerpt = (c) => {
            if (!c) return s.site_tagline || '';
            // Menghapus shortcode [cari-x] agar tidak bocor ke meta deskripsi
            let cleanText = String(c).replace(REGEX_SHORTCODES, '').replace(/\[cari\]/gi, '').replace(/\[cari-[^\]]+\]/gi, '').replace(/\{\{recent_posts\}\}/gi, '').replace(/\[artikel-[^\]]+\]/gi, '').replace(/<[^>]+>/g, '').trim();
            return cleanText.substring(0, 150) + (cleanText.length > 150 ? '...' : '');
        };

        const applyGlobalPlaceholders = (html, s, seoMetaHtml, ctxData = {}) => {
            let res = html;
            if (ctxData.content) res = res.replace(/\{\{content\}\}/g, ctxData.content);
            if (ctxData.popular_widget) res = res.replace(/\{\{popular_widget\}\}/g, ctxData.popular_widget);
            if (ctxData.recent_posts !== undefined) res = res.replace(/\{\{recent_posts\}\}/g, ctxData.recent_posts);
            else res = res.replace(/\{\{recent_posts\}\}/gi, '[artikel-6]');
            
            if (ctxData.toc !== undefined) res = res.replace(/\{\{toc\}\}/g, ctxData.toc);
            if (ctxData.toc_title) res = res.replace(/\{\{toc_title\}\}/g, ctxData.toc_title);
            if (ctxData.toc_content) res = res.replace(/\{\{toc_content\}\}/g, ctxData.toc_content);
            if (ctxData.baca_juga !== undefined) res = res.replace(/\{\{baca_juga\}\}/g, ctxData.baca_juga);
            if (ctxData.baca_juga_title) res = res.replace(/\{\{baca_juga_title\}\}/g, ctxData.baca_juga_title);

            // Fungsi Form Builder Dinamis (Global maupun Per-Kategori)
            const buildSearchForm = (actionUrl, placeholderText) => `<div class="my-10 w-full flex justify-center"><form action="${actionUrl}" method="GET" class="relative w-full max-w-3xl group"><div class="absolute inset-y-0 left-5 flex items-center pointer-events-none"><svg class="w-6 h-6 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg></div><input type="text" name="q" placeholder="${placeholderText}" class="block w-full py-5 pr-32 pl-14 md:pl-16 text-lg text-slate-800 bg-white border-2 border-slate-200 rounded-full shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" required><button type="submit" class="absolute right-2.5 bottom-2.5 top-2.5 bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-bold rounded-full text-white px-6 md:px-8 transition-colors shadow-md text-base flex items-center">Cari</button></form></div>`;

            res = res.replace(/\{\{seo_meta\}\}/g, seoMetaHtml || '').replace(/\{\{site_name\}\}/g, s.site_name || 'Website').replace(/\{\{site_tagline\}\}/g, s.site_tagline || 'Profesional').replace(/\{\{site_logo\}\}/g, s.site_logo || 'https://ik.imagekit.io/qmuoybenvx/icon-disatu.web_.id__YB_M5g9O8.png').replace(/\{\{site_favicon\}\}/g, s.site_favicon || 'https://ik.imagekit.io/qmuoybenvx/icon-disatu.web_.id__YB_M5g9O8.png').replace(/\{\{year\}\}/g, new Date().getFullYear()).replace(/\{\{today_date\}\}/g, new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })).replace(/\{\{site_url\}\}/g, reqSiteUrl)
            // Render Shortcode [cari] Global
            .replace(/\[cari\]/gi, buildSearchForm(`/${BLOG_SLUG}`, 'Cari layanan, artikel, atau informasi...'))
            // Render Shortcode [cari-namakategori]
            .replace(/\[cari-([^\]]+)\]/gi, (match, catSlug) => buildSearchForm(`/${CATEGORY_SLUG}/${catSlug}`, `Cari dalam kategori ${catSlug.replace(/-/g, ' ').toUpperCase()}...`));

            for (const [key, value] of Object.entries(ctxData)) {
                if(key !== 'content' && key !== 'popular_widget' && key !== 'recent_posts' && !key.startsWith('toc') && !key.startsWith('baca_juga')) {
                    res = res.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), value || '');
                }
            }
            return res;
        };

        const isHome = path === '/' || path === '/index.html';
        const isBlogList = path === `/${BLOG_SLUG}`;
        const isPostDetail = path.startsWith(`/${BLOG_SLUG}/`);
        const isCategoryList = path.startsWith(`/${CATEGORY_SLUG}/`);

        if (SHEET_ID && (isHome || isBlogList || isPostDetail || isCategoryList || path.length > 1)) {
            
            // FETCH GLOBAL UMUM
            const [pagesRaw, usersRaw] = await Promise.all([
                fetchSheetData(SHEET_ID, 'Pages'), 
                fetchSheetData(SHEET_ID, 'Users')
            ]);

            let usersMap = {}; 
            usersRaw.forEach(row => { 
                if (row) {
                    if (row[0]) usersMap[row[0].toString().toLowerCase()] = row[2] || "Admin";
                    if (row[4]) usersMap[row[4].toString().toLowerCase()] = row[2] || "Admin";
                } 
            });

            const safeImg = (imgUrl) => imgUrl || s.site_logo || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&q=80';
            const siteFavicon = s.site_favicon || 'https://ik.imagekit.io/qmuoybenvx/icon-disatu.web_.id__YB_M5g9O8.png';

            const buildPopularWidget = (popularPostsArray) => {
                if (!popularPostsArray) return '';
                return popularPostsArray.map(p => {
                    const firstCatPop = (p[3] || 'Info').split(',')[0].trim();
                    return `
                    <a href="/${BLOG_SLUG}/${p[1]}" class="flex gap-4 group items-start p-3 -mx-3 rounded-2xl hover:bg-slate-50 transition-colors">
                        <div class="overflow-hidden rounded-xl shadow-sm flex-shrink-0 w-24 h-20"><img src="${safeImg(p[4])}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"></div>
                        <div class="flex-1 pt-1"><span class="text-[10px] font-bold text-blue-600 tracking-widest uppercase mb-1.5 block">${firstCatPop}</span><h4 class="font-bold text-[15px] leading-snug text-slate-800 group-hover:text-blue-600 line-clamp-2">${p[2]}</h4></div>
                    </a>`;
                }).join('');
            };

            const buildBacaJugaWidget = (relatedArray) => {
                if (!relatedArray || relatedArray.length === 0) return '';
                let html = `<div class="mt-12 pt-6 border-t border-slate-200"><h3 class="text-sm font-semibold text-slate-600 mb-3">Baca Juga:</h3><ul class="space-y-1.5 baca-juga-list">`;
                relatedArray.forEach(p => {
                    html += `<li class="flex items-center gap-2"><span class="text-slate-400 text-xs flex-shrink-0">►</span><a href="/${BLOG_SLUG}/${p[1]}" class="text-slate-600 hover:text-blue-600 transition-colors text-sm hover:underline">${p[2]}</a></li>`;
                });
                return html + '</ul></div>';
            };

            const buildCardHtml = (postRawArray) => {
                const rawContent = postRawArray[5] || '';
                const pDate = parseDateSafe(postRawArray[6] || postRawArray[5]).formatted; 
                let metaData = { status: '', price: '', wa: '', location: '', specs: [] };
                let m;
                while ((m = REGEX_SHORTCODES.exec(rawContent)) !== null) {
                    let k = m[1].toLowerCase(); let v = m[2].trim();
                    if(k==='lt') k='luas-tanah'; if(k==='lb') k='luas-bangunan';
                    if(k==='kt') k='kamar-tidur'; if(k==='km') k='kamar-mandi';
                    if (k === 'status') metaData.status = v;
                    else if (k.match(/^(harga|tarif|biaya|spp)$/)) metaData.price = v;
                    else if (k.startsWith('wa-')) metaData.wa = v;
                    else if (k === 'lokasi' || k === 'alamat') metaData.location = v;
                    else metaData.specs.push({ key: k, val: v });
                }
                const cleanExcerpt = safeExcerpt(rawContent);

                let statusBadge = '';
                if (metaData.status) {
                    let bgClass = 'bg-blue-600';
                    if (metaData.status.toLowerCase().match(/terjual|sold|full|penuh/)) bgClass = 'bg-red-500';
                    else if (metaData.status.toLowerCase().match(/sewa|sisa/)) bgClass = 'bg-orange-500';
                    statusBadge = `<div class="absolute top-4 right-4 ${bgClass} text-white px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider uppercase shadow-md z-10">${metaData.status}</div>`;
                }

                const priceBadge = metaData.price ? `<div class="text-[18px] font-black text-emerald-600 mb-2">${metaData.price}</div>` : '';
                const locationPin = metaData.location ? `<div class="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">${getSmartIcon('lokasi', 'w-3.5 h-3.5')} <span class="truncate">${metaData.location}</span></div>` : '';
                let cardSpecsList = metaData.specs.slice(0, 4).map(spec => {
                    let k = spec.key; let v = spec.val; let displayVal = v;
                    if(k==='kamar-tidur') displayVal = v.replace(/kamar/i,'').trim() + ' KT';
                    else if(k==='kamar-mandi') displayVal = v.replace(/mandi|kamar/i,'').trim() + ' KM';
                    else if(k==='luas-tanah') displayVal = 'LT ' + v.replace(/m2/i,'').trim();
                    else if(k==='luas-bangunan') displayVal = 'LB ' + v.replace(/m2/i,'').trim();
                    return `<span class="flex items-center gap-1.5 truncate" title="${k.replace(/-/g,' ').toUpperCase()}">${getSmartIcon(k, "w-4 h-4 text-blue-500")} <span class="truncate">${displayVal}</span></span>`;
                });
                const specsHtml = cardSpecsList.length > 0 ? `<div class="grid grid-cols-2 gap-x-3 gap-y-2 mt-4 pt-4 border-t border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">${cardSpecsList.join('')}</div>` : '';
                const hasAnyMeta = metaData.status || metaData.price || metaData.location || metaData.specs.length > 0;
                const dateHtml = hasAnyMeta ? '' : `<div class="text-[12px] font-semibold text-slate-400 mb-2">${pDate}</div>`;

                const primaryCatCard = (postRawArray[3] || 'Kategori').split(',')[0].trim();

                return `<article class="group hover-card bg-white rounded-[1.5rem] border border-slate-100 overflow-hidden cursor-pointer flex flex-col shadow-sm hover:shadow-md" onclick="window.top.location.href='/${BLOG_SLUG}/${postRawArray[1]}'">
                    <div class="relative overflow-hidden aspect-[4/3] bg-slate-100"><img src="${safeImg(postRawArray[4])}" loading="lazy" decoding="async" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"><div class="absolute top-4 left-4 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider text-blue-600 uppercase shadow-sm z-10">${primaryCatCard}</div>${statusBadge}</div>
                    <div class="p-5 lg:p-6 flex flex-col flex-grow">${dateHtml}${locationPin}<h4 class="text-lg font-bold mb-2 leading-snug text-slate-900 group-hover:text-blue-600 transition-colors" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${postRawArray[2]}</h4>${priceBadge}<p class="text-[14px] text-slate-500 flex-grow leading-relaxed mb-4" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${cleanExcerpt}</p>${specsHtml}<div class="${specsHtml ? 'mt-4 pt-4 border-t border-slate-100' : 'mt-auto pt-4'} flex items-center gap-1.5 text-[14px] font-bold text-blue-600 group-hover:gap-2.5 transition-all duration-300">Selengkapnya <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg></div></div></article>`;
            };

            // ✨ SERVER-SIDE SHORTCODE QUERIES & PAGINATION
            const processShortcuts = async (contentString, titleContext = 'Informasi') => {
                if (!contentString) return '';
                contentString = contentString.replace(/\[toc(?:=([^\]]+))?\]/gi, (match, customTitle) => {
                    return `{{toc_title::${customTitle ? customTitle.trim() : 'Daftar Isi'}}}{{toc}}`;
                });
                contentString = contentString.replace(/\[baca_juga(?:=([0-9]+))?\]/gi, (match, countStr) => {
                    return `{{baca_juga_count::${countStr ? parseInt(countStr, 10) : 3}}}{{baca_juga}}`;
                });
                
                const regexArtikel = /\[artikel-([^\]]+)\]/gi;
                let html = contentString;
                
                const matches = [...contentString.matchAll(regexArtikel)];
                for (const match of matches) {
                    const param = match[1].trim(); 
                    let parts = param.split('-');
                    
                    // Deteksi jika shortcode berakhiran '-p' untuk memunculkan pagination
                    let showPagination = false;
                    if (parts.length > 1 && parts[parts.length - 1].toLowerCase() === 'p') {
                        showPagination = true;
                        parts.pop(); // Buang '-p' dari parts
                    }
                    
                    const countStr = parts.pop().trim(); 
                    const count = parseInt(countStr, 10);
                    if (isNaN(count)) continue;
                    
                    const catSlugRaw = parts.length > 0 ? parts.join('-').trim() : null;
                    let qWhere = `B IS NOT NULL`;
                    if (catSlugRaw) {
                        const catName = catSlugRaw.replace(/-/g, ' ');
                        qWhere += ` AND lower(D) contains '${catName.toLowerCase()}'`;
                    }
                    
                    let targetedPosts = [];
                    let paginationHtml = '';

                    if (showPagination) {
                        const catIdentifier = catSlugRaw || 'all';
                        const scPageParam = `p_${catIdentifier.replace(/[^a-z0-9]/g, '')}`; // Pisahkan parameter tiap kategori
                        const currentScPage = parseInt(url.searchParams.get(scPageParam)) || 1;
                        const offset = (currentScPage - 1) * count;

                        const qData = `SELECT A, B, C, D, E, F, G, H WHERE ${qWhere} ORDER BY G DESC LIMIT ${count} OFFSET ${offset}`;
                        const qCount = `SELECT count(B) WHERE ${qWhere}`;

                        const [fetchedPosts, countData] = await Promise.all([
                            fetchSheetData(SHEET_ID, 'Posts', qData),
                            fetchSheetData(SHEET_ID, 'Posts', qCount)
                        ]);
                        
                        targetedPosts = fetchedPosts;
                        const totalScRows = (countData[0] && countData[0][0]) ? parseInt(countData[0][0]) : 0;
                        const totalScPages = Math.ceil(totalScRows / count) || 1;

                        // Generate Pagination HTML Jika Stok Kategori Masih Ada
                        if (totalScPages > 1) {
                            const currentUrl = new URL(request.url);
                            currentUrl.searchParams.delete(scPageParam);
                            const queryStr = currentUrl.searchParams.toString();
                            const baseQueryStr = queryStr ? `&${queryStr}` : '';
                            const basePath = currentUrl.pathname;

                            paginationHtml = `<div class="col-span-full flex justify-center items-center gap-3 mt-8 mb-4">`;
                            
                            // Tombol Back
                            if (currentScPage > 1) {
                                paginationHtml += `<a href="${basePath}?${scPageParam}=${currentScPage - 1}${baseQueryStr}" class="px-5 py-2.5 bg-white border border-slate-200 rounded-full font-semibold text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm transition-all text-sm flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg> Back</a>`;
                            } else {
                                paginationHtml += `<div class="px-5 py-2.5 opacity-0 pointer-events-none w-[90px]"></div>`;
                            }
                            
                            // Indikator Halaman
                            paginationHtml += `<span class="text-sm font-bold text-slate-600 bg-slate-100/80 backdrop-blur-sm border border-slate-200 px-6 py-2.5 rounded-full shadow-inner">Hal ${currentScPage} / ${totalScPages}</span>`;
                            
                            // Tombol Next
                            if (currentScPage < totalScPages) {
                                paginationHtml += `<a href="${basePath}?${scPageParam}=${currentScPage + 1}${baseQueryStr}" class="px-5 py-2.5 bg-white border border-slate-200 rounded-full font-semibold text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm transition-all text-sm flex items-center gap-1.5">Next <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></a>`;
                            } else {
                                paginationHtml += `<div class="px-5 py-2.5 opacity-0 pointer-events-none w-[90px]"></div>`;
                            }
                            
                            paginationHtml += `</div>`;
                        }

                    } else {
                        // Original Logic Without Pagination
                        let q = `SELECT A, B, C, D, E, F, G, H WHERE ${qWhere} ORDER BY G DESC LIMIT ${count}`;
                        targetedPosts = await fetchSheetData(SHEET_ID, 'Posts', q);
                    }
                    
                    let replaceHtml = '';
                    if (targetedPosts.length === 0) {
                        replaceHtml = `<div class="w-full text-center p-5 border-2 border-dashed border-red-200 bg-red-50/50 rounded-2xl text-red-500 text-sm my-8 shadow-sm">⚠️ Data shortcode dipanggil, namun tidak ada artikel ditemukan.</div>`;
                    } else {
                        // Tempelkan blok pagination di bawah grid
                        replaceHtml = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 my-10 w-full">${targetedPosts.map(p => buildCardHtml(p)).join('')}${paginationHtml}</div>`;
                    }
                    html = html.replace(match[0], replaceHtml);
                }

                html = html.replace(REGEX_SHORTCODES, (match, param, value) => {
                    let key = param.toLowerCase(); const val = value.trim();
                    if(key==='lt') key='luas-tanah'; if(key==='lb') key='luas-bangunan';
                    if(key==='kt') key='kamar-tidur'; if(key==='km') key='kamar-mandi';
                    if (key === 'status') {
                        let badgeClass = 'bg-blue-100 text-blue-700 border-blue-200';
                        if (val.toLowerCase().match(/terjual|sold|full|penuh/)) badgeClass = 'bg-red-100 text-red-700 border-red-200';
                        else if (val.toLowerCase().match(/sewa|sisa/)) badgeClass = 'bg-orange-100 text-orange-700 border-orange-200';
                        return `<div class="inline-block border-2 font-black uppercase tracking-widest text-sm px-5 py-2 rounded-xl mb-6 ${badgeClass} shadow-sm">${val}</div>`;
                    }
                    if (key.match(/^(harga|tarif|biaya|spp)$/)) return `<div class="text-3xl md:text-4xl font-black text-emerald-600 my-6 py-4 px-6 bg-emerald-50/50 border-2 border-emerald-100 rounded-2xl inline-block w-full text-center shadow-sm tracking-tight">${val}</div>`;
                    if(key.startsWith('wa-')) {
                        let waNum = val.replace(/[^0-9]/g, ''); if(waNum.startsWith('0')) waNum = '62' + waNum.substring(1);
                        return `<a href="https://wa.me/${waNum}?text=Halo,%20saya%20tertarik%20dengan%20${encodeURIComponent(titleContext)}" target="_blank" class="flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-4 px-6 rounded-2xl transition-all w-full my-8 shadow-xl shadow-green-500/20 transform hover:-translate-y-1 text-lg"><svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.015c-.198 0-.52.074-.792.347-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg> Hubungi via WhatsApp</a>`;
                    }
                    const label = key.replace(/-/g, ' ').toUpperCase();
                    return `<div class="inline-flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl my-2 mr-2 min-w-[160px] shadow-sm hover:border-blue-300 transition-colors"><div class="text-blue-500 bg-blue-50 p-2 rounded-lg">${getSmartIcon(key, 'w-5 h-5')}</div><div class="flex-1"><div class="text-[10px] font-bold text-slate-400 tracking-widest">${label}</div><div class="font-bold text-slate-800 text-sm mt-0.5">${val}</div></div></div>`;
                });
                return html;
            };

            const cssStyles = `<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');body { font-family: 'Inter', sans-serif; background-color: #f8fafc; color: #0f172a; }.glass-nav { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid rgba(241, 245, 249, 0.8); }.soft-shadow { box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.04), 0 0 3px rgba(0,0,0,0.02); }.hover-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }.hover-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04); }.cms-content { font-size: 1.125rem; line-height: 1.85; color: #334155; width: 100%; }.cms-content h2 { font-size: 1.875rem; font-weight: 800; margin: 2.5rem 0 1.25rem; color: #0f172a; letter-spacing: -0.02em; }.cms-content h3 { font-size: 1.5rem; font-weight: 700; margin: 2rem 0 1rem; color: #1e293b; letter-spacing: -0.01em; }.cms-content p { margin-bottom: 1.75rem; }.cms-content a { color: #2563eb; text-decoration: none; border-bottom: 2px solid transparent; transition: border-color 0.2s; }.cms-content a:hover { border-color: #2563eb; }.cms-content img { border-radius: 1.25rem; margin: 2.5rem 0; width: 100%; height: auto; object-fit: cover; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }.cms-content ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1.75rem; }.cms-content ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1.75rem; }.cms-content li { margin-bottom: 0.5rem; }.cms-content blockquote { border-left: 4px solid #3b82f6; background: #eff6ff; padding: 1.25rem 1.5rem; border-radius: 0 1rem 1rem 0; margin: 2rem 0; font-style: italic; color: #1e3a8a; }.toc-list a { transition: color 0.2s; }.toc-list a:hover { color: #2563eb; }#toc-content { transition: all 0.3s ease-in-out; } .cms-content .toc-list, .cms-content .toc-list ul, .cms-content .baca-juga-list { list-style-type: none !important; padding-left: 0 !important; margin-bottom: 0 !important; } .cms-content .toc-list li, .cms-content .baca-juga-list li { list-style-type: none !important; margin-bottom: 0.25rem !important; }</style>`;

            const defaultHeaderHtml = s.header_template || `<header class="glass-nav sticky top-0 z-50"><div class="max-w-7xl mx-auto px-5 lg:px-8 py-4 flex justify-between items-center"><a href="/" class="flex-shrink-0 flex items-center gap-3.5 group"><img src="{{site_logo}}" alt="Logo" class="h-10 w-auto object-contain group-hover:scale-105 transition-transform duration-300"><div><h1 class="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{{site_name}}</h1></div></a><nav class="hidden md:block"><ul class="flex items-center gap-8 text-[15px] font-semibold text-slate-600"><li><a href="/" class="hover:text-blue-600 transition-colors">Beranda</a></li><li><a href="/${BLOG_SLUG}" class="hover:text-blue-600 transition-colors">Artikel & Info</a></li></ul></nav></div></header>`;

            const defaultFooterHtml = s.footer_template || `<footer class="bg-white border-t border-slate-200 py-16 mt-20"><div class="max-w-7xl mx-auto px-5 flex flex-col items-center text-center"><img src="{{site_logo}}" class="h-12 w-auto mb-6 opacity-90 hover:scale-105 transition-transform" alt="Logo Footer"><h2 class="text-2xl font-black text-slate-900 tracking-tight mb-2">{{site_name}}</h2><p class="text-[15px] text-slate-500 mb-8 max-w-md leading-relaxed">{{site_tagline}}</p><div class="w-full border-t border-slate-100 pt-8 text-sm text-slate-500 font-medium">&copy; {{year}} {{site_name}}. Hak Cipta Dilindungi. <br/><span class="mt-4 inline-flex items-center justify-center bg-slate-50 text-slate-400 px-4 py-1.5 rounded-full text-xs font-semibold border border-slate-200">by Andi | disatu.web.id</span></div></div></footer>`;

            // =========================================================================
            // BLOK 1: PAGING (HOME / LIST) DENGAN SERVER-SIDE SQL LIMIT
            // =========================================================================
            if (isHome || isBlogList || isCategoryList) {
                let listTitle = s.site_name || "Pembaruan Terkini"; 
                let listDesc = s.site_tagline || "Informasi, panduan, dan penawaran terbaik khusus untuk Anda.";
                let pageTypeUrl = reqSiteUrl + path;
                
                const POSTS_PER_PAGE = 12; 
                const currentPage = parseInt(url.searchParams.get('p')) || 1;
                const offset = (currentPage - 1) * POSTS_PER_PAGE;
                
                let baseWhere = `B IS NOT NULL`;
                const searchQuery = url.searchParams.get('q');
                
                // Cek apakah user sedang berada di halaman spesifik kategori terlebih dahulu
                if (isCategoryList) {
                    const catSlugFromUrl = path.split('/')[2];
                    const catName = catSlugFromUrl.replace(/-/g, ' ');
                    baseWhere += ` AND lower(D) contains '${catName.toLowerCase()}'`;
                    listTitle = `Kategori: ${catName}`; 
                    listDesc = `Kumpulan update terbaru dari kategori ini.`;
                }
                
                // Tambahkan filter query ke baseWhere baik untuk global maupun per kategori
                if (searchQuery) {
                    const sq = searchQuery.replace(/'/g, "''").toLowerCase(); 
                    baseWhere += ` AND (lower(C) contains '${sq}' OR lower(D) contains '${sq}')`;
                    
                    if (isCategoryList) {
                        listTitle = `Pencarian "${searchQuery}" di ${listTitle.replace('Kategori: ', '')}`;
                    } else {
                        listTitle = `Hasil Pencarian: "${searchQuery}"`; 
                        listDesc = `Hasil penelusuran terkini.`;
                    }
                }

                const queryCount = `SELECT count(B) WHERE ${baseWhere}`;
                const queryData = `SELECT A, B, C, D, E, F, G, H WHERE ${baseWhere} ORDER BY G DESC LIMIT ${POSTS_PER_PAGE} OFFSET ${offset}`;

                const [countRaw, postsRaw] = await Promise.all([
                    fetchSheetData(SHEET_ID, 'Posts', queryCount),
                    fetchSheetData(SHEET_ID, 'Posts', queryData)
                ]);

                const totalRows = (countRaw[0] && countRaw[0][0]) ? parseInt(countRaw[0][0]) : 0;
                const totalPages = Math.ceil(totalRows / POSTS_PER_PAGE) || 1;
                
                let schemaItemListArr = postsRaw.map((p, idx) => ({
                    "@type": "ListItem", "position": idx + 1, "url": `${reqSiteUrl}/${BLOG_SLUG}/${p[1]}`
                }));
                
                const seoHome = { title: currentPage > 1 ? `${listTitle} - Halaman ${currentPage} - ${s.site_name}` : `${listTitle} - ${s.site_name}`, description: listDesc || s.site_tagline, image: s.site_logo, url: pageTypeUrl + (currentPage > 1 ? `?p=${currentPage}` : '') + (searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''), type: 'website' };

                if (isHome && s.home_page && currentPage === 1 && !isCategoryList && !searchQuery) { 
                    const homePage = pagesRaw.find(p => p[1] === s.home_page);
                    if (homePage) {
                        const rawContent = homePage[3] || '';
                        const homeExcerpt = homePage[2] || ''; 
                        const seoMetaHtml = generateSeoMetaTags({ ...seoHome, title: `${homePage[2]} - ${s.site_name}`, description: homeExcerpt }, s);
                        let ctxDataHome = { title: homePage[2], title_safe: safeJson(homePage[2]), excerpt: homeExcerpt, excerpt_safe: safeJson(homeExcerpt), page_url: reqSiteUrl + path, image_url: s.site_logo, date_iso: new Date().toISOString(), content: rawContent };

                        if (rawContent.match(/<html/i) || rawContent.match(/<!DOCTYPE html>/i)) {
                            let iframeHtml = rawContent.includes('<base target=') ? rawContent : rawContent.replace('<head>', '<head><base target="_parent">');
                            iframeHtml = applyGlobalPlaceholders(iframeHtml, s, seoMetaHtml, ctxDataHome);
                            iframeHtml = await processShortcuts(iframeHtml, homePage[2]);
                            return cacheAndRespond(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${seoMetaHtml}<link rel="icon" href="${siteFavicon}"><style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #f8fafc; } iframe { width: 100%; height: 100vh; border: none; display: block; }</style></head><body><iframe srcdoc="${iframeHtml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}"></iframe></body></html>`);
                        } else {
                            const rawTemplateStr = s.page_template || `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">{{seo_meta}}\n<script type="application/ld+json">{"@context": "https://schema.org","@type": "WebSite","name": "{{site_name}}","url": "{{site_url}}"}</script>\n<link rel="icon" href="${siteFavicon}"><script src="https://cdn.tailwindcss.com"></script><script src="https://unpkg.com/lucide@latest"></script>${cssStyles}</head><body class="flex flex-col min-h-screen selection:bg-blue-100">${defaultHeaderHtml}<main class="flex-grow w-full">{{content}}</main>${defaultFooterHtml}</body></html>`;
                            let finalHtml = applyGlobalPlaceholders(rawTemplateStr, s, seoMetaHtml, ctxDataHome);
                            finalHtml = await processShortcuts(finalHtml, homePage[2]);
                            return cacheAndRespond(finalHtml);
                        }
                    }
                }
                const urlParams = new URLSearchParams(); if(searchQuery) urlParams.set('q', searchQuery);
                const baseQueryStr = urlParams.toString() ? `&${urlParams.toString()}` : '';
                const paginationHtml = totalPages > 1 ? `<div class="col-span-full flex justify-center items-center gap-3 mt-16 mb-8">${currentPage > 1 ? `<a href="?p=${currentPage - 1}${baseQueryStr}" class="px-5 py-2.5 bg-white border border-slate-200 rounded-full font-semibold text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm transition-all text-sm flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg> Back</a>` : '<div class="px-5 py-2.5 opacity-0 pointer-events-none w-[90px]"></div>'}<span class="text-sm font-bold text-slate-600 bg-slate-100/80 backdrop-blur-sm border border-slate-200 px-6 py-2.5 rounded-full shadow-inner">Hal ${currentPage} / ${totalPages}</span>${currentPage < totalPages ? `<a href="?p=${currentPage + 1}${baseQueryStr}" class="px-5 py-2.5 bg-white border border-slate-200 rounded-full font-semibold text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm transition-all text-sm flex items-center gap-1.5">Next <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></a>` : '<div class="px-5 py-2.5 opacity-0 pointer-events-none w-[90px]"></div>'}</div>` : '';
                let recentPostsHtml = postsRaw.map(p => buildCardHtml(p)).join('') + paginationHtml;
                
                let ctxDataList = {
                    title: listTitle, title_safe: safeJson(listTitle), category_name: listTitle.replace('Kategori: ', ''), category_desc: listDesc, excerpt: listDesc, excerpt_safe: safeJson(listDesc), page_url: reqSiteUrl + path, image_url: s.site_logo, date_iso: new Date().toISOString(), schema_item_list: JSON.stringify(schemaItemListArr),
                    recent_posts: postsRaw.length === 0 ? '<div class="col-span-full text-center py-20 text-slate-500 text-lg">Belum ada data yang ditemukan.</div>' : recentPostsHtml
                };

                const rawTemplateStr = (isCategoryList && s.category_template) ? s.category_template : (s.blog_template || `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">{{seo_meta}}\n<script type="application/ld+json">{"@context": "https://schema.org","@type": "CollectionPage","name": "{{title_safe}}","description":"{{excerpt_safe}}","url": "{{page_url}}","mainEntity": {"@type": "ItemList","itemListElement": {{schema_item_list}}}}</script>\n<link rel="icon" href="${siteFavicon}"><script src="https://cdn.tailwindcss.com"></script><script src="https://unpkg.com/lucide@latest"></script>${cssStyles}</head><body class="flex flex-col min-h-screen selection:bg-blue-100">${defaultHeaderHtml}<main class="flex-grow max-w-7xl mx-auto px-5 lg:px-8 py-16 lg:py-24 w-full"><div class="text-center mb-16 lg:mb-20"><h1 class="text-4xl lg:text-5xl font-black mb-5 tracking-tight text-slate-900">{{title}}</h1><p class="text-lg lg:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">{{category_desc}}</p></div><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">{{recent_posts}}</div></main>${defaultFooterHtml}</body></html>`);
                
                let finalHtml = applyGlobalPlaceholders(rawTemplateStr, s, generateSeoMetaTags(seoHome, s), ctxDataList);
                finalHtml = await processShortcuts(finalHtml, listTitle);
                return cacheAndRespond(finalHtml);
            }

            // =========================================================================
            // BLOK 2: POST DETAIL DENGAN SERVER-SIDE WIDGETS
            // =========================================================================
            if (isPostDetail) {
                const slug = path.split('/')[2]; 
                const fullPostData = await fetchSheetData(SHEET_ID, 'Posts', `SELECT A, B, C, D, E, F, G, H WHERE B = '${slug}' LIMIT 1`);
                const post = fullPostData[0]; 
                
                if (post) {
                    let rawContent = post[5] || '';
                    rawContent = injectHeadingAnchors(rawContent);
                    
                    let metaVars = {}; let match;
                    while ((match = REGEX_SHORTCODES.exec(rawContent)) !== null) {
                        let k = match[1].toLowerCase().replace(/-/g, '_'); const val = match[2].trim();
                        metaVars[`meta_${k}`] = val; metaVars[`meta_${k}_safe`] = safeJson(val);
                        if (k.match(/^(harga|tarif|biaya|spp)$/)) metaVars['meta_harga_clean'] = val.replace(/[^0-9]/g, '');
                    }

                    const tocTitleMatch = rawContent.match(/\{\{toc_title::([^}]+)\}\}/);
                    const tocTitle = tocTitleMatch ? tocTitleMatch[1] : 'Daftar Isi';
                    const tocHtml = generateAutoTOC(rawContent, tocTitle);
                    
                    const bacaJugaCountMatch = rawContent.match(/\{\{baca_juga_count::([0-9]+)\}\}/);
                    const bacaJugaCount = bacaJugaCountMatch ? parseInt(bacaJugaCountMatch[1], 10) : 3;
                    const bacaJugaTitle = s.baca_juga_title || 'Baca Juga';
                    
                    rawContent = rawContent.replace(/\{\{toc_title::[^}]+\}\}/g, '').replace(/\{\{baca_juga_count::[0-9]+\}\}/g, '');

                    // SETUP MULTI-CATEGORY UNTUK BADGES & RELATED
                    const catArray = (post[3] || 'Umum').split(',').map(c => c.trim()).filter(Boolean);
                    const primaryCat = catArray[0] || 'Umum';
                    const catBadgesHtml = catArray.map(c => `<a href="/${CATEGORY_SLUG}/${slugify(c)}" class="inline-flex bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 transition-colors font-bold text-xs tracking-widest uppercase px-4 py-1.5 rounded-lg">${c}</a>`).join('');

                    const [popularPostsArray, relatedPostsArray] = await Promise.all([
                        fetchSheetData(SHEET_ID, 'Posts', `SELECT A, B, C, D, E, F, G, H WHERE B IS NOT NULL AND B != '${slug}' ORDER BY G DESC LIMIT 5`),
                        fetchSheetData(SHEET_ID, 'Posts', `SELECT A, B, C, D, E, F, G, H WHERE lower(D) contains '${primaryCat.toLowerCase()}' AND B != '${slug}' ORDER BY G DESC LIMIT ${bacaJugaCount}`)
                    ]);

                    const popularWidgetHtml = buildPopularWidget(popularPostsArray);
                    const bacaJugaHtml = buildBacaJugaWidget(relatedPostsArray);

                    const postExcerpt = safeExcerpt(rawContent); const postImg = safeImg(post[4]);
                    const postDateFormatted = parseDateSafe(post[6]).formatted; const authorName = usersMap[(post[7] || '').toLowerCase()] || 'Admin';
                    const postDateIso = parseDateSafe(post[6]).iso;
                    const seoPost = { title: `${post[2]} - ${s.site_name}`, description: postExcerpt, image: postImg, url: reqSiteUrl + path, type: 'article', publishedTime: postDateIso };
                    
                    let ctxDataPost = {
                        category: primaryCat, category_badges: catBadgesHtml, title: post[2] || '', title_safe: safeJson(post[2] || ''), date: postDateFormatted, date_iso: postDateIso, author_name: authorName, author_name_safe: safeJson(authorName), excerpt: postExcerpt, excerpt_safe: safeJson(postExcerpt), page_url: reqSiteUrl + path, image_url: postImg,
                        image_tag: post[4] ? `<img src="${post[4]}" class="w-full aspect-[16/9] rounded-[1.5rem] mb-12 object-cover shadow-sm bg-slate-100">` : '',
                        popular_widget: popularWidgetHtml, content: rawContent, toc: tocHtml, toc_title: tocTitle, toc_content: tocHtml, baca_juga: bacaJugaHtml, baca_juga_title: bacaJugaTitle, ...metaVars
                    };

                    const rawTemplateStr = s.article_template || `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">{{seo_meta}}\n<script type="application/ld+json">{"@context": "https://schema.org","@type": "Article","headline": "{{title_safe}}","image": ["{{image_url}}"],"datePublished": "{{date_iso}}","dateModified": "{{date_iso}}","author": { "@type": "Person", "name": "{{author_name_safe}}" }}</script>\n<link rel="icon" href="${siteFavicon}"><script src="https://cdn.tailwindcss.com"></script><script src="https://unpkg.com/lucide@latest"></script>${cssStyles}</head><body class="flex flex-col min-h-screen selection:bg-blue-100">${defaultHeaderHtml}<main class="flex-grow max-w-7xl mx-auto px-5 lg:px-8 py-12 lg:py-20 w-full"><div class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16"><article class="lg:col-span-8 bg-white p-6 md:p-10 lg:p-14 rounded-[2rem] soft-shadow border border-slate-100"><div class="flex flex-wrap gap-2 mb-6">{{category_badges}}</div><h1 class="text-3xl md:text-4xl lg:text-5xl font-black mb-8 leading-[1.2] tracking-tight text-slate-900">{{title}}</h1><div class="flex items-center gap-4 text-slate-500 text-[15px] font-medium mb-10 pb-8 border-b border-slate-100"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-lg">${authorName.charAt(0)}</div><span class="text-slate-800">{{author_name}}</span></div> <span class="text-slate-300">|</span> <div>{{date}}</div></div>{{image_tag}}<div class="cms-content max-w-none">{{toc}}{{content}}{{baca_juga}}</div></article><aside class="lg:col-span-4"><div class="bg-white border border-slate-100 rounded-[2rem] p-8 soft-shadow sticky top-28"><h3 class="text-[17px] font-black border-b border-slate-100 pb-5 mb-6 tracking-tight text-slate-900 uppercase">Artikel Populer</h3><div class="space-y-6">{{popular_widget}}</div></div></aside></div></main>${defaultFooterHtml}</body></html>`;
                    let finalHtml = applyGlobalPlaceholders(rawTemplateStr, s, generateSeoMetaTags(seoPost, s), ctxDataPost);
                    finalHtml = await processShortcuts(finalHtml, post[2]);
                    return cacheAndRespond(finalHtml);
                }
            }
            
            // =========================================================================
            // BLOK 3: STATIC PAGE DETAIL
            // =========================================================================
            const pageSlug = path.substring(1); const page = pagesRaw.find(p => p[1] === pageSlug);
            if (page) {
                const rawContent = page[3] || ''; 
                const pageExcerpt = page[2] || ''; 
                const seoMetaHtml = generateSeoMetaTags({ title: `${page[2]} - ${s.site_name}`, description: pageExcerpt, image: s.site_logo, url: reqSiteUrl + path, type: 'website' }, s);
                let ctxDataPage = { title: page[2], title_safe: safeJson(page[2]), excerpt: pageExcerpt, excerpt_safe: safeJson(pageExcerpt), page_url: reqSiteUrl + path, image_url: s.site_logo, date_iso: new Date().toISOString(), content: rawContent };

                if (rawContent.match(/<html/i) || rawContent.match(/<!DOCTYPE html>/i)) {
                    let iframeHtml = rawContent.includes('<base target=') ? rawContent : rawContent.replace('<head>', '<head><base target="_parent">');
                    iframeHtml = applyGlobalPlaceholders(iframeHtml, s, seoMetaHtml, ctxDataPage);
                    iframeHtml = await processShortcuts(iframeHtml, page[2]);
                    return cacheAndRespond(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${seoMetaHtml}<link rel="icon" href="${siteFavicon}"><style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #f8fafc; } iframe { width: 100%; height: 100vh; border: none; display: block; }</style></head><body><iframe srcdoc="${iframeHtml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}"></iframe></body></html>`);
                } else {
                    const rawTemplateStr = s.page_template || `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">{{seo_meta}}\n<script type="application/ld+json">{"@context": "https://schema.org","@type": "WebPage","name": "{{title_safe}}","description": "{{excerpt_safe}}","url": "{{page_url}}"}</script>\n<link rel="icon" href="${siteFavicon}"><script src="https://cdn.tailwindcss.com"></script><script src="https://unpkg.com/lucide@latest"></script>${cssStyles}</head><body class="flex flex-col min-h-screen selection:bg-blue-100">${defaultHeaderHtml}<main class="flex-grow max-w-4xl mx-auto px-5 py-12 md:py-20 w-full"><div class="bg-white p-8 md:p-16 rounded-[2rem] soft-shadow border border-slate-100"><h1 class="text-3xl md:text-5xl font-black mb-12 tracking-tight text-slate-900 text-center">{{title}}</h1><div class="cms-content w-full">{{content}}</div></div></main>${defaultFooterHtml}</body></html>`;
                    let finalHtml = applyGlobalPlaceholders(rawTemplateStr, s, seoMetaHtml, ctxDataPage);
                    finalHtml = await processShortcuts(finalHtml, page[2]);
                    return cacheAndRespond(finalHtml);
                }
            }
        }
        return env.ASSETS.fetch(request);
      }
    };
