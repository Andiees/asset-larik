// by Andi | disatu.web.id
        let allSurahData = [], audioPlayer = new Audio(), currentPlayingBtn = null;
        let selectedQari = localStorage.getItem('quran_qari') || "05";
        document.getElementById('qari-selector').value = selectedQari;

        // --- SISTEM MENU NAVBAR ---
        const btn = document.getElementById('mobile-menu-btn');
        const menu = document.getElementById('mobile-menu');
        if(btn && menu) btn.addEventListener('click', () => menu.classList.toggle('hidden'));
        document.getElementById('year').textContent = new Date().getFullYear();
        window.addEventListener('scroll', () => {
            const nav = document.getElementById('navbar');
            if(nav) {
                if (window.scrollY > 10) nav.classList.add('shadow-md');
                else nav.classList.remove('shadow-md');
            }
        });

        // --- FETCH DAFTAR SURAH ---
        async function fetchSurah() {
            try {
                const res = await fetch('https://equran.id/api/v2/surat');
                const json = await res.json();
                if(json.code === 200) {
                    allSurahData = json.data;
                    renderSurah(allSurahData);
                    renderLastRead();
                }
            } catch(e) { console.error(e); }
        }

        function renderSurah(data) {
            const grid = document.getElementById('surah-grid');
            grid.innerHTML = data.map(s => `
                <div onclick="bukaSurah(${s.nomor})" class="bg-slate-50 rounded-2xl p-5 border border-gray-100 hover:bg-emerald-50 transition cursor-pointer flex items-center justify-between group shadow-sm">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-white rounded-lg flex items-center justify-center font-bold text-emerald-600 border group-hover:bg-emerald-600 group-hover:text-white transition">${s.nomor}</div>
                        <div><h3 class="font-bold text-slate-800 leading-tight">${s.namaLatin}</h3><p class="text-[10px] text-gray-400 uppercase tracking-wider">${s.arti} • ${s.jumlahAyat} Ayat</p></div>
                    </div>
                    <div class="text-2xl font-arabic text-emerald-600">${s.nama}</div>
                </div>
            `).join('');
        }

        document.getElementById('search-surah').oninput = (e) => {
            const k = e.target.value.toLowerCase();
            renderSurah(allSurahData.filter(s => s.namaLatin.toLowerCase().includes(k) || s.arti.toLowerCase().includes(k)));
        };

        // --- BUKA SURAH & DETAIL ---
        async function bukaSurah(no, scrollAyat = null) {
            document.getElementById('view-list').classList.add('hidden');
            document.getElementById('view-baca').classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            hentikanAudio();
            document.getElementById('ayat-container').innerHTML = '<div class="text-center py-20"><i class="fa-solid fa-circle-notch fa-spin text-3xl text-emerald-600"></i></div>';

            try {
                const res = await fetch(`https://equran.id/api/v2/surat/${no}`);
                const json = await res.json();
                if(json.code === 200) {
                    const s = json.data;
                    document.getElementById('baca-header-latin').textContent = s.namaLatin;
                    document.getElementById('baca-header-arab').textContent = s.nama;
                    document.getElementById('baca-header-arti').textContent = s.arti;
                    document.getElementById('bismillah-banner').classList.toggle('hidden', s.nomor === 1 || s.nomor === 9);
                    
                    document.getElementById('ayat-container').innerHTML = s.ayat.map(a => `
                        <div id="ayat-${a.nomorAyat}" class="pt-8 pb-4 px-2 transition-all duration-500 rounded-2xl border-2 border-transparent">
                            <div class="flex justify-between items-center mb-8 border-b border-gray-50 pb-4">
                                <span class="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-100">${a.nomorAyat}</span>
                                <div class="flex gap-2">
                                    <button onclick="playAudio('${a.audio[selectedQari]}', this, 'ayat-${a.nomorAyat}')" class="w-8 h-8 rounded-full bg-slate-50 text-emerald-600 border flex items-center justify-center hover:bg-emerald-600 hover:text-white transition"><i class="fa-solid fa-play text-[10px]"></i></button>
                                    <button onclick="tandai(${s.nomor},'${s.namaLatin}',${a.nomorAyat})" class="w-8 h-8 rounded-full bg-slate-50 text-yellow-600 border flex items-center justify-center hover:bg-yellow-500 hover:text-white transition"><i class="fa-solid fa-bookmark text-[10px]"></i></button>
                                    <button onclick="openShare('${a.teksArab}','${a.teksIndonesia.replace(/'/g,"")}', '${s.namaLatin}', ${a.nomorAyat})" class="w-8 h-8 rounded-full bg-slate-50 text-purple-600 border flex items-center justify-center hover:bg-purple-600 hover:text-white transition"><i class="fa-solid fa-image text-[10px]"></i></button>
                                </div>
                            </div>
                            <div class="text-right mb-10"><p class="font-arabic text-4xl md:text-5xl leading-[2.5] text-slate-800">${a.teksArab}</p></div>
                            <div class="bg-slate-50 p-5 rounded-2xl border border-gray-100"><p class="text-emerald-700 text-xs font-bold italic mb-2 uppercase tracking-wide">${a.teksLatin}</p><p class="text-sm text-slate-600 leading-relaxed">"${a.teksIndonesia}"</p></div>
                        </div>
                    `).join('');

                    if(scrollAyat) {
                        setTimeout(() => {
                            const el = document.getElementById(`ayat-${scrollAyat}`);
                            if(el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ayat-highlight'); }
                        }, 600);
                    }
                }
            } catch(e) { console.error(e); }
        }

        // --- HISTORY LOGIC ---
        function tandai(no, nm, ay) {
            let hist = JSON.parse(localStorage.getItem('quran_history') || "[]");
            hist = hist.filter(h => h.no !== no); 
            hist.unshift({no, nm, ay, time: new Date().getTime()}); 
            localStorage.setItem('quran_history', JSON.stringify(hist.slice(0, 6))); 
            showToast(`Ayat ${ay} ditandai`);
        }

        function renderLastRead() {
            const hist = JSON.parse(localStorage.getItem('quran_history') || "[]");
            const container = document.getElementById('last-read-container');
            const list = document.getElementById('last-read-list');
            
            if(hist.length > 0) {
                container.classList.remove('hidden');
                list.innerHTML = hist.map(h => `
                    <div onclick="bukaSurah(${h.no}, ${h.ay})" class="bg-emerald-700 p-4 rounded-2xl text-white shadow-md cursor-pointer hover:bg-emerald-800 transition flex items-center justify-between border border-emerald-500">
                        <div><p class="text-[10px] text-emerald-200 font-bold uppercase tracking-widest">Surah</p><h4 class="font-bold text-lg">${h.nm}</h4></div>
                        <div class="text-right"><p class="text-[10px] text-emerald-200 font-bold uppercase tracking-widest">Ayat</p><h4 class="font-bold text-lg">${h.ay}</h4></div>
                    </div>
                `).join('');
            } else { container.classList.add('hidden'); }
        }

        function hapusRiwayat() { localStorage.removeItem('quran_history'); renderLastRead(); showToast("Riwayat dihapus"); }

        // --- AUDIO & UI HELPERS ---
        function ubahQari() { selectedQari = document.getElementById('qari-selector').value; localStorage.setItem('quran_qari', selectedQari); showToast("Qari' diperbarui"); }
        function playAudio(url, btn, id) {
            if(currentPlayingBtn === btn && !audioPlayer.paused) { hentikanAudio(); return; }
            hentikanAudio();
            currentPlayingBtn = btn;
            document.getElementById(id).classList.add('ayat-highlight');
            btn.innerHTML = '<i class="fa-solid fa-pause text-[10px]"></i>';
            btn.classList.add('bg-emerald-600', 'text-white');
            audioPlayer.src = url;
            audioPlayer.play();
            audioPlayer.onended = () => hentikanAudio();
        }
        function hentikanAudio() {
            audioPlayer.pause();
            if(currentPlayingBtn) {
                currentPlayingBtn.innerHTML = '<i class="fa-solid fa-play text-[10px]"></i>';
                currentPlayingBtn.classList.remove('bg-emerald-600', 'text-white');
                document.querySelectorAll('.ayat-highlight').forEach(el => el.classList.remove('ayat-highlight'));
            }
            currentPlayingBtn = null;
        }
        function kembaliKeList() { 
            document.getElementById('view-baca').classList.add('hidden'); 
            document.getElementById('view-list').classList.remove('hidden'); 
            hentikanAudio(); renderLastRead();
        }
        function showToast(m) {
            const t = document.getElementById('toast-notification');
            document.getElementById('toast-message').textContent = m;
            t.classList.remove('opacity-0', 'translate-y-24');
            setTimeout(() => t.classList.add('opacity-0', 'translate-y-24'), 3000);
        }

        // --- SHARE IMAGE LOGIC ---
        let currentImg = null;
        async function openShare(arab, indo, surah, ay) {
            const modal = document.getElementById('share-modal');
            modal.classList.remove('hidden'); modal.classList.add('flex');
            setTimeout(() => modal.classList.remove('opacity-0', 'scale-95'), 10);
            document.getElementById('preview-container').innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-3xl text-emerald-600"></i>';

            document.getElementById('canvas-arab').textContent = arab;
            document.getElementById('canvas-indo').textContent = `"${indo}"`;
            document.getElementById('canvas-surah').textContent = `QS. ${surah} : ${ay}`;

            setTimeout(() => {
                html2canvas(document.getElementById('canvas-template'), { scale: 2, backgroundColor: "#ffffff" }).then(c => {
                    currentImg = c.toDataURL("image/png");
                    document.getElementById('preview-container').innerHTML = `<img src="${currentImg}" class="w-full rounded-xl shadow-lg border">`;
                });
            }, 600);

            document.getElementById('btn-share-link').onclick = () => {
                const link = `${window.location.origin}${window.location.pathname}#${surah}-${ay}`;
                navigator.clipboard.writeText(link); showToast("Link ayat disalin!");
            };
        }

        function closeShareModal() { 
            const m = document.getElementById('share-modal');
            m.classList.add('opacity-0', 'scale-95'); setTimeout(() => m.classList.add('hidden'), 300); 
        }

        document.getElementById('btn-download-img').onclick = () => {
            const a = document.createElement('a'); a.href = currentImg; a.download = 'Ayat_AlQuran.png'; a.click();
        };

        // Initialize
        document.addEventListener('DOMContentLoaded', fetchSurah);
