'use strict';
// Standalone browser Canvas evidence. Does not adjust native production options.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const color = process.argv[2] || 'white';
const sample = process.argv[3] || 'latin';
const mode = process.argv[4] || 'fill';
const colors = { white: 'white', red: 'red', green: 'lime', gray: 'rgb(128,128,128)', black: 'black', 'half-white': 'rgba(255,255,255,0.5)' };
const texts = { latin: 'Atlas 123', combining: 'A\u0301tlas', thai: '\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22' };
if (!Object.hasOwn(colors, color) || !Object.hasOwn(texts, sample)) throw new Error('Unknown color or sample');
if (!['fill', 'outline', 'stroke-round', 'stroke-miter', 'stroke-bevel'].includes(mode)) throw new Error('Unknown paint mode');
const suffix = mode === 'fill' ? (color === 'white' && sample === 'latin' ? '' : '-' + color + '-' + sample) : '-' + color + '-' + sample + '-' + mode;
const output = path.join(__dirname, 'build/ttf-raster-web' + suffix);
const chrome = process.env.CC_GPU_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(output, { recursive: true });
let complete, fail;
const done = new Promise((resolve, reject) => { complete = resolve; fail = reject; });
const received = new Set();
const server = http.createServer(async (req, res) => {
    try {
        if (req.url === '/font.ttf') {
            res.writeHead(200, { 'Content-Type': 'font/ttf' });
            fs.createReadStream(path.join(__dirname, '../../../tests/fixtures/Thonburi.ttf')).pipe(res);
            return;
        }
        if (req.method === 'POST') {
            if (req.url === '/metadata') {
                const chunks = []; let length = 0;
                for await (const chunk of req) {
                    length += chunk.length;
                    if (length > 16384) throw new Error('Metadata too large');
                    chunks.push(chunk);
                }
                const metadata = JSON.parse(Buffer.concat(chunks).toString());
                if (received.size !== 12 || metadata.cases.length !== 12) throw new Error('Incomplete raw matrix');
                fs.writeFileSync(path.join(output, 'metadata.json'), JSON.stringify(metadata, null, 2));
                res.end('OK'); complete(); return;
            }
            if (!/^\/(12|24|36|48)-[012]\.rgba$/.test(req.url)) throw new Error('Invalid capture name');
            const chunks = []; let length = 0;
            for await (const chunk of req) {
                length += chunk.length;
                if (length > 256 * 128 * 4) throw new Error('Capture too large');
                chunks.push(chunk);
            }
            if (length !== 256 * 128 * 4) throw new Error('Invalid capture length');
            fs.writeFileSync(path.join(output, req.url.slice(1)), Buffer.concat(chunks));
            res.end('OK');
            received.add(req.url);
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<script>
        (async () => {
            const face = new FontFace('M6Raw', 'url(/font.ttf)');
            document.fonts.add(await face.load());
            const cases=[], text=${JSON.stringify(texts[sample])};
            for (const size of [12,24,36,48]) for (let style=0; style<3; style++) {
                const canvas = document.createElement('canvas'); canvas.width=256; canvas.height=128;
                const ctx=canvas.getContext('2d');
                ctx.font=(style===1?'bold ':style===2?'italic ':'')+size+'px M6Raw';
                ctx.textBaseline='alphabetic'; ctx.textAlign='left';
                ctx.fillStyle='rgba(255,255,255,0.004)'; ctx.fillRect(0,0,256,128);
                ctx.fillStyle=${JSON.stringify(colors[color])};
                if (${JSON.stringify(mode)}==='fill') ctx.fillText(text,4.5,size*.87+4);
                else {
                    ctx.strokeStyle=${JSON.stringify(colors[color])}; ctx.lineWidth=4;
                    ctx.lineJoin=${JSON.stringify(mode === 'stroke-miter' ? 'miter' : mode === 'stroke-bevel' ? 'bevel' : 'round')};
                    ctx.strokeText(text,4.5,size*.87+4);
                    if (${JSON.stringify(mode)}==='outline') { ctx.fillStyle='white'; ctx.fillText(text,4.5,size*.87+4); }
                }
                cases.push({size,style,font:ctx.font,width:ctx.measureText(text).width});
                await fetch('/'+size+'-'+style+'.rgba',{method:'POST',body:ctx.getImageData(0,0,256,128).data});
            }
            await fetch('/metadata',{method:'POST',body:JSON.stringify({userAgent:navigator.userAgent,text,color:${JSON.stringify(color)},mode:${JSON.stringify(mode)},cases})});
        })();</script>`);
    } catch (error) { res.writeHead(500); res.end(String(error)); fail(error); }
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check',
        '--user-data-dir=' + path.join(__dirname, 'build/ttf-raster-browser-' + process.pid),
        'http://127.0.0.1:' + server.address().port], { windowsHide: true, stdio: 'ignore' });
    browser.on('error', fail);
    browser.on('exit', (code, signal) => fail(new Error('Chrome exited: ' + code + '/' + signal)));
    const timeout = setTimeout(() => fail(new Error('Raw Canvas capture timeout')), 60000);
    try { await done; console.log('TTF Web raw raster: 12 captures'); }
    finally { clearTimeout(timeout); browser.kill(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
