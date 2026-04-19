(function() {
    // ======================== KONFIGURASI ========================
    const TEST_PAYLOAD = 'ZEN_XSS_' + Math.random().toString(36).substr(2, 8);
    const DANGEROUS_SINKS = ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval', 'setTimeout', 'setInterval'];
    
    // ======================== STORAGE DATA ========================
    let sources = {
        urlParams: {},
        hash: '',
        localStorage: {},
        sessionStorage: {}
    };
    
    let reflections = [];
    let sinkCalls = [];
    let flowTraces = [];
    
    // ======================== HELPER FUNCTIONS ========================
    function getElementXPath(element) {
        if (!element) return 'unknown';
        let path = [];
        while (element && element.nodeType === Node.ELEMENT_NODE) {
            let selector = element.tagName.toLowerCase();
            if (element.id) {
                selector += '#' + element.id;
                path.unshift(selector);
                break;
            } else {
                let sibling = element;
                let nth = 1;
                while (sibling = sibling.previousElementSibling) {
                    if (sibling.tagName === element.tagName) nth++;
                }
                if (nth !== 1) selector += ':nth-of-type(' + nth + ')';
                path.unshift(selector);
            }
            element = element.parentNode;
        }
        return path.join(' > ');
    }
    
    function highlightElement(element) {
        if (!element) return;
        let originalOutline = element.style.outline;
        element.style.outline = '3px solid red';
        setTimeout(() => { element.style.outline = originalOutline; }, 2000);
    }
    
    // ======================== 1. INPUT DETECTION (SOURCE) ========================
    function captureSources() {
        // URL Parameters
        let urlParams = new URLSearchParams(window.location.search);
        for (let [key, value] of urlParams.entries()) {
            if (value.includes(TEST_PAYLOAD) || value.includes('ZEN_')) {
                sources.urlParams[key] = value;
            }
        }
        
        // Hash
        if (window.location.hash.includes(TEST_PAYLOAD) || window.location.hash.includes('ZEN_')) {
            sources.hash = window.location.hash;
        }
        
        // LocalStorage
        for (let i = 0; i < localStorage.length; i++) {
            let key = localStorage.key(i);
            let value = localStorage.getItem(key);
            if (value && (value.includes(TEST_PAYLOAD) || value.includes('ZEN_'))) {
                sources.localStorage[key] = value;
            }
        }
        
        // SessionStorage
        for (let i = 0; i < sessionStorage.length; i++) {
            let key = sessionStorage.key(i);
            let value = sessionStorage.getItem(key);
            if (value && (value.includes(TEST_PAYLOAD) || value.includes('ZEN_'))) {
                sources.sessionStorage[key] = value;
            }
        }
    }
    
    // ======================== 2. REFLECTION DETECTION ========================
    function scanDOMForReflections() {
        let walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    if (node.textContent && node.textContent.includes(TEST_PAYLOAD)) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_SKIP;
                }
            }
        );
        
        while (walker.nextNode()) {
            let node = walker.currentNode;
            reflections.push({
                value: TEST_PAYLOAD,
                node: node,
                path: getElementXPath(node.parentElement)
            });
        }
        
        // Also check attributes
        let allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
            for (let attr of el.attributes) {
                if (attr.value && attr.value.includes(TEST_PAYLOAD)) {
                    reflections.push({
                        value: TEST_PAYLOAD,
                        node: el,
                        attribute: attr.name,
                        path: getElementXPath(el)
                    });
                }
            }
        });
    }
    
    // ======================== 3. SINK HOOKING ========================
    function hookSinks() {
        // Hook Element.prototype.innerHTML
        let originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        Object.defineProperty(Element.prototype, 'innerHTML', {
            get: originalInnerHTML.get,
            set: function(value) {
                if (typeof value === 'string' && (value.includes(TEST_PAYLOAD) || value.includes('ZEN_'))) {
                    let stack = new Error().stack;
                    sinkCalls.push({
                        sink: 'innerHTML',
                        value: value,
                        element: this,
                        stack: stack,
                        timestamp: Date.now()
                    });
                    
                    // Create flow trace
                    checkFlow('innerHTML', value, this, stack);
                }
                return originalInnerHTML.set.call(this, value);
            }
        });
        
        // Hook document.write
        let originalWrite = document.write;
        document.write = function(html) {
            if (typeof html === 'string' && (html.includes(TEST_PAYLOAD) || html.includes('ZEN_'))) {
                sinkCalls.push({
                    sink: 'document.write',
                    value: html,
                    stack: new Error().stack
                });
                checkFlow('document.write', html, null, new Error().stack);
            }
            return originalWrite.apply(document, arguments);
        };
        
        // Hook eval
        let originalEval = window.eval;
        window.eval = function(code) {
            if (typeof code === 'string' && (code.includes(TEST_PAYLOAD) || code.includes('ZEN_'))) {
                sinkCalls.push({
                    sink: 'eval',
                    value: code,
                    stack: new Error().stack
                });
                checkFlow('eval', code, null, new Error().stack);
            }
            return originalEval.call(this, code);
        };
        
        // Hook setTimeout (string form)
        let originalSetTimeout = window.setTimeout;
        window.setTimeout = function(handler, timeout, ...args) {
            if (typeof handler === 'string' && (handler.includes(TEST_PAYLOAD) || handler.includes('ZEN_'))) {
                sinkCalls.push({
                    sink: 'setTimeout (string)',
                    value: handler,
                    stack: new Error().stack
                });
                checkFlow('setTimeout', handler, null, new Error().stack);
            }
            return originalSetTimeout.call(this, handler, timeout, ...args);
        };
        
        console.log('[XSS Tool] Sinks hooked successfully');
    }
    
    // ======================== 4. DATA FLOW TRACING ========================
    function checkFlow(sinkName, value, element, stack) {
        // Check if value contains our test payload
        let matchedSource = null;
        
        // Check URL params
        for (let [key, val] of Object.entries(sources.urlParams)) {
            if (value.includes(val)) {
                matchedSource = { type: 'location.search', key: key, value: val };
                break;
            }
        }
        
        // Check hash
        if (!matchedSource && sources.hash && value.includes(sources.hash)) {
            matchedSource = { type: 'location.hash', value: sources.hash };
        }
        
        // Check localStorage
        for (let [key, val] of Object.entries(sources.localStorage)) {
            if (value.includes(val)) {
                matchedSource = { type: 'localStorage', key: key, value: val };
                break;
            }
        }
        
        if (matchedSource) {
            let trace = {
                severity: 'HIGH',
                source: matchedSource,
                sink: sinkName,
                value: value,
                element: element,
                elementPath: element ? getElementXPath(element) : 'N/A',
                stack: stack
            };
            flowTraces.push(trace);
            printAlert(trace);
        }
    }
    
    // ======================== 5. PRINT OUTPUT ========================
    function printAlert(trace) {
        console.log('%c🔥 POTENTIAL DOM XSS DETECTED', 'color: red; font-size: 16px; font-weight: bold');
        console.log('%cSource:', 'color: yellow', trace.source);
        console.log('%cSink:', 'color: orange', trace.sink);
        console.log('%cDOM Location:', 'color: cyan', trace.elementPath);
        console.log('%cValue:', 'color: magenta', trace.value);
        console.log('%cStack Trace:', 'color: gray', trace.stack);
        console.log('─'.repeat(80));
        
        // Highlight element if exists
        if (trace.element) {
            highlightElement(trace.element);
        }
    }
    
    // ======================== 6. MUTATION OBSERVER (DYNAMIC APPS) ========================
    function startMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    // Check added nodes for reflections
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.TEXT_NODE && node.textContent.includes(TEST_PAYLOAD)) {
                            reflections.push({
                                value: TEST_PAYLOAD,
                                node: node,
                                path: getElementXPath(node.parentElement)
                            });
                            console.log('[Mutation] New reflection detected:', getElementXPath(node.parentElement));
                        }
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            let walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
                            while (walker.nextNode()) {
                                let textNode = walker.currentNode;
                                if (textNode.textContent.includes(TEST_PAYLOAD)) {
                                    reflections.push({
                                        value: TEST_PAYLOAD,
                                        node: textNode,
                                        path: getElementXPath(textNode.parentElement)
                                    });
                                }
                            }
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
        
        console.log('[XSS Tool] MutationObserver started for dynamic apps');
        return observer;
    }
    
    // ======================== 7. AUTO PAYLOAD TEST ========================
    function injectTestPayload() {
        // Inject via URL if we control it (for demo, just add to DOM)
        let testInputs = document.querySelectorAll('input, textarea');
        testInputs.forEach(input => {
            if (input.value && input.value !== '') {
                let originalValue = input.value;
                input.value = originalValue + TEST_PAYLOAD;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                console.log(`[Inject] Payload added to ${input.tagName} ${input.name || input.id || ''}`);
            }
        });
        
        // Also try to add to forms
        console.log(`[Inject] Test payload: ${TEST_PAYLOAD}`);
        console.log('[XSS Tool] Watching for flows...');
    }
    
    // ======================== 8. FINAL REPORT ========================
    function generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 DOM XSS FLOW ANALYSIS REPORT');
        console.log('='.repeat(80));
        
        console.log('\n📥 Sources detected:');
        if (Object.keys(sources.urlParams).length) console.log('  - URL Params:', sources.urlParams);
        if (sources.hash) console.log('  - Hash:', sources.hash);
        if (Object.keys(sources.localStorage).length) console.log('  - localStorage:', sources.localStorage);
        if (Object.keys(sources.sessionStorage).length) console.log('  - sessionStorage:', sources.sessionStorage);
        
        console.log('\n🔍 Reflections found:', reflections.length);
        reflections.forEach((ref, i) => {
            console.log(`  ${i+1}. ${ref.path} ${ref.attribute ? `[${ref.attribute}]` : ''}`);
        });
        
        console.log('\n💀 Sink calls captured:', sinkCalls.length);
        
        console.log('\n🚨 CRITICAL FLOW TRACES:', flowTraces.length);
        flowTraces.forEach((trace, i) => {
            console.log(`\n  ${i+1}. [${trace.severity}] ${trace.source.type} → ${trace.sink}`);
            console.log(`     DOM: ${trace.elementPath}`);
        });
        
        if (flowTraces.length === 0) {
            console.log('\n✅ No direct source→sink flow detected with current payload');
            console.log('💡 Tip: Try interacting with the page (click, submit forms, etc)');
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('🎯 Tool active. Perform actions on the page to test XSS flows.');
        console.log(`🔬 Test payload: ${TEST_PAYLOAD}`);
    }
    
    // ======================== MAIN INIT ========================
    function init() {
        console.clear();
        console.log('%c🧨 DOM XSS DATA FLOW TRACER v1.0', 'color: #00ff00; font-size: 20px; font-weight: bold');
        console.log('%cTracking: Sources → Sinks → Reflections', 'color: #ffaa00');
        console.log('─'.repeat(80));
        
        captureSources();
        hookSinks();
        scanDOMForReflections();
        let observer = startMutationObserver();
        injectTestPayload();
        
        // Re-scan after 2 seconds for async content
        setTimeout(() => {
            scanDOMForReflections();
            generateReport();
        }, 2000);
        
        // Re-scan on user interaction
        ['click', 'submit', 'input', 'change'].forEach(event => {
            document.addEventListener(event, () => {
                setTimeout(() => scanDOMForReflections(), 100);
            });
        });
        
        // Expose for debugging
        window.__xssTool = {
            sources, reflections, sinkCalls, flowTraces, observer, TEST_PAYLOAD
        };
    }
    
    // Run
    init();
})();
