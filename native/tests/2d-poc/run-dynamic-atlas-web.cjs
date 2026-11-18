'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const bitmap = process.argv.includes('--bitmap');
const projectArg = process.argv.slice(2).find(arg => !arg.startsWith('--'));
const root = path.resolve(projectArg || path.join(__dirname, '../../../../cocos-m1-test/build/web-mobile'));
const output = path.join(__dirname, bitmap ? 'build/bitmap-web-captures' : 'build/atlas-web-captures');
if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('Build the acceptance Web project first');
fs.mkdirSync(output, { recursive: true });
const logs = [], captures = new Set(), results = [];
let layoutMetrics = [];
let fallbackPassed = false;
let lifecyclePassed = false;
let automaticPassed = false;
let resolveDone, rejectDone;
const done = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (req.method === 'POST' && (url.pathname === '/m6-capture' || (bitmap && url.pathname === '/m6-bitmap-capture'))) {
            const name = url.searchParams.get('name');
            const isBitmap = url.pathname === '/m6-bitmap-capture';
            if (!(isBitmap ? /^(bitmap|atlas)-(flat|rotated)-(source|packed|restored|layout-[a-z0-9-]+)$/ : /^(sprite|mask)-(repeat|clamp)-(source|packed|restored)$/).test(name)) throw new Error('Invalid capture name');
            let length = 0;
            const chunks = [];
            for await (const chunk of req) { length += chunk.length; if (length > 262144) throw new Error('Capture too large'); chunks.push(chunk); }
            if (length !== 262144 || (isBitmap === bitmap && captures.has(name))) throw new Error('Invalid or duplicate capture');
            if (isBitmap === bitmap) { fs.writeFileSync(path.join(output, name + '.rgba'), Buffer.concat(chunks)); captures.add(name); }
            res.writeHead(200); res.end('OK'); return;
        }
        const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
        const mime = { '.js': 'application/javascript', '.html': 'text/html', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png' };
        res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
    } catch (error) { res.writeHead(500); res.end(String(error)); rejectDone(error); }
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const chrome = process.env.CC_GPU_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    const browser = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--ignore-gpu-blocklist', '--remote-debugging-port=0', '--user-data-dir=' + path.join(__dirname, 'build/atlas-web-profile-' + process.pid), 'http://127.0.0.1:' + server.address().port], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    browser.on('error', rejectDone);
    browser.on('exit', code => rejectDone(new Error('Browser exited: ' + code)));
    let socket;
    browser.stderr.on('data', async data => {
        const match = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/.exec(data.toString());
        if (!match || socket) return;
        try {
            const tabs = await (await fetch('http://127.0.0.1:' + match[1] + '/json/list')).json();
            socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
            socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
            socket.onmessage = event => {
                const message = JSON.parse(event.data);
                if (message.method === 'Runtime.exceptionThrown') rejectDone(new Error(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text));
                if (message.method !== 'Runtime.consoleAPICalled') return;
                const text = message.params.args.map(arg => arg.value ?? arg.description ?? '').join(' ');
                logs.push(text);
                if (text === 'M6_ATLAS_FALLBACK_PASS') fallbackPassed = true;
                if (text === 'M6_ATLAS_LIFECYCLE_PASS') lifecyclePassed = true;
                if (text === 'M6_ATLAS_AUTOMATIC_PASS') automaticPassed = true;
                if (!bitmap && text.startsWith('M6_DYNAMIC_ATLAS ')) {
                    const result = JSON.parse(text.slice(17)); results.push(result);
                    if (!result.state || !result.restored || (result.sampling === 'clamp' && !result.equal)) rejectDone(new Error('Web atlas state or framebuffer mismatch'));
                }
                if (text.startsWith('M5_RICHTEXT_ERROR ')) rejectDone(new Error(text));
                if (bitmap && text.startsWith('M6_BITMAP_LAYOUT ')) layoutMetrics.push(JSON.parse(text.slice(17)));
                if (bitmap && text.startsWith('M6_BITMAP_GPU_READY ')) {
                    const result = JSON.parse(text.slice(20)); results.push(...result.checks);
                    if (!fallbackPassed || !lifecyclePassed || !automaticPassed || captures.size !== 88 || result.captures !== 12 || result.layoutCaptures !== 76 || layoutMetrics.length !== 76 || result.checks.length !== 4) rejectDone(new Error('Missing bitmap captures')); else resolveDone();
                }
                if (text.startsWith('M6_BITMAP_CAPTURE ') || text.startsWith('M6_ATLAS_CAPTURE ') || text.startsWith('M6_MASK_STATE ')) console.log(text);
                if (!bitmap && text.startsWith('M4_GRAPHICS ')) {
                    if (!fallbackPassed || !lifecyclePassed || !automaticPassed || captures.size !== 12 || results.length !== 4) rejectDone(new Error('Missing Web atlas captures/results'));
                    else resolveDone();
                }
            };
        } catch (error) { rejectDone(error); }
    });
    const timeout = setTimeout(() => rejectDone(new Error('Web atlas capture timeout')), 90000);
    try { await done; fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ captures: [...captures].sort(), results, layoutMetrics }, null, 2) + '\n'); console.log('Web ' + (bitmap ? 'bitmap' : 'dynamic atlas') + ' captures: PASS (' + captures.size + ')'); }
    finally { clearTimeout(timeout); socket?.close(); browser.kill(); server.close(); fs.writeFileSync(path.join(output, 'console.log'), logs.join('\n')); }
})().catch(error => { console.error(error); process.exitCode = 1; });
