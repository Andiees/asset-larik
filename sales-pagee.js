// ─────────────────────────────────────────────
        // 1. KONTAK & SISTEM
        // ─────────────────────────────────────────────
        const CONTACT = {
            whatsapp: '6285172447739',
            email: 'katsua.digital@gmail.com',
        };

        const SHEETS = {
            sheetId: 'MTRhWjlDdEk4SXlkdl92dTA2cElDb1N0cFV2UU1xaG9JSUpJNDJwaEtGWTg=',
            sheetName: 'Sheet1',
        };

        // ─────────────────────────────────────────────
        // 2. LINK ORDER & PESAN WA
        // ─────────────────────────────────────────────
        const ORDER_LINKS = {
            starter: 'https://member.larik.web.id/checkout?id=starter',
            pro: 'https://member.larik.web.id/checkout?id=pro',
            business: 'https://member.larik.web.id/checkout?id=business',
        };

        const WA_MESSAGES = {
            starter: 'Halo saya mau paket Starter LARIK CMS',
            pro: 'Halo saya mau paket Pro LARIK CMS',
            business: 'Halo saya mau paket Business LARIK CMS',
            custom: 'Halo saya tertarik paket Terima Beres LARIK CMS',
        };

        // ─────────────────────────────────────────────
        // 3. FITUR DASHBOARD
        // ─────────────────────────────────────────────
        const FEATURES = [
            { icon: 'fa-solid fa-bolt', title: 'Real-time Sync', desc: 'Edit di Google Sheets → Dashboard & Website langsung terupdate secara otomatis dan sinkron.' },
            { icon: 'fa-solid fa-wand-magic-sparkles', title: 'Auto SEO & Schema', desc: 'Meta tags, sitemap.xml, robots.txt, dan JSON-LD schema otomatis dibuat untuk membantu optimasi mesin pencari.' },
            { icon: 'fa-solid fa-palette', title: 'Ganti Tema 1-Klik', desc: 'Pilih dari berbagai tema siap pakai. Tampilan, warna, dan branding menyesuaikan dengan mudah.' },
            { icon: 'fa-solid fa-file-lines', title: 'Auto TOC & Baca Juga', desc: 'Table of Contents dan artikel terkait otomatis muncul di setiap halaman untuk meningkatkan pengalaman pembaca.' },
        ];

        // ─────────────────────────────────────────────
        // 4. PAKET HARGA - DENGAN BONUS AI TOOLS
        // ─────────────────────────────────────────────
        const PRICING = [
            { 
                name: 'Starter', 
                desc: 'Coba dulu, rasakan bedanya', 
                price: 'Rp 149rb', 
                popular: false, 
                icon: 'fa-solid fa-rocket', 
                features: [
                    '1 Domain', 
                    'Dashboard Admin Included', 
                    'Akses Google Sheets sebagai Database', 
                    'Real-time Sync Konten', 
                    'Fitur Dasar (Blog, Katalog)', 
                    'Auto SEO Dasar', 
                    'Update Sistem Rutin', 
                    'Dokumentasi Instalasi',
                    '<span class="text-primary font-semibold"> BONUS:</span> Artikel Generator AI',
                    '<span class="text-primary font-semibold"> BONUS:</span> Landing Page Generator'
                ] 
            },
            { 
                name: 'Pro', 
                desc: 'Untuk UMKM & Bisnis Aktif', 
                price: 'Rp 299rb', 
                popular: true, 
                icon: 'fa-solid fa-crown', 
                features: [
                    '3 Domain', 
                    'Dashboard Admin Included', 
                    'Semua Fitur Starter', 
                    'Auto TOC & Baca Juga', 
                    'Auto SEO & Schema Lengkap', 
                    'Sinkronisasi Real-time Tanpa Batas', 
                    'Update Fitur Seumur Hidup', 
                    'Priority Support 1-on-1', 
                    'Template Data Siap Pakai',
                    '<span class="text-primary font-semibold"> BONUS:</span> Artikel Generator AI',
                    '<span class="text-primary font-semibold"> BONUS:</span> Landing Page Generator'
                ] 
            },
            { 
                name: 'Business', 
                desc: 'Untuk Agency & Developer', 
                price: 'Rp 499rb', 
                popular: false, 
                icon: 'fa-solid fa-building', 
                features: [
                    '5 Domain', 
                    'Dashboard Admin Included', 
                    'Semua Fitur Pro', 
                    'Lisensi Lebih Banyak', 
                    'Cocok untuk Jasa Pembuatan Website', 
                    'Lisensi Komersial', 
                    'Video Tutorial Detail', 
                    'Grup Support Prioritas',
                    '<span class="text-primary font-semibold"> BONUS:</span> Artikel Generator AI',
                    '<span class="text-primary font-semibold"> BONUS:</span> Landing Page Generator'
                ] 
            },
        ];

        // ─────────────────────────────────────────────
        // 5. CUSTOM ADMIN
        // ─────────────────────────────────────────────
        const CUSTOM_PROCESS = [
            { num: 1, title: 'Konsultasi & Brief', desc: 'Kami pahami niche, brand, & kebutuhan Anda' },
            { num: 2, title: 'Desain Tema Custom', desc: 'Layout, warna, & struktur disesuaikan 100% dengan brand' },
            { num: 3, title: 'Setup & Input Konten', desc: 'Domain, SSL, sistem, & data awal kami yang kerjakan' },
            { num: 4, title: 'Serah Terima & Training', desc: 'Video panduan + sesi Zoom sampai Anda mahir pakai' },
        ];

        const CUSTOM_DELIVERABLES = [
            { text: '🎨 Tema Custom Sesuai Brand' },
            { text: '⚙️ Setup Sistem & Domain' },
            { text: '📝 Input Konten Awal (10-20 Artikel/Produk)' },
            { text: '🔍 Optimasi SEO Dasar' },
            { text: '🎥 Video Tutorial & Panduan PDF' },
            { text: '🛡️ Revisi 2x + Support 3 Bulan' },
        ];

        const CUSTOM_PRICE = 'Rp. 599rb';

        // ─────────────────────────────────────────────
        // 6. FAQ
        // ─────────────────────────────────────────────
        const FAQ = [
            { q: 'Benaran tanpa biaya hosting?', a: 'Benar. Anda hanya perlu membeli domain sekali. Sistem berjalan tanpa biaya hosting bulanan, dengan database menggunakan Google Sheets.' },
            { q: 'Gimana cara edit kontennya?', a: 'Cukup buka Google Sheets atau Dashboard Admin, lakukan perubahan, lalu simpan. Website akan otomatis terupdate.' },
            { q: 'Perlu jago coding?', a: 'Tidak. Instalasi cukup mengikuti panduan yang tersedia. Pengelolaan konten dibuat sederhana seperti menggunakan spreadsheet.' },
            { q: 'Apakah bisa dipakai untuk bisnis?', a: 'Bisa. Sistem ini cocok untuk website bisnis, landing page, katalog produk, maupun blog.' },
            { q: 'Apakah data aman?', a: 'Data tersimpan di Google Sheets yang memiliki sistem keamanan dan backup dari Google.' },
            { q: 'Apakah bisa digunakan di banyak domain?', a: 'Bisa, sesuai dengan jumlah lisensi yang Anda miliki.' },
            { q: 'Apakah website bisa diakses di HP?', a: 'Bisa. Website sudah responsive dan nyaman diakses melalui desktop maupun mobile.' },
            { q: 'Bagaimana jika butuh bantuan?', a: 'Tersedia support yang siap membantu jika Anda mengalami kendala saat penggunaan.' },
            { q: 'Apakah sistem akan terus diupdate?', a: 'Ya, sistem akan terus dikembangkan untuk meningkatkan performa dan fitur ke depannya.' },
            { q: 'Apakah cocok untuk pemula?', a: 'Sangat cocok. Sistem dirancang agar mudah digunakan bahkan oleh pengguna tanpa pengalaman teknis.' },
           { q: 'Apakah ada garansi atau refund?', a: 'Tidak ada garansi atau refund. Dengan melakukan pembelian, Anda dianggap telah memahami dan menyetujui produk yang dibeli.' },
        ];

        /* ============================================
           HELPER FUNCTIONS
           ============================================ */
        function getWaLink(msg) { 
            return `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(msg)}`; 
        }

        function getOrderLink(pkgName) {
            const key = pkgName.toLowerCase();
            if (ORDER_LINKS[key]) {
                return ORDER_LINKS[key];
            }
            const msg = WA_MESSAGES[key] || `Halo saya mau paket ${pkgName} LARIK CMS`;
            return getWaLink(msg);
        }

        function getDecodedSheetId() {
            try {
                return atob(SHEETS.sheetId).replace('|', '');
            } catch(e) {
                return SHEETS.sheetId;
            }
        }

        function buildSheetsUrl(sheetName = SHEETS.sheetName) {
    const _0xId = getDecodedSheetId();
    const _0xBase = atob('aHR0cHM6Ly9kb2NzLmdvb2dsZS5jb20vc3ByZWFkc2hlZXRzL2Qv');
    const _0xEnd = atob('L2d2aXovdHE=');
    const _0xPrm = atob('P3RxeD1vdXQ6anNvbiZzaGVldD0='); 
    
    return _0xBase + _0xId + _0xEnd + _0xPrm + sheetName;
}
        document.getElementById('nav-wa-btn').href = getWaLink(WA_MESSAGES.pro);
        document.getElementById('mobile-wa-btn').href = getWaLink(WA_MESSAGES.pro);
        document.getElementById('custom-wa-btn').href = getWaLink(WA_MESSAGES.custom);
        document.getElementById('cta-wa-btn').href = getWaLink(WA_MESSAGES.pro);
        document.getElementById('footer-wa').href = getWaLink(WA_MESSAGES.pro);

        const featuresEl = document.getElementById('features-list');
        FEATURES.forEach(f => {
            featuresEl.innerHTML += `<div class="flex items-start gap-4"><div class="w-12 h-12 bg-surface rounded-xl flex items-center justify-center text-primary shadow-sm flex-shrink-0 text-lg"><i class="${f.icon}"></i></div><div><h4 class="font-heading font-bold text-dark text-lg">${f.title}</h4><p class="text-base text-muted mt-1">${f.desc}</p></div></div>`;
        });
        
        const pricingEl = document.getElementById('pricing-cards');
        PRICING.forEach((p, i) => {
            const orderLink = getOrderLink(p.name);
            // PERBAIKAN: Tombol Starter & Business kini lebih menonjol dengan warna primary solid
            const btnClass = p.popular 
                ? 'btn-primary shadow-glow' 
                : 'bg-primary text-white font-heading font-semibold py-4 rounded-xl transition text-base hover:bg-primary-dark hover:shadow-lg border-2 border-primary';
            const popularBadge = p.popular ? '<div class="absolute top-6 right-6 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow-glow">PALING LARIS</div>' : '';
            const popularClass = p.popular ? 'popular group' : 'group';
            
            pricingEl.innerHTML += `
                <div class="price-card ${popularClass}" data-aos="fadeInUp" data-aos-delay="${i * 100}">
                    ${popularBadge}
                    <div class="flex items-center gap-3 mb-6">
                        <div class="w-12 h-12 ${p.popular ? 'bg-primary text-white' : 'bg-teal-50 text-primary'} rounded-xl flex items-center justify-center ${p.popular ? 'shadow-glow' : 'group-hover:bg-primary group-hover:text-white'} transition-colors"><i class="${p.icon} text-xl"></i></div>
                        <div><h3 class="font-heading font-bold text-dark text-xl">${p.name}</h3><p class="text-sm text-muted">${p.desc}</p></div>
                    </div>
                    <div class="mb-6 pb-6 border-b border-slate-100"><span class="text-4xl font-heading font-extrabold text-dark">${p.price}</span><span class="text-muted text-base"> /lifetime</span></div>
                    <ul class="space-y-3.5 mb-8">${p.features.map(f => `<li class="flex items-center gap-3 text-base text-slate-600"><i class="fa-solid fa-check text-primary text-sm"></i> ${f}</li>`).join('')}</ul>
                    <a href="${orderLink}" class="block w-full text-center ${btnClass} font-heading font-semibold py-4 rounded-xl transition text-base" ${ORDER_LINKS[p.name.toLowerCase()] ? '' : 'target="_blank"'}>Pilih ${p.name}</a>
                </div>`;
        });

(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if(ref) { localStorage.setItem('melimpah_affiliate', ref); }
})();

        const processEl = document.getElementById('custom-process');
        CUSTOM_PROCESS.forEach(s => {
            processEl.innerHTML += `<div class="process-step"><div class="step-num">${s.num}</div><div><p class="text-sm font-semibold text-white">${s.title}</p><p class="text-xs text-slate-500">${s.desc}</p></div></div>`;
        });

        const deliverablesEl = document.getElementById('custom-deliverables');
        CUSTOM_DELIVERABLES.forEach(d => {
            deliverablesEl.innerHTML += `<div class="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10"><span class="text-sm text-slate-300">${d.text}</span><i class="fa-solid fa-check text-primary"></i></div>`;
        });

        document.getElementById('custom-price').textContent = CUSTOM_PRICE;
        const faqEl = document.getElementById('faq-list');
        FAQ.forEach((f, i) => {
            faqEl.innerHTML += `
                <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-soft" data-aos="fadeInUp" data-aos-delay="${i * 100}">
                    <button class="faq-toggle w-full px-6 py-5 text-left flex items-center justify-between gap-3" onclick="toggleFaq(this)">
                        <span class="font-heading font-semibold text-dark text-lg">${f.q}</span>
                        <i class="fa-solid fa-chevron-down text-muted flex-shrink-0 transition-transform text-lg"></i>
                    </button>
                    <div class="faq-content hidden px-6 pb-5 text-base text-muted leading-relaxed">${f.a}</div>
                </div>`;
        });

        AOS.init({ once: true, offset: 80, duration: 800, easing: 'ease-out-cubic' });

        function toggleFaq(btn) {
            const content = btn.nextElementSibling;
            const icon = btn.querySelector('.fa-chevron-down');
            content.classList.toggle('hidden');
            icon.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
        }

        // ─────────────────────────────────────────────
        // THEMES LOAD MORE FUNCTIONALITY
        // ─────────────────────────────────────────────
        let allThemes = [];
        let visibleThemesCount = 8;
        
        function renderThemes(themes, startIndex, endIndex) {
            return themes.slice(startIndex, endIndex).map((t, i) => `
                <div class="theme-card" data-aos="fadeInUp" data-aos-delay="${Math.min(i * 30, 300)}">
                    <div class="aspect-[4/3] overflow-hidden bg-slate-100 relative group">
                        <img src="${t.img}" alt="${t.nama}" class="w-full h-full object-cover" loading="lazy">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-6">
                            <a href="${t.link}" target="_blank" class="inline-flex items-center gap-2 bg-white text-dark px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-primary hover:text-white transition shadow-lg"><i class="fa-solid fa-arrow-up-right-from-square"></i> Lihat Demo</a>
                        </div>
                    </div>
                    <div class="p-5"><h3 class="font-heading font-bold text-dark text-lg mb-2">${t.nama}</h3><a href="${t.link}" target="_blank" class="inline-flex items-center gap-2 text-primary font-semibold text-base hover:opacity-80 transition">Kunjungi <i class="fa-solid fa-arrow-right"></i></a></div>
                </div>`).join('');
        }

        function updateThemesDisplay(showAll = false) {
            const gridEl = document.getElementById('themes-grid');
            const loadMoreContainer = document.getElementById('themes-load-more-container');
            
            if (showAll || visibleThemesCount >= allThemes.length) {
                gridEl.innerHTML = renderThemes(allThemes, 0, allThemes.length);
                loadMoreContainer.classList.add('hidden');
            } else {
                gridEl.innerHTML = renderThemes(allThemes, 0, visibleThemesCount);
                loadMoreContainer.classList.remove('hidden');
            }
        }

        async function fetchThemes() {
            const loadingEl = document.getElementById('themes-loading');
            const gridEl = document.getElementById('themes-grid');
            const errorEl = document.getElementById('themes-error');
            const loadMoreBtn = document.getElementById('themes-load-more-btn');
            
            try {
                const res = await fetch(buildSheetsUrl());
                const text = await res.text();
                const json = JSON.parse(text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/)[1]);
                if (!json.table?.rows) throw new Error('No data');
                
                allThemes = json.table.rows.slice(1).reverse().map(r => ({
                    nama: r.c[0]?.v || 'Tema Baru',
                    link: r.c[1]?.v || '#',
                    img: r.c[2]?.v || 'https://placehold.co/600x450/f1f5f9/64748b?text=Preview'
                }));
                
                // Tampilkan 8 tema pertama
                updateThemesDisplay(false);
                
                // Setup Load More button
                loadMoreBtn.onclick = function() {
                    visibleThemesCount += 8;
                    updateThemesDisplay();
                };
                
                loadingEl.classList.add('hidden');
                gridEl.classList.remove('hidden');
            } catch(e) {
                loadingEl.classList.add('hidden');
                errorEl.classList.remove('hidden');
            }
        }

        document.addEventListener('DOMContentLoaded', fetchThemes);

        document.querySelectorAll('a[href^="#"]').forEach(a => {
            a.addEventListener('click', e => {
                e.preventDefault();
                const t = document.querySelector(a.getAttribute('href'));
                if(t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
                document.getElementById('mobile-menu').classList.add('hidden');
            });
        });

        window.addEventListener('scroll', () => {
            const nav = document.getElementById('navbar');
            nav.classList.toggle('shadow-md', window.scrollY > 40);
        });
