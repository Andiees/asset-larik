 window.currentActiveItemId = null;

    // 🔧 FIX: Fungsi parse tanggal format Indonesia (DD/MM/YYYY)
    function parseIndonesianDate(dateStr) {
        if (!dateStr) return new Date(0);
        // Handle jika sudah format Date object dari Sheets
        if (dateStr instanceof Date) return dateStr;
        
        const parts = String(dateStr).split('/');
        if (parts.length === 3) {
            const [day, month, year] = parts.map(p => parseInt(p, 10));
            // Bulan di JS: 0 = Januari, jadi month - 1
            return new Date(year, month - 1, day);
        }
        // Fallback ke parser default jika format tidak dikenali
        return new Date(dateStr);
    }

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

        // Fetch Data from Google Sheets
        async function loadKatalog() {
            try {
                // Membaca dari Sheet "Jurnal". Format: A=Post_ID, B=Judul, C=Kategori, D=Gambar, E=Konten, F=Tanggal, G=id_user, H=Link_Jurnal
                const query = encodeURIComponent("SELECT A,B,C,D,E,F,G,H WHERE B IS NOT NULL");
                const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=Jurnal&tq=${query}`;

                const response = await fetch(url);
                const text = await response.text();
                const json = JSON.parse(text.substring(47, text.length - 2));
                let rows = json.table.rows;

                // 🔧 FIX: Skip baris header (baris 1) jika terikut dalam hasil query
                // Google Visualization API biasanya sudah mengabaikan header, 
                // tapi kita tambahkan safety check untuk memastikan
                if (rows && rows.length > 0) {
                    const firstRow = rows[0].c;
                    // Jika kolom B (judul) berisi teks "Judul" (header), maka skip baris pertama
                    if (firstRow && firstRow[1] && String(firstRow[1].v).toLowerCase() === 'judul') {
                        rows = rows.slice(1);
                    }
                }

                if (!rows || rows.length === 0) {
                    container.innerHTML = `<p class="col-span-full text-center text-slate-500">Jurnal masih kosong.</p>`;
                    return;
                }

                // Map Data & Bersihkan Tag
                allData = rows.map((row, index) => {
                    const d = row.c;
                    const rawDate = d[5]?.f || d[5]?.v || ''; 
                    const rawKonten = d[4]?.v || '';
                    
                    // Bersihkan tag kurung siku sepenuhnya dari tampilan HTML (mengabaikan shortcut)
                    const deskripsiBersih = rawKonten.replace(/\[.*?\]/g, '');
                    
                    return {
                        id: index, 
                        post_id: d[0]?.v || '',
                        judul: d[1]?.v || 'Untitled',
                        kategori: d[2]?.v || 'Umum',
                        gambar: d[3]?.v || 'https://via.placeholder.com/400x300?text=No+Image',
                        deskripsiBersih: deskripsiBersih,
                        tanggal: rawDate, // Simpan string asli untuk display
                        tanggalParsed: parseIndonesianDate(d[5]?.v), // 🔥 Untuk sorting akurat
                        link_jurnal: d[7]?.v || '' 
                    };
                });

                // 🔧 FIX: Sorting Descending Berdasarkan Tanggal (terbaru di atas)
                allData.sort((a, b) => {
                    const dateA = a.tanggalParsed?.getTime() || -a.id;
                    const dateB = b.tanggalParsed?.getTime() || -b.id;
                    return dateB - dateA; // descending: newest first ✅
                });

                buildFilters();
                applyFilters();

                // Cek Hash Modal saat load pertama (Mendukung pembacaan dari Parent Iframe)
                checkHashAndOpenModal();

            } catch (err) {
                console.error("Fetch Error:", err);
                container.innerHTML = `<p class="col-span-full text-center text-red-500">Gagal memuat data. Periksa SHEET_ID atau nama Sheet "Jurnal" di config.js</p>`;
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
                // Gunakan deskripsi yang sudah dibersihkan tag HTML-nya untuk pencarian
                const textDesc = item.deskripsiBersih.replace(/<[^>]*>?/gm, ''); 
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
                container.innerHTML = `<p class="col-span-full text-center text-slate-500 py-10">Jurnal tidak ditemukan.</p>`;
                paginationContainer.classList.add('hidden');
                return;
            }

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
                        ${item.tanggal ? `<p class="text-[10px] text-slate-400 font-medium"><i class="fa-regular fa-calendar mr-1"></i>${item.tanggal}</p>` : ''}
                    </div>
                    <button class="w-full mt-5 bg-slate-50 text-indigo-600 py-2.5 rounded-xl font-bold text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        Lihat Detail
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

        // Buka Pop Up
        window.openModal = function(id) {
            const targetId = parseInt(id);
            const item = allData.find(d => d.id === targetId);
            if(!item) return;

            window.currentActiveItemId = item.id;
            
            // Push URL Hash (Iframe Safe)
            try { window.top.history.replaceState(null, null, '#id=' + item.id); } catch(e) {
                try { window.history.replaceState(null, null, '#id=' + item.id); } catch(err) {}
            }

            document.getElementById('modal-image').src = item.gambar;
            document.getElementById('modal-category').innerText = item.kategori;
            document.getElementById('modal-title').innerText = item.judul;
            document.getElementById('modal-date').innerText = item.tanggal || 'Tanggal tidak tersedia';
            
            // Eksekusi Deskripsi Bersih
            document.getElementById('modal-description').innerHTML = item.deskripsiBersih;
            
            // Tombol Link Jurnal
            const linksContainer = document.getElementById('modal-links');
            if (item.link_jurnal && item.link_jurnal.trim() !== '') {
                let href = String(item.link_jurnal).trim();
                if(!href.startsWith('http')) href = 'https://' + href;
                
                linksContainer.innerHTML = `
                    <a href="${href}" target="_blank" class="purchase-btn bg-indigo-600 text-white w-full hover:bg-indigo-700 shadow-[0_4px_15px_rgba(30,90,230,0.3)]">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> <span>Kunjungi Link Jurnal</span>
                    </a>`;
            } else {
                linksContainer.innerHTML = `<p class="text-sm text-slate-400 font-medium">Link akses belum tersedia.</p>`;
            }

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
            
            try { window.top.history.replaceState(null, null, window.top.location.pathname + window.top.location.search); } catch(e) {
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

        // Copy Share Link (Iframe safe)
        window.copyShareLink = function() {
            if (window.currentActiveItemId === null) return;
            let shareUrl = '';
            try { shareUrl = window.top.location.origin + window.top.location.pathname + '#id=' + window.currentActiveItemId; } catch (e) {
                try { const ref = new URL(document.referrer); shareUrl = ref.origin + ref.pathname + '#id=' + window.currentActiveItemId; } catch (err) {
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
            } catch (err) { console.error('Gagal menyalin link', err); }
            document.body.removeChild(textArea);
        };

        function checkHashAndOpenModal() {
            let hash = '';
            try { hash = window.top.location.hash; } catch(e) { hash = window.location.hash; }
            if (hash && hash.startsWith('#id=')) {
                const targetId = hash.replace('#id=', '');
                setTimeout(() => openModal(targetId), 300); 
            }
        }

        function showToast() {
            const toast = document.getElementById('toast');
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }

        document.getElementById('detail-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('detail-modal')) closeModal();
        });

        loadKatalog();

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
