(function(){
    let panel = document.createElement('div');
    panel.id = 'flow-panel';
    panel.innerHTML = `
        <style>
            #flow-panel{position:fixed;bottom:20px;right:20px;width:650px;max-height:80vh;background:#0a0e27;border:2px solid #ff4444;border-radius:10px;z-index:9999999;font-family:'Courier New',monospace;font-size:12px;box-shadow:0 4px 20px black;color:#00ff88;display:flex;flex-direction:column}
            #flow-panel .head{background:#ff4444;color:#fff;padding:10px 12px;font-weight:bold;cursor:move;border-radius:8px 8px 0 0;display:flex;justify-content:space-between}
            #flow-panel .content{padding:12px;overflow-y:auto;max-height:70vh}
            #flow-panel input{width:100%;padding:8px;background:#1a1f3a;border:1px solid #ff4444;color:#00ff88;border-radius:5px;margin:5px 0;box-sizing:border-box;font-size:13px}
            #flow-panel button{background:#ff4444;color:#fff;border:none;padding:6px 12px;cursor:pointer;border-radius:5px;margin:3px;font-weight:bold}
            #flow-panel button:hover{background:#ff6666}
            #flow-panel .item{background:#1a1f3a;margin:12px 0;padding:10px;border-left:4px solid #ff4444;border-radius:5px}
            #flow-panel .sink-item{background:#2a0a0a;border-left-color:#ff0000;border:1px solid #ff0000}
            #flow-panel .tag{color:#ffaa00;font-weight:bold}
            #flow-panel .copy-btn{background:#333;color:#00ff88;border:1px solid #00ff88;padding:3px 10px;font-size:10px;margin-left:8px;cursor:pointer;border-radius:3px}
            .close-btn{cursor:pointer;background:none;border:none;color:#fff;font-size:18px}
            pre{background:#000;padding:10px;overflow-x:auto;margin:8px 0;border-radius:4px;font-size:11px;white-space:pre-wrap;word-break:break-all;color:#ddd}
            .sink-warning{background:#ff0000;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold;display:inline-block;margin:5px 0}
            .path-info{font-size:10px;color:#88aaff;margin:5px 0;word-break:break-all}
        </style>
        <div class="head">
            <span>🔥 DOM XSS FLOW TRACER - FULL ELEMENT SCAN</span>
            <span class="close-btn" id="close-panel">✖</span>
        </div>
        <div class="content">
            <div>
                <label>🔍 Query / kata kunci yang mau dilacak:</label>
                <input type="text" id="track-value" placeholder="Contoh: 1amkaiz3n, sepatu, test">
                <button id="track-btn">🔍 LACAK DATA FLOW</button>
                <button id="clear-btn">🗑 Bersihkan</button>
                <button id="copy-all-btn" style="background:#333">📋 Copy Semua</button>
            </div>
            <div id="result-area" style="margin-top:12px">
                <div style="color:#888;text-align:center">⬆ Ketik query, klik LACAK</div>
            </div>
        </div>
    `;
    document.body.appendChild(panel);
    
    let header = panel.querySelector('.head'), pos1=0,pos2=0,pos3=0,pos4=0;
    header.onmousedown = (e) => { e.preventDefault(); pos3=e.clientX; pos4=e.clientY; document.onmouseup=()=>{document.onmouseup=null;document.onmousemove=null}; document.onmousemove=(e)=>{e.preventDefault(); pos1=pos3-e.clientX; pos2=pos4-e.clientY; pos3=e.clientX; pos4=e.clientY; panel.style.top=(panel.offsetTop-pos2)+'px'; panel.style.left=(panel.offsetLeft-pos1)+'px'; panel.style.bottom='auto'; panel.style.right='auto'}};
    
    document.getElementById('close-panel').onclick = () => panel.remove();
    document.getElementById('track-btn').onclick = () => trackData();
    document.getElementById('clear-btn').onclick = () => clearResults();
    document.getElementById('copy-all-btn').onclick = () => copyAllResults();
    
    let targetValue = '';
    let lastResults = [];
    let sinkDetections = [];
    
    // HOOK SINK BERBAHAYA
    function hookSinks() {
        // Hook innerHTML
        let desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        Object.defineProperty(Element.prototype, 'innerHTML', {
            get: desc.get,
            set: function(val) {
                if(targetValue && typeof val === 'string' && val.includes(targetValue)) {
                    sinkDetections.push({
                        sink: 'innerHTML',
                        element: this,
                        path: getPath(this),
                        value: val.substring(0, 200)
                    });
                    updateSinkWarning();
                }
                return desc.set.call(this, val);
            }
        });
        
        // Hook document.write
        let origWrite = document.write;
        document.write = function(html) {
            if(targetValue && typeof html === 'string' && html.includes(targetValue)) {
                sinkDetections.push({ sink: 'document.write', value: html.substring(0, 200) });
                updateSinkWarning();
            }
            return origWrite.apply(document, arguments);
        };
        
        // Hook eval
        let origEval = window.eval;
        window.eval = function(code) {
            if(targetValue && typeof code === 'string' && code.includes(targetValue)) {
                sinkDetections.push({ sink: 'eval', value: code.substring(0, 200) });
                updateSinkWarning();
            }
            return origEval.call(this, code);
        };
        
        console.log('[XSS] Sinks hooked');
    }
    
    function updateSinkWarning() {
        let warningDiv = document.getElementById('sink-warning-area');
        if(warningDiv) {
            warningDiv.innerHTML = `<div class="sink-warning">⚠️ PERINGATAN: Query terdeteksi masuk ke SINK BERBAHAYA! (${sinkDetections.length} kali)</div>`;
        }
    }
    
    function trackData() {
        let input = document.getElementById('track-value');
        targetValue = input.value.trim();
        if(!targetValue) { alert('Isi query yang mau dilacak!'); return; }
        
        sinkDetections = [];
        let resultDiv = document.getElementById('result-area');
        resultDiv.innerHTML = `<div style="color:#00ff88">🔍 Melacak "${targetValue}" di seluruh DOM...</div>`;
        
        setTimeout(() => {
            let found = scanDOMFull(targetValue);
            lastResults = found;
            displayResultsFull(found);
        }, 200);
    }
    
    function scanDOMFull(val) {
        let results = [];
        let lowerVal = val.toLowerCase();
        let panelElement = document.getElementById('flow-panel');
        
        // Scan SEMUA element yang mengandung query (di outerHTML)
        document.querySelectorAll('*').forEach(el => {
            if(panelElement && panelElement.contains(el)) return;
            
            let outer = el.outerHTML;
            if(outer && outer.toLowerCase().includes(lowerVal)) {
                results.push({
                    type: 'ELEMENT',
                    tag: el.tagName,
                    id: el.id || '-',
                    class: el.className || '-',
                    path: getPath(el),
                    fullHTML: outer,
                    element: el
                });
            }
        });
        
        return results;
    }
    
    function getPath(el) {
        if(!el) return 'unknown';
        let path = [];
        let temp = el;
        while(temp && temp.nodeType === 1 && temp !== document.body) {
            let selector = temp.tagName.toLowerCase();
            if(temp.id && temp.id !== 'flow-panel') { 
                selector += '#' + temp.id; 
                path.unshift(selector); 
                break; 
            }
            path.unshift(selector);
            temp = temp.parentNode;
            if(path.length > 10) break;
        }
        return path.join(' > ');
    }
    
    function displayResultsFull(results) {
        let resultDiv = document.getElementById('result-area');
        
        if(results.length === 0) {
            resultDiv.innerHTML = `<div style="color:#ff8888">✗ "${targetValue}" TIDAK DITEMUKAN di DOM</div>
                                   <div style="color:#888; margin-top:8px">💡 Tips: Pastikan query sudah muncul di halaman (cari dulu di webnya)</div>`;
            return;
        }
        
        let sinkHtml = '';
        if(sinkDetections.length > 0) {
            sinkHtml = `<div style="background:#ff0000;color:#fff;padding:10px;margin-bottom:15px;border-radius:5px">
                        🔥🔥🔥 QUERY MASUK KE SINK BERBAHAYA! (${sinkDetections.length} kali)<br>
                        ${sinkDetections.map(s => `• ${s.sink} di ${s.path || 'unknown'}`).join('<br>')}
                        </div>`;
        }
        
        let html = sinkHtml;
        html += `<div style="margin-bottom:10px">✅ Ditemukan <strong style="color:#ff4444">${results.length}</strong> lokasi query di DOM:</div>`;
        
        results.forEach((r, i) => {
            html += `<div class="item" id="result-item-${i}">
                        <div>
                            <span class="tag">📍 ${r.tag}</span> 
                            <button class="copy-btn" data-idx="${i}">📋 Copy Full HTML</button>
                        </div>
                        <div class="path-info">📁 ${r.path}</div>`;
            
            if(r.id !== '-') html += `<div style="font-size:10px; color:#ffaa00">🆔 ID: ${r.id}</div>`;
            if(r.class !== '-') html += `<div style="font-size:10px; color:#88ff88">📚 Class: ${r.class}</div>`;
            
            html += `<div style="margin-top:8px">
                        <div style="color:#ffaa00; margin-bottom:4px">📄 FULL ELEMENT HTML:</div>
                        <pre>${escapeHtml(r.fullHTML)}</pre>
                     </div>
                     </div>`;
        });
        
        resultDiv.innerHTML = html;
        
        // Copy buttons
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.onclick = (e) => {
                let idx = parseInt(btn.getAttribute('data-idx'));
                let item = results[idx];
                if(item && item.fullHTML) {
                    navigator.clipboard.writeText(item.fullHTML).then(() => {
                        let oldText = btn.innerText;
                        btn.innerText = '✓ Copied!';
                        setTimeout(() => btn.innerText = oldText, 1500);
                    });
                }
            };
        });
    }
    
    function copyAllResults() {
        if(lastResults.length === 0) { alert('Tidak ada hasil'); return; }
        let text = lastResults.map(r => `[${r.tag}] @ ${r.path}\n${r.fullHTML}\n${'='.repeat(80)}`).join('\n\n');
        if(sinkDetections.length > 0) {
            text = `⚠️ SINK DETECTED ⚠️\n${sinkDetections.map(s => `${s.sink} at ${s.path}`).join('\n')}\n\n${text}`;
        }
        navigator.clipboard.writeText(text).then(() => alert(`✅ ${lastResults.length} element di-copy`));
    }
    
    function escapeHtml(str) { 
        if(!str) return '';
        return str.replace(/[&<>]/g, function(m) { 
            if(m === '&') return '&amp;'; 
            if(m === '<') return '&lt;'; 
            if(m === '>') return '&gt;'; 
            return m;
        });
    }
    
    function clearResults() {
        document.getElementById('result-area').innerHTML = '<div style="color:#888;text-align:center">⬆ Ketik query, klik LACAK</div>';
        targetValue = '';
        lastResults = [];
        sinkDetections = [];
    }
    
    hookSinks();
    console.log('✅ DOM XSS FLOW TRACER siap!');
    console.log('💡 Cara pake: 1. Cari query di web 2. Masukkan query yg sama ke tool 3. Klik LACAK');
})();
