'use strict';

// Sample the V8 isolate of the Windows app that produced this stdout file.
const fs = require('node:fs');
const { setTimeout: wait } = require('node:timers/promises');

const [log, output, mode] = process.argv.slice(2);
const snapshots = [];
async function main () {
    const text = () => fs.readFileSync(log, 'utf8');
    const address = text().match(/v8only=true&ws=(127\.0\.0\.1:\d+\/[\w-]+)/);
    if (!address) throw new Error('Missing loopback inspector URL in the application log');
    const ws = new WebSocket('ws://' + address[1]);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    let sequence = 0;
    function call (method, params = {}, timeoutMs = 5000) {
        const id = ++sequence;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error(method + ' timed out')), timeoutMs);
            const receive = event => {
                const message = JSON.parse(event.data);
                if (message.id !== id) return;
                ws.removeEventListener('message', receive); clearTimeout(timeout);
                if (message.error) reject(new Error(JSON.stringify(message.error)));
                else resolve(message.result);
            };
            ws.addEventListener('message', receive);
            ws.send(JSON.stringify({ id, method, params }));
        });
    }
    const samples = [];
    try {
        for (let cycle = 0; cycle <= 1000; cycle += 100) {
            const deadline = Date.now() + 120000;
            const marker = 'M6_STATIC_ATLAS_STRESS_SAMPLE {"cycle":' + cycle + ',';
            while (!text().includes(marker)) {
                if (ws.readyState !== WebSocket.OPEN || Date.now() >= deadline) throw new Error('Missing cycle ' + cycle);
                await wait(100);
            }
            const response = await call('Runtime.getHeapUsage');
            const crt = await call('Runtime.evaluate', { expression: "typeof jsb.readM6CrtHeap === 'function' ? jsb.readM6CrtHeap() : null", returnByValue: true });
            if (crt.exceptionDetails) throw new Error('Native CRT sampling failed');
            if (typeof crt.result.value === 'string') {
                const [bytes, blocks] = crt.result.value.split(',').map(Number);
                if (!(bytes > 0 && blocks > 0)) throw new Error('Invalid CRT sample');
                response.nativeCrtBytes = bytes; response.nativeCrtBlocks = blocks;
            }
            if (!(response.usedSize > 0 && response.totalSize >= response.usedSize)) throw new Error('Invalid heap size');
            if (cycle < 1000 && text().includes('M6_STATIC_ATLAS_STRESS_SAMPLE {"cycle":' + (cycle + 100) + ',')) {
                throw new Error('Missed sampling window for cycle ' + cycle);
            }
            if (mode === '--snapshots' && (cycle === 100 || cycle === 1000)) {
                const path = require('node:path');
                const file = path.basename(output) + '.' + cycle + '.heapsnapshot';
                const directory = path.dirname(output);
                const saved = await call('Runtime.evaluate', { expression: 'jsb.saveM6HeapSnapshot(' + cycle + ')', returnByValue: true }, 90000);
                if (saved.result?.value !== true) throw new Error('Diagnostic app failed to save heap snapshot');
                fs.copyFileSync(path.join(process.argv[5], 'm6-' + cycle + '.heapsnapshot'), path.join(directory, file));
                snapshots.push({ cycle, file });
                if (cycle === 1000) fs.writeFileSync(path.join(directory, 'manifest.json'),
                    JSON.stringify({ result: { cycles: cycle }, snapshots, backend: 'Windows V8' }, null, 2));
            }
            samples.push({ cycle, ...response });
            fs.writeFileSync(output, JSON.stringify(samples, null, 2) + '\n');
        }
    } finally { ws.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
