 const editor = grapesjs.init({
      container: '#gjs',
      height: '100%',
      fromElement: true,
      storageManager: false,
      allowScripts: 1, 
      plugins: ['gjs-blocks-basic'],
      
      deviceManager: {
        devices: [
          { name: 'Desktop', width: '' },
          { name: 'Mobile', width: '375px', widthMedia: '480px' }
        ]
      },

      styleManager: {
        sectors: [
          {
            name: 'Warna & Gaya Dasar',
            open: true,
            buildProps: ['color', 'background-color', 'font-family', 'font-size', 'text-align'],
            properties: [
               { name: 'Warna Teks', property: 'color', type: 'color' },
               { name: 'Warna Latar', property: 'background-color', type: 'color' }
            ]
          },
          {
            name: 'Batas & Ruang',
            open: false,
            buildProps: ['padding', 'margin', 'border-radius', 'border'],
            properties: [
               { name: 'Lengkungan', property: 'border-radius' }
            ]
          }
        ]
      },
      // Mengaktifkan Spectrum color picker bawaan agar fiturnya maksimal
      colorPicker: { appendTo: 'parent', offset: { top: 26, left: -160 } },
      
      canvas: {
        scripts: ['https://cdn.tailwindcss.com'],
        styles: ['https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap']
      }
    });

    editor.on('load', () => {
      editor.Panels.getButton('views', 'open-sm').set('active', true);
    });

    editor.on('component:selected', (model) => {
      if(model.is('image') || model.is('link')) {
        editor.Panels.getButton('views', 'open-tm').set('active', true);
      } else {
        editor.Panels.getButton('views', 'open-sm').set('active', true);
      }
    });

    // Toolbar Kustom
    document.getElementById('btn-undo').onclick = () => editor.runCommand('core:undo');
    document.getElementById('btn-redo').onclick = () => editor.runCommand('core:redo');

    const btnDesktop = document.getElementById('btn-desktop');
    const btnMobile = document.getElementById('btn-mobile');
    btnDesktop.onclick = () => {
      editor.setDevice('Desktop');
      btnDesktop.classList.add('active');
      btnMobile.classList.remove('active');
    };
    btnMobile.onclick = () => {
      editor.setDevice('Mobile');
      btnMobile.classList.add('active');
      btnDesktop.classList.remove('active');
    };

    // Modal Import
    const modal = document.getElementById('import-modal');
    document.getElementById('btn-import').onclick = () => {
      const currentHtml = editor.getHtml();
      const currentCss = editor.getCss();
      const currentCode = currentHtml ? `<style>${currentCss}</style>\n${currentHtml}` : '';
      document.getElementById('import-area').value = currentCode;
      modal.classList.remove('hidden');
    };
    document.getElementById('btn-close').onclick = () => modal.classList.add('hidden');
    document.getElementById('btn-apply').onclick = () => {
      editor.setComponents(document.getElementById('import-area').value);
      modal.classList.add('hidden');
    };

    (function() {
    var allowedDomain = "larik.web.id";
    var currentDomain = window.location.hostname;

    // Normalisasi (hapus www.)
    currentDomain = currentDomain.replace(/^www\./, "");

    // Cek apakah domain cocok atau subdomain
    if (
        currentDomain !== allowedDomain &&
        !currentDomain.endsWith("." + allowedDomain)
    ) {
        window.location.href = "https://" + allowedDomain;
    }
})();

    // Export Sakti
    document.getElementById('btn-export').onclick = function() {
      const btn = this;
      const htmlContent = editor.getHtml();
      const cssContent = editor.getCss();
      
      const finalCode = `<!DOCTYPE html>\n<html lang="id">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<style>\n${cssContent}\n</style>\n</head>\n<body>\n${htmlContent}\n</body>\n</html>`;
      
      navigator.clipboard.writeText(finalCode).then(() => {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `✅ Sukses Tersalin!`;
        btn.classList.replace('bg-emerald-600', 'bg-slate-800');
        btn.classList.replace('hover:bg-emerald-700', 'hover:bg-slate-900');
        
        setTimeout(() => {
          btn.innerHTML = originalHtml;
          btn.classList.replace('bg-slate-800', 'bg-emerald-600');
          btn.classList.replace('hover:bg-slate-900', 'hover:bg-emerald-700');
        }, 2500);
      });
    };
