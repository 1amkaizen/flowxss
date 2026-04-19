(function(){
    let q = prompt('Masukkan kata/query yang mau dilacak (contoh: 1amkaiz3n, sepatu):');
    if(!q) return;
    
    let results = [];
    let totalHits = 0;
    
    // 1. SCAN TEXT NODES (tanpa deduplikasi)
    let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: n => n.textContent && n.textContent.includes(q) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
    });
    while(walker.nextNode()) {
        let n = walker.currentNode;
        let p = n.parentElement;
        if(p) {
            totalHits++;
            results.push({
                type: '📝 TEXT NODE',
                tag: p.tagName,
                id: p.id || '-',
                class: p.className || '-',
                path: getPath(p),
                html: p.outerHTML,
                context: n.textContent.substring(0, 100)
            });
        }
    }
    
    // 2. SCAN ATTRIBUTES (tanpa deduplikasi)
    document.querySelectorAll('*').forEach(el => {
        for(let a of el.attributes) {
            if(a.value && a.value.includes(q)) {
                totalHits++;
                results.push({
                    type: `🔑 ATTRIBUTE [${a.name}]`,
                    tag: el.tagName,
                    id: el.id || '-',
                    class: el.className || '-',
                    path: getPath(el),
                    html: el.outerHTML,
                    attrName: a.name,
                    attrValue: a.value.substring(0, 100)
                });
            }
        }
    });
    
    // 3. SCAN SCRIPT TAGS (khusus biar lebih detil)
    document.querySelectorAll('script').forEach(script => {
        let content = script.textContent;
        if(content && content.includes(q)) {
            totalHits++;
            results.push({
                type: '📜 SCRIPT CONTENT',
                tag: 'script',
                id: script.id || '-',
                class: script.className || '-',
                path: getPath(script),
                html: script.outerHTML,
                context: content.substring(0, 100)
            });
        }
    });
    
    function getPath(el) {
        if(!el) return '';
        let p = [];
        let t = el;
        while(t && t.nodeType === 1 && t !== document.body && t !== document.documentElement) {
            let s = t.tagName.toLowerCase();
            if(t.id && t.id !== 'flow-panel') { 
                s += '#' + t.id; 
                p.unshift(s); 
                break; 
            }
            p.unshift(s);
            t = t.parentNode;
            if(p.length > 10) break;
        }
        return p.join(' > ');
    }
    
    // Buka tab baru
    let win = window.open();
    win.document.write(`<html><head><title>Data Flow Tracer - ${q}</title>
    <style>
        body{background:#0a0e27;color:#00ff88;font-family:'Courier New',monospace;padding:20px;margin:0}
        .item{background:#1a1f3a;margin:12px 0;padding:12px;border-left:4px solid #ff4444;border-radius:5px}
        pre{background:#000;padding:8px;overflow-x:auto;border-radius:4px;font-size:10px;white-space:pre-wrap;word-break:break-all;color:#ddd;max-height:200px}
        .path{color:#ffaa00;font-size:10px;margin:4px 0;word-break:break-all}
        .tag{color:#00ff88;font-weight:bold}
        h1{color:#ff4444}
        button{background:#ff4444;color:#fff;border:none;padding:6px 12px;cursor:pointer;border-radius:5px;margin:5px;font-size:11px}
        .sink-badge{background:#ff0000;color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;display:inline-block;margin-left:10px}
        .counter{background:#ff4444;color:#fff;padding:5px 12px;border-radius:5px;display:inline-block;margin:10px 0}
        .small-info{color:#888;font-size:10px;margin:3px 0}
    </style></head><body>
    <h1>🔍 DATA FLOW TRACER (NO DEDUPLICATION)</h1>
    <div>Query: <strong style="color:#ffaa00">${escapeHtml(q)}</strong></div>
    <div class="counter">📊 TOTAL DITEMUKAN: ${results.length} lokasi (dari ${totalHits} hit)</div>
    <button onclick="copySemua()">📋 Copy SEMUA HTML</button>
    <button onclick="copySummary()">📋 Copy Summary</button>
    <hr>`);
    
    if(results.length === 0) {
        win.document.write(`<div style="color:#ff8888">✗ "${escapeHtml(q)}" TIDAK DITEMUKAN di DOM</div>
        <div style="color:#888">💡 Pastikan query sudah muncul di halaman (cari dulu di webnya)</div>`);
    } else {
        results.forEach((r, i) => {
            let sinkNote = '';
            if(r.tag === 'SCRIPT' || (r.type.includes('on')) || r.tag === 'IFRAME' || r.tag === 'IMG' || r.type.includes('innerHTML')) {
                sinkNote = '<span class="sink-badge">⚠️ POTENSI SINK!</span>';
            }
            
            win.document.write(`<div class="item" id="item-${i}">
                <div>
                    <span class="tag">📍 ${r.tag}</span> | ${r.type}
                    ${sinkNote}
                    <button onclick="copyItem(${i})" style="float:right;padding:2px 8px">📋 Copy</button>
                </div>
                <div class="path">📁 ${r.path}</div>
                ${r.id !== '-' ? `<div>🆔 ID: ${r.id}</div>` : ''}
                ${r.class !== '-' ? `<div>📚 Class: ${r.class.substring(0, 80)}</div>` : ''}
                ${r.attrName ? `<div>🔑 Attribute: ${r.attrName} = "${escapeHtml(r.attrValue)}"</div>` : ''}
                ${r.context ? `<div class="small-info">💬 Context: "${escapeHtml(r.context)}"</div>` : ''}
                <div style="margin-top:8px">
                    <div style="color:#ffaa00">📄 FULL ELEMENT HTML:</div>
                    <pre>${escapeHtml(r.html)}</pre>
                </div>
            </div>`);
        });
    }
    
    win.document.write(`<script>
        let items = ${JSON.stringify(results.map(r => r.html))};
        let fullData = ${JSON.stringify(results)};
        
        function copySemua() {
            navigator.clipboard.writeText(items.join('\\n\\n---\\n\\n')).then(() => alert('${results.length} element HTML di-copy'));
        }
        
        function copySummary() {
            let summary = results.map((r,i) => {
                return \`[\${i+1}] \${r.type} @ \${r.tag}\\nPath: \${r.path}\\n\`;
            }).join('\\n');
            navigator.clipboard.writeText(summary).then(() => alert('Summary ${results.length} item di-copy'));
        }
        
        function copyItem(i) {
            navigator.clipboard.writeText(items[i]).then(() => alert('Element '+(i+1)+' di-copy'));
        }
        
        function escapeHtml(s) {
            if(!s) return '';
            return s.replace(/[&<>]/g, function(m) {
                if(m === '&') return '&amp;';
                if(m === '<') return '&lt;';
                if(m === '>') return '&gt;';
                return m;
            });
        }
    <\/script>`);
    win.document.close();
    
    function escapeHtml(s) {
        if(!s) return '';
        return s.replace(/[&<>]/g, function(m) {
            if(m === '&') return '&amp;';
            if(m === '<') return '&lt;';
            if(m === '>') return '&gt;';
            return m;
        });
    }
})();
