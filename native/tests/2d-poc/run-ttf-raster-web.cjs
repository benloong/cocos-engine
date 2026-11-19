'use strict';
// Standalone browser Canvas evidence. Does not adjust native production options.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const color = process.argv[2] || 'white';
const sample = process.argv[3] || 'latin';
const originGrid = sample === 'origin-stem' || sample === 'origin-curve';
const width = originGrid ? 512 : 256, height = originGrid ? 512 : 128;
const styleCount = originGrid ? 4 : 3;
const mode = process.argv[4] || 'fill';
const lineWidth = Number(process.argv[5] ?? 4);
if (!Number.isFinite(lineWidth) || lineWidth <= 0 || (process.argv[5] && mode === 'fill')) throw new Error('Expected a positive stroke width for a stroke mode');
const colors = { white: 'white', red: 'red', green: 'lime', gray: 'rgb(128,128,128)', black: 'black', 'half-white': 'rgba(255,255,255,0.5)' };
const texts = { latin: 'Atlas 123', stems: 'I E L', rounds: 'O S C', combining: 'A\u0301tlas', thai: '\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22' };
texts['origin-stem'] = 'I';
texts['origin-curve'] = 'O';
if (!Object.hasOwn(colors, color) || !Object.hasOwn(texts, sample)) throw new Error('Unknown color or sample');
if (!['fill', 'outline', 'stroke-round', 'stroke-miter', 'stroke-bevel'].includes(mode)) throw new Error('Unknown paint mode');
const suffix = mode === 'fill' ? (color === 'white' && sample === 'latin' ? '' : '-' + color + '-' + sample) : '-' + color + '-' + sample + '-' + mode;
const output = path.join(__dirname, 'build/ttf-raster-web' + suffix + (lineWidth === 4 ? '' : '-width-' + lineWidth));
const chrome = process.env.CC_GPU_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(output, { recursive: true });
let complete, fail;
const done = new Promise((resolve, reject) => { complete = resolve; fail = reject; });
const received = new Set();
const server = http.createServer(async (req, res) => {
    try {
        if (req.url === '/font.ttf' || req.url === '/replacement.ttf') {
            res.writeHead(200, { 'Content-Type': 'font/ttf' });
            const file = req.url === '/font.ttf' ? 'tests/fixtures/Thonburi.ttf' : 'editor/assets/default_fonts/builtin-freetype/OpenSans-Regular.ttf';
            fs.createReadStream(path.join(__dirname, '../../..', file)).pipe(res);
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
                if (received.size !== 4 * styleCount || metadata.cases.length !== received.size) throw new Error('Incomplete raw matrix');
                const { fallback, loaded, replaced, restored, released, reloaded } = metadata.aliasWidths;
                if (loaded !== 95.9765625 || fallback === loaded || !Number.isFinite(replaced) || replaced === loaded
                    || restored !== loaded || released !== fallback || reloaded !== loaded) {
                    throw new Error('Canvas did not follow font registration: ' + JSON.stringify(metadata.aliasWidths));
                }
                fs.writeFileSync(path.join(output, 'metadata.json'), JSON.stringify(metadata, null, 2));
                res.end('OK'); complete(); return;
            }
            const capture = /^\/(12|24|36|48)-([0-3])\.rgba$/.exec(req.url);
            if (!capture || Number(capture[2]) >= styleCount) throw new Error('Invalid capture name');
            const chunks = []; let length = 0;
            for await (const chunk of req) {
                length += chunk.length;
                if (length > width * height * 4) throw new Error('Capture too large');
                chunks.push(chunk);
            }
            if (length !== width * height * 4) throw new Error('Invalid capture length');
            fs.writeFileSync(path.join(output, req.url.slice(1)), Buffer.concat(chunks));
            res.end('OK');
            received.add(req.url);
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<script>
        (async () => {
            const family = 'M6CanvasFamilyWithMoreThanThirtyOneCharacters';
            const face = new FontFace(family, 'url(/font.ttf)');
            const retained = document.createElement('canvas').getContext('2d');
            retained.font = '24px ' + family;
            const measure = () => retained.measureText('Atlas 123').width;
            const fallback = measure();
            document.fonts.add(await face.load());
            const loaded = measure();
            const replacement = await new FontFace(family, 'url(/replacement.ttf)').load();
            document.fonts.add(replacement);
            const replaced = measure();
            document.fonts.delete(replacement);
            const restored = measure();
            document.fonts.delete(face);
            const released = measure();
            document.fonts.add(face);
            const aliasWidths = { family, fallback, loaded, replaced, restored, released, reloaded: measure() };
            const cases=[], text=${JSON.stringify(texts[sample])};
            for (const size of [12,24,36,48]) for (let style=0; style<${styleCount}; style++) {
                const canvas = document.createElement('canvas'); canvas.width=${width}; canvas.height=${height};
                const ctx=canvas.getContext('2d');
                ctx.font=['','bold ','italic ','bold italic '][style]+size+'px '+family;
                ctx.textBaseline='alphabetic'; ctx.textAlign='left';
                ctx.fillStyle='rgba(255,255,255,0.004)'; ctx.fillRect(0,0,canvas.width,canvas.height);
                const tiles=${originGrid ? 8 : 1};
                for(let row=0; row<tiles; row++) for(let col=0; col<tiles; col++) {
                    const x=tiles===1?4.5:8+col*64+col/8, y=tiles===1?size*.87+4:50+row*64+row/8;
                    ctx.fillStyle=${JSON.stringify(colors[color])};
                    if (${JSON.stringify(mode)}==='fill') { ctx.fillText(text,x,y); continue; }
                    ctx.strokeStyle=${JSON.stringify(colors[color])}; ctx.lineWidth=${lineWidth};
                    ctx.lineJoin=${JSON.stringify(mode === 'stroke-miter' ? 'miter' : mode === 'stroke-bevel' ? 'bevel' : 'round')};
                    ctx.strokeText(text,x,y);
                    if (${JSON.stringify(mode)}==='outline') { ctx.fillStyle='white'; ctx.fillText(text,x,y); }
                }
                cases.push({size,style,font:ctx.font,width:ctx.measureText(text).width});
                await fetch('/'+size+'-'+style+'.rgba',{method:'POST',body:ctx.getImageData(0,0,canvas.width,canvas.height).data});
            }
            await fetch('/metadata',{method:'POST',body:JSON.stringify({userAgent:navigator.userAgent,text,color:${JSON.stringify(color)},mode:${JSON.stringify(mode)},lineWidth:${lineWidth},aliasWidths,cases})});
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
    try { await done; console.log('TTF Web raw raster:', received.size, 'captures'); }
    finally { clearTimeout(timeout); browser.kill(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
