(function(){
    let q = prompt('Masukkan kata/query yang mau dilacak (contoh: 1amkaiz3n, sepatu):');
    if(!q) return;
    
    // =============== GENERATE SEMUA KEMUNGKINAN ENCODING ===============
    function generateEncodings(input) {
        let variants = new Map();
        
        variants.set(input, '✅ RAW (No encoding)');
        
        // URL encode
        let urlEncoded = encodeURIComponent(input);
        variants.set(urlEncoded, '🔐 URL Encoding (lowercase)');
        variants.set(urlEncoded.toUpperCase(), '🔐 URL Encoding (uppercase)');
        
        // HTML entity encode
        let htmlEncoded = input.replace(/[&<>]/g, function(m) {
            if(m === '&') return '&amp;';
            if(m === '<') return '&lt;';
            if(m === '>') return '&gt;';
            return m;
        });
        variants.set(htmlEncoded, '🔐 HTML Entity Encoding');
        
        // Double HTML encode
        let doubleHtmlEncoded = htmlEncoded.replace(/[&<>]/g, function(m) {
            if(m === '&') return '&amp;';
            if(m === '<') return '&lt;';
            if(m === '>') return '&gt;';
            return m;
        });
        variants.set(doubleHtmlEncoded, '🔐 Double HTML Entity');
        
        // Unicode escape
        let unicodeEncoded = '';
        for(let i = 0; i < input.length; i++) {
            unicodeEncoded += '\\u' + input.charCodeAt(i).toString(16).padStart(4, '0');
        }
        variants.set(unicodeEncoded, '🔐 Unicode Escape');
        
        // HEXADECIMAL ESCAPE
        let hexEncoded = '';
        for(let i = 0; i < input.length; i++) {
            hexEncoded += '\\x' + input.charCodeAt(i).toString(16).padStart(2, '0');
        }
        variants.set(hexEncoded, '🔐 Hexadecimal Escape');
        
        // Decimal HTML entity
        let decimalHtml = '';
        for(let i = 0; i < input.length; i++) {
            decimalHtml += '&#' + input.charCodeAt(i) + ';';
        }
        variants.set(decimalHtml, '🔐 Decimal HTML Entity');
        
        // Case variants
        variants.set(input.toLowerCase(), '🔐 Lowercase variant');
        variants.set(input.toUpperCase(), '🔐 Uppercase variant');
        
        return variants;
    }
    
    let encodings = generateEncodings(q);
    
    function matchesAnyEncoding(str) {
        if(!str) return false;
        for(let enc of encodings.keys()) {
            if(str.includes(enc)) return true;
        }
        return false;
    }
    
    function getMatchedEncodingInfo(str) {
        for(let [enc, type] of encodings.entries()) {
            if(str.includes(enc)) {
                return { matched: enc, type: type };
            }
        }
        return null;
    }
    
    // =============== SIMPAN REFERENSI TOOL SENDIRI ===============
    let toolMarker = document.getElementById('__xss_tracer_marker');
    if(!toolMarker) {
        let marker = document.createElement('div');
        marker.id = '__xss_tracer_marker';
        marker.style.display = 'none';
        document.body.appendChild(marker);
    }
    
    function isPartOfTool(element) {
        if(!element) return false;
        // Cek apakah element ada di dalam panel tool atau marker
        if(element.id === '__xss_tracer_marker') return true;
        if(element.id && element.id.includes('flow-panel')) return true;
        if(element.id && element.id.includes('__xss')) return true;
        // Cek parent chain
        let parent = element;
        while(parent) {
            if(parent.id === '__xss_tracer_marker') return true;
            if(parent.id && parent.id.includes('flow-panel')) return true;
            parent = parent.parentElement;
        }
        return false;
    }
    
    let results = [];
    
    // SCAN TEXT NODES (EXCLUDE TOOL)
    let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: n => {
            if(isPartOfTool(n.parentElement)) return NodeFilter.FILTER_SKIP;
            return (n.textContent && matchesAnyEncoding(n.textContent)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
    });
    while(walker.nextNode()) {
        let n = walker.currentNode;
        let p = n.parentElement;
        if(p && !isPartOfTool(p)) {
            let encInfo = getMatchedEncodingInfo(n.textContent);
            if(encInfo) {
                results.push({
                    type: '📝 TEXT NODE',
                    tag: p.tagName,
                    id: p.id || '-',
                    class: p.className || '-',
                    path: getPath(p),
                    html: p.outerHTML,
                    context: n.textContent.substring(0, 300),
                    matchedEncoding: encInfo.matched,
                    encodingType: encInfo.type
                });
            }
        }
    }
    
    // SCAN ATTRIBUTES (EXCLUDE TOOL)
    document.querySelectorAll('*').forEach(el => {
        if(isPartOfTool(el)) return;
        for(let a of el.attributes) {
            if(a.value && matchesAnyEncoding(a.value)) {
                let encInfo = getMatchedEncodingInfo(a.value);
                if(encInfo) {
                    results.push({
                        type: `🔑 ATTRIBUTE [${a.name}]`,
                        tag: el.tagName,
                        id: el.id || '-',
                        class: el.className || '-',
                        path: getPath(el),
                        html: el.outerHTML,
                        attrName: a.name,
                        attrValue: a.value.substring(0, 300),
                        matchedEncoding: encInfo.matched,
                        encodingType: encInfo.type
                    });
                }
            }
        }
    });
    
    // SCAN SCRIPT TAGS (EXCLUDE TOOL)
    document.querySelectorAll('script').forEach(script => {
        if(isPartOfTool(script)) return;
        let content = script.textContent;
        if(content && matchesAnyEncoding(content)) {
            let encInfo = getMatchedEncodingInfo(content);
            if(encInfo) {
                results.push({
                    type: '📜 SCRIPT CONTENT',
                    tag: 'script',
                    id: script.id || '-',
                    class: script.className || '-',
                    path: getPath(script),
                    html: script.outerHTML,
                    context: content.substring(0, 300),
                    matchedEncoding: encInfo.matched,
                    encodingType: encInfo.type
                });
            }
        }
    });
    
    function getPath(el) {
        if(!el) return '';
        let p = [];
        let t = el;
        while(t && t.nodeType === 1 && t !== document.body && t !== document.documentElement) {
            let s = t.tagName.toLowerCase();
            if(t.id && t.id !== '__xss_tracer_marker' && !t.id.includes('flow-panel')) { 
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
    
    // BUILD SUMMARY
    let encodingSummary = new Map();
    results.forEach(r => {
        let key = r.encodingType;
        if(!encodingSummary.has(key)) {
            encodingSummary.set(key, { count: 0, example: r.matchedEncoding });
        }
        encodingSummary.set(key, {
            count: encodingSummary.get(key).count + 1,
            example: r.matchedEncoding
        });
    });
    
    // Buka tab baru
    let win = window.open();
    win.document.write(`<html><head><title>Data Flow Tracer - ${q}</title>
    <style>
        body{background:#0a0e27;color:#00ff88;font-family:'Courier New',monospace;padding:20px;margin:0}
        .item{background:#1a1f3a;margin:12px 0;padding:12px;border-left:4px solid #ff4444;border-radius:5px}
        .summary-item{background:#0a1a2a;margin:8px 0;padding:10px;border-left:4px solid #ffaa00;border-radius:5px}
        pre{background:#000;padding:8px;overflow-x:auto;border-radius:4px;font-size:10px;white-space:pre-wrap;word-break:break-all;color:#ddd;max-height:200px}
        .path{color:#ffaa00;font-size:10px;margin:4px 0;word-break:break-all}
        .tag{color:#00ff88;font-weight:bold}
        h1{color:#ff4444}
        h2{color:#ffaa00;font-size:16px;margin:15px 0 10px 0}
        button{background:#ff4444;color:#fff;border:none;padding:6px 12px;cursor:pointer;border-radius:5px;margin:5px;font-size:11px}
        .sink-badge{background:#ff0000;color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;display:inline-block;margin-left:10px}
        .counter{background:#ff4444;color:#fff;padding:5px 12px;border-radius:5px;display:inline-block;margin:10px 0}
        .small-info{color:#aaa;font-size:10px;margin:3px 0}
        .encoding-badge{background:#ff8800;color:#000;padding:2px 8px;border-radius:4px;font-size:10px;display:inline-block;margin-left:10px}
        .encoding-info{color:#ffaa00;font-size:10px;margin:4px 0;font-weight:bold}
        .highlight-orange{background:#ff8800;color:#000;padding:0 2px;border-radius:3px;font-weight:bold}
    </style></head><body>
    <h1>🔍 DATA FLOW TRACER (TARGET ONLY - TOOL EXCLUDED)</h1>
    <div>Original Query: <strong style="color:#ffaa00">${escapeHtml(q)}</strong></div>
    <div class="counter">📊 TOTAL DITEMUKAN DI TARGET: ${results.length} lokasi</div>
    
    <h2>📋 RINGKASAN ENCODING YANG DITEMUKAN:</h2>`);
    
    for(let [encType, data] of encodingSummary.entries()) {
        win.document.write(`<div class="summary-item">
            <strong>${encType}</strong><br>
            <span style="color:#00ff88">→ Ditemukan ${data.count} kali</span><br>
            <span style="color:#888;font-size:10px">Contoh: ${escapeHtml(data.example.substring(0, 80))}</span>
        </div>`);
    }
    
    win.document.write(`<hr>
    <button onclick="copySemua()">📋 Copy SEMUA HTML</button>
    <button onclick="copySummary()">📋 Copy Summary</button>
    <button onclick="copyEncodingSummary()">📋 Copy Encoding Map</button>
    <hr>
    <h2>📄 DETAIL LOKASI (${results.length} item):</h2>`);
    
    if(results.length === 0) {
        win.document.write(`<div style="color:#ff8888">✗ "${escapeHtml(q)}" TIDAK DITEMUKAN di DOM target</div>
        <div style="color:#888">💡 Pastikan query sudah muncul di halaman (cari dulu di webnya)</div>`);
    } else {
        results.forEach((r, i) => {
            let sinkNote = '';
            if(r.tag === 'SCRIPT' || r.type.includes('on') || r.tag === 'IFRAME' || r.tag === 'IMG') {
                sinkNote = '<span class="sink-badge">⚠️ POTENSI SINK!</span>';
            }
            
            win.document.write(`<div class="item" id="item-${i}">
                <div>
                    <span class="tag">📍 ${r.tag}</span> | ${r.type}
                    ${sinkNote}
                    <span class="encoding-badge">${r.encodingType}</span>
                    <button onclick="copyItem(${i})" style="float:right;padding:2px 8px">📋 Copy</button>
                </div>
                <div class="path">📁 ${r.path}</div>
                ${r.id !== '-' ? `<div>🆔 ID: ${r.id}</div>` : ''}
                ${r.class !== '-' ? `<div>📚 Class: ${r.class.substring(0, 80)}</div>` : ''}
                ${r.attrName ? `<div>🔑 Attribute: ${r.attrName}</div>` : ''}
                <div class="encoding-info">🔐 Ditemukan sebagai: <span class="highlight-orange">${escapeHtml(r.matchedEncoding)}</span></div>
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
        let encodingMap = ${JSON.stringify(Array.from(encodingSummary.entries()))};
        
        function copySemua() {
            navigator.clipboard.writeText(items.join('\\n\\n---\\n\\n')).then(() => alert('${results.length} element HTML di-copy'));
        }
        
        function copySummary() {
            let summary = results.map((r,i) => {
                return \`[\${i+1}] \${r.type} @ \${r.tag}\\nPath: \${r.path}\\nEncoding: \${r.encodingType}\\nValue: \${r.matchedEncoding}\\n\`;
            }).join('\\n\\n');
            navigator.clipboard.writeText(summary).then(() => alert('Summary ${results.length} item di-copy'));
        }
        
        function copyEncodingSummary() {
            let encText = "ENCODING MAPPING SUMMARY\\n\\n";
            for(let [encType, data] of encodingMap) {
                encText += \`\${encType}: \${data.count} kali\\nContoh: \${data.example}\\n\\n\`;
            }
            navigator.clipboard.writeText(encText).then(() => alert('Encoding summary di-copy'));
        }
        
        function copyItem(i) {
            navigator.clipboard.writeText(items[i]).then(() => alert('Element '+(i+1)+' di-copy'));
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
