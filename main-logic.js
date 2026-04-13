// main-logic.js - ENGINE CMS GOD MODE ULTIMATE (CENTRALIZED)
// by Andi | disatu.web.id

export async function handleRequest(request, env, ctx, SHEET_ID, GAS_URL) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';
    const reqSiteUrl = url.origin;

    // --- FUNGSI INTERNAL (DATA FETCHING & UTILS) ---
    
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
        } catch (e) { console.error("Error fetching sheet:", e); }
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

    const REGEX_SHORTCODES = /\[([a-zA-Z0-9\-]+)=([^\]"']+)\]/gi;

    // --- CACHE & LOGIC HELPERS ---
    
    const pageCache = caches.default;
    const pageCacheKey = new Request(url.toString(), { method: 'GET' });
    let contentType = "text/html;charset=UTF-8";
    if (path.endsWith('.xml')) contentType = "text/xml;charset=UTF-8";
    else if (path.endsWith('.txt')) contentType = "text/plain;charset=UTF-8";
    else if (path === '/api') contentType = "application/json";

    const isSearchQuery = url.searchParams.has('q');

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

    // --- SISTEM LISENSI ---
    
    let isLicenseValid = false;
    const forceLicenseRefresh = url.searchParams.has('li') || url.searchParams.get('li') === '1';

    if (SHEET_ID && SHEET_ID !== 'ID_SPREADSHEET_PEMBELI_DISINI' && SHEET_ID !== '') {
        try {
            let MASTER_LICENSE_SHEET_ID = "1tasyRF3BlNgZriFf6DcFh-dpA9mFLON2V7T3vQj5Tg0";
            const masterIdCacheKey = new Request(`https://lic-verify.local/master-id`, { method: 'GET' });
            
            if (forceLicenseRefresh) {
                const configUrl = `https://raw.githubusercontent.com/Andiees/asset-larik/main/lic-config.js?t=${Date.now()}`;
                const configRes = await fetch(configUrl, { cache: 'no-store' });
                if (configRes.ok) {
                    const configText = await configRes.text();
                    const idMatch = configText.match(/MASTER_ID:\s*["']([^"']+)["']/i);
                    if (idMatch) {
                        MASTER_LICENSE_SHEET_ID = idMatch[1];
                        await pageCache.put(masterIdCacheKey, new Response(MASTER_LICENSE_SHEET_ID, { headers: { 'Cache-Control': 'public, max-age=604800' }}));
                    }
                }
            } else {
                const cachedMasterId = await pageCache.match(masterIdCacheKey);
                if (cachedMasterId) MASTER_LICENSE_SHEET_ID = await cachedMasterId.text();
            }

            const licCacheKey = new Request(`https://lic-verify.local/license-v1?id=${SHEET_ID}&host=${url.hostname}`, { method: 'GET' });
            if (forceLicenseRefresh) await pageCache.delete(licCacheKey);

            let cachedLic = (!forceLicenseRefresh) ? await pageCache.match(licCacheKey) : null;
            if (cachedLic) {
                if (await cachedLic.text() === 'OK') isLicenseValid = true;
            } else {
                const query = encodeURIComponent(`SELECT C WHERE A = '${url.hostname}' AND B = '${SHEET_ID}' LIMIT 1`);
                const sheetUrl = `https://docs.google.com/spreadsheets/d/${MASTER_LICENSE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=Licenses&tq=${query}&t=${Date.now()}`;
                const res = await fetch(sheetUrl, { cache: 'no-store' });
                const text = await res.text();
                const jsonStr = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/);
                if (jsonStr && jsonStr[1]) {
                    const json = JSON.parse(jsonStr[1]);
                    if (json.table?.rows?.length > 0 && json.table.rows[0].c[0]?.v === 'Aktif') isLicenseValid = true;
                }
                ctx.waitUntil(pageCache.put(licCacheKey, new Response(isLicenseValid ? 'OK' : 'FAIL', { headers: { 'Content-Type': 'text/plain', 'Cache-Control': `public, max-age=604800` }})));
            }
        } catch (e) { isLicenseValid = true; }
    }

    if (!isLicenseValid) {
        if (!SHEET_ID || SHEET_ID === 'ID_SPREADSHEET_PEMBELI_DISINI') return new Response("⚙️ SISTEM BELUM SIAP: Silakan masukkan Sheet ID Anda di config.js", { status: 200 });
        return new Response(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Lisensi Tidak Valid</title><style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff1f2;color:#9f1239;text-align:center;}h1{font-weight:900;}p{opacity:0.8;margin-bottom:20px;line-height:1.6;}.footer{margin-top:30px;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;}.btn{background:#e11d48;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;}</style></head><body><h1>LISENSI BELUM AKTIF</h1><p>Domain: <strong>${url.hostname}</strong><br>ID: <strong>${SHEET_ID}</strong></p><a href="?li=1" class="btn">REFRESH LISENSI</a><div class="footer">&copy; 2026 AKTIVASI LICENSI DI | LARIK.WEB.ID </div></body></html>`, { status: 403, headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    }

    // --- CORE CMS LOGIC ---

    if (path === "/api") {
        if (!GAS_URL) return new Response("GAS_URL tidak ditemukan", { status: 500 });
        return new Response(await (await fetch(GAS_URL, { method: request.method, body: await request.text(), headers: { "Content-Type": "text/plain;charset=utf-8" } })).text(), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    let settingsRaw = await fetchSheetData(SHEET_ID, 'Settings');
    let s = {}; settingsRaw.forEach(row => { if(row && row[0]) s[row[0]] = row[1]; });
    
    const BLOG_SLUG = s.blog_slug || 'blog';
    const CATEGORY_SLUG = s.category_slug || 'kategori';

    // Sitemap logic
    if (path === "/sitemap.xml" || path.match(/^\/sitemap-(\d+)\.xml$/)) {
        const sitemapMatch = path.match(/^\/sitemap-(\d+)\.xml$/);
        if (!sitemapMatch) {
            const countRaw = await fetchSheetData(SHEET_ID, 'Posts', 'SELECT count(B) WHERE B IS NOT NULL');
            const totalRows = (countRaw[0] && countRaw[0][0]) ? parseInt(countRaw[0][0]) : 0;
            const totalChunks = Math.ceil(totalRows / 1000) || 1;
            let index = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
            for (let i = 1; i <= totalChunks; i++) index += `<sitemap><loc>${reqSiteUrl}/sitemap-${i}.xml</loc></sitemap>`;
            return cacheAndRespond(index + `</sitemapindex>`);
        } else {
            const chunkIndex = parseInt(sitemapMatch[1]);
            const limit = 1000; const offset = (chunkIndex - 1) * limit;
            const postsData = await fetchSheetData(SHEET_ID, 'Posts', `SELECT B, D, G WHERE B IS NOT NULL ORDER BY G DESC LIMIT ${limit} OFFSET ${offset}`);
            let urls = (chunkIndex === 1) ? `<url><loc>${reqSiteUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url><url><loc>${reqSiteUrl}/${BLOG_SLUG}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>` : '';
            const uniqueCats = new Set();
            postsData.forEach(post => {
                if (post[0]) urls += `<url><loc>${reqSiteUrl}/${BLOG_SLUG}/${post[0]}</loc><lastmod>${parseDateSafe(post[2]).short}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`;
                if (post[1]) post[1].split(',').forEach(c => { if(c.trim()) uniqueCats.add(slugify(c.trim())); });
            });
            uniqueCats.forEach(cat => { urls += `<url><loc>${reqSiteUrl}/${CATEGORY_SLUG}/${cat}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`; });
            return cacheAndRespond(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
        }
    }

    if (path === "/robots.txt" || path === "/ads.txt") {
        let content = path === "/robots.txt" ? `User-agent: *\nAllow: /\nSitemap: ${reqSiteUrl}/sitemap.xml` : "";
        if (s.robots_txt && path === "/robots.txt") content = s.robots_txt;
        if (s.ads_txt && path === "/ads.txt") content = s.ads_txt;
        return cacheAndRespond(content);
    }

    // --- SEO & RENDER HELPERS ---

    const generateSeoMetaTags = (seoData, s) => {
        return `<title>${seoData.title}</title><meta name="description" content="${seoData.description}"><meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="${seoData.url}">${s.google_site_verification ? `<meta name="google-site-verification" content="${s.google_site_verification}">` : ''}${s.bing_site_verification ? `<meta name="msvalidate.01" content="${s.bing_site_verification}">` : ''}<meta property="og:locale" content="id_ID"><meta property="og:type" content="${seoData.type}"><meta property="og:title" content="${seoData.title}"><meta property="og:description" content="${seoData.description}"><meta property="og:image" content="${seoData.image}"><meta property="og:url" content="${seoData.url}"><meta property="og:site_name" content="${s.site_name || 'Website'}">${seoData.publishedTime ? `<meta property="article:published_time" content="${seoData.publishedTime}">` : ''}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${seoData.title}"><meta name="twitter:description" content="${seoData.description}"><meta name="twitter:image" content="${seoData.image}">`.trim();
    };

    const safeExcerpt = (c) => {
        if (!c) return s.site_tagline || '';
        let cleanText = String(c).replace(REGEX_SHORTCODES, '').replace(/\[cari\]/gi, '').replace(/\[cari-[^\]]+\]/gi, '').replace(/\{\{recent_posts\}\}/gi, '').replace(/\[artikel-[^\]]+\]/gi, '').replace(/<[^>]+>/g, '').trim();
        return cleanText.substring(0, 150) + (cleanText.length > 150 ? '...' : '');
    };

    const applyGlobalPlaceholders = (html, s, seoMetaHtml, ctxData = {}) => {
        let res = html;
        const buildSearchForm = (actionUrl, placeholderText) => `<div class="my-10 w-full flex justify-center"><form action="${actionUrl}" method="GET" class="relative w-full max-w-3xl group"><div class="absolute inset-y-0 left-5 flex items-center pointer-events-none"><svg class="w-6 h-6 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg></div><input type="text" name="q" placeholder="${placeholderText}" class="block w-full py-5 pr-32 pl-14 md:pl-16 text-lg text-slate-800 bg-white border-2 border-slate-200 rounded-full shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" required><button type="submit" class="absolute right-2.5 bottom-2.5 top-2.5 bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-bold rounded-full text-white px-6 md:px-8 transition-colors shadow-md text-base flex items-center">Cari</button></form></div>`;
        res = res.replace(/\{\{seo_meta\}\}/g, seoMetaHtml || '').replace(/\{\{site_name\}\}/g, s.site_name || 'Website').replace(/\{\{site_tagline\}\}/g, s.site_tagline || '').replace(/\{\{site_logo\}\}/g, s.site_logo || '').replace(/\{\{site_favicon\}\}/g, s.site_favicon || '').replace(/\{\{year\}\}/g, new Date().getFullYear()).replace(/\{\{today_date\}\}/g, new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })).replace(/\{\{site_url\}\}/g, reqSiteUrl).replace(/\[cari\]/gi, buildSearchForm(`/${BLOG_SLUG}`, 'Cari...')).replace(/\[cari-([^\]]+)\]/gi, (m, cat) => buildSearchForm(`/${CATEGORY_SLUG}/${cat}`, `Cari di ${cat}...`));
        for (const [key, val] of Object.entries(ctxData)) res = res.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), val || '');
        return res;
    };

    const buildCardHtml = (p) => {
        const raw = p[5] || ''; let meta = { status: '', price: '', loc: '', specs: [] }; let m;
        while ((m = REGEX_SHORTCODES.exec(raw)) !== null) {
            let k = m[1].toLowerCase(); let v = m[2].trim();
            if(k==='lt') k='luas-tanah'; if(k==='lb') k='luas-bangunan'; if(k==='kt') k='kamar-tidur'; if(k==='km') k='kamar-mandi';
            if (k === 'status') meta.status = v; else if (k.match(/^(harga|tarif|biaya|spp)$/)) meta.price = v; else if (k === 'lokasi' || k === 'alamat') meta.loc = v; else meta.specs.push({ k, v });
        }
        const badge = meta.status ? `<div class="absolute top-4 right-4 ${meta.status.match(/terjual|sold|full/i) ? 'bg-red-500' : 'bg-blue-600'} text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase z-10">${meta.status}</div>` : '';
        const specs = meta.specs.slice(0,4).map(s => `<span class="flex items-center gap-1.5 truncate">${getSmartIcon(s.k)} <span class="truncate">${s.v}</span></span>`).join('');
        return `<article class="group hover-card bg-white rounded-[1.5rem] border border-slate-100 overflow-hidden cursor-pointer flex flex-col shadow-sm" onclick="window.top.location.href='/${BLOG_SLUG}/${p[1]}'">
            <div class="relative overflow-hidden aspect-[4/3]"><img src="${p[4] || ''}" class="w-full h-full object-cover group-hover:scale-105 transition-transform"><div class="absolute top-4 left-4 bg-white/95 px-3 py-1.5 rounded-full text-[10px] font-bold text-blue-600 uppercase z-10">${(p[3]||'').split(',')[0]}</div>${badge}</div>
            <div class="p-6 flex flex-col flex-grow"><h4 class="text-lg font-bold mb-2 group-hover:text-blue-600">${p[2]}</h4><div class="text-emerald-600 font-black mb-2">${meta.price}</div><p class="text-sm text-slate-500 line-clamp-3">${safeExcerpt(raw)}</p>${specs ? `<div class="grid grid-cols-2 gap-2 mt-4 pt-4 border-t text-[11px] font-bold text-slate-500 uppercase">${specs}</div>` : ''}</div></article>`;
    };

    const processShortcuts = async (html, titleContext) => {
        const regexArtikel = /\[artikel-([^\]]+)\]/gi;
        const matches = [...html.matchAll(regexArtikel)];
        for (const match of matches) {
            let p = match[1].trim().split('-');
            let isP = p[p.length-1].toLowerCase()==='p'; if(isP) p.pop();
            let count = parseInt(p.pop()); let cat = p.length>0 ? p.join('-') : null;
            let qW = `B IS NOT NULL ${cat ? `AND lower(D) contains '${cat.replace(/-/g,' ')}'` : ''}`;
            let posts = await fetchSheetData(SHEET_ID, 'Posts', `SELECT A, B, C, D, E, F, G, H WHERE ${qW} ORDER BY G DESC LIMIT ${count}`);
            html = html.replace(match[0], `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-10">${posts.map(i => buildCardHtml(i)).join('')}</div>`);
        }
        return html.replace(REGEX_SHORTCODES, (m, k, v) => {
            k = k.toLowerCase(); if(k.startsWith('wa-')) return `<a href="https://wa.me/${v.replace(/[^0-9]/g,'')}" class="bg-[#25D366] text-white font-bold py-4 px-6 rounded-2xl block text-center my-8">Hubungi WhatsApp</a>`;
            if(k.match(/^(harga|tarif|biaya)$/)) return `<div class="text-3xl font-black text-emerald-600 text-center my-6">${v}</div>`;
            return `<div class="inline-flex items-center gap-2 p-3 bg-white border rounded-xl my-1 mr-1">${getSmartIcon(k)} <b>${v}</b></div>`;
        });
    };

    const cssStyles = `<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');body{font-family:'Inter',sans-serif;background:#f8fafc;}.hover-card{transition:all .3s;}.hover-card:hover{transform:translateY(-4px);shadow:lg;}.cms-content{font-size:1.125rem;line-height:1.85;}.cms-content h2{font-size:1.8rem;font-weight:800;margin:2rem 0;}.cms-content img{border-radius:1.5rem;margin:2rem 0;width:100%;}</style>`;
    const header = s.header_template || `<header class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b"><div class="max-w-7xl mx-auto px-5 py-4 flex justify-between items-center"><a href="/" class="font-black text-xl">{{site_name}}</a><nav class="hidden md:flex gap-8 font-semibold"><a href="/">Beranda</a><a href="/${BLOG_SLUG}">Artikel</a></nav></div></header>`;
    const footer = s.footer_template || `<footer class="bg-white border-t py-12 mt-20 text-center text-slate-500"><p>&copy; {{year}} {{site_name}}</p><span class="text-xs font-bold bg-slate-100 px-4 py-1 rounded-full border">by Andi | disatu.web.id</span></footer>`;

    // --- MAIN ROUTER ---

    const isHome = path === '/' || path === '/index.html';
    const isBlogList = path === `/${BLOG_SLUG}`;
    const isPostDetail = path.startsWith(`/${BLOG_SLUG}/`);
    const isCategoryList = path.startsWith(`/${CATEGORY_SLUG}/`);

    const pagesRaw = await fetchSheetData(SHEET_ID, 'Pages');

    if (isHome || isBlogList || isCategoryList) {
        const cur = parseInt(url.searchParams.get('p')) || 1; const off = (cur - 1) * 12;
        let where = `B IS NOT NULL`;
        if (isCategoryList) where += ` AND lower(D) contains '${path.split('/')[2].replace(/-/g,' ')}'`;
        const posts = await fetchSheetData(SHEET_ID, 'Posts', `SELECT A, B, C, D, E, F, G, H WHERE ${where} ORDER BY G DESC LIMIT 12 OFFSET ${off}`);
        
        if (isHome && s.home_page && cur === 1 && !isCategoryList) {
            const h = pagesRaw.find(p => p[1] === s.home_page);
            if (h) {
                const seo = generateSeoMetaTags({ title: h[2], description: h[2], image: s.site_logo, url: reqSiteUrl }, s);
                let res = applyGlobalPlaceholders(s.page_template || `<html><head>{{seo_meta}}</head><body>${header}{{content}}${footer}</body></html>`, s, seo, { content: h[3] });
                return cacheAndRespond(await processShortcuts(res, h[2]));
            }
        }
        const listHtml = `<div class="grid grid-cols-1 md:grid-cols-3 gap-8">${posts.map(p => buildCardHtml(p)).join('')}</div>`;
        const final = applyGlobalPlaceholders(s.blog_template || `<html><head>{{seo_meta}}</head><body>${header}<main class="max-w-7xl mx-auto py-20 px-5">${listHtml}</main>${footer}</body></html>`, s, '', { content: listHtml });
        return cacheAndRespond(final);
    }

    if (isPostDetail) {
        const slug = path.split('/')[2];
        const pData = await fetchSheetData(SHEET_ID, 'Posts', `SELECT A, B, C, D, E, F, G, H WHERE B = '${slug}' LIMIT 1`);
        if (pData[0]) {
            const p = pData[0]; const seo = generateSeoMetaTags({ title: p[2], description: safeExcerpt(p[5]), image: p[4], url: reqSiteUrl + path, type: 'article' }, s);
            const content = await processShortcuts(injectHeadingAnchors(p[5]), p[2]);
            const final = applyGlobalPlaceholders(s.article_template || `<html><head>{{seo_meta}}</head><body>${header}<main class="max-w-4xl mx-auto py-20 px-5"><h1 class="text-4xl font-black mb-8">${p[2]}</h1>${content}</main>${footer}</body></html>`, s, seo, { content });
            return cacheAndRespond(final);
        }
    }

    const page = pagesRaw.find(p => p[1] === path.substring(1));
    if (page) {
        const seo = generateSeoMetaTags({ title: page[2], description: page[2], image: s.site_logo, url: reqSiteUrl + path }, s);
        const final = applyGlobalPlaceholders(s.page_template || `<html><head>{{seo_meta}}</head><body>${header}<main class="max-w-4xl mx-auto py-20 px-5">${page[3]}</main>${footer}</body></html>`, s, seo, { content: page[3] });
        return cacheAndRespond(await processShortcuts(final, page[2]));
    }

    return new Response("Not Found", { status: 404 });
}
