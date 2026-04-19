(function(){
    let panel = document.createElement('div');
    panel.id = 'flow-panel';
    panel.innerHTML = `
        <style>
            #flow-panel{position:fixed;bottom:20px;right:20px;width:420px;max-height:550px;background:#1a1e2a;border:2px solid #00aaff;border-radius:10px;z-index:9999999;font-family:monospace;font-size:12px;box-shadow:0 4px 20px black;color:#00aaff;display:flex;flex-direction:column}
            #flow-panel .head{background:#00aaff;color:#1a1e2a;padding:8px 12px;font-weight:bold;cursor:move;border-radius:8px 8px 0 0;display:flex;justify-content:space-between}
            #flow-panel .content{padding:10px;overflow-y:auto;max-height:450px}
            #flow-panel input{width:100%;padding:6px;background:#0d1117;border:1px solid #00aaff;color:#00aaff;border-radius:5px;margin:5px 0;box-sizing:border-box}
            #flow-panel button{background:#00aaff;color:#1a1e2a;border:none;padding:5px 10px;cursor:pointer;border-radius:5px;margin:3px;font-weight:bold}
            #flow-panel .item{background:#0d1117;margin:6px 0;padding:6px;border-left:3px solid #ffaa00;border-radius:3px;word-break:break-all}
            #flow-panel .tag{color:#ffaa00;font-weight:bold}
            .close-btn{cursor:pointer;background:none;border:none;color:#1a1e2a;font-size:16px}
            .real-result{background:#0a1a2a;border-left-color:#00ff88}
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
    document.body.appendChild(panel);
    
    let header = panel.querySelector('.head'), pos1=0,pos2=0,pos3=0,pos4=0;
    header.onmousedown = (e) => { e.preventDefault(); pos3=e.clientX; pos4=e.clientY; document.onmouseup=()=>{document.onmouseup=null;document.onmousemove=null}; document.onmousemove=(e)=>{e.preventDefault(); pos1=pos3-e.clientX; pos2=pos4-e.clientY; pos3=e.clientX; pos4=e.clientY; panel.style.top=(panel.offsetTop-pos2)+'px'; panel.style.left=(panel.offsetLeft-pos1)+'px'; panel.style.bottom='auto'; panel.style.right='auto'}};
    
    document.getElementById('close-panel').onclick = () => panel.remove();
    document.getElementById('track-btn').onclick = () => trackData();
    document.getElementById('clear-btn').onclick = () => clearResults();
    
    let targetValue = '';
    
    function trackData() {
        let input = document.getElementById('track-value');
        targetValue = input.value.trim();
        if(!targetValue) { alert('Isi kata yang mau dilacak!'); return; }
        let resultDiv = document.getElementById('result-area');
        resultDiv.innerHTML = `<div style="color:#00ff88">🔍 Melacak "${targetValue}" di SEMUA DOM (kecuali panel ini)...</div>`;
        setTimeout(() => {
            let found = scanDOMForValue(targetValue);
            displayResults(found);
            highlightElements(found);
        }, 200);
    }
    
    function scanDOMForValue(val) {
        let results = [];
        let lowerVal = val.toLowerCase();
        let panelElement = document.getElementById('flow-panel');
        
        // Text nodes (skip panel sendiri)
        let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: n => {
                if(panelElement && panelElement.contains(n)) return NodeFilter.FILTER_SKIP;
                return (n.textContent && n.textContent.toLowerCase().includes(lowerVal)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            }
        });
        while(walker.nextNode()) {
            let node = walker.currentNode;
            let parent = node.parentElement;
            if(parent && !panelElement.contains(parent)) {
                results.push({
                    type: '📝 TEXT',
                    tag: parent.tagName,
                    path: getPath(parent),
                    sample: node.textContent.substring(0, 150),
                    element: parent
                });
            }
        }
        
        // Attributes (skip panel)
        document.querySelectorAll('*').forEach(el => {
            if(panelElement && panelElement.contains(el)) return;
            for(let attr of el.attributes) {
                if(attr.value && attr.value.toLowerCase().includes(lowerVal)) {
                    results.push({
                        type: `🔑 ATTR [${attr.name}]`,
                        tag: el.tagName,
                        path: getPath(el),
                        sample: attr.value.substring(0, 150),
                        element: el
                    });
                }
            }
        });
        
        // Input values (skip panel)
        document.querySelectorAll('input, textarea, select').forEach(el => {
            if(panelElement && panelElement.contains(el)) return;
            if(el.value && el.value.toLowerCase().includes(lowerVal)) {
                results.push({
                    type: '✏️ INPUT VALUE',
                    tag: el.tagName,
                    path: getPath(el),
                    sample: el.value.substring(0, 150),
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
            if(temp.id) { selector += '#' + temp.id; path.unshift(selector); break; }
            if(temp.className && typeof temp.className === 'string') {
                let classes = temp.className.split(' ').filter(c => c && !c.includes('flow-panel')).slice(0,2).join('.');
                if(classes) selector += '.' + classes;
            }
            path.unshift(selector);
            temp = temp.parentNode;
        }
        return path.join(' > ');
    }
    
    function highlightElements(results) {
        document.querySelectorAll('.flow-highlight').forEach(el => el.classList.remove('flow-highlight'));
        let style = document.getElementById('flow-highlight-style');
        if(!style) {
            style = document.createElement('style');
            style.id = 'flow-highlight-style';
            style.textContent = '.flow-highlight { outline: 3px solid #ffaa00 !important; background: rgba(255,170,0,0.3) !important; transition: 0.2s; }';
            document.head.appendChild(style);
        }
        results.forEach(r => {
            if(r.element) {
                r.element.classList.add('flow-highlight');
            }
        });
        setTimeout(() => {
            document.querySelectorAll('.flow-highlight').forEach(el => el.classList.remove('flow-highlight'));
        }, 4000);
    }
    
    function displayResults(results) {
        let resultDiv = document.getElementById('result-area');
        
        // Filter out results from panel itself
        let realResults = results.filter(r => {
            return !r.path.includes('flow-panel') && !r.sample.includes('Melacak');
        });
        
        if(realResults.length === 0) {
            resultDiv.innerHTML = `<div style="color:#ff8888">✗ "${targetValue}" TIDAK DITEMUKAN di DOM website</div>
                                   <div style="color:#888; margin-top:8px">💡 Tips:<br>
                                   • Udah cari dulu di websitenya?<br>
                                   • Mungkin hasil via AJAX? Coba scroll atau klik dulu<br>
                                   • Kata "Babi" emang gak ada di halaman ini</div>`;
            return;
        }
        
        let html = `<div style="margin-bottom:8px">✅ Ditemukan <strong style="color:#00ff88">${realResults.length}</strong> lokasi REAL di halaman:</div>`;
        realResults.forEach((r, i) => {
            let displayPath = r.path.length > 60 ? r.path.substring(0,60)+'...' : r.path;
            html += `<div class="item real-result">
                        <div><span class="tag">📍 ${r.tag}</span> | ${r.type}</div>
                        <div style="font-size:10px; color:#88aaff; word-break:break-all">${displayPath}</div>
                        <div style="font-size:10px; color:#aaa; margin-top:4px">💾 "${escapeHtml(r.sample)}"</div>
                     </div>`;
        });
        html += `<div style="margin-top:10px; font-size:10px; color:#aaa; border-top:1px solid #333; padding-top:6px">
                    🟡 Element yang mengandung kata "${targetValue}" sudah di-highlight kuning
                 </div>`;
        resultDiv.innerHTML = html;
    }
    
    function escapeHtml(str) { 
        if(!str) return '';
        return str.replace(/[&<>]/g, function(m) { 
            if(m === '&') return '&amp;'; 
            if(m === '<') return '&lt;'; 
            if(m === '>') return '&gt;'; 
            return m;
        }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
            return c;
        });
    }
    
    function clearResults() {
        document.getElementById('result-area').innerHTML = '<div style="color:#888;text-align:center">⬆ Ketik kata, klik LACAK</div>';
        document.querySelectorAll('.flow-highlight').forEach(el => el.classList.remove('flow-highlight'));
        targetValue = '';
    }
    
    console.log('✅ DATA FLOW TRACER v2 - SKIP PANEL SENDIRI');
    console.log('💡 Cara pake: 1. Cari dulu di website 2. Lalu klik LACAK di tool ini');
})();
