// by Andi | disatu.web.id

// ==========================================
// 5. KAJIAN: FETCH, PAGINATION, DEEP LINK & SHARE
// ==========================================
let allKajianData = [];
let displayedCount = 0;
const ITEMS_PER_LOAD = 3;
let currentShareData = null;

function parseIndonesianDate(dateStr) {
    if(!dateStr) return 0;
    const months = { 'januari': '01', 'februari': '02', 'maret': '03', 'april': '04', 'mei': '05', 'juni': '06', 'juli': '07', 'agustus': '08', 'september': '09', 'oktober': '10', 'november': '11', 'desember': '12' };
    const regex = /(\d{1,2})[\s]+([a-zA-Z]+)[\s]+(\d{4})/;
    const match = dateStr.match(regex);
    if (match) return parseInt(`${match[3]}${months[match[2].toLowerCase()] || '01'}${match[1].padStart(2, '0')}`);
    return 0; 
}

async function fetchKajianData() {
    const container = document.getElementById('kajian-container');
    if(!container) return;

    try {
        const sheetName = encodeURIComponent("Kajian");
        const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
        
        const response = await fetch(url);
        const text = await response.text();
        const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\)/);
        if (!jsonMatch) throw new Error("Format response tidak valid");
        
        const data = JSON.parse(jsonMatch[1]);
        
        data.table.rows.forEach((row) => {
            const id = row.c[0] ? row.c[0].v : '';
            if (!id || id.toString().toLowerCase() === 'id') return; 
            
            allKajianData.push({
                id: id,
                edisi: row.c[1] ? row.c[1].v : '',
                pemateri: row.c[2] ? row.c[2].v : '',
                waktu: row.c[3] ? row.c[3].v : '',
                tema: row.c[4] ? row.c[4].v : '',
                gambar: row.c[5] ? row.c[5].v : 'https://images.unsplash.com/photo-1596468351509-c183ce5fb470?q=80&w=1000&auto=format&fit=crop',
                deskripsi: row.c[6] ? row.c[6].v : '',
                sortValue: parseIndonesianDate(row.c[3] ? row.c[3].v : '')
            });
        });

        allKajianData.sort((a, b) => b.sortValue - a.sortValue);
        container.innerHTML = '';
        
        if(allKajianData.length > 0) {
            renderKajian();
            
            // Cek jika ada perintah buka dari URL Hash
            const hash = window.location.hash;
            if(hash.startsWith('#kajian=')) {
                const kajianId = hash.replace('#kajian=', '');
                const foundIndex = allKajianData.findIndex(k => k.id === kajianId);
                if(foundIndex !== -1) {
                    setTimeout(() => openModal(foundIndex, false), 500); 
                }
            }
        } else {
            container.innerHTML = '<div class="col-span-1 md:col-span-3 text-center py-10 text-gray-500">Belum ada jadwal kajian saat ini.</div>';
        }
    } catch (error) {
        console.error(error);
        container.innerHTML = '<div class="col-span-1 md:col-span-3 text-center py-10 text-red-500"><i class="fa-solid fa-triangle-exclamation mr-2"></i> Gagal memuat jadwal kajian. Pastikan Sheet Public.</div>';
    }
}

function renderKajian() {
    const container = document.getElementById('kajian-container');
    const endIdx = Math.min(displayedCount + ITEMS_PER_LOAD, allKajianData.length);
    let htmlOutput = '';

    for (let i = displayedCount; i < endIdx; i++) {
        const item = allKajianData[i];
        let parsedHari = "Hari", parsedTgl = "00", parsedBln = "Bln";
        
        if (item.waktu) {
            const parts = item.waktu.split(/[\s,]+/); 
            if (parts.length >= 3) {
                parsedHari = parts[0]; parsedTgl = parts[1]; parsedBln = parts[2].substring(0, 3);
            }
        }

        let badgeClass = "bg-emerald-50 text-emerald-600";
        const edisiLower = (item.edisi || "").toLowerCase();
        if (edisiLower.includes("spesial")) badgeClass = "bg-yellow-50 text-yellow-600";
        else if (edisiLower.includes("muslimah")) badgeClass = "bg-blue-50 text-blue-600";

        htmlOutput += `
        <div onclick="openModal(${i})" class="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition duration-300 border border-gray-100 group cursor-pointer flex flex-col h-full">
            <div class="relative h-40 sm:h-48 overflow-hidden bg-slate-200">
                <img src="${item.gambar}" alt="${item.tema}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
                <div class="absolute top-3 left-3 sm:top-4 sm:left-4 bg-white/90 backdrop-blur px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-center shadow">
                    <p class="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase">${parsedHari}</p>
                    <p class="text-lg sm:text-xl font-bold text-emerald-700 leading-none">${parsedTgl}</p>
                    <p class="text-[10px] sm:text-xs font-medium text-gray-600">${parsedBln}</p>
                </div>
            </div>
            <div class="p-4 sm:p-6 flex-grow">
                <span class="text-[10px] sm:text-xs font-bold ${badgeClass} px-2 py-1 rounded mb-2 sm:mb-3 inline-block">${item.edisi}</span>
                <h3 class="text-lg sm:text-xl font-bold text-slate-800 mb-2 group-hover:text-emerald-700 transition line-clamp-2">${item.tema}</h3>
                <div class="space-y-1 sm:space-y-2 mt-3 sm:mt-4 text-xs sm:text-sm text-gray-600">
                    <p class="flex items-center"><i class="fa-solid fa-user-tie w-4 sm:w-5 text-emerald-600"></i> <span class="truncate">${item.pemateri}</span></p>
                    <p class="flex items-center"><i class="fa-regular fa-clock w-4 sm:w-5 text-emerald-600"></i> <span class="truncate">${item.waktu}</span></p>
                </div>
            </div>
        </div>
        `;
    }

    container.insertAdjacentHTML('beforeend', htmlOutput);
    displayedCount = endIdx;

    const loadMoreBtn = document.getElementById('load-more-container');
    if (loadMoreBtn) loadMoreBtn.style.display = (displayedCount < allKajianData.length) ? 'block' : 'none';
}

function openModal(index, allowPushState = true) {
    const data = allKajianData[index];
    const modal = document.getElementById('kajian-modal');
    const modalContent = document.getElementById('kajian-modal-content');
    
    if(!data || !modal) return;

    const baseUrl = window.location.href.split('#')[0].split('?')[0];
    const shareUrl = `${baseUrl}#kajian=${data.id}`;

    if (allowPushState) {
        try { window.history.pushState(null, null, `#kajian=${data.id}`); } catch(e){}
    }

    currentShareData = {
        title: `Hadirilah Kajian: ${data.tema}`,
        text: `Hadirilah Majelis Ilmu: \n"${data.tema}"\n\nBersama: ${data.pemateri}\nWaktu: ${data.waktu}\n\nDi Masjid Raya Al-Hikmah.\nMari ramaikan taman-taman surga.\n\nLink: ${shareUrl}`,
        url: shareUrl
    };

    document.getElementById('modal-img').src = data.gambar;
    document.getElementById('modal-title').textContent = data.tema;
    document.getElementById('modal-pemateri').textContent = data.pemateri;
    document.getElementById('modal-waktu').textContent = data.waktu;
    document.getElementById('modal-deskripsi').textContent = data.deskripsi || "Tidak ada deskripsi tambahan.";
    
    const badge = document.getElementById('modal-badge');
    badge.textContent = data.edisi || "Kajian";
    const edisiLower = (data.edisi || "").toLowerCase();
    badge.className = "text-[10px] sm:text-xs font-bold px-3 py-1 rounded-md mb-3 inline-block shadow-sm " + 
        (edisiLower.includes("spesial") ? "bg-yellow-500 text-white" : 
         edisiLower.includes("muslimah") ? "bg-blue-500 text-white" : "bg-emerald-500 text-white");

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.classList.add('opacity-100');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
    
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('kajian-modal');
    const modalContent = document.getElementById('kajian-modal-content');
    if(!modal) return;
    
    try { window.history.pushState("", document.title, window.location.pathname + window.location.search); } catch(e){}

    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
    }, 300);
}

async function shareKajian() {
    if (!currentShareData) return;
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: currentShareData.title,
                text: currentShareData.text
            });
            return; 
        } catch (err) {
            console.log('Share dibatalkan user.');
        }
    } 
    
    fallbackCopyText(currentShareData.text);
}

function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; 
    textArea.style.left = "-9999px"; 
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        if(typeof showToast === 'function') showToast('Info & Link Kajian telah disalin!');
    } catch (err) {
        alert('Gagal menyalin otomatis. Silakan salin manual.');
    }
    document.body.removeChild(textArea);
}

function copyRekening() {
    fallbackCopyText("7123 4567 89");
    if(typeof showToast === 'function') showToast('Nomor Rekening BSI berhasil disalin!');
}

// ==========================================
// 6. INTEGRASI LAPORAN KEUANGAN
// ==========================================
async function fetchKeuanganData() {
    try {
        const sheetName = encodeURIComponent("Keuangan");
        const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
        
        const response = await fetch(url);
        const text = await response.text();
        const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\)/);
        
        if (!jsonMatch) throw new Error("Format Keuangan tidak valid");
        
        const data = JSON.parse(jsonMatch[1]);
        const rows = data.table.rows;

        const formatRupiah = (val) => {
            return "Rp " + new Intl.NumberFormat('id-ID').format(val || 0);
        };

        const pemasukan = rows[0] && rows[0].c[1] ? rows[0].c[1].v : 0;
        const pengeluaran = rows[1] && rows[1].c[1] ? rows[1].c[1].v : 0;
        const saldo = rows[2] && rows[2].c[1] ? rows[2].c[1].v : 0;

        const elPemasukan = document.getElementById('pemasukan-pekan');
        const elPengeluaran = document.getElementById('pengeluaran-pekan');
        const elSaldo = document.getElementById('saldo-total');

        if(elPemasukan) elPemasukan.textContent = formatRupiah(pemasukan);
        if(elPengeluaran) elPengeluaran.textContent = formatRupiah(pengeluaran);
        if(elSaldo) elSaldo.textContent = formatRupiah(saldo);

    } catch (error) {
        console.error("Gagal menarik data Keuangan:", error);
        const errText = "Gagal Muat";
        const elPemasukan = document.getElementById('pemasukan-pekan');
        const elPengeluaran = document.getElementById('pengeluaran-pekan');
        const elSaldo = document.getElementById('saldo-total');
        
        if(elPemasukan) elPemasukan.textContent = errText;
        if(elPengeluaran) elPengeluaran.textContent = errText;
        if(elSaldo) elSaldo.textContent = errText;
    }
}

// ==========================================
// INIT FETCH DATA & EVENTS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    fetchKajianData();
    fetchKeuanganData();

    const btnLoadMore = document.getElementById('btn-load-more');
    if(btnLoadMore) btnLoadMore.addEventListener('click', renderKajian);

    const modal = document.getElementById('kajian-modal');
    if(modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }
});
