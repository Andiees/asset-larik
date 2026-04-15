let activeEl = null;
    let originalHead = "";
    let historyStack = [];
    let historyIndex = -1;

    function startVisual() {
      const code = document.getElementById('code-entry').value;
      if(!code.trim()) return alert("Paste kode dulu!");
      
      const parser = new DOMParser();
      const docParsed = parser.parseFromString(code, 'text/html');
      originalHead = docParsed.head.innerHTML;

      document.getElementById('layer-code').style.display = 'none';
      document.getElementById('layer-visual').style.display = 'flex';
      document.getElementById('visual-tools').style.display = 'flex';
      document.getElementById('btnRun').style.display = 'none';
      document.getElementById('btnBack').style.display = 'inline-block';
      document.getElementById('btnCopy').style.display = 'inline-block';

      const frame = document.getElementById('preview-frame');
      const doc = frame.contentDocument;
      doc.open(); doc.write(code); doc.close();
      
      setTimeout(() => {
        setupArchitectEngine(doc);
        saveState(); 
      }, 600);
    }

    function setupArchitectEngine(doc) {
      const style = doc.createElement('style');
      style.id = "sakti-internal-style";
      style.innerHTML = `
        .s-hover { outline: 2px dashed #10b981 !important; outline-offset: -2px !important; cursor: pointer !important; }
        .s-active { outline: 3px solid #10b981 !important; outline-offset: -3px !important; }
        #s-tools { position: fixed !important; display: none; background: #10b981 !important; border-radius: 8px !important; padding: 8px 12px !important; z-index: 2147483647 !important; gap: 15px !important; align-items: center !important; box-shadow: 0 10px 30px rgba(0,0,0,0.3) !important; color: white !important; pointer-events: auto !important; }
        .st-btn { cursor: pointer !important; font-size: 18px !important; display: flex !important; align-items: center !important; transition: 0.2s !important; color: white !important; }
        .st-btn:hover { transform: scale(1.2) !important; }
        .dragging { opacity: 0.3 !important; }
      `;
      doc.head.appendChild(style);

      const tb = doc.createElement('div');
      tb.id = 's-tools';
      tb.innerHTML = `<div class="st-btn" id="st-up" title="Parent"><i class="fa-solid fa-arrow-up"></i></div><div class="st-btn" id="st-drag" draggable="true" title="Drag"><i class="fa-solid fa-arrows-up-down-left-right"></i></div><div class="st-btn" id="st-dup" title="Duplicate"><i class="fa-solid fa-copy"></i></div><div class="st-btn" id="st-del" title="Delete" style="color:#ff6b6b !important"><i class="fa-solid fa-trash"></i></div>`;
      doc.body.appendChild(tb);

      const fa = doc.createElement('link');
      fa.rel = 'stylesheet'; fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      doc.head.appendChild(fa);

      doc.addEventListener('mouseover', e => { if(e.target === doc.body || tb.contains(e.target)) return; e.target.classList.add('s-hover'); e.stopPropagation(); });
      doc.addEventListener('mouseout', e => { e.target.classList.remove('s-hover'); });

      doc.addEventListener('click', e => {
        if(tb.contains(e.target) || e.target === doc.body) return;
        
        // --- PERBAIKAN MENU BURGER HP ---
        // Jika elemen atau parent-nya punya event (biasanya button menu), biarkan event aslinya jalan dulu
        const interactiveTags = ['BUTTON', 'A', 'I', 'SPAN'];
        const isMenuTrigger = e.target.closest('button') || e.target.closest('#menuBtn');
        
        if (!isMenuTrigger) {
            e.preventDefault(); 
            e.stopPropagation();
        }

        if(activeEl) activeEl.classList.remove('s-active');
        activeEl = e.target; activeEl.classList.add('s-active');
        
        const css = doc.defaultView.getComputedStyle(activeEl);
        document.getElementById('f-text').value = activeEl.innerText;
        document.getElementById('f-size').value = parseInt(css.fontSize);
        document.getElementById('f-radius').value = parseInt(css.borderRadius) || 0;
        document.getElementById('f-color').value = rgbToHex(css.color);
        document.getElementById('f-bg').value = rgbToHex(css.backgroundColor);
        document.getElementById('f-font').value = css.fontFamily.split(',')[0].replace(/"/g, "");

        const link = activeEl.closest('a');
        document.getElementById('ctx-link').style.display = link ? 'block' : 'none';
        if(link) document.getElementById('f-link').value = link.getAttribute('href') || '';

        const isImg = activeEl.tagName.toLowerCase() === 'img';
        document.getElementById('ctx-image').style.display = isImg ? 'block' : 'none';
        if(isImg) document.getElementById('f-img').value = activeEl.getAttribute('src') || '';

        updateToolbarPosition(doc, tb);
      });

      function updateToolbarPosition(doc, tb) {
        if(!activeEl) return;
        const rect = activeEl.getBoundingClientRect();
        const winH = doc.defaultView.innerHeight;
        tb.style.display = 'flex';
        let topPos = rect.bottom + 10;
        if (topPos + 50 > winH) topPos = rect.top - 50;
        tb.style.top = topPos + 'px';
        tb.style.left = Math.max(10, rect.left) + 'px';
      }

      // Action Handlers
      doc.getElementById('st-dup').onclick = (e) => {
        e.stopPropagation();
        activeEl.insertAdjacentHTML('afterend', activeEl.outerHTML);
        saveState();
        setTimeout(() => activeEl.nextElementSibling.click(), 50);
      };

      let draggedEl = null;
      doc.getElementById('st-drag').ondragstart = (e) => { draggedEl = activeEl; draggedEl.classList.add('dragging'); e.dataTransfer.setDragImage(new Image(), 0, 0); };
      doc.addEventListener('dragover', e => {
        e.preventDefault();
        const parent = draggedEl.parentElement;
        const children = [...parent.querySelectorAll(':scope > *:not(#s-tools):not(.dragging)')];
        const parentStyle = doc.defaultView.getComputedStyle(parent);
        const isHorizontal = parentStyle.display === 'flex' && parentStyle.flexDirection !== 'column';
        const afterElement = children.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = isHorizontal ? (e.clientX - box.left - box.width / 2) : (e.clientY - box.top - box.height / 2);
          if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
          else return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
        if (afterElement == null) parent.appendChild(draggedEl); else parent.insertBefore(draggedEl, afterElement);
      });

      doc.addEventListener('dragend', () => { draggedEl.classList.remove('dragging'); saveState(); updateToolbarPosition(doc, tb); });
      doc.getElementById('st-up').onclick = (e) => { e.stopPropagation(); if(activeEl.parentElement && activeEl.parentElement !== doc.body) activeEl.parentElement.click(); };
      doc.getElementById('st-del').onclick = (e) => { e.stopPropagation(); activeEl.remove(); tb.style.display = 'none'; activeEl = null; saveState(); };
    }

    function applyStyle() {
      if(!activeEl) return;
      activeEl.innerText = document.getElementById('f-text').value;
      activeEl.style.fontSize = document.getElementById('f-size').value + 'px';
      activeEl.style.color = document.getElementById('f-color').value;
      activeEl.style.backgroundImage = 'none';
      activeEl.style.backgroundColor = document.getElementById('f-bg').value;
      activeEl.style.borderRadius = document.getElementById('f-radius').value + 'px';
      activeEl.style.fontFamily = document.getElementById('f-font').value;
      const link = activeEl.closest('a');
      if(link) link.setAttribute('href', document.getElementById('f-link').value);
      if(activeEl.tagName.toLowerCase() === 'img') activeEl.setAttribute('src', document.getElementById('f-img').value);
      saveState();
    }

    // --- VIEW & HISTORY LOGIC ---
    function changeView(mode) {
      const frame = document.getElementById('preview-frame');
      document.getElementById('btn-desktop').classList.toggle('active', mode === 'desktop');
      document.getElementById('btn-mobile').classList.toggle('active', mode === 'mobile');
      if(mode === 'mobile') frame.classList.add('mobile-view');
      else frame.classList.remove('mobile-view');
    }

    function saveState() {
      const currentBody = document.getElementById('preview-frame').contentDocument.body.innerHTML;
      if (historyIndex === -1 || historyStack[historyIndex] !== currentBody) {
        historyStack = historyStack.slice(0, historyIndex + 1);
        historyStack.push(currentBody);
        historyIndex++;
      }
    }

    function undo() {
      if (historyIndex > 0) {
        historyIndex--;
        document.getElementById('preview-frame').contentDocument.body.innerHTML = historyStack[historyIndex];
        reattachEvents();
      }
    }

    function redo() {
      if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        document.getElementById('preview-frame').contentDocument.body.innerHTML = historyStack[historyIndex];
        reattachEvents();
      }
    }

    function reattachEvents() {
      const doc = document.getElementById('preview-frame').contentDocument;
      activeEl = null;
      setupArchitectEngine(doc);
    }

    function getCleanFinalCode() {
      const doc = document.getElementById('preview-frame').contentDocument;
      const bodyClone = doc.body.cloneNode(true);
      const tools = bodyClone.querySelector('#s-tools');
      if(tools) tools.remove();
      bodyClone.querySelectorAll('*').forEach(el => {
        el.classList.remove('s-hover', 's-active', 'dragging');
        if (el.classList.length === 0) el.removeAttribute('class');
      });
      return `<!DOCTYPE html>\n<html lang="id">\n<head>\n${originalHead}\n</head>\n<body>${bodyClone.innerHTML}</body>\n</html>`;
    }

    function exitVisual() {
      document.getElementById('code-entry').value = getCleanFinalCode();
      document.getElementById('layer-visual').style.display = 'none';
      document.getElementById('visual-tools').style.display = 'none';
      document.getElementById('layer-code').style.display = 'flex';
      ['btnBack','btnCopy'].forEach(id => document.getElementById(id).style.display = 'none');
      document.getElementById('btnRun').style.display = 'inline-block';
    }

    function copyResult() { navigator.clipboard.writeText(getCleanFinalCode()).then(() => alert("✅ KODE DISALIN!")); }

    function rgbToHex(rgb) {
      if (!rgb || rgb.indexOf('rgb') === -1) return '#ffffff';
      let vals = rgb.match(/\d+/g);
      return "#" + ((1 << 24) + (parseInt(vals[0]) << 16) + (parseInt(vals[1]) << 8) + parseInt(vals[2])).toString(16).slice(1);
    }
