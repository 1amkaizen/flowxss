(function() {
    // ======================== UI PANEL ========================
    let panel = null;
    let testValue = '';
    let sources = [];
    let sinkHits = [];
    
    function createPanel() {
        if (document.getElementById('xss-visual-panel')) return;
        
        let div = document.createElement('div');
        div.id = 'xss-visual-panel';
        div.innerHTML = `
            <style>
                #xss-visual-panel {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 450px;
                    max-height: 600px;
                    background: #0a0e27;
                    border: 2px solid #00ff88;
                    border-radius: 12px;
                    z-index: 999999;
                    font-family: 'Courier New', monospace;
                    font-size: 13px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                    display: flex;
                    flex-direction: column;
                    backdrop-filter: blur(8px);
                }
                #xss-visual-panel .head {
                    background: #00ff88;
                    color: #0a0e27;
                    padding: 10px 12px;
                    font-weight: bold;
                    cursor: move;
                    border-radius: 10px 10px 0 0;
                    display: flex;
                    justify-content: space-between;
                }
                #xss-visual-panel .content {
                    padding: 12px;
                    overflow-y: auto;
                    flex: 1;
                    color: #00ff88;
                }
                #xss-visual-panel input {
                    width: 100%;
                    padding: 8px;
                    background: #1a1f3a;
                    border: 1px solid #00ff88;
                    color: #00ff88;
                    border-radius: 6px;
                    margin: 8px 0;
                    font-family: monospace;
                }
                #xss-visual-panel button {
                    background: #00ff88;
                    color: #0a0e27;
                    border: none;
                    padding: 6px 12px;
                    cursor: pointer;
                    font-weight: bold;
                    border-radius: 6px;
                    margin: 4px;
                }
                #xss-visual-panel .flow-item {
                    background: #1a1f3a;
                    margin: 8px 0;
                    padding: 8px;
                    border-left: 4px solid #ff4444;
                    border-radius: 4px;
                    font-size: 11px;
                }
                .badge-danger { background: #ff4444; color: white; padding: 2px 6px; border-radius: 4px; }
                .badge-warning { background: #ffaa00; color: black; padding: 2px 6px; border-radius: 4px; }
                .location { color: #ffaa00; font-size: 10px; margin-top: 4px; }
                .close-btn { cursor: pointer; background: none; border: none; color: #0a0e27; font-size: 18px; font-weight: bold; }
            </style>
            <div class="head">
                <span>🧨 DOM XSS VISUAL TRACER</span>
                <span class="close-btn" id="xss-close-panel">✖</span>
            </div>
            <div class="content">
                <div style="margin-bottom: 12px;">
                    <label>🔍 Ketik input test (contoh: &lt;img src=x onerror=alert(1)&gt;)</label>
                    <input type="text" id="xss-test-input" placeholder="Ketik XSS payload...">
                    <button id="xss-scan-btn">▶ SCAN NOW</button>
                    <button id="xss-clear-btn">🗑 Clear</button>
                </div>
                <div id="xss-results">
                    <div style="color: #888; text-align: center;">⬆ Ketik payload lalu klik SCAN</div>
                </div>
            </div>
        `;
        document.body.appendChild(div);
        
        // Draggable
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        let header = div.querySelector('.head');
        header.onmousedown = dragMouseDown;
        function dragMouseDown(e) { e.preventDefault(); pos3 = e.clientX; pos4 = e.clientY; document.onmouseup = closeDrag; document.onmousemove = elementDrag; }
        function elementDrag(e) { e.preventDefault(); pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY; pos3 = e.clientX; pos4 = e.clientY; div.style.top = (div.offsetTop - pos2) + 'px'; div.style.left = (div.offsetLeft - pos1) + 'px'; div.style.bottom = 'auto'; div.style.right = 'auto'; }
        function closeDrag() { document.onmouseup = null; document.onmousemove = null; }
        
        document.getElementById('xss-close-panel').onclick = () => div.remove();
        document.getElementById('xss-scan-btn').onclick = () => scanUserInput();
        document.getElementById('xss-clear-btn').onclick = () => clearResults();
        
        return div;
    }
    
    function clearResults() {
        document.getElementById('xss-results').innerHTML = '<div style="color: #888; text-align: center;">⬆ Ketik payload lalu klik SCAN</div>';
        sources = [];
        sinkHits = [];
        testValue = '';
    }
    
    function scanUserInput() {
        let input = document.getElementById('xss-test-input');
        testValue = input.value;
        if (!testValue) {
            alert('Isi dulu payload testnya bro!');
            return;
        }
        
        let resultsDiv = document.getElementById('xss-results');
        resultsDiv.innerHTML = `<div style="color: #00ff88;">🔍 Scanning: "${testValue.substring(0, 50)}"...</div>`;
        
        // Reset
        sources = [];
        sinkHits = [];
        
        // Step 1: Scan where input appears in DOM
        setTimeout(() => {
            scanDOMForValue(testValue);
            displayResults();
        }, 100);
    }
    
    function scanDOMForValue(value) {
        let found = [];
        
        // Check text nodes
        let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: node => node.textContent && node.textContent.includes(value) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
        });
        while (walker.nextNode()) {
            let node = walker.currentNode;
            found.push({
                type: 'text',
                node: node,
                path: getPath(node.parentElement),
                html: node.textContent
            });
            highlightElement(node.parentElement);
        }
        
        // Check attributes
        document.querySelectorAll('*').forEach(el => {
            for (let attr of el.attributes) {
                if (attr.value && attr.value.includes(value)) {
                    found.push({
                        type: 'attribute',
                        attribute: attr.name,
                        node: el,
                        path: getPath(el),
                        value: attr.value
                    });
                    highlightElement(el);
                }
            }
        });
        
        // Check input values
        document.querySelectorAll('input, textarea, select').forEach(el => {
            if (el.value && el.value.includes(value)) {
                found.push({
                    type: 'input',
                    tag: el.tagName,
                    node: el,
                    path: getPath(el),
                    value: el.value
                });
                highlightElement(el);
            }
        });
        
        sources = found;
    }
    
    // Hook sinks untuk deteksi runtime
    function hookSinksVisual() {
        // Hook innerHTML
        let desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        Object.defineProperty(Element.prototype, 'innerHTML', {
            get: desc.get,
            set: function(val) {
                if (testValue && typeof val === 'string' && val.includes(testValue)) {
                    sinkHits.push({
                        sink: 'innerHTML',
                        element: this,
                        path: getPath(this),
                        value: val.substring(0, 100)
                    });
                    highlightElement(this);
                    updateResultsUI();
                }
                return desc.set.call(this, val);
            }
        });
        
        // Hook document.write
        let origWrite = document.write;
        document.write = function(html) {
            if (testValue && typeof html === 'string' && html.includes(testValue)) {
                sinkHits.push({ sink: 'document.write', value: html.substring(0, 100) });
                updateResultsUI();
            }
            return origWrite.apply(document, arguments);
        };
        
        // Hook eval
        let origEval = window.eval;
        window.eval = function(code) {
            if (testValue && typeof code === 'string' && code.includes(testValue)) {
                sinkHits.push({ sink: 'eval', value: code.substring(0, 100) });
                updateResultsUI();
            }
            return origEval.call(this, code);
        };
        
        console.log('[XSS Visual] Sinks hooked');
    }
    
    function getPath(el) {
        if (!el) return 'unknown';
        let path = [];
        while (el && el.nodeType === 1) {
            let selector = el.tagName.toLowerCase();
            if (el.id) { selector += '#' + el.id; path.unshift(selector); break; }
            let nth = 1, sibling = el;
            while (sibling = sibling.previousElementSibling) if (sibling.tagName === el.tagName) nth++;
            if (nth !== 1) selector += ':nth-of-type(' + nth + ')';
            path.unshift(selector);
            el = el.parentNode;
        }
        return path.join(' > ');
    }
    
    function highlightElement(el) {
        if (!el) return;
        let orig = el.style.outline;
        el.style.outline = '3px solid #ff4444';
        setTimeout(() => el.style.outline = orig, 2000);
    }
    
    function displayResults() {
        let resultsDiv = document.getElementById('xss-results');
        let html = '';
        
        // REFLECTIONS
        html += `<div style="margin: 12px 0;"><strong>📌 INPUT DITEMUKAN DI (${sources.length} lokasi):</strong></div>`;
        if (sources.length === 0) {
            html += `<div style="color: #ff8888;">✗ Input tidak ditemukan di DOM (mungkin via AJAX atau tidak di-reflect)</div>`;
        } else {
            sources.forEach((s, i) => {
                html += `<div class="flow-item">
                            <span class="badge-warning">Reflection ${i+1}</span>
                            <div><strong>📍 Lokasi:</strong> ${s.path}</div>
                            <div><strong>📝 Tipe:</strong> ${s.type} ${s.attribute ? '['+s.attribute+']' : ''}</div>
                            <div class="location">💾 Value: ${(s.value || s.html || '').substring(0, 80)}</div>
                         </div>`;
            });
        }
        
        // SINKS
        html += `<div style="margin: 12px 0;"><strong>💀 SINK BERBAHAYA YANG TERPANGGIL (${sinkHits.length}):</strong></div>`;
        if (sinkHits.length === 0) {
            html += `<div style="color: #ffaa00;">⚠ Belum ada sink berbahaya yang terpanggil dengan input ini</div>`;
            html += `<div style="color: #888; font-size: 11px;">💡 Coba interaksi dengan halaman (klik, submit form, dll)</div>`;
        } else {
            sinkHits.forEach((s, i) => {
                html += `<div class="flow-item">
                            <span class="badge-danger">⚠ SINK ${i+1}</span>
                            <div><strong>🔥 Sink:</strong> ${s.sink}</div>
                            <div><strong>📍 Lokasi:</strong> ${s.path || 'N/A'}</div>
                            <div class="location">💀 Value: ${s.value}</div>
                         </div>`;
            });
        }
        
        // FLOW CONCLUSION
        if (sources.length > 0 && sinkHits.length > 0) {
            html += `<div style="background: #ff4444; color: white; padding: 10px; margin-top: 12px; border-radius: 6px; text-align: center;">
                        🔥🔥🔥 POTENSI DOM XSS! Input masuk ke sink berbahaya!
                     </div>`;
        } else if (sources.length > 0) {
            html += `<div style="background: #ffaa00; color: black; padding: 10px; margin-top: 12px; border-radius: 6px; text-align: center;">
                        ⚠ Input muncul di DOM, tapi belum terdeteksi masuk ke sink. Coba interaksi!
                     </div>`;
        }
        
        resultsDiv.innerHTML = html;
    }
    
    function updateResultsUI() {
        let resultsDiv = document.getElementById('xss-results');
        if (resultsDiv && !resultsDiv.innerHTML.includes('SCAN')) {
            displayResults();
        }
    }
    
    // Mutation observer buat SPA
    function startMutationObserverVisual() {
        let observer = new MutationObserver(() => {
            if (testValue) {
                scanDOMForValue(testValue);
                displayResults();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        console.log('[XSS Visual] MutationObserver aktif buat SPA');
    }
    
    // INIT
    function init() {
        createPanel();
        hookSinksVisual();
        startMutationObserverVisual();
        console.log('✅ XSS Visual Tracer siap! Ketik payload di panel, klik SCAN');
    }
    
    init();
})();
