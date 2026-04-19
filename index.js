(function(){
    let panel = document.createElement('div');
    panel.id = 'flow-panel';
    panel.innerHTML = `
        <style>
            #flow-panel{position:fixed;bottom:20px;right:20px;width:600px;max-height:80vh;background:#1a1e2a;border:2px solid #00aaff;border-radius:10px;z-index:9999999;font-family:monospace;font-size:12px;box-shadow:0 4px 20px black;color:#00aaff;display:flex;flex-direction:column}
            #flow-panel .head{background:#00aaff;color:#1a1e2a;padding:10px 12px;font-weight:bold;cursor:move;border-radius:8px 8px 0 0;display:flex;justify-content:space-between}
            #flow-panel .content{padding:12px;overflow-y:auto;max-height:70vh}
            #flow-panel input{width:100%;padding:8px;background:#0d1117;border:1px solid #00aaff;color:#00aaff;border-radius:5px;margin:5px 0;box-sizing:border-box;font-size:13px}
            #flow-panel button{background:#00aaff;color:#1a1e2a;border:none;padding:6px 12px;cursor:pointer;border-radius:5px;margin:3px;font-weight:bold}
            #flow-panel button:hover{background:#00ffcc}
            #flow-panel .item{background:#0d1117;margin:10px 0;padding:10px;border-left:3px solid #ffaa00;border-radius:5px;word-break:break-all}
            #flow-panel .script-item{background:#0a1a2a;border-left-color:#ff6600}
            #flow-panel .tag{color:#ffaa00;font-weight:bold}
            #flow-panel .copy-btn{background:#333;color:#00aaff;border:1px solid #00aaff;padding:3px 10px;font-size:10px;margin-left:8px;cursor:pointer;border-radius:3px}
            #flow-panel .copy-btn:hover{background:#00aaff;color:#000}
            .close-btn{cursor:pointer;background:none;border:none;color:#1a1e2a;font-size:18px;font-weight:bold}
            pre{background:#000;padding:8px;overflow-x:auto;margin:5px 0;border-radius:4px;font-size:11px;max-height:200px;white-space:pre-wrap;word-break:break-all}
            .highlight{background:#ff6600;color:#000;font-weight:bold;padding:0 2px;border-radius:3px}
            .full-element{font-size:11px;color:#88ff88;margin-top:8px}
            .path-info{font-size:10px;color:#88aaff;margin:4px 0;word-break:break-all}
        </style>
        <div class="head">
            <span>🔍 DATA FLOW TRACER v4 - FULL ELEMENT PREVIEW</span>
            <span class="close-btn" id="close-panel">✖</span>
        </div>
        <div class="content">
            <div>
                <label>📝 Kata kunci yang mau dilacak:</label>
                <input type="text" id="track-value" placeholder="Contoh: 1amkaiz3n, sepatu, dll">
                <button id="track-btn">🔍 LACAK</button>
                <button id="clear-btn">🗑 Bersihkan</button>
                <button id="copy-all-btn" style="background:#333">📋 Copy Semua</button>
            </div>
            <div id="result-area" style="margin-top:12px">
                <div style="color:#888;text-align:center">⬆ Ketik kata, klik LACAK</div>
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
    
    function trackData() {
        let input = document.getElementById('track-value');
        targetValue = input.value.trim();
        if(!targetValue) { alert('Isi kata yang mau dilacak!'); return; }
        let resultDiv = document.getElementById('result-area');
        resultDiv.innerHTML = `<div style="color:#00ff88">🔍 Melacak "${targetValue}" di SEMUA DOM...</div>`;
        setTimeout(() => {
            let found = scanDOMFull(targetValue);
            lastResults = found;
            displayResultsFull(found);
            highlightElements(found);
        }, 200);
    }
    
    function getOuterHTML(element) {
        if(!element) return '';
        return element.outerHTML;
    }
    
    function highlightKeyword(text, keyword) {
        if(!text || !keyword) return text;
        let regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, `<span class="highlight">$1</span>`);
    }
    
    function scanDOMFull(val) {
        let results = [];
        let lowerVal = val.toLowerCase();
        let panelElement = document.getElementById('flow-panel');
        
        // 1. SEMUA ELEMENT yang mengandung keyword di attribute atau text content
        document.querySelectorAll('*').forEach(el => {
            if(panelElement && panelElement.contains(el)) return;
            
            // Cek di outerHTML
            let outer = el.outerHTML;
            if(outer && outer.toLowerCase().includes(lowerVal)) {
                results.push({
                    type: '🏷️ ELEMENT',
                    tag: el.tagName,
                    id: el.id || '',
                    classes: el.className,
                    path: getPath(el),
                    fullElement: outer,
                    element: el
                });
                return; // udah ketemu, skip pengecekan lain buat element ini
            }
            
            // Cek di attribute
            for(let attr of el.attributes) {
                if(attr.value && attr.value.toLowerCase().includes(lowerVal)) {
                    results.push({
                        type: `🔑 ATTRIBUTE [${attr.name}]`,
                        tag: el.tagName,
                        path: getPath(el),
                        fullElement: outer,
                        highlightAttr: attr.name,
                        element: el
                    });
                    break;
                }
            }
        });
        
        // 2. SCRIPT TAGS khusus (biar lebih detil)
        document.querySelectorAll('script').forEach(script => {
            if(panelElement && panelElement.contains(script)) return;
            let outer = script.outerHTML;
            if(outer && outer.toLowerCase().includes(lowerVal)) {
                // Cek apakah sudah ada di results
                let exists = results.some(r => r.element === script);
                if(!exists) {
                    results.push({
                        type: '📜 SCRIPT TAG',
                        tag: 'script',
                        id: script.id || '',
                        path: getPath(script),
                        fullElement: outer,
                        element: script
                    });
                }
            }
        });
        
        // 3. META & LINK tags
        document.querySelectorAll('link, meta').forEach(tag => {
            if(panelElement && panelElement.contains(tag)) return;
            let outer = tag.outerHTML;
            if(outer && outer.toLowerCase().includes(lowerVal)) {
                let exists = results.some(r => r.element === tag);
                if(!exists) {
                    results.push({
                        type: `🔗 ${tag.tagName} TAG`,
                        tag: tag.tagName,
                        path: getPath(tag),
                        fullElement: outer,
                        element: tag
                    });
                }
            }
        });
        
        return results;
    }
    
    function getPath(el) {
        if(!el) return 'unknown';
        let path = [];
        let temp = el;
        while(temp && temp.nodeType === 1 && temp !== document.body && temp !== document.documentElement) {
            let selector = temp.tagName.toLowerCase();
            if(temp.id && temp.id !== 'flow-panel') { 
                selector += '#' + temp.id; 
                path.unshift(selector); 
                break; 
            }
            if(temp.className && typeof temp.className === 'string') {
                let classes = temp.className.split(' ').filter(c => c && !c.includes('flow-panel')).slice(0,2).join('.');
                if(classes) selector += '.' + classes;
            }
            path.unshift(selector);
            temp = temp.parentNode;
            if(path.length > 8) break;
        }
        return path.join(' > ');
    }
    
    function highlightElements(results) {
        document.querySelectorAll('.flow-highlight').forEach(el => el.classList.remove('flow-highlight'));
        let style = document.getElementById('flow-highlight-style');
        if(!style) {
            style = document.createElement('style');
            style.id = 'flow-highlight-style';
            style.textContent = '.flow-highlight { outline: 3px solid #ff6600 !important; background: rgba(255,102,0,0.15) !important; transition: 0.2s; }';
            document.head.appendChild(style);
        }
        results.forEach(r => {
            if(r.element) {
                r.element.classList.add('flow-highlight');
            }
        });
        setTimeout(() => {
            document.querySelectorAll('.flow-highlight').forEach(el => el.classList.remove('flow-highlight'));
        }, 5000);
    }
    
    function displayResultsFull(results) {
        let resultDiv = document.getElementById('result-area');
        
        let realResults = results.filter(r => {
            return !r.path.includes('flow-panel');
        });
        
        if(realResults.length === 0) {
            resultDiv.innerHTML = `<div style="color:#ff8888">✗ "${targetValue}" TIDAK DITEMUKAN di DOM</div>
                                   <div style="color:#888; margin-top:8px">💡 Tips:<br>
                                   • Udah cari dulu di websitenya?<br>
                                   • Mungkin perlu interaksi (klik, submit, scroll)</div>`;
            return;
        }
        
        let html = `<div style="margin-bottom:10px">✅ Ditemukan <strong style="color:#00ff88">${realResults.length}</strong> lokasi:</div>`;
        
        realResults.forEach((r, i) => {
            let isScript = r.type.includes('SCRIPT');
            let highlightedElement = highlightKeyword(r.fullElement || '', targetValue);
            
            html += `<div class="item ${isScript ? 'script-item' : ''}" id="result-item-${i}">
                        <div>
                            <span class="tag">📍 ${r.tag}</span> | ${r.type}
                            <button class="copy-btn" data-idx="${i}">📋 Copy Element</button>
                        </div>
                        <div class="path-info">📁 ${r.path}</div>`;
            
            if(r.id) {
                html += `<div style="font-size:10px; color:#ffaa00">🆔 ID: ${r.id}</div>`;
            }
            
            html += `<div class="full-element">
                        <div style="margin:8px 0 4px 0; color:#00ff88">📄 FULL ELEMENT HTML (keyword <span style="background:#ff6600;color:#000;padding:0 4px;border-radius:3px">${targetValue}</span> di-highlight):</div>
                        <pre>${highlightedElement}</pre>
                     </div>
                     </div>`;
        });
        
        html += `<div style="margin-top:10px; font-size:10px; color:#aaa; border-top:1px solid #333; padding-top:8px">
                    🟡 Element di-highlight orange di halaman<br>
                    📋 Klik Copy Element untuk menyalin full HTML ke clipboard
                 </div>`;
        
        resultDiv.innerHTML = html;
        
        // Attach copy events
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.onclick = (e) => {
                let idx = parseInt(btn.getAttribute('data-idx'));
                let item = realResults[idx];
                if(item && item.fullElement) {
                    navigator.clipboard.writeText(item.fullElement).then(() => {
                        let oldText = btn.innerText;
                        btn.innerText = '✓ Copied!';
                        setTimeout(() => btn.innerText = oldText, 1500);
                    });
                }
            };
        });
    }
    
    function copyAllResults() {
        if(lastResults.length === 0) { alert('Tidak ada hasil untuk di-copy'); return; }
        let textToCopy = lastResults.map(r => {
            return `[${r.type}] @ ${r.path}\n${r.fullElement}\n${'='.repeat(80)}`;
        }).join('\n\n');
        navigator.clipboard.writeText(textToCopy).then(() => {
            alert(`✅ ${lastResults.length} hasil di-copy ke clipboard!`);
        });
    }
    
    function clearResults() {
        document.getElementById('result-area').innerHTML = '<div style="color:#888;text-align:center">⬆ Ketik kata, klik LACAK</div>';
        document.querySelectorAll('.flow-highlight').forEach(el => el.classList.remove('flow-highlight'));
        targetValue = '';
        lastResults = [];
    }
    
    console.log('✅ DATA FLOW TRACER v4 - FULL ELEMENT PREVIEW + HIGHLIGHT');
})();
