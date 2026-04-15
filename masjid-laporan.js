 // by Andi | disatu.web.id

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

        let allTransaksi = []; 

        const formatCcy = (num) => new Intl.NumberFormat('id-ID').format(num);
        const getNumber = (cell) => {
            if (!cell || cell.v === null || cell.v === undefined) return 0;
            if (typeof cell.v === 'number') return cell.v;
            if (typeof cell.v === 'string') {
                const cleanStr = cell.v.replace(/[^0-9]/g, '');
                return cleanStr ? parseInt(cleanStr) : 0;
            }
            return 0;
        };

        async function fetchDetailKeuangan() {
            const tbody = document.getElementById('keuangan-body');
            try {
                const sheetName = encodeURIComponent("Keuangan");
                const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheetName}&range=A6:E&headers=1`;
                const response = await fetch(url);
                const text = await response.text();
                const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\)/);
                const data = JSON.parse(jsonMatch[1]);
                const rows = data.table.rows;
                const availableYears = new Set(); 

                rows.forEach((r) => {
                    const row = r.c;
                    if (!row) return; 
                    let tanggal = row[0] ? (row[0].f || row[0].v || "-") : "-";
                    const keterangan = row[1] ? (row[1].v || "-") : "-";
                    const masuk = getNumber(row[2]);
                    const keluar = getNumber(row[3]);
                    const saldo = getNumber(row[4]);

                    if (keterangan === "-" && masuk === 0 && keluar === 0 && saldo === 0) return;

                    let bulanStr = "", tahunStr = "";
                    let rawTgl = row[0] ? row[0].v : null;
                    if (typeof rawTgl === 'string' && rawTgl.startsWith('Date(')) {
                        let parts = rawTgl.match(/Date\((\d+),\s*(\d+)/);
                        if (parts) {
                            tahunStr = parts[1];
                            bulanStr = String(parseInt(parts[2]) + 1).padStart(2, '0');
                        }
                    } else {
                        let match = String(tanggal).match(/(\d{4})-(\d{2})/);
                        if (match) { tahunStr = match[1]; bulanStr = match[2]; }
                    }
                    if(tahunStr) availableYears.add(tahunStr);
                    allTransaksi.push({ tanggal, keterangan, masuk, keluar, saldo, bulan: bulanStr, tahun: tahunStr });
                });

                const yearSelect = document.getElementById('filter-tahun');
                Array.from(availableYears).sort().reverse().forEach(year => {
                    yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
                });

                const sekarang = new Date();
                const bSkrg = String(sekarang.getMonth() + 1).padStart(2, '0');
                const tSkrg = String(sekarang.getFullYear());
                if (allTransaksi.some(t => t.bulan === bSkrg && t.tahun === tSkrg)) {
                    document.getElementById('filter-bulan').value = bSkrg;
                    document.getElementById('filter-tahun').value = tSkrg;
                }

                document.getElementById('update-info').textContent = `Sinkronisasi: ${new Date().toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}`;
                renderTabel();
            } catch (error) {
                tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-red-500">Database gagal dimuat.</td></tr>`;
            }
        }

        function renderTabel() {
            const tbody = document.getElementById('keuangan-body');
            const footer = document.getElementById('tabel-footer');
            const filterBulan = document.getElementById('filter-bulan');
            const filterTahun = document.getElementById('filter-tahun');
            const printPeriod = document.getElementById('print-period-info');

            let totalMasuk = 0, totalKeluar = 0, htmlContent = '';

            allTransaksi.forEach((item) => {
                let show = true;
                if (filterBulan.value !== "" && item.bulan !== filterBulan.value) show = false;
                if (filterTahun.value !== "" && item.tahun !== filterTahun.value) show = false;

                if (show) {
                    totalMasuk += item.masuk;
                    totalKeluar += item.keluar;
                    htmlContent += `
                        <tr class="hover:bg-slate-50 transition border-b border-gray-50 last:border-0">
                            <td class="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-500">${item.tanggal}</td>
                            <td class="px-6 py-4 font-semibold text-slate-800">${item.keterangan}</td>
                            <td class="px-6 py-4 text-right text-emerald-600 font-bold">${item.masuk > 0 ? '+ Rp ' + formatCcy(item.masuk) : '-'}</td>
                            <td class="px-6 py-4 text-right text-red-500 font-medium">${item.keluar > 0 ? '- Rp ' + formatCcy(item.keluar) : '-'}</td>
                            <td class="px-6 py-4 text-right font-bold bg-emerald-50/30 text-emerald-900">Rp ${formatCcy(item.saldo)}</td>
                        </tr>`;
                }
            });

            // Update info periode untuk cetak
            const labelBulan = filterBulan.options[filterBulan.selectedIndex].text;
            const labelTahun = filterTahun.value || "Seluruh Tahun";
            printPeriod.textContent = `Periode: ${labelBulan} ${labelTahun}`;

            if (htmlContent === '') {
                tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-10 text-center text-gray-500">Tidak ada data.</td></tr>';
                footer.classList.add('hidden');
            } else {
                tbody.innerHTML = htmlContent;
                document.getElementById('total-filter-masuk').textContent = 'Rp ' + formatCcy(totalMasuk);
                document.getElementById('total-filter-keluar').textContent = 'Rp ' + formatCcy(totalKeluar);
                footer.classList.remove('hidden');
            }
        }

        document.addEventListener('DOMContentLoaded', fetchDetailKeuangan);
