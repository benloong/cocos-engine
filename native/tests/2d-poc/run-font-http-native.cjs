'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const font = fs.readFileSync(path.join(__dirname, '../../../tests/fixtures/Thonburi.ttf'));
const asan = process.argv.includes('--asan');
const requests = { font: 0, missing: 0 };
const server = http.createServer((request, response) => {
    if (request.url === '/m6-http-font.ttf') {
        ++requests.font;
        response.writeHead(200, { 'Content-Type': 'font/ttf', 'Content-Length': font.length });
        response.end(font);
    } else {
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
        const bypass = [process.env.NO_PROXY || process.env.no_proxy, '127.0.0.1', 'localhost'].filter(Boolean).join(',');
        const child = spawn('powershell.exe', args, { windowsHide: true, stdio: 'inherit',
            env: { ...process.env, NO_PROXY: bypass, no_proxy: bypass } });
        const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
        fs.writeFileSync(path.join(__dirname, `build/font-http-${asan ? 'asan' : 'normal'}-requests.json`), JSON.stringify(requests, null, 2) + '\n');
        if (code !== 0 || !requests.font || !requests.missing) throw new Error(`HTTP font probe failed: ${code}, ${JSON.stringify(requests)}`);
        console.log('M6_FONT_HTTP_REQUESTS ' + JSON.stringify(requests));
    } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
