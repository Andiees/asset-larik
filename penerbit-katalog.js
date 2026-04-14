window.currentActiveItemId = null;

    document.addEventListener("DOMContentLoaded", async function() {
        const container = document.getElementById('katalog-container');
        const paginationContainer = document.getElementById('pagination-container');
        const filtersContainer = document.getElementById('category-filters');
        
        let allData = [];
        let filteredData = [];
        let currentPage = 1;
        const itemsPerPage = 8;
        let currentCategory = 'All';
        let searchQuery = '';

        function formatRupiah(angka) {
            if (!angka) return 'Rp 0';
            const num = typeof angka === 'string' ? parseInt(angka.replace(/\D/g,'')) : angka;
            return new Intl.NumberFormat('id-ID', { 
                style: 'currency', currency: 'IDR', minimumFractionDigits: 0 
            }).format(num);
        }

        // ✅ FUNGSI PARSE TANGGAL INDONESIA: "13/4/2026" -> Timestamp untuk sorting
        function parseTanggalIndonesia(str) {
            if (!str || str === '' || str === null || str === undefined) return 0;
            // Jika sudah Date object, langsung ambil timestamp
            if (str instanceof Date) return str.getTime();
            // Jika number (timestamp), langsung return
            if (typeof str === 'number') return str;
            
            // Parse string format DD/MM/YYYY atau D/M/YYYY
            const parts = String(str).trim().split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1; // JS month 0-11
                const year = parseInt(parts[2], 10);
                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                    return new Date(year, month, day).getTime();
                }
            }
            // Fallback: coba parse default (untuk format YYYY-MM-DD dll)
            const fallback = new Date(str).getTime();
            return isNaN(fallback) ? 0 : fallback;
        }

        async function loadKatalog() {
            try {
                const query = encodeURIComponent("SELECT A,B,C,D,E,F,G,H,I WHERE B IS NOT NULL");
                const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=Katalog&tq=${query}`;

                const response = await fetch(url);
                const text = await response.text();
                const json = JSON.parse(text.substring(47, text.length - 2));
                const rows = json.table.rows;

                if (!rows || rows.length === 0) {
                    container.innerHTML = `<p class="col-span-full text-center text-slate-500">Katalog masih kosong.</p>`;
                    return;
                }

                // ✅ Mapping Data dengan Validasi Lebih Ketat
                allData = rows.map((row, index) => {
                    const d = row.c;
                    
                    // 🔹 Cek semua kemungkinan kolom tanggal (Kolom G = index 6)
                    const rawDate = d[6]?.v || d[6]?.f || '';
                    const formattedDate = d[6]?.f || d[6]?.v || '';

                    return {
                        id: index, 
                        judul: d[1]?.v || 'Untitled',
                        harga: d[2]?.v,
                        kategori: d[3]?.v || 'Umum',
                        gambar: d[4]?.v || 'https://via.placeholder.com/400x300?text=No+Image',
                        deskripsi: d[5]?.v || '',
                        // 🔹 tanggalDisplay: untuk ditampilkan APA ADANYA (format sheet)
                        tanggalDisplay: formattedDate || (rawDate ? String(rawDate) : ''),
                        // 🔹 timestamp: untuk sorting, pakai fungsi parse khusus
                        timestamp: parseTanggalIndonesia(rawDate),
                        links: d[8]?.v 
                    };
                });

                // ✅ Sorting Descending: Terbaru di Atas (berdasarkan timestamp)
                allData.sort((a, b) => {
                    // Jika kedua timestamp 0 (gagal parse), fallback ke ID (semakin besar = baru)
                    if (a.timestamp === 0 && b.timestamp === 0) {
                        return b.id - a.id;
                    }
                    return b.timestamp - a.timestamp;
                });

                buildFilters();
                applyFilters();
                checkHashAndOpenModal();

            } catch (err) {
                console.error("Fetch Error:", err);
                container.innerHTML = `<p class="col-span-full text-center text-red-500">Gagal memuat data. Periksa SHEET_ID di config.js</p>`;
            }
        }

        function buildFilters() {
            const categories = ['All', ...new Set(allData.map(item => item.kategori))];
            filtersContainer.innerHTML = categories.map(cat => `
                <button class="filter-btn ${cat === currentCategory ? 'active' : ''}" data-cat="${cat}">
                    ${cat === 'All' ? 'Semua Kategori' : cat}
                </button>
            `).join('');

            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    currentCategory = e.target.dataset.cat;
                    currentPage = 1; 
                    applyFilters();
                });
            });
        }

        document.getElementById('search-input').addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            currentPage = 1;
            applyFilters();
        });
        document.getElementById('search-form').addEventListener('submit', (e) => e.preventDefault());

        function applyFilters() {
            filteredData = allData.filter(item => {
                const matchCat = currentCategory === 'All' || item.kategori === currentCategory;
                const textDesc = item.deskripsi.replace(/<[^>]*>?/gm, ''); 
                const matchSearch = item.judul.toLowerCase().includes(searchQuery) || 
                                    textDesc.toLowerCase().includes(searchQuery) ||
                                    item.kategori.toLowerCase().includes(searchQuery);
                return matchCat && matchSearch;
            });
            renderPage();
        }

        function renderPage() {
            container.innerHTML = '';
            const startIndex = (currentPage - 1) * itemsPerPage;
            const paginatedItems = filteredData.slice(startIndex, startIndex + itemsPerPage);

            if (paginatedItems.length === 0) {
                container.innerHTML = `<p class="col-span-full text-center text-slate-500 py-10">Buku tidak ditemukan.</p>`;
                paginationContainer.classList.add('hidden');
                return;
            }

            // ✅ Card: tanggalDisplay ditampilkan APA ADANYA tanpa parsing/format ulang
            container.innerHTML = paginatedItems.map(item => `
                <article class="post-card group" onclick="openModal(${item.id})">
                    <div class="post-image-wrapper">
                        <img src="${item.gambar}" alt="${item.judul}" loading="lazy">
                        <span class="absolute top-3 left-3 bg-white/90 px-3 py-1 rounded-full text-[10px] font-bold text-indigo-600 border border-slate-200 shadow-sm backdrop-blur-sm">
                            ${item.kategori}
                        </span>
                    </div>
                    <div class="flex-grow flex flex-col">
                        <h3 class="line-clamp-2">${item.judul}</h3>
                        ${item.tanggalDisplay && item.tanggalDisplay !== '' ? 
                            `<p class="text-[10px] text-slate-400 mb-2 font-medium"><i class="fa-regular fa-calendar mr-1"></i>${item.tanggalDisplay}</p>` 
                            : ''}
                        <div class="mt-auto pt-2">
                            <span class="price-tag text-sm">${formatRupiah(item.harga)}</span>
                        </div>
                    </div>
                    <button class="w-full mt-4 bg-slate-50 text-indigo-600 py-2.5 rounded-xl font-bold text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        Liha Detail
                    </button>
                </article>
            `).join('');

            renderPagination();
        }

        function renderPagination() {
            const totalPages = Math.ceil(filteredData.length / itemsPerPage);
            if (totalPages <= 1) {
                paginationContainer.classList.add('hidden');
                return;
            }
            paginationContainer.classList.remove('hidden');
            
            let html = `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})"><i class="fa-solid fa-chevron-left"></i></button>`;
            for(let i=1; i<=totalPages; i++){
                html += `<button class="page-btn ${currentPage === i ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
            }
            html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;
            
            paginationContainer.innerHTML = html;
        }

        window.goToPage = function(page) {
            currentPage = page;
            renderPage();
            document.getElementById('katalog-container').scrollIntoView({behavior: 'smooth', block: 'start'});
        };

        window.openModal = function(id) {
            const targetId = parseInt(id);
            const item = allData.find(d => d.id === targetId);
            if(!item) return;

            window.currentActiveItemId = item.id;
            
            try {
                window.top.history.replaceState(null, null, '#id=' + item.id);
            } catch(e) {
                try { window.history.replaceState(null, null, '#id=' + item.id); } catch(err) {}
            }

            document.getElementById('modal-image').src = item.gambar;
            document.getElementById('modal-category').innerText = item.kategori;
            document.getElementById('modal-title').innerText = item.judul;
            document.getElementById('modal-price').innerText = formatRupiah(item.harga);
            // ✅ Modal: tanggalDisplay ditampilkan apa adanya
            document.getElementById('modal-date').innerText = item.tanggalDisplay || 'Tanggal tidak tersedia';
            document.getElementById('modal-description').innerHTML = item.deskripsi;
            
            const linksContainer = document.getElementById('modal-links');
            let htmlLinks = '';
            
            if (item.links) {
                try {
                    const data = typeof item.links === 'string' ? JSON.parse(item.links) : item.links;
                    const linksObj = data?.links || {};
                    const platforms = [
                        { key: 'whatsapp', icon: 'fa-brands fa-whatsapp', label: 'Beli di WhatsApp', class: 'whatsapp' },
                        { key: 'shopee', icon: 'fa-solid fa-bag-shopping', label: 'Beli di Shopee', class: 'shopee' },
                        { key: 'tokopedia', icon: 'fa-solid fa-store', label: 'Beli di Tokopedia', class: 'tokopedia' },
                        { key: 'tiktok_shop', icon: 'fa-brands fa-tiktok', label: 'Beli di TikTok', class: 'tiktok' }
                    ];
                    
                    htmlLinks = platforms
                        .filter(p => linksObj[p.key])
                        .map(p => `
                            <a href="${linksObj[p.key]}" target="_blank" class="purchase-btn ${p.class}">
                                <i class="${p.icon}"></i> <span>${p.label}</span>
                            </a>
                        `).join('');
                } catch (e) {
                    if (String(item.links).trim().startsWith('http')) {
                        htmlLinks = `
                            <a href="${String(item.links).trim()}" target="_blank" class="purchase-btn whatsapp w-full col-span-full">
                                <i class="fa-brands fa-whatsapp"></i> <span>Pesan Sekarang</span>
                            </a>`;
                    }
                }
            }
            
            linksContainer.innerHTML = htmlLinks || `<p class="text-sm text-slate-400 font-medium col-span-full">Link pembelian belum tersedia.</p>`;

            const modal = document.getElementById('detail-modal');
            const box = document.getElementById('modal-content-box');
            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                box.classList.remove('scale-95');
                box.classList.add('scale-100');
            }, 10);
            
            document.body.style.overflow = 'hidden';
        };

        window.closeModal = function() {
            window.currentActiveItemId = null;
            
            try {
                window.top.history.replaceState(null, null, window.top.location.pathname + window.top.location.search);
            } catch(e) {
                try { window.history.replaceState(null, null, window.location.pathname + window.location.search); } catch(err) {}
            }

            const modal = document.getElementById('detail-modal');
            const box = document.getElementById('modal-content-box');
            modal.classList.add('opacity-0');
            box.classList.remove('scale-100');
            box.classList.add('scale-95');
            
            setTimeout(() => {
                modal.classList.add('hidden');
                document.body.style.overflow = 'auto'; 
            }, 300);
        };

        window.copyShareLink = function() {
            if (window.currentActiveItemId === null) return;
            
            let shareUrl = '';
            
            try {
                shareUrl = window.top.location.origin + window.top.location.pathname + '#id=' + window.currentActiveItemId;
            } catch (e) {
                try {
                    const ref = new URL(document.referrer);
                    shareUrl = ref.origin + ref.pathname + '#id=' + window.currentActiveItemId;
                } catch (err) {
                    shareUrl = window.location.origin + window.location.pathname + '#id=' + window.currentActiveItemId;
                }
            }
            
            const textArea = document.createElement("textarea");
            textArea.value = shareUrl;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                showToast();
            } catch (err) {
                console.error('Gagal menyalin link', err);
            }
            
            document.body.removeChild(textArea);
        };

        function checkHashAndOpenModal() {
            let hash = '';
            try {
                hash = window.top.location.hash;
            } catch(e) {
                hash = window.location.hash;
            }
            
            if (hash && hash.startsWith('#id=')) {
                const targetId = hash.replace('#id=', '');
                setTimeout(() => openModal(targetId), 300); 
            }
        }

        function showToast() {
            const toast = document.getElementById('toast');
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        document.getElementById('detail-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('detail-modal')) closeModal();
        });

        loadKatalog();

        // ===== UI SCRIPTS HEADER =====
        const burgerBtn = document.getElementById('burger-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        const icon = burgerBtn?.querySelector('i');

        if (burgerBtn && mobileMenu && icon) {
            burgerBtn.addEventListener('click', () => {
                const isOpen = mobileMenu.classList.contains('opacity-100');
                if (!isOpen) {
                    mobileMenu.classList.remove('opacity-0', 'pointer-events-none');
                    mobileMenu.classList.add('opacity-100', 'pointer-events-auto');
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-xmark');
                } else {
                    mobileMenu.classList.remove('opacity-100', 'pointer-events-auto');
                    mobileMenu.classList.add('opacity-0', 'pointer-events-none');
                    icon.classList.remove('fa-xmark');
                    icon.classList.add('fa-bars');
                }
            });
        }

        const submenuBtn = document.querySelector('.mobile-submenu-btn');
        const submenu = document.querySelector('.mobile-submenu');
        const submenuToggle = document.querySelector('.mobile-submenu-toggle');
        
        if (submenuBtn && submenu && submenuToggle) {
            submenuBtn.addEventListener('click', (e) => {
                e.preventDefault();
                submenu.classList.toggle('active');
                submenuToggle.classList.toggle('active');
            });
        }

        document.addEventListener('click', (event) => {
            if (burgerBtn && mobileMenu && !burgerBtn.contains(event.target) && !mobileMenu.contains(event.target)) {
                mobileMenu.classList.remove('opacity-100', 'pointer-events-auto');
                mobileMenu.classList.add('opacity-0', 'pointer-events-none');
                if (icon) {
                    icon.classList.remove('fa-xmark');
                    icon.classList.add('fa-bars');
                }
            }
        });
    });
