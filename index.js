(function() {
    'use strict';
    
    // ======================== KONFIGURASI ========================
    const CONFIG = {
        testPayload: 'ZEN_XSS_' + Math.random().toString(36).substr(2, 10),
        dangerousSinks: ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval', 'setTimeout', 'setInterval', 'Function'],
        highlightDuration: 3000,
        autoInject: true,
        monitorXHR: true,
        monitorFetch: true
    };
    
    // ======================== GLOBAL STATE ========================
    let state = {
        sources: { urlParams: {}, hash: '', localStorage: {}, sessionStorage: {}, cookies: [] },
        reflections: [],
        sinkCalls: [],
        flowTraces: [],
        xhrLogs: [],
        fetchLogs: [],
        observer: null,
        hooked: false
    };
    
    // ======================== UI PANEL (Floating) ========================
    function createPanel() {
        let panel = document.createElement('div');
        panel.id = 'xss-tracer-panel';
        panel.innerHTML = `
            <style>
                #xss-tracer-panel {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 380px;
                    max-height: 500px;
                    background: #1a1e2a;
                    color: #00ff9d;
                    border: 1px solid #00ff9d;
                    border-radius: 8px;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    z-index: 999999;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                    backdrop-filter: blur(4px);
                }
                #xss-tracer-panel .header {
                    background: #0d1117;
                    padding: 8px 12px;
                    cursor: move;
                    border-bottom: 1px solid #00ff9d;
                    font-weight: bold;
                    display: flex;
                    justify-content: space-between;
                }
                #xss-tracer-panel .content {
                    padding: 10px;
                    overflow-y: auto;
                    flex: 1;
                    max-height: 400px;
                }
                #xss-tracer-panel .log-entry {
                    border-left: 3px solid #ff4444;
                    margin: 8px 0;
                    padding: 6px;
                    background: #0f1322;
                    font-size: 11px;
                    word-break: break-word;
                }
                #xss-tracer-panel .log-entry.info {
                    border-left-color: #44ff44;
                }
                #xss-tracer-panel .badge {
                    background: #ff4444;
                    color: white;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 10px;
                }
                #xss-tracer-panel button {
                    background: #2a2f45;
                    color: #00ff9d;
                    border: 1px solid #00ff9d;
                    padding: 4px 8px;
                    margin: 2px;
                    cursor: pointer;
                    border-radius: 4px;
                }
                #xss-tracer-panel button:hover { background: #00ff9d; color: #0d1117; }
                #xss-tracer-panel .close-btn { cursor: pointer; background: none; border: none; color: #ff6666; font-size: 16px; }
            </style>
            <div class="header">
                <span>🧨 DOM XSS Flow Tracer</span>
                <div>
                    <button id="xss-clear-logs">🗑️</button>
                    <button id="xss-minimize">─</button>
                    <span class="close-btn" id="xss-close">✖</span>
                </div>
            </div>
            <div class="content" id="xss-log-content">
                <div class="log-entry info">✅ Tool loaded. Test payload: ${CONFIG.testPayload}</div>
                <div class="log-entry info">🔍 Monitoring sources & sinks...</div>
            </div>
        `;
        document.body.appendChild(panel);
        
        // Event listeners
        document.getElementById('xss-clear-logs').onclick = () => {
            document.getElementById('xss-log-content').innerHTML = '';
            addLog('Logs cleared', 'info');
        };
        document.getElementById('xss-minimize').onclick = () => {
            let content = document.getElementById('xss-log-content');
            content.style.display = content.style.display === 'none' ? 'block' : 'none';
        };
        document.getElementById('xss-close').onclick = () => {
            panel.style.display = 'none';
        };
        
        // Draggable
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        let header = panel.querySelector('.header');
        header.onmousedown = dragMouseDown;
        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }
        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            panel.style.top = (panel.offsetTop - pos2) + 'px';
            panel.style.left = (panel.offsetLeft - pos1) + 'px';
            panel.style.bottom = 'auto';
            panel.style.right = 'auto';
        }
        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }
    
    function addLog(msg, type = 'alert') {
        let content = document.getElementById('xss-log-content');
        if (content) {
            let div = document.createElement('div');
            div.className = 'log-entry ' + (type === 'info' ? 'info' : '');
            div.innerHTML = `[${new Date().toLocaleTimeString()}] ${msg}`;
            content.appendChild(div);
            content.scrollTop = content.scrollHeight;
        }
        console.log(`[XSS-Tracer] ${msg}`);
    }
    
    // ======================== SOURCE CAPTURE ========================
    function captureSources() {
        // URL Params
        let urlParams = new URLSearchParams(window.location.search);
        for (let [key, value] of urlParams.entries()) {
            if (value.includes(CONFIG.testPayload)) {
                state.sources.urlParams[key] = value;
                addLog(`📥 Source detected: location.search ?${key}=${value.substring(0, 50)}`, 'info');
            }
        }
        
        // Hash
        if (window.location.hash.includes(CONFIG.testPayload)) {
            state.sources.hash = window.location.hash;
            addLog(`📥 Source detected: location.hash = ${window.location.hash.substring(0, 50)}`, 'info');
        }
        
        // Storage
        for (let i = 0; i < localStorage.length; i++) {
            let key = localStorage.key(i);
            let val = localStorage.getItem(key);
            if (val && val.includes(CONFIG.testPayload)) {
                state.sources.localStorage[key] = val;
                addLog(`📥 Source detected: localStorage[${key}]`, 'info');
            }
        }
        
        for (let i = 0; i < sessionStorage.length; i++) {
            let key = sessionStorage.key(i);
            let val = sessionStorage.getItem(key);
            if (val && val.includes(CONFIG.testPayload)) {
                state.sources.sessionStorage[key] = val;
                addLog(`📥 Source detected: sessionStorage[${key}]`, 'info');
            }
        }
        
        // Cookies
        document.cookie.split(';').forEach(cookie => {
            if (cookie.includes(CONFIG.testPayload)) {
                state.sources.cookies.push(cookie.trim());
                addLog(`📥 Source detected: Cookie: ${cookie.trim()}`, 'info');
            }
        });
    }
    
    // ======================== REFLECTION SCAN ========================
    function scanReflections() {
        let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: node => node.textContent.includes(CONFIG.testPayload) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
        });
        while (walker.nextNode()) {
            let node = walker.currentNode;
            state.reflections.push({ value: CONFIG.testPayload, node, path: getPath(node.parentElement) });
            addLog(`🔍 Reflection found: ${getPath(node.parentElement)}`, 'info');
        }
        
        document.querySelectorAll('*').forEach(el => {
            for (let attr of el.attributes) {
                if (attr.value && attr.value.includes(CONFIG.testPayload)) {
                    state.reflections.push({ value: CONFIG.testPayload, node: el, attr: attr.name, path: getPath(el) });
                    addLog(`🔍 Reflection in attribute ${attr.name}: ${getPath(el)}`, 'info');
                }
            }
        });
    }
    
    // ======================== SINK HOOKING ========================
    function hookSinks() {
        if (state.hooked) return;
        
        // Hook innerHTML/outerHTML
        let descInner = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        Object.defineProperty(Element.prototype, 'innerHTML', {
            get: descInner.get,
            set: function(val) {
                if (typeof val === 'string' && val.includes(CONFIG.testPayload)) {
                    processSinkCall('innerHTML', val, this);
                }
                return descInner.set.call(this, val);
            }
        });
        
        // Hook document.write
        let origWrite = document.write;
        document.write = function(html) {
            if (typeof html === 'string' && html.includes(CONFIG.testPayload)) {
                processSinkCall('document.write', html, null);
            }
            return origWrite.apply(document, arguments);
        };
        
        // Hook eval
        let origEval = window.eval;
        window.eval = function(code) {
            if (typeof code === 'string' && code.includes(CONFIG.testPayload)) {
                processSinkCall('eval', code, null);
            }
            return origEval.call(this, code);
        };
        
        // Hook setTimeout/setInterval string form
        let origST = window.setTimeout;
        window.setTimeout = function(handler, timeout) {
            if (typeof handler === 'string' && handler.includes(CONFIG.testPayload)) {
                processSinkCall('setTimeout(string)', handler, null);
            }
            return origST.call(this, handler, timeout);
        };
        
        state.hooked = true;
        addLog('🔗 All dangerous sinks hooked', 'info');
    }
    
    function processSinkCall(sinkName, value, element) {
        let stack = new Error().stack;
        state.sinkCalls.push({ sink: sinkName, value, element, stack, timestamp: Date.now() });
        
        // Check data flow
        let matched = findMatchingSource(value);
        if (matched) {
            state.flowTraces.push({ sink: sinkName, source: matched, value, element, path: element ? getPath(element) : 'N/A' });
            addLog(`🔥🔥🔥 [HIGH] Data flow: ${matched.type} → ${sinkName} at ${getPath(element)}`, 'alert');
            if (element) highlightElement(element);
        } else {
            addLog(`⚠️ Sink called with test payload but source unknown: ${sinkName}`, 'info');
        }
    }
    
    function findMatchingSource(value) {
        for (let [k, v] of Object.entries(state.sources.urlParams)) if (value.includes(v)) return { type: 'location.search', key: k, value: v };
        if (state.sources.hash && value.includes(state.sources.hash)) return { type: 'location.hash', value: state.sources.hash };
        for (let [k, v] of Object.entries(state.sources.localStorage)) if (value.includes(v)) return { type: 'localStorage', key: k, value: v };
        for (let [k, v] of Object.entries(state.sources.sessionStorage)) if (value.includes(v)) return { type: 'sessionStorage', key: k, value: v };
        for (let c of state.sources.cookies) if (value.includes(c)) return { type: 'cookie', value: c };
        return null;
    }
    
    // ======================== XHR/FETCH MONITORING (BONUS) ========================
    function hookXHR() {
        let origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
            this._url = url;
            this._method = method;
            return origOpen.apply(this, arguments);
        };
        let origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function(body) {
            if (body && typeof body === 'string' && body.includes(CONFIG.testPayload)) {
                state.xhrLogs.push({ url: this._url, method: this._method, body });
                addLog(`📡 XHR sent with test payload to ${this._url}`, 'info');
            }
            return origSend.apply(this, arguments);
        };
    }
    
    function hookFetch() {
        let origFetch = window.fetch;
        window.fetch = function(url, options) {
            let body = options?.body;
            if (body && typeof body === 'string' && body.includes(CONFIG.testPayload)) {
                state.fetchLogs.push({ url, body });
                addLog(`📡 Fetch sent with test payload to ${url}`, 'info');
            }
            return origFetch.apply(this, arguments);
        };
    }
    
    // ======================== MUTATION OBSERVER ========================
    function startMutationObserver() {
        state.observer = new MutationObserver(() => scanReflections());
        state.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        addLog('👁️ MutationObserver active (SPA support)', 'info');
    }
    
    // ======================== AUTO PAYLOAD INJECTION ========================
    function autoInjectPayload() {
        document.querySelectorAll('input, textarea').forEach(el => {
            if (el.value !== undefined) {
                el.value = CONFIG.testPayload;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                addLog(`💉 Injected payload into ${el.tagName} ${el.name || el.id || ''}`, 'info');
            }
        });
    }
    
    // ======================== UTILITIES ========================
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
        el.style.outline = '3px solid #ff0000';
        setTimeout(() => el.style.outline = orig, CONFIG.highlightDuration);
    }
    
    // ======================== REPORT ========================
    function showReport() {
        addLog(`\n========== REPORT ==========`, 'info');
        addLog(`Sources: ${Object.keys(state.sources.urlParams).length} URL params, ${state.sources.hash ? 'hash' : 'no hash'}, ${Object.keys(state.sources.localStorage).length} localStorage`, 'info');
        addLog(`Reflections: ${state.reflections.length}`, 'info');
        addLog(`Sink calls: ${state.sinkCalls.length}`, 'info');
        addLog(`🔥 DATA FLOWS FOUND: ${state.flowTraces.length}`, state.flowTraces.length ? 'alert' : 'info');
        state.flowTraces.forEach((t, i) => {
            addLog(`${i+1}. ${t.source.type} → ${t.sink} at ${t.path}`, 'alert');
        });
        if (CONFIG.monitorXHR) addLog(`XHR logs: ${state.xhrLogs.length}`, 'info');
        if (CONFIG.monitorFetch) addLog(`Fetch logs: ${state.fetchLogs.length}`, 'info');
    }
    
    // ======================== INIT ========================
    function init() {
        createPanel();
        captureSources();
        hookSinks();
        if (CONFIG.monitorXHR) hookXHR();
        if (CONFIG.monitorFetch) hookFetch();
        startMutationObserver();
        if (CONFIG.autoInject) autoInjectPayload();
        setTimeout(() => { scanReflections(); showReport(); }, 2000);
        
        window.__xssTracer = state;
        addLog(`🎯 Tool ready! Payload: ${CONFIG.testPayload}`, 'info');
        addLog(`💡 Try interacting with the page (forms, clicks)`, 'info');
    }
    
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
