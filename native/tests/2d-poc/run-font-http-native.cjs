'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const font = require('./font-http-response.cjs')();
const asan = process.argv.includes('--asan');
const release = process.argv.includes('--release');
const exeIndex = process.argv.indexOf('--exe');
const handleReportIndex = process.argv.indexOf('--handle-report');
if (process.argv.includes('--js-rich-text')) throw new Error('Component TS rollback is no longer supported');
if (asan && release) throw new Error('Select one native configuration');
const requests = { font: font.requests, aliases: font.aliasRequests, missing: 0, queued: 0 };
const server = http.createServer((request, response) => {
    if (font.serveAlias(request, response)) return;
    if (request.url === '/m6-cancel.ttf') {
        font.serveResumable(request, response);
    } else if (request.url === '/m6-http-font.ttf') {
        font.serve(request, response);
    } else {
        if (request.url === '/never-requested.ttf') ++requests.queued;
        ++requests.missing;
        response.writeHead(404); response.end();
    }
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'run-graphics-gpu-native.ps1'),
            '-Mode', 'richtext', '-FontHttpOrigin', `http://127.0.0.1:${server.address().port}`];
        if (asan) args.push('-Exe', path.join(__dirname, 'build/gpu-win-asan/native-2d-m6-gpu.exe'));
        if (release) args.push('-Exe', path.join(__dirname, 'build/gpu-win-release/native-2d-m6-gpu.exe'));
        if (exeIndex !== -1) {
            if (asan || release) throw new Error('Select a configuration or an explicit executable');
            args.push('-Exe', path.resolve(process.argv[exeIndex + 1]));
        }
        if (handleReportIndex !== -1) args.push('-FontHandleReport', path.resolve(process.argv[handleReportIndex + 1]));
        const bypass = [process.env.NO_PROXY || process.env.no_proxy, '127.0.0.1', 'localhost'].filter(Boolean).join(',');
        const child = spawn('powershell.exe', args, { windowsHide: true, stdio: 'inherit',
            env: { ...process.env, NO_PROXY: bypass, no_proxy: bypass } });
        const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
        fs.writeFileSync(path.join(__dirname, `build/font-http-${asan ? 'asan' : release ? 'release' : 'normal'}-requests.json`), JSON.stringify(requests, null, 2) + '\n');
        const completeTransfers = handleReportIndex === -1 ? 1 : 31;
        if (code !== 0 || requests.font.interrupted !== 1 || requests.font.complete !== completeTransfers || requests.font.cancelled !== 1
            || requests.font.resumed !== 1 || !requests.aliases.a || !requests.aliases.b || requests.queued !== 0 || !requests.missing) {
            throw new Error(`HTTP font probe failed: ${code}, ${JSON.stringify(requests)}`);
        }
        console.log('M6_FONT_HTTP_REQUESTS ' + JSON.stringify(requests));
    } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
