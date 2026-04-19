(function(){
    let q = prompt('Masukkan kata/query yang mau dilacak (contoh: 1amkaiz3n, sepatu):');
    if(!q) return;
    
    let hasil = [];
    
    // Cari di text nodes
    let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: n => n.textContent && n.textContent.includes(q) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
    });
    while(walker.nextNode()) {
        let n = walker.currentNode;
        let p = n.parentElement;
        if(p && !hasil.some(r => r.el === p)) {
            hasil.push({
                el: p,
                html: p.outerHTML,
                path: getPath(p),
                tag: p.tagName,
                id: p.id || '',
                class: p.className || ''
            });
        }
    }
    
    // Cari di attributes
    document.querySelectorAll('*').forEach(el => {
        for(let a of el.attributes) {
            if(a.value && a.value.includes(q)) {
                if(!hasil.some(r => r.el === el)) {
                    hasil.push({
                        el: el,
                        html: el.outerHTML,
                        path: getPath(el),
                        tag: el.tagName,
                        id: el.id || '',
                        class: el.className || '',
                        attr: a.name
                    });
                }
            }
        }
    });
    
    function getPath(el) {
        if(!el) return '';
        let p = [];
        let t = el;
        while(t && t.nodeType === 1 && t !== document.body) {
            let s = t.tagName.toLowerCase();
            if(t.id) {
                s += '#' + t.id;
                p.unshift(s);
                break;
            }
            p.unshift(s);
            t = t.parentNode;
        }
        return p.join(' > ');
    }
    
    // Buka tab baru
    let w = window.open();
    w.document.write(`<html><head><title>Data Flow Tracer - ${q}</title>
    <style>
        body{background:#0a0e27;color:#00ff88;font-family:'Courier New',monospace;padding:20px;margin:0}
        .item{background:#1a1f3a;margin:15px 0;padding:15px;border-left:4px solid #ff4444;border-radius:5px}
        pre{background:#000;padding:10px;overflow-x:auto;border-radius:4px;font-size:11px;white-space:pre-wrap;word-break:break-all;color:#ddd;max-height:300px}
        .path{color:#ffaa00;font-size:11px;margin:5px 0}
        .tag{color:#00ff88;font-weight:bold}
        h1{color:#ff4444}
        button{background:#ff4444;color:#fff;border:none;padding:6px 12px;cursor:pointer;border-radius:5px;margin:5px;font-size:11px}
        .sink-badge{background:#ff0000;color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;display:inline-block;margin-left:10px}
    </style></head><body>
    <h1>🔍 DATA FLOW TRACER</h1>
    <div>Query: <strong style="color:#ffaa00">${escapeHtml(q)}</strong> | Ditemukan: <strong>${hasil.length}</strong> element</div>
    <button onclick="copySemua()">📋 Copy SEMUA HTML</button>
    <hr>`);
    
    if(hasil.length === 0) {
        w.document.write(`<div style="color:#ff8888">✗ "${escapeHtml(q)}" TIDAK DITEMUKAN di DOM</div>
        <div style="color:#888">💡 Pastikan query sudah muncul di halaman (cari dulu di webnya)</div>`);
    } else {
        hasil.forEach((h,i) => {
            let sinkNote = '';
            if(h.tag === 'SCRIPT' || (h.attr && h.attr.toLowerCase().includes('on')) || h.tag === 'IFRAME' || h.tag === 'IMG') {
                sinkNote = '<span class="sink-badge">⚠️ POTENSI SINK BERBAHAYA!</span>';
            }
            w.document.write(`<div class="item">
                <div><span class="tag">📍 ${h.tag}</span> ${sinkNote}</div>
                <div class="path">📁 ${h.path}</div>
                ${h.id ? `<div>🆔 ID: ${h.id}</div>` : ''}
                ${h.class ? `<div>📚 Class: ${h.class}</div>` : ''}
                ${h.attr ? `<div>🔑 Attribute: ${h.attr}</div>` : ''}
                <div style="margin-top:8px"><div style="color:#ffaa00">📄 FULL ELEMENT HTML:</div>
                <pre>${escapeHtml(h.html)}</pre></div>
                <button onclick="copyItem(${i})">📋 Copy Element Ini</button>
            </div>`);
        });
    }
    
    w.document.write(`<script>
        let items = ${JSON.stringify(hasil.map(h => h.html))};
        function copySemua(){navigator.clipboard.writeText(items.join('\\n\\n')).then(()=>alert('${hasil.length} element di-copy'))}
        function copyItem(i){navigator.clipboard.writeText(items[i]).then(()=>alert('Element '+(i+1)+' di-copy'))}
    <\/script>`);
    w.document.close();
    
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
