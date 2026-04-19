javascript:(function(){
    let panel, targetValue = '';
    
    function createPanel() {
        if(document.getElementById('flow-panel')) return;
        let div = document.createElement('div');
        div.id = 'flow-panel';
        div.innerHTML = `
            <style>
                #flow-panel{position:fixed;bottom:20px;right:20px;width:400px;max-height:500px;background:#1a1e2a;border:2px solid #00aaff;border-radius:10px;z-index:999999;font-family:monospace;font-size:12px;box-shadow:0 4px 20px black;color:#00aaff;display:flex;flex-direction:column}
                #flow-panel .head{background:#00aaff;color:#1a1e2a;padding:8px 12px;font-weight:bold;cursor:move;border-radius:8px 8px 0 0;display:flex;justify-content:space-between}
                #flow-panel .content{padding:10px;overflow-y:auto;max-height:400px}
                #flow-panel input{width:100%;padding:6px;background:#0d1117;border:1px solid #00aaff;color:#00aaff;border-radius:5px;margin:5px 0}
                #flow-panel button{background:#00aaff;color:#1a1e2a;border:none;padding:5px 10px;cursor:pointer;border-radius:5px;margin:3px;font-weight:bold}
                #flow-panel .item{background:#0d1117;margin:6px 0;padding:6px;border-left:3px solid #ffaa00;border-radius:3px;word-break:break-all}
                #flow-panel .tag{color:#ffaa00;font-weight:bold}
                .close-btn{cursor:pointer;background:none;border:none;color:#1a1e2a;font-size:16px}
            </style>
            <div class="head">
                <span>🔍 DATA FLOW TRACER</span>
                <span class="close-btn" id="close-panel">✖</span>
            </div>
            <div class="content">
                <div>
                    <label>📝 Kata kunci yang mau dilacak:</label>
                    <input type="text" id="track-value" placeholder="Contoh: sepatu, baju, iphone">
                    <button id="track-btn">🔍 LACAK</button>
                    <button id="clear-btn">🗑 Bersihkan</button>
                </div>
                <div id="result-area" style="margin-top:12px">
                    <div style="color:#888;text-align:center">⬆ Ketik kata, klik LACAK</div>
                </div>
            </div>
        `;
        document.body.appendChild(div);
        
        // Draggable
        let header = div.querySelector('.head'), pos1=0,pos2=0,pos3=0,pos4=0;
        header.onmousedown = (e) => { e.preventDefault(); pos3=e.clientX; pos4=e.clientY; document.onmouseup=()=>{document.onmouseup=null;document.onmousemove=null}; document.onmousemove=(e)=>{e.preventDefault(); pos1=pos3-e.clientX; pos2=pos4-e.clientY; pos3=e.clientX; pos4=e.clientY; div.style.top=(div.offsetTop-pos2)+'px'; div.style.left=(div.offsetLeft-pos1)+'px'; div.style.bottom='auto'; div.style.right='auto'}};
        
        document.getElementById('close-panel').onclick = () => div.remove();
        document.getElementById('track-btn').onclick = () => trackData();
        document.getElementById('clear-btn').onclick = () => clearResults();
    }
    
    function trackData() {
        let input = document.getElementById('track-value');
        targetValue = input.value.trim();
        if(!targetValue) { alert('Isi kata yang mau dilacak!'); return; }
        
        let resultDiv = document.getElementById('result-area');
        resultDiv.innerHTML = `<div style="color:#00ff88">🔍 Melacak "${targetValue}" di seluruh DOM...</div>`;
        
        setTimeout(() => {
            let found = scanDOMForValue(targetValue);
            displayResults(found);
            highlightElements(found);
        }, 100);
    }
    
    function scanDOMForValue(val) {
        let results = [];
        
        // 1. Cari di semua text node
        let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: n => n.textContent && n.textContent.toLowerCase().includes(val.toLowerCase()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
        });
        while(walker.nextNode()) {
            let node = walker.currentNode;
            let parent = node.parentElement;
            results.push({
                type: '📝 TEXT',
                tag: parent ? parent.tagName : 'unknown',
                path: getPath(parent),
                sample: node.textContent.substring(0, 100)
            });
        }
        
        // 2. Cari di semua attribute (termasuk input value, img src, dll)
        let allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
            for(let attr of el.attributes) {
                if(attr.value && attr.value.toLowerCase().includes(val.toLowerCase())) {
                    results.push({
                        type: `🔑 ATTR [${attr.name}]`,
                        tag: el.tagName,
                        path: getPath(el),
                        sample: attr.value.substring(0, 100)
                    });
                }
            }
        });
        
        // 3. Cari khusus di input value
        document.querySelectorAll('input, textarea, select').forEach(el => {
            if(el.value && el.value.toLowerCase().includes(val.toLowerCase())) {
                results.push({
                    type: '✏️ INPUT VALUE',
                    tag: el.tagName,
                    path: getPath(el),
                    sample: el.value.substring(0, 100)
                });
            }
        });
        
        return results;
    }
    
    function getPath(el) {
        if(!el) return 'unknown';
        let path = [];
        while(el && el.nodeType === 1) {
            let selector = el.tagName.toLowerCase();
            if(el.id) { selector += '#' + el.id; path.unshift(selector); break; }
            if(el.className && typeof el.className === 'string') {
                let classes = el.className.split(' ').slice(0,2).join('.');
                if(classes) selector += '.' + classes;
            }
            path.unshift(selector);
            el = el.parentNode;
        }
        return path.join(' > ');
    }
    
    function highlightElements(results) {
        document.querySelectorAll('.flow-highlight').forEach(el => el.classList.remove('flow-highlight'));
        let style = document.getElementById('flow-highlight-style');
        if(!style) {
            style = document.createElement('style');
            style.id = 'flow-highlight-style';
            style.textContent = '.flow-highlight { outline: 3px solid #ffaa00 !important; background: rgba(255,170,0,0.2) !important; transition: 0.2s; }';
            document.head.appendChild(style);
        }
        results.forEach(r => {
            if(r.path !== 'unknown') {
                let selector = r.path.split(' > ').pop();
                try {
                    let el = document.querySelector(selector);
                    if(el) el.classList.add('flow-highlight');
                } catch(e) {}
            }
        });
        setTimeout(() => {
            document.querySelectorAll('.flow-highlight').forEach(el => el.classList.remove('flow-highlight'));
        }, 3000);
    }
    
    function displayResults(results) {
        let resultDiv = document.getElementById('result-area');
        if(results.length === 0) {
            resultDiv.innerHTML = `<div style="color:#ff8888">✗ "${targetValue}" tidak ditemukan di DOM manapun</div>
                                   <div style="color:#888; margin-top:8px">💡 Mungkin data via AJAX? Coba interaksi dulu (klik, scroll)</div>`;
            return;
        }
        
        let html = `<div style="margin-bottom:8px">✅ Ditemukan <strong style="color:#ffaa00">${results.length}</strong> lokasi:</div>`;
        results.forEach((r, i) => {
            html += `<div class="item">
                        <div><span class="tag">📍 ${r.tag}</span> | ${r.type}</div>
                        <div style="font-size:10px; color:#88aaff">${r.path}</div>
                        <div style="font-size:10px; color:#aaa; margin-top:4px">💾 "${r.sample}"</div>
                     </div>`;
        });
        html += `<div style="margin-top:10px; font-size:10px; color:#aaa; border-top:1px solid #333; padding-top:6px">
                    🟡 Highlight kuning = lokasi data di halaman (3 detik)
                 </div>`;
        resultDiv.innerHTML = html;
    }
    
    function clearResults() {
        document.getElementById('result-area').innerHTML = '<div style="color:#888;text-align:center">⬆ Ketik kata, klik LACAK</div>';
        document.querySelectorAll('.flow-highlight').forEach(el => el.classList.remove('flow-highlight'));
        targetValue = '';
    }
    
    createPanel();
    console.log('✅ DATA FLOW TRACER siap! Ketik kata pencarian (contoh: sepatu) lalu klik LACAK');
})();
