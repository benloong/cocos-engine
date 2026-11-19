'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const bitmap = process.argv.includes('--bitmap');
const stress = process.argv.includes('--static-atlas-stress');
const heapSnapshots = process.argv.includes('--heap-snapshots');
const noOptimizingJit = process.argv.includes('--no-optimizing-jit');
if (bitmap && stress) throw new Error('Select one atlas probe mode');
if ((heapSnapshots && !stress) || (noOptimizingJit && !heapSnapshots)) {
    throw new Error('Heap snapshots require Web static atlas stress, and disabling optimizing JIT requires heap snapshots');
}
const projectArg = process.argv.slice(2).find(arg => !arg.startsWith('--'));
const root = path.resolve(projectArg || path.join(__dirname, '../../../../cocos-m1-test/build/web-mobile'));
const stressOutput = heapSnapshots
    ? (noOptimizingJit ? 'static-atlas-heap-no-opt' : 'static-atlas-heap')
    : 'static-atlas-stress-web';
const output = path.join(__dirname, 'build', stress ? stressOutput : bitmap ? 'bitmap-web-captures' : 'atlas-web-captures');
if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('Build the acceptance Web project first');
fs.mkdirSync(output, { recursive: true });
const manifestPath = path.join(output, 'manifest.json');
if (heapSnapshots) fs.rmSync(manifestPath, { force: true });
const logs = [], captures = new Set(), results = [], samples = [];
let layoutMetrics = [];
let bitmapReady = false;
let fallbackPassed = false;
let lifecyclePassed = false;
let automaticPassed = false;
let staticAtlasPassed = false;
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
    const browserArgs = ['--headless=new', '--no-first-run', '--no-default-browser-check', '--ignore-gpu-blocklist',
        '--remote-debugging-port=0', '--user-data-dir=' + path.join(__dirname, 'build/atlas-web-profile-' + process.pid)];
    if (stress) {
        const flags = noOptimizingJit ? '--expose-gc --no-turbofan --no-maglev' : '--expose-gc';
        browserArgs.push('--js-flags=' + flags, '--enable-precise-memory-info', '--disable-background-timer-throttling');
    }
    browserArgs.push('http://127.0.0.1:' + server.address().port + (stress ? '/?static-atlas-stress=1' : ''));
    const browser = spawn(chrome, browserArgs, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    browser.on('error', rejectDone);
    browser.on('exit', code => rejectDone(new Error('Browser exited: ' + code)));
    let socket;
    let snapshot = null;
    let snapshotWork = Promise.resolve();
    const snapshots = [];
    function takeSnapshot (cycle) {
        return new Promise((resolve, reject) => {
            const name = cycle + '.heapsnapshot';
            const fd = fs.openSync(path.join(output, name), 'w');
            const id = cycle + 1;
            snapshot = { id, fd, name, cycle, resolve, reject };
            socket.send(JSON.stringify({ id, method: 'HeapProfiler.takeHeapSnapshot', params: { reportProgress: false, captureNumericValue: true } }));
        });
    }
    browser.stderr.on('data', async data => {
        const match = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/.exec(data.toString());
        if (!match || socket) return;
        try {
            const tabs = await (await fetch('http://127.0.0.1:' + match[1] + '/json/list')).json();
            socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
            socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
            function handleMessage (event) {
                const message = JSON.parse(event.data);
                if (snapshot && message.method === 'HeapProfiler.addHeapSnapshotChunk') {
                    fs.writeSync(snapshot.fd, message.params.chunk);
                    return;
                }
                if (snapshot && message.id === snapshot.id) {
                    const completed = snapshot;
                    snapshot = null;
                    fs.closeSync(completed.fd);
                    if (message.error) {
                        completed.reject(new Error(message.error.message));
                    } else {
                        snapshots.push({ cycle: completed.cycle, file: completed.name });
                        console.log('Captured Web heap checkpoint ' + completed.cycle);
                        completed.resolve();
                    }
                    return;
                }
                if (message.method === 'Runtime.exceptionThrown') rejectDone(new Error(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text));
                if (message.method !== 'Runtime.consoleAPICalled') return;
                const text = message.params.args.map(arg => arg.value ?? arg.description ?? '').join(' ');
                logs.push(text);
                if (text === 'M6_ATLAS_FALLBACK_PASS') fallbackPassed = true;
                if (text === 'M6_ATLAS_LIFECYCLE_PASS') lifecyclePassed = true;
                if (text === 'M6_ATLAS_AUTOMATIC_PASS') automaticPassed = true;
                if (text === 'M6_STATIC_ATLAS_PASS') staticAtlasPassed = true;
                if (text.startsWith('M6_STATIC_ATLAS_ERROR ')) rejectDone(new Error(text));
                if (stress) {
                    if (text.startsWith('M6_STATIC_ATLAS_STRESS_SAMPLE ')) {
                        const sample = JSON.parse(text.slice('M6_STATIC_ATLAS_STRESS_SAMPLE '.length));
                        samples.push(sample);
                        if (heapSnapshots && (sample.cycle === 100 || sample.cycle === 1000)) {
                            snapshotWork = snapshotWork.then(() => takeSnapshot(sample.cycle));
                            snapshotWork.catch(rejectDone);
                        }
                        console.log(text);
                    } else if (text.startsWith('M6_STATIC_ATLAS_STRESS_PASS ')) {
                        const result = JSON.parse(text.slice('M6_STATIC_ATLAS_STRESS_PASS '.length));
                        if (result.cycles !== 1000 || result.checkedAssets !== 5000 || result.pixelChecks !== 22
                            || samples.length !== 11 || samples.some((sample, i) => sample.cycle !== i * 100
                                || sample.wrappers !== (i === 0 ? 0 : 500) || !Number.isFinite(sample.jsHeapBytes) || sample.jsHeapBytes <= 0)) {
                            rejectDone(new Error('Incomplete Web static atlas stress report'));
                        } else {
                            results.push(result);
                            snapshotWork.then(() => {
                                if (heapSnapshots && snapshots.length !== 2) rejectDone(new Error('Missing Web heap snapshots'));
                                else resolveDone();
                            }, rejectDone);
                        }
                    }
                    return;
                }
                if (!bitmap && text.startsWith('M6_DYNAMIC_ATLAS ')) {
                    const result = JSON.parse(text.slice(17)); results.push(result);
                    if (!result.state || !result.restored || (result.sampling === 'clamp' && !result.equal)) rejectDone(new Error('Web atlas state or framebuffer mismatch'));
                }
                if (text.startsWith('M5_RICHTEXT_ERROR ')) rejectDone(new Error(text));
                if (bitmap && text.startsWith('M6_BITMAP_LAYOUT ')) layoutMetrics.push(JSON.parse(text.slice(17)));
                if (bitmap && text.startsWith('M6_BITMAP_GPU_READY ')) {
                    const result = JSON.parse(text.slice(20)); results.push(...result.checks);
                    if (!fallbackPassed || !lifecyclePassed || !automaticPassed || !staticAtlasPassed || captures.size !== 92 || result.captures !== 12 || result.layoutCaptures !== 80 || layoutMetrics.length !== 80 || result.checks.length !== 4) rejectDone(new Error('Missing bitmap captures'));
                    else bitmapReady = true;
                }
                if (bitmap && text.startsWith('M5_RICHTEXT ')) {
                    const rich = JSON.parse(text.slice('M5_RICHTEXT '.length));
                    const italic = rich.segments.filter(segment => segment.text === 'Italic');
                    if (italic.length !== 1 || !Number.isFinite(italic[0].w) || Math.abs(italic[0].w - 90.748) > .01) {
                        rejectDone(new Error('Web system Arial Italic width changed: ' + JSON.stringify(italic)));
                        return;
                    }
                    console.log('Web system Arial Italic width=' + italic[0].w);
                    const index = rich.segments.indexOf(italic[0]);
                    const [space, underline] = rich.segments.slice(index + 1, index + 3);
                    if (space?.text !== ' ' || space.y !== italic[0].y
                        || underline?.text !== 'Underline' || underline.y >= space.y) {
                        rejectDone(new Error('The trailing space must fit after Italic before Underline wraps'));
                        return;
                    }
                    if (!bitmapReady || rich.native || !rich.queryMatches || rich.clicks?.join(',') !== 'first,second,second'
                        || rich.jsLabelComponents !== rich.labels || rich.jsSpriteComponents !== rich.sprites
                        || rich.labels !== 9 || rich.sprites !== 1 || rich.children !== 10) {
                        rejectDone(new Error('Missing Web RichText segment components: ' + text));
                    } else {
                        console.log('Web RichText segment queries: 9 Label, 1 Sprite');
                        resolveDone();
                    }
                }
                if (text.startsWith('M6_BITMAP_CAPTURE ') || text.startsWith('M6_ATLAS_CAPTURE ') || text.startsWith('M6_MASK_STATE ')) console.log(text);
                if (!bitmap && text.startsWith('M4_GRAPHICS ')) {
                    if (!fallbackPassed || !lifecyclePassed || !automaticPassed || !staticAtlasPassed || captures.size !== 12 || results.length !== 4) rejectDone(new Error('Missing Web atlas captures/results'));
                    else resolveDone();
                }
            }
            socket.onmessage = event => {
                try { handleMessage(event); } catch (error) { rejectDone(error); }
            };
        } catch (error) { rejectDone(error); }
    });
    const timeout = setTimeout(() => rejectDone(new Error('Web atlas capture timeout')), stress ? 600000 : 90000);
    try {
        await done;
        const manifest = stress ? { result: results[0], samples, ...(heapSnapshots && { snapshots, noOptimizingJit }) }
            : { captures: [...captures].sort(), results, layoutMetrics };
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
        console.log(stress ? 'Web static atlas: PASS (1000 cycles)'
            : 'Web ' + (bitmap ? 'bitmap' : 'dynamic atlas') + ' captures: PASS (' + captures.size + ')');
    } finally {
        clearTimeout(timeout);
        if (snapshot) fs.closeSync(snapshot.fd);
        socket?.close();
        browser.kill();
        server.close();
        fs.writeFileSync(path.join(output, 'console.log'), logs.join('\n'));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
