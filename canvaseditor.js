// ============ GLOBAL STATE ============
        document.getElementById('year').textContent = new Date().getFullYear();
        
        const editor = document.getElementById('code-editor');
        const previewFrame = document.getElementById('preview-frame');
        const sidebar = document.getElementById('editor-sidebar');
        const contextMenu = document.getElementById('context-menu');
        const inspectorOverlay = document.getElementById('inspector-overlay');
        const btnSnippets = document.getElementById('btn-snippets');
        const dropdownSnippets = document.getElementById('dropdown-snippets');
        const editorContainer = document.getElementById('editor-container');
        
        let settings = { autoRefresh: true, theme: 'light', fontSize: 14, previewMode: 'desktop', inspectMode: false, editorVisible: true };
        let debounceTimer, isSyncingFromIframe = false, isSyncingFromEditor = false;
        let activeEl = null, clipboardSection = null;
        let pendingStyleChanges = {};
        let gradientStops = [{ color: '#3b82f6', position: 0 }, { color: '#8b5cf6', position: 100 }];
        let gradientType = 'linear', gradientAngle = 135;
        
        let historyCode = [], historyIndex = -1;
        const btnUndo = document.getElementById('btn-undo'), btnRedo = document.getElementById('btn-redo');
        
        // ============ DEFAULT CODE ============
        const defaultHTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview Website</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
  <style>
    .mobile-menu { display: none; }
    .mobile-menu.active { display: block !important; }
    @media (max-width: 768px) { .desktop-nav { display: none !important; } .burger-btn { display: flex !important; } }
    .burger-btn { display: none; cursor: pointer; }
    @media (min-width: 769px) { .burger-btn { display: none !important; } .desktop-nav { display: flex !important; } }
  </style>
</head>
<body class="bg-slate-100 text-gray-800 font-sans min-h-screen">
  
  <nav id="main-navbar" style="background-color: #1f2937; padding: 16px 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center;">
      <a href="#" id="nav-logo" style="color: #60a5fa; font-size: 1.5rem; font-weight: bold; text-decoration: none;">LogoBrand</a>
      <ul class="desktop-nav" id="desktop-nav-list" style="display: flex; gap: 24px; list-style: none; margin: 0; padding: 0;">
        <li><a href="#" id="nav-beranda" style="color: white; text-decoration: none;">Beranda</a></li>
        <li><a href="#" id="nav-fitur" style="color: white; text-decoration: none;">Fitur</a></li>
        <li><a href="#" id="nav-login" style="background-color: #3b82f6; color: white; padding: 8px 20px; border-radius: 8px; text-decoration: none;">Login</a></li>
      </ul>
      <button class="burger-btn" id="burger-button" onclick="document.querySelector('.mobile-menu').classList.toggle('active')" style="display: none; background: none; border: none; color: white; font-size: 24px; padding: 8px;"><i class="fas fa-bars" id="burger-icon"></i></button>
    </div>
    <div class="mobile-menu" id="mobile-menu-container" style="display: none; background: #1f2937; padding: 16px; margin-top: 8px; border-radius: 8px;">
      <a href="#" id="mobile-beranda" style="display: block; color: white; padding: 12px; text-decoration: none;">Beranda</a>
      <a href="#" id="mobile-fitur" style="display: block; color: white; padding: 12px; text-decoration: none;">Fitur</a>
      <a href="#" id="mobile-login" style="display: block; background: #3b82f6; color: white; padding: 12px; border-radius: 8px; text-align: center; text-decoration: none;">Login</a>
    </div>
  </nav>

  <section id="hero-section" style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 80px 24px; text-align: center; color: white;">
    <img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400" id="hero-image" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; margin: 0 auto 24px; border: 4px solid white; box-shadow: 0 10px 30px rgba(0,0,0,0.3);" alt="Hero">
    <h2 id="hero-title" style="font-size: 2.5rem; font-weight: 800; margin-bottom: 16px;">Bangun Website Impian</h2>
    <p id="hero-desc" style="font-size: 1.2rem; margin-bottom: 32px;">Geser elemen dengan tombol Atas/Bawah/Kiri/Kanan</p>
    <a href="#" id="hero-cta" style="display: inline-block; background: white; color: #3b82f6; font-weight: bold; padding: 14px 40px; border-radius: 9999px; text-decoration: none; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">Mulai Sekarang</a>
  </section>

  <footer id="main-footer" style="background-color: #1f2937; padding: 40px 24px; text-align: center; color: #9ca3af;">
    <a href="#" id="footer-logo" style="font-size: 1.5rem; font-weight: bold; color: white; text-decoration: none; display: block; margin-bottom: 12px;">LogoBrand</a>
    <p style="font-size: 0.8rem;">&copy; 2026. <a href="#" id="footer-privacy" style="color: #60a5fa;">Kebijakan Privasi</a></p>
  </footer>

  <script>
    document.querySelector('.burger-btn')?.addEventListener('click', function() { document.querySelector('.mobile-menu').classList.toggle('active'); });
  <\/script>
</body>
</html>`;

        editor.value = defaultHTML;
        saveState(defaultHTML);
        updatePreview();
        document.getElementById('editor-line-count').textContent = 'Baris: ' + editor.value.split('\n').length;

        // ============ TOGGLE EDITOR ============
        function toggleEditor() {
            settings.editorVisible = !settings.editorVisible;
            const btn = document.getElementById('toggle-editor-btn');
            if (settings.editorVisible) {
                editorContainer.classList.remove('collapsed');
                btn.classList.add('active');
                btn.innerHTML = '<i class="fas fa-code"></i> <span class="hidden sm:inline">Editor</span>';
            } else {
                editorContainer.classList.add('collapsed');
                btn.classList.remove('active');
                btn.innerHTML = '<i class="fas fa-code"></i> <span class="hidden sm:inline">Tampilkan</span>';
            }
        }

        // ============ RESIZER ============
        const resizer = document.getElementById('resizer');
        const leftSide = editorContainer;
        const rightSide = document.getElementById('preview-wrapper');
        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            previewFrame.style.pointerEvents = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const container = leftSide.parentElement;
            const containerRect = container.getBoundingClientRect();
            let newLeft = e.clientX - containerRect.left;
            newLeft = Math.max(0, Math.min(newLeft, containerRect.width - 300));
            leftSide.style.width = newLeft + 'px';
            leftSide.style.flex = 'none';
            rightSide.style.flex = '1';
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) { isResizing = false; document.body.style.cursor = 'default'; previewFrame.style.pointerEvents = 'auto'; }
        });

        // ============ SIDEBAR ============
        function toggleSidebar() { sidebar.classList.toggle('collapsed'); }
        function showSidebar() { sidebar.classList.remove('collapsed'); }

        // ============ UNDO / REDO ============
        function saveState(code) {
            if (historyIndex >= 0 && historyCode[historyIndex] === code) return;
            if (historyIndex < historyCode.length - 1) historyCode = historyCode.slice(0, historyIndex + 1);
            historyCode.push(code); historyIndex++;
            if (historyCode.length > 100) { historyCode.shift(); historyIndex--; }
            updateUndoRedoUI();
        }
        function updateUndoRedoUI() {
            btnUndo.classList.toggle('text-gray-400', historyIndex <= 0);
            btnUndo.classList.toggle('cursor-not-allowed', historyIndex <= 0);
            btnRedo.classList.toggle('text-gray-400', historyIndex >= historyCode.length - 1);
            btnRedo.classList.toggle('cursor-not-allowed', historyIndex >= historyCode.length - 1);
        }
        function undo() { if (historyIndex > 0) { historyIndex--; applyHistory(); } }
        function redo() { if (historyIndex < historyCode.length - 1) { historyIndex++; applyHistory(); } }
        function applyHistory() {
            isSyncingFromEditor = true;
            editor.value = historyCode[historyIndex];
            updatePreview(); updateUndoRedoUI();
            document.getElementById('editor-line-count').textContent = 'Baris: ' + editor.value.split('\n').length;
            activeEl = null;
            setTimeout(() => isSyncingFromEditor = false, 100);
        }

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
            if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
            if (e.ctrlKey && e.key.toLowerCase() === 'd' && activeEl) { e.preventDefault(); duplicateElement(); return; }
            if (e.key === 'Delete' && activeEl && document.activeElement !== editor) { e.preventDefault(); deleteElement(); return; }
            if (e.key === 'Escape') { if (activeEl) { navigateElement('parent'); return; } hideContextMenu(); return; }
            if (activeEl && document.activeElement !== editor) {
                if (e.key === 'ArrowLeft') { e.preventDefault(); shiftElement('left'); }
                if (e.key === 'ArrowRight') { e.preventDefault(); shiftElement('right'); }
                if (e.key === 'ArrowUp') { e.preventDefault(); shiftElement('top'); }
                if (e.key === 'ArrowDown') { e.preventDefault(); shiftElement('bottom'); }
            }
        });

        // ============ AUTO REFRESH ============
        editor.addEventListener('input', () => {
            if (isSyncingFromIframe) return;
            document.getElementById('editor-line-count').textContent = 'Baris: ' + editor.value.split('\n').length;
            if (settings.autoRefresh) {
                isSyncingFromEditor = true;
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => { updatePreview(); saveState(editor.value); setTimeout(() => isSyncingFromEditor = false, 100); }, 400);
            } else {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => saveState(editor.value), 1000);
            }
        });

        function updatePreview() { previewFrame.srcdoc = editor.value; }

        // ============ SIDEBAR TABS ============
        function switchSidebarTab(tab) {
            ['style', 'typography', 'layout', 'gradient', 'media'].forEach(t => {
                document.getElementById('stab-' + t).className = 'flex-1 py-1.5 px-1.5 rounded-md text-[9px] font-bold transition text-gray-500 hover:text-gray-700';
                document.getElementById('stab-content-' + t).classList.add('hidden');
            });
            document.getElementById('stab-' + tab).className = 'flex-1 py-1.5 px-1.5 rounded-md text-[9px] font-bold transition bg-white shadow-sm text-blue-600';
            document.getElementById('stab-content-' + tab).classList.remove('hidden');
            if (tab === 'gradient') renderGradientStops();
        }

        function detectElementType(el) {
            const badgeTag = document.getElementById('badge-tag');
            [document.getElementById('badge-link'), document.getElementById('badge-image'), document.getElementById('badge-burger')].forEach(b => b.classList.add('hidden'));
            [document.getElementById('image-editor-section'), document.getElementById('link-editor-section'), document.getElementById('burger-editor-section')].forEach(s => s.classList.add('hidden'));
            document.getElementById('media-fallback').classList.remove('hidden');
            
            badgeTag.textContent = el.tagName;
            badgeTag.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700';
            document.getElementById('sidebar-element-info').textContent = 'Pilih elemen';
            
            const tag = el.tagName.toLowerCase();
            if (tag === 'img') {
                document.getElementById('badge-image').classList.remove('hidden');
                document.getElementById('image-editor-section').classList.remove('hidden');
                document.getElementById('media-fallback').classList.add('hidden');
                document.getElementById('image-src-input').value = el.getAttribute('src') || '';
                badgeTag.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700';
                document.getElementById('sidebar-element-info').textContent = '🖼️ Gambar';
                switchSidebarTab('media');
            } else if (tag === 'a') {
                document.getElementById('badge-link').classList.remove('hidden');
                document.getElementById('link-editor-section').classList.remove('hidden');
                document.getElementById('media-fallback').classList.add('hidden');
                document.getElementById('link-href-input').value = el.getAttribute('href') || '#';
                badgeTag.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700';
                document.getElementById('sidebar-element-info').textContent = '🔗 Link';
                switchSidebarTab('media');
            } else if ((tag === 'button' && el.innerHTML.includes('fa-bars')) || (tag === 'i' && el.classList.contains('fa-bars')) || (el.id && el.id.includes('mobile-'))) {
                document.getElementById('badge-burger').classList.remove('hidden');
                document.getElementById('burger-editor-section').classList.remove('hidden');
                document.getElementById('media-fallback').classList.add('hidden');
                badgeTag.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700';
                document.getElementById('sidebar-element-info').textContent = '🍔 ' + (el.textContent?.trim().substring(0, 12) || 'Burger');
                switchSidebarTab('media');
            } else {
                document.getElementById('sidebar-element-info').textContent = tag.toUpperCase() + (el.id ? ' #' + el.id : '');
            }
        }

        function navigateElement(direction) {
            if (!activeEl) return;
            const doc = activeEl.ownerDocument;
            let newEl = null;
            switch(direction) {
                case 'parent': newEl = activeEl.parentElement; if (newEl === doc.body || newEl === doc.documentElement) newEl = activeEl; break;
                case 'child': newEl = activeEl.firstElementChild || activeEl; break;
                case 'prev':
                    if (activeEl.previousElementSibling) { newEl = activeEl.previousElementSibling; while (newEl.lastElementChild) newEl = newEl.lastElementChild; }
                    else if (activeEl.parentElement !== doc.body) newEl = activeEl.parentElement;
                    else newEl = activeEl;
                    break;
                case 'next':
                    if (activeEl.nextElementSibling) { newEl = activeEl.nextElementSibling; while (newEl.firstElementChild) newEl = newEl.firstElementChild; }
                    else { let p = activeEl.parentElement; while (p && !p.nextElementSibling && p !== doc.body) p = p.parentElement; newEl = p?.nextElementSibling || activeEl; while (newEl?.firstElementChild) newEl = newEl.firstElementChild; }
                    break;
            }
            if (newEl && newEl !== activeEl && newEl.nodeType === 1) {
                if (activeEl) activeEl.classList.remove('active-highlight', 'active-highlight-link', 'active-highlight-image', 'active-highlight-burger');
                activeEl = newEl;
                applyHighlight(activeEl);
                updateColorPickers();
                detectElementType(activeEl);
                showSidebar();
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        function applyHighlight(el) {
            el.classList.remove('active-highlight', 'active-highlight-link', 'active-highlight-image', 'active-highlight-burger', 'hover-highlight');
            if (el.tagName === 'IMG') el.classList.add('active-highlight-image');
            else if (el.tagName === 'A') el.classList.add('active-highlight-link');
            else if ((el.tagName === 'BUTTON' && el.innerHTML.includes('fa-bars')) || (el.tagName === 'I' && el.classList.contains('fa-bars')) || (el.id && el.id.includes('mobile-'))) el.classList.add('active-highlight-burger');
            else el.classList.add('active-highlight');
        }

        // ============ PREVIEW INTERACTION ============
        previewFrame.addEventListener('load', function() {
            const doc = previewFrame.contentDocument || previewFrame.contentWindow.document;
            if (!doc || !doc.body) return;

            doc.body.contentEditable = "true";
            doc.designMode = "on";
            
            const style = doc.createElement('style');
            style.id = 'visual-builder-helper-css';
            style.innerHTML = `
                * { outline: none !important; }
                .hover-highlight { outline: 2px dashed #3b82f6 !important; outline-offset: 1px; cursor: pointer !important; background-color: rgba(59,130,246,0.03) !important; }
                .active-highlight { outline: 3px solid #2563eb !important; outline-offset: 3px; z-index: 50; animation: borderPulse 2s infinite; }
                .active-highlight-link { outline: 3px solid #f59e0b !important; outline-offset: 3px; }
                .active-highlight-image { outline: 3px solid #10b981 !important; outline-offset: 3px; }
                .active-highlight-burger { outline: 3px solid #ef4444 !important; outline-offset: 3px; z-index: 9999 !important; }
                @keyframes borderPulse { 0%,100% { outline-color: #3b82f6; } 50% { outline-color: #8b5cf6; } }
                a, img, svg, i, .fa, .fas, .far, .fab, button, .mobile-menu, .mobile-menu * { pointer-events: auto !important; cursor: pointer !important; }
                body { min-height: 100vh; }
                [contenteditable="true"] { cursor: text; }
                .mobile-menu { transition: all 0.3s ease; }
                .mobile-menu.active { display: block !important; }
                #mobile-menu-container a, #mobile-menu-container button, #mobile-menu-container * { pointer-events: auto !important; cursor: pointer !important; }
            `;
            doc.head.appendChild(style);

            doc.body.addEventListener('mouseover', function(e) {
                if (e.target === doc.body || e.target === doc.documentElement || e.target.nodeName === 'HTML') return;
                if (activeEl === e.target) return;
                e.target.classList.add('hover-highlight');
                if (settings.inspectMode && !activeEl) {
                    const rect = e.target.getBoundingClientRect();
                    inspectorOverlay.style.display = 'block';
                    inspectorOverlay.style.top = rect.top + 'px';
                    inspectorOverlay.style.left = rect.left + 'px';
                    inspectorOverlay.style.width = rect.width + 'px';
                    inspectorOverlay.style.height = rect.height + 'px';
                }
            }, true);
            
            doc.body.addEventListener('mouseout', function(e) {
                e.target.classList.remove('hover-highlight');
                if (!activeEl && settings.inspectMode) inspectorOverlay.style.display = 'none';
            }, true);

            doc.body.addEventListener('click', function(e) {
                if (e.target === doc.body || e.target === doc.documentElement || e.target.nodeName === 'HTML') { activeEl = null; return; }
                e.stopPropagation(); e.preventDefault();
                if (activeEl && activeEl !== e.target) activeEl.classList.remove('active-highlight', 'active-highlight-link', 'active-highlight-image', 'active-highlight-burger');
                activeEl = e.target;
                applyHighlight(activeEl);
                updateColorPickers();
                detectElementType(activeEl);
                showSidebar();
                if (activeEl.closest('.mobile-menu')) {
                    const menu = activeEl.closest('.mobile-menu');
                    menu.classList.add('active');
                    menu.style.display = 'block';
                }
            }, true);

            doc.body.addEventListener('contextmenu', function(e) {
                e.preventDefault(); e.stopPropagation();
                if (e.target === doc.body || e.target === doc.documentElement || e.target.nodeName === 'HTML') return;
                if (activeEl && activeEl !== e.target) activeEl.classList.remove('active-highlight', 'active-highlight-link', 'active-highlight-image', 'active-highlight-burger');
                activeEl = e.target;
                applyHighlight(activeEl);
                contextMenu.classList.remove('hidden');
                contextMenu.style.top = Math.min(e.clientY, window.innerHeight - 280) + 'px';
                contextMenu.style.left = Math.min(e.clientX, window.innerWidth - 220) + 'px';
            }, true);

            doc.body.addEventListener('input', function() {
                if (isSyncingFromEditor) return;
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => syncToEditor(), 300);
            }, true);

            const observer = new MutationObserver(() => {
                if (!isSyncingFromEditor && !isSyncingFromIframe) {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(syncToEditor, 500);
                }
            });
            observer.observe(doc.body, { childList: true, subtree: true, attributes: true, characterData: true });
        });

        document.addEventListener('click', (e) => {
            if (!contextMenu.contains(e.target)) hideContextMenu();
            if (!dropdownSnippets.contains(e.target) && !btnSnippets.contains(e.target)) dropdownSnippets.classList.add('hidden');
        });

        function hideContextMenu() { contextMenu.classList.add('hidden'); }

        function updateColorPickers() {
            if (!activeEl) return;
            const cs = activeEl.ownerDocument.defaultView.getComputedStyle(activeEl);
            function rgbToHex(rgb) {
                if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return '#ffffff';
                const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
                return m ? '#' + [m[1], m[2], m[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('') : '#ffffff';
            }
            document.getElementById('bg-color-picker').value = rgbToHex(cs.backgroundColor);
            document.getElementById('bg-color-hex').value = rgbToHex(cs.backgroundColor);
            document.getElementById('text-color-picker').value = rgbToHex(cs.color);
            document.getElementById('text-color-hex').value = rgbToHex(cs.color);
            const fs = parseInt(cs.fontSize);
            if (!isNaN(fs)) {
                document.getElementById('font-size-slider').value = fs;
                document.getElementById('font-size-value').textContent = fs + 'px';
            }
            const p = parseInt(cs.padding);
            if (!isNaN(p)) {
                document.getElementById('padding-slider').value = p;
                document.getElementById('padding-value').textContent = p + 'px';
            }
            const o = parseFloat(cs.opacity);
            if (!isNaN(o)) {
                document.getElementById('opacity-slider').value = Math.round(o * 100);
                document.getElementById('opacity-value').textContent = Math.round(o * 100) + '%';
            }
        }

        // ============ CLEAN SYNC - BUANG SAMPAH TAILWIND ============
        function cleanTailwindTrash(htmlString) {
            // Hapus semua <style> tag yang mengandung Tailwind variables
            htmlString = htmlString.replace(/<style[^>]*>[\s\S]*?--tw-[\s\S]*?<\/style>/gi, '');
            
            // Hapus style tag Tailwind CDN injection
            htmlString = htmlString.replace(/<style[^>]*>[\s\S]*?tailwindcss[\s\S]*?<\/style>/gi, '');
            
            // Hapus style tag yang hanya berisi ::before,::after dengan --tw variables
            htmlString = htmlString.replace(/<style[^>]*>[\s\S]*?::before[\s\S]*?--tw-[\s\S]*?<\/style>/gi, '');
            
            // Bersihkan atribut data atribut Tailwind yang tidak perlu
            // Tapi pertahankan class Tailwind yang memang digunakan user
            
            return htmlString;
        }

        function syncToEditor() {
            isSyncingFromIframe = true;
            const doc = previewFrame.contentDocument || previewFrame.contentWindow.document;
            const cloneHtml = doc.documentElement.cloneNode(true);
            
            // Hapus helper CSS kita
            const helperStyle = cloneHtml.querySelector('#visual-builder-helper-css');
            if (helperStyle) helperStyle.remove();
            
            // Hapus SEMUA style tag yang mengandung Tailwind variables
            const allStyles = cloneHtml.querySelectorAll('style');
            allStyles.forEach(s => {
                const content = s.textContent || s.innerHTML || '';
                // Hapus jika mengandung tailwind variables atau tailwindcss
                if (content.includes('--tw-') || 
                    content.includes('tailwindcss') ||
                    content.includes('::before') && content.includes('--tw-') ||
                    content.includes('::-webkit') && content.includes('--tw-')) {
                    s.remove();
                }
            });

            const body = cloneHtml.querySelector('body');
            if (body) {
                body.removeAttribute('contenteditable');
                body.style.cursor = '';
            }
            
            // Hapus class highlight
            cloneHtml.querySelectorAll('.active-highlight, .hover-highlight, .active-highlight-link, .active-highlight-image, .active-highlight-burger').forEach(el => {
                el.classList.remove('active-highlight', 'hover-highlight', 'active-highlight-link', 'active-highlight-image', 'active-highlight-burger');
                if (!el.className.trim()) el.removeAttribute('class');
            });

            let result = '<!DOCTYPE html>\n' + cloneHtml.outerHTML;
            
            // Clean Tailwind trash
            result = cleanTailwindTrash(result);
            
            editor.value = result;
            saveState(editor.value);
            document.getElementById('editor-line-count').textContent = 'Baris: ' + editor.value.split('\n').length;
            setTimeout(() => isSyncingFromIframe = false, 100);
        }

        // ============ STYLE CHANGES ============
        function changeStyleInstant(property, value) {
            if (!activeEl) return;
            activeEl.style[property] = value;
            pendingStyleChanges[property] = value;
            if (property === 'backgroundColor') { document.getElementById('bg-color-hex').value = value; if (value.startsWith('#')) document.getElementById('bg-color-picker').value = value; }
            if (property === 'color') { document.getElementById('text-color-hex').value = value; if (value.startsWith('#')) document.getElementById('text-color-picker').value = value; }
            if (property === 'fontSize') { document.getElementById('font-size-slider').value = parseInt(value); document.getElementById('font-size-value').textContent = value; }
            if (property === 'padding') { document.getElementById('padding-slider').value = parseInt(value); document.getElementById('padding-value').textContent = value; }
            if (property === 'opacity') { document.getElementById('opacity-slider').value = Math.round(value * 100); document.getElementById('opacity-value').textContent = Math.round(value * 100) + '%'; }
        }
        function changeStyleConfirmed() { 
            if (Object.keys(pendingStyleChanges).length > 0) { 
                syncToEditor(); 
                pendingStyleChanges = {}; 
            } 
        }
        function resetElementStyle() { 
            if (!activeEl) return; 
            activeEl.removeAttribute('style'); 
            syncToEditor(); 
            updateColorPickers(); 
            showToast('🔄 Style direset'); 
        }

        // ============ SHIFT ELEMENT (4 ARAH) - MENGGUNAKAN POSITION RELATIVE + TOP/LEFT ============
        function shiftElement(direction) {
            if (!activeEl) return;
            
            // Pastikan elemen memiliki position relative
            const currentPosition = activeEl.style.position;
            if (!currentPosition || currentPosition === 'static') {
                activeEl.style.position = 'relative';
            }
            
            // Dapatkan nilai top/left saat ini
            const currentTop = parseInt(activeEl.style.top) || 0;
            const currentLeft = parseInt(activeEl.style.left) || 0;
            const shiftAmount = 20; // pixel per geser
            
            switch(direction) {
                case 'top':
                    activeEl.style.top = (currentTop - shiftAmount) + 'px';
                    break;
                case 'bottom':
                    activeEl.style.top = (currentTop + shiftAmount) + 'px';
                    break;
                case 'left':
                    activeEl.style.left = (currentLeft - shiftAmount) + 'px';
                    break;
                case 'right':
                    activeEl.style.left = (currentLeft + shiftAmount) + 'px';
                    break;
            }
            
            const newTop = parseInt(activeEl.style.top) || 0;
            const newLeft = parseInt(activeEl.style.left) || 0;
            const dirNames = { top: 'atas', bottom: 'bawah', left: 'kiri', right: 'kanan' };
            const dirArrows = { top: '⬆', bottom: '⬇', left: '⬅', right: '➡' };
            
            syncToEditor();
            showToast(dirArrows[direction] + ' Geser ' + dirNames[direction] + ' (t:' + newTop + 'px, l:' + newLeft + 'px)');
        }

        // ============ GRADIENT BUILDER ============
        function setGradientType(type) {
            gradientType = type;
            document.querySelectorAll('[id^="grad-type-"]').forEach(b => b.className = 'flex-1 py-1 text-[9px] border rounded hover:bg-gray-50');
            document.getElementById('grad-type-' + type).className = 'flex-1 py-1 text-[9px] border rounded bg-blue-50 border-blue-300 text-blue-700';
            document.getElementById('grad-angle-container').style.display = type === 'linear' ? 'block' : 'none';
            buildGradient();
        }

        function addGradientStop() {
            gradientStops.push({ color: '#a855f7', position: 50 });
            renderGradientStops();
            buildGradient();
        }

        function removeGradientStop(index) {
            if (gradientStops.length <= 2) return;
            gradientStops.splice(index, 1);
            renderGradientStops();
            buildGradient();
        }

        function updateGradientStop(index, field, value) {
            gradientStops[index][field] = field === 'position' ? parseInt(value) : value;
            buildGradient();
        }

        function renderGradientStops() {
            const container = document.getElementById('gradient-stops-list');
            container.innerHTML = gradientStops.map((stop, i) => `
                <div class="flex items-center space-x-1.5 bg-gray-50 p-1.5 rounded-lg">
                    <input type="color" value="${stop.color}" onchange="updateGradientStop(${i}, 'color', this.value);renderGradientStops()" class="w-6 h-6">
                    <input type="text" value="${stop.color}" onchange="updateGradientStop(${i}, 'color', this.value)" class="flex-1 px-1.5 py-1 text-[9px] border rounded font-mono bg-white" placeholder="#HEX">
                    <input type="number" value="${stop.position}" min="0" max="100" onchange="updateGradientStop(${i}, 'position', this.value);renderGradientStops()" class="w-12 px-1 py-1 text-[9px] border rounded bg-white text-center">
                    <button onclick="removeGradientStop(${i})" class="text-red-400 hover:text-red-600 p-0.5"><i class="fas fa-times text-[9px]"></i></button>
                </div>
            `).join('');
        }

        function buildGradient() {
            const angle = document.getElementById('grad-angle-slider')?.value || gradientAngle;
            gradientAngle = parseInt(angle);
            const sortedStops = [...gradientStops].sort((a, b) => a.position - b.position);
            const stopsStr = sortedStops.map(s => `${s.color} ${s.position}%`).join(', ');
            let gradientStr;
            if (gradientType === 'linear') gradientStr = `linear-gradient(${gradientAngle}deg, ${stopsStr})`;
            else if (gradientType === 'radial') gradientStr = `radial-gradient(circle, ${stopsStr})`;
            else gradientStr = `conic-gradient(from ${gradientAngle}deg, ${stopsStr})`;
            document.getElementById('gradient-preview').style.background = gradientStr;
            return gradientStr;
        }

        function applyGradient() {
            if (!activeEl) return;
            activeEl.style.background = buildGradient();
            syncToEditor();
            showToast('🌈 Gradien diterapkan!');
        }

        function applyPresetGradient(name) {
            const presets = {
                sunset: 'linear-gradient(135deg, #ff512f 0%, #f09819 100%)',
                ocean: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
                forest: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
                fire: 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)',
                neon: 'linear-gradient(135deg, #f953c6 0%, #b91d73 100%)',
                midnight: 'linear-gradient(135deg, #141e30 0%, #243b55 100%)'
            };
            if (!activeEl) return;
            activeEl.style.background = presets[name];
            document.getElementById('gradient-preview').style.background = presets[name];
            syncToEditor();
            showToast('🌈 Gradien ' + name + ' diterapkan!');
        }

        // ============ MEDIA ============
        function changeImageSrc(url) {
            if (!activeEl || activeEl.tagName !== 'IMG') return;
            activeEl.setAttribute('src', url);
            document.getElementById('image-src-input').value = url;
            syncToEditor();
            showToast('🖼️ URL Gambar diganti!');
        }
        function changeLinkHref(url) {
            if (!activeEl) return;
            let linkEl = activeEl.tagName === 'A' ? activeEl : activeEl.closest('a');
            if (linkEl) {
                linkEl.setAttribute('href', url);
                document.getElementById('link-href-input').value = url;
                syncToEditor();
                showToast('🔗 URL Link diganti!');
            }
        }
        function toggleBurgerMenu() {
            if (!activeEl) return;
            const doc = activeEl.ownerDocument;
            const mobileMenu = doc.querySelector('.mobile-menu') || doc.querySelector('#mobile-menu-container');
            if (mobileMenu) {
                mobileMenu.classList.toggle('active');
                mobileMenu.style.display = mobileMenu.classList.contains('active') ? 'block' : 'none';
                syncToEditor();
                showToast('🍔 Menu: ' + (mobileMenu.classList.contains('active') ? 'TERBUKA' : 'TERTUTUP'));
            }
        }

        // ============ ELEMENT ACTIONS ============
        function duplicateElement() {
            if (!activeEl) return;
            const clone = activeEl.cloneNode(true);
            clone.classList.remove('active-highlight', 'hover-highlight', 'active-highlight-link', 'active-highlight-image', 'active-highlight-burger');
            activeEl.parentNode.insertBefore(clone, activeEl.nextSibling);
            activeEl.classList.remove('active-highlight', 'active-highlight-link', 'active-highlight-image', 'active-highlight-burger');
            activeEl = clone;
            applyHighlight(activeEl);
            syncToEditor(); detectElementType(activeEl); showSidebar();
            showToast('👥 Elemen diduplikat');
        }
        function copySection() {
            if (!activeEl) return;
            const doc = activeEl.ownerDocument;
            let section = activeEl;
            while (section?.parentElement && section.parentElement !== doc.body) section = section.parentElement;
            if (section && section !== doc.body) {
                clipboardSection = section.cloneNode(true);
                clipboardSection.classList.remove('active-highlight', 'hover-highlight', 'active-highlight-link', 'active-highlight-image', 'active-highlight-burger');
                showToast('📋 Section dicopy!');
            }
        }
        function pasteSection() {
            if (!clipboardSection || !activeEl) return;
            const doc = activeEl.ownerDocument;
            let section = activeEl;
            while (section?.parentElement && section.parentElement !== doc.body) section = section.parentElement;
            if (section && section !== doc.body) {
                section.parentNode.insertBefore(clipboardSection.cloneNode(true), section.nextSibling);
                syncToEditor(); showToast('✅ Section ditempel!');
            }
        }
        function moveSectionUp() {
            if (!activeEl) return;
            const doc = activeEl.ownerDocument;
            let section = activeEl;
            while (section?.parentElement && section.parentElement !== doc.body) section = section.parentElement;
            if (section?.previousElementSibling && section !== doc.body) {
                section.parentNode.insertBefore(section, section.previousElementSibling);
                syncToEditor(); showToast('⬆️ Dipindah ke atas');
            }
        }
        function moveSectionDown() {
            if (!activeEl) return;
            const doc = activeEl.ownerDocument;
            let section = activeEl;
            while (section?.parentElement && section.parentElement !== doc.body) section = section.parentElement;
            if (section?.nextElementSibling && section !== doc.body) {
                section.parentNode.insertBefore(section.nextElementSibling, section);
                syncToEditor(); showToast('⬇️ Dipindah ke bawah');
            }
        }
        function deleteElement() {
            if (!activeEl) return;
            hideContextMenu();
            activeEl.remove(); activeEl = null;
            syncToEditor(); showToast('🗑️ Elemen dihapus');
        }

        // ============ INSPECT MODE ============
        function toggleInspectMode() {
            settings.inspectMode = !settings.inspectMode;
            const btn = document.getElementById('btn-inspect');
            btn.className = settings.inspectMode ? 'p-1 rounded-sm transition bg-blue-100 text-blue-600 border border-blue-300 shadow-sm' : 'p-1 rounded-sm transition text-gray-400 hover:text-blue-600 bg-white border border-gray-200 shadow-sm';
            inspectorOverlay.style.display = settings.inspectMode ? 'block' : 'none';
        }

        // ============ SNIPPETS ============
        btnSnippets.addEventListener('click', (e) => { e.stopPropagation(); dropdownSnippets.classList.toggle('hidden'); });

        const snippets = {
            navbar: `\n  <nav id="main-navbar" style="background-color: #1f2937; padding: 16px 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center;">
      <a href="#" id="nav-logo" style="color: #60a5fa; font-size: 1.5rem; font-weight: bold; text-decoration: none;">Logo</a>
      <ul class="desktop-nav" style="display: flex; gap: 24px; list-style: none; margin: 0;">
        <li><a href="#" id="nav-beranda" style="color: white; text-decoration: none;">Beranda</a></li>
        <li><a href="#" id="nav-fitur" style="color: white; text-decoration: none;">Fitur</a></li>
      </ul>
      <button class="burger-btn" id="burger-button" style="display: none; background: none; border: none; color: white; font-size: 24px;"><i class="fas fa-bars" id="burger-icon"></i></button>
    </div>
    <div class="mobile-menu" id="mobile-menu-container" style="display: none; background: #1f2937; padding: 16px; margin-top: 8px; border-radius: 8px;">
      <a href="#" id="mobile-beranda" style="display: block; color: white; padding: 12px; text-decoration: none;">Beranda</a>
      <a href="#" id="mobile-fitur" style="display: block; color: white; padding: 12px; text-decoration: none;">Fitur</a>
      <a href="#" id="mobile-login" style="display: block; background: #3b82f6; color: white; padding: 12px; border-radius: 8px; text-align: center; text-decoration: none;">Login</a>
    </div>
  </nav>\n`,
            hero: `\n  <section style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 80px 24px; text-align: center; color: white;">
    <img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; margin-bottom: 24px; border: 4px solid white;">
    <h2 style="font-size: 2.5rem; font-weight: 800;">Judul Hero</h2>
    <a href="#" style="background: white; color: #3b82f6; padding: 14px 40px; border-radius: 9999px; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 16px;">CTA</a>
  </section>\n`,
            features: `\n  <section style="padding: 48px 24px; background: white; text-align: center;">
    <h2 style="font-size: 2rem; font-weight: bold;">Fitur</h2>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; max-width: 900px; margin: 32px auto 0;">
      <div style="padding: 24px; border-radius: 12px; background: #eff6ff;"><i class="fas fa-rocket" style="font-size: 2rem; color: #3b82f6;"></i><h3>Fitur 1</h3></div>
      <div style="padding: 24px; border-radius: 12px; background: #faf5ff;"><i class="fas fa-paint-brush" style="font-size: 2rem; color: #8b5cf6;"></i><h3>Fitur 2</h3></div>
    </div>
  </section>\n`,
            gallery: `\n  <section style="padding: 48px 24px; text-align: center;">
    <h2 style="font-size: 2rem; font-weight: bold;">Galeri</h2>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; max-width: 800px; margin: 24px auto 0;">
      <img src="https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=300" style="width: 100%; height: 160px; object-fit: cover; border-radius: 12px;">
      <img src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300" style="width: 100%; height: 160px; object-fit: cover; border-radius: 12px;">
    </div>
  </section>\n`,
            cta: `\n  <section style="background: #3b82f6; padding: 48px 24px; text-align: center; color: white;">
    <h2 style="font-size: 2rem; font-weight: bold;">Siap Memulai?</h2>
    <a href="#" style="background: white; color: #3b82f6; padding: 14px 40px; border-radius: 9999px; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 16px;">Daftar</a>
  </section>\n`,
            pricing: `\n  <section style="padding: 48px 24px; text-align: center;">
    <h2 style="font-size: 2rem; font-weight: bold;">Harga</h2>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; max-width: 700px; margin: 32px auto 0;">
      <div style="background: white; padding: 32px; border-radius: 16px; border: 1px solid #e5e7eb;"><h3>Basic</h3><div style="font-size: 2.5rem; font-weight: 800; color: #3b82f6;">Rp99k</div></div>
      <div style="background: white; padding: 32px; border-radius: 16px; border: 2px solid #3b82f6;"><h3>Pro</h3><div style="font-size: 2.5rem; font-weight: 800; color: #3b82f6;">Rp299k</div></div>
    </div>
  </section>\n`,
            testimonial: `\n  <section style="padding: 48px 24px; text-align: center; background: white;">
    <div style="max-width: 500px; margin: 0 auto;"><div style="font-size: 3rem; color: #e5e7eb;">❝</div>
    <p style="font-style: italic;">"Tool ini luar biasa!"</p>
    <div style="font-weight: bold;">Nama</div><div style="color: #f59e0b;">⭐⭐⭐⭐⭐</div></div>
  </section>\n`,
            footer: `\n  <footer style="background: #1f2937; padding: 40px 24px; text-align: center; color: #9ca3af;">
    <a href="#" style="color: white; font-size: 1.5rem; font-weight: bold; text-decoration: none;">Logo</a>
    <p style="font-size: 0.8rem; margin-top: 8px;">&copy; 2026</p>
  </footer>\n`
        };

        function insertSnippet(key) {
            const code = editor.value;
            const bodyEndIndex = code.lastIndexOf('</body>');
            editor.value = bodyEndIndex !== -1 ? code.slice(0, bodyEndIndex) + snippets[key] + code.slice(bodyEndIndex) : code + snippets[key];
            saveState(editor.value);
            document.getElementById('editor-line-count').textContent = 'Baris: ' + editor.value.split('\n').length;
            dropdownSnippets.classList.add('hidden');
            if (settings.autoRefresh) updatePreview();
            showToast('✅ Section ditambahkan!');
        }

        // ============ COPY CODE ============
        function copyCode() {
            const code = editor.value;
            const iconCopy = document.getElementById('icon-copy');
            const textCopy = document.getElementById('text-copy');
            const btnCopy = document.getElementById('btn-copy');
            navigator.clipboard.writeText(code).then(() => {
                iconCopy.className = 'fas fa-check-circle text-green-500';
                textCopy.textContent = 'Tersalin!';
                btnCopy.classList.add('border-green-300', 'bg-green-50');
                showToast('📋 Kode HTML disalin!');
                setTimeout(() => { iconCopy.className = 'fas fa-copy'; textCopy.textContent = 'Copy'; btnCopy.classList.remove('border-green-300', 'bg-green-50'); }, 2000);
            }).catch(() => { const ta = document.createElement("textarea"); ta.value = code; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); showToast('📋 Disalin!'); });
        }

        function showToast(message, icon = '✅') {
            const toast = document.getElementById('toast-notification');
            document.getElementById('toast-icon').textContent = icon;
            document.getElementById('toast-message').textContent = message;
            toast.style.opacity = '1';
            clearTimeout(toast._timeout);
            toast._timeout = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
        }

        // ============ SETTINGS ============
        function toggleModal(id) {
            const modal = document.getElementById(id), content = document.getElementById(id + '-content');
            if (modal.classList.contains('hidden')) {
                modal.classList.remove('hidden'); modal.classList.add('flex');
                requestAnimationFrame(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); });
            } else { modal.classList.add('opacity-0'); content.classList.add('scale-95'); setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300); }
        }
        function applySettings() {
            settings.autoRefresh = document.getElementById('setting-autorefresh').checked;
            document.getElementById('btn-refresh').classList.toggle('hidden', settings.autoRefresh);
            if (settings.autoRefresh) updatePreview();
            settings.fontSize = parseInt(document.getElementById('setting-fontsize').value);
            editor.style.fontSize = settings.fontSize + 'px';
        }
        function setTheme(mode) {
            settings.theme = mode;
            const eh = document.getElementById('editor-header'), bl = document.getElementById('btn-theme-light'), bd = document.getElementById('btn-theme-dark');
            if (mode === 'dark') {
                editor.classList.add('dark-editor'); editor.classList.remove('bg-white', 'text-gray-800');
                eh.classList.replace('bg-gray-100', 'bg-gray-800'); eh.classList.replace('text-gray-500', 'text-gray-300');
                bd.className = "py-2 px-3 border-2 rounded-lg text-xs font-medium transition bg-gray-800 border-gray-700 text-white";
                bl.className = "py-2 px-3 border-2 rounded-lg text-xs font-medium transition bg-white border-gray-200 text-gray-600 hover:bg-gray-50";
            } else {
                editor.classList.remove('dark-editor'); editor.classList.add('bg-white', 'text-gray-800');
                eh.classList.replace('bg-gray-800', 'bg-gray-100'); eh.classList.replace('text-gray-300', 'text-gray-500');
                bl.className = "py-2 px-3 border-2 rounded-lg text-xs font-medium transition bg-blue-50 border-blue-500 text-blue-700";
                bd.className = "py-2 px-3 border-2 rounded-lg text-xs font-medium transition bg-white border-gray-200 text-gray-600 hover:bg-gray-50";
            }
        }
        function setPreviewMode(mode) {
            settings.previewMode = mode;
            const btns = { desktop: document.getElementById('btn-desktop'), tablet: document.getElementById('btn-tablet'), mobile: document.getElementById('btn-mobile') };
            previewFrame.classList.remove('preview-mobile', 'preview-tablet', 'w-full', 'h-full');
            Object.values(btns).forEach(b => b.className = 'p-1 rounded-sm transition text-gray-400 hover:text-gray-600');
            if (mode === 'mobile') { previewFrame.classList.add('preview-mobile'); btns.mobile.className = 'p-1 rounded-sm transition bg-gray-100 text-blue-600'; }
            else if (mode === 'tablet') { previewFrame.classList.add('preview-tablet'); btns.tablet.className = 'p-1 rounded-sm transition bg-gray-100 text-blue-600'; }
            else { previewFrame.classList.add('w-full', 'h-full'); btns.desktop.className = 'p-1 rounded-sm transition bg-gray-100 text-blue-600'; }
        }

        // ============ INIT ============
        renderGradientStops();
        buildGradient();
        updateUndoRedoUI();
        console.log('✅ Live Web Builder Clean v3 siap!');
        console.log('🧹 Sampah Tailwind dibersihkan otomatis');
        console.log('↔️ Geser 4 arah: Atas/Bawah/Kiri/Kanan');
        console.log('🍔 Semua item burger bisa diedit');
