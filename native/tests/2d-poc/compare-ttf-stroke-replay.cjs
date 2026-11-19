'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const build = path.join(__dirname, 'build');
const work = fs.mkdtempSync(path.join(build, 'stroke-replay-'));
const font = path.resolve(__dirname, '../../../tests/fixtures/Thonburi.ttf');
const chrome = process.env.CC_GPU_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const stages = ['lines', 'widened', 'center'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

// Runs inside Chrome. The mask is four samples wide per destination pixel.
// Only the centerline variant strokes. The two widened variants already describe filled areas.
function scan(paths) {
    const result = {};
    for (const [name, text] of paths) {
        const outline = new Path2D();
        let ctx, stroke = false, fillRule = 'evenodd';
        for (const line of text.trim().split(/\r?\n/)) {
            const [op, ...fields] = line.split(' ');
            const v = fields.map(value => Math.fround(Number(value)));
            switch (op) {
            case 'S': {
                const canvas = document.createElement('canvas');
                [canvas.width, canvas.height] = v;
                ctx = canvas.getContext('2d');
                break;
            }
            case 'T':
                ctx.setTransform(...v.slice(0, 6));
                ctx.lineWidth = v[6];
                ctx.lineJoin = 'round';
                stroke = true;
                break;
            case 'F': fillRule = v[0] ? 'nonzero' : 'evenodd'; break;
            case 'M': outline.moveTo(...v); break;
            case 'L': outline.lineTo(...v); break;
            case 'C': outline.bezierCurveTo(...v); break;
            case 'E': if (v[0]) outline.closePath(); break;
            default: throw new Error('Unexpected path command ' + op);
            }
        }
        if (stroke) ctx.stroke(outline);
        else ctx.fill(outline, fillRule);
        const image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
        let bytes = '';
        for (let i = 3; i < image.length; i += 4) bytes += String.fromCharCode(image[i]);
        result[name] = btoa(bytes);
    }
    document.querySelector('pre').textContent = JSON.stringify(result);
}

function capture(config, binary, output, cwd, stage) {
    const env = { ...process.env };
    delete env.CC2D_STROKE_REPLAY;
    if (stage) env.CC2D_STROKE_REPLAY = stage;
    execFileSync(path.join(__dirname, 'native', config, binary + '.exe'),
        [font, output, 'green', 'latin', 'stroke-round'], { cwd, env, stdio: 'inherit' });
}

function compareAlpha(actual, reference) {
    assert.equal(actual.length, 256 * 128 * 4);
    assert.equal(reference.length, actual.length);
    let pixels = 0, max = 0;
    for (let i = 3; i < actual.length; i += 4) {
        const delta = Math.abs(actual[i] - reference[i]);
        if (delta > 1) ++pixels;
        max = Math.max(max, delta);
    }
    return { pixels, max };
}

execFileSync(process.execPath, [path.join(__dirname, 'run-ttf-raster-web.cjs'), 'green', 'latin', 'stroke-round'], { stdio: 'inherit' });
const web = path.join(build, 'ttf-raster-web-green-latin-stroke-round');
const metadata = JSON.parse(fs.readFileSync(path.join(web, 'metadata.json')));
assert.equal(metadata.cases.length, 12);
assert.equal(metadata.text, 'Atlas 123');
assert.equal(metadata.lineWidth, 4);
const configs = ['out', 'out-release2'];
const rows = [];
for (const config of configs) {
    const dir = path.join(work, config);
    fs.mkdirSync(dir);
    capture(config, 'cc2d_ttf_raster', 'production', dir);
    capture(config, 'cc2d_ttf_stroke_replay', 'baseline', dir);
    const paths = fs.readdirSync(dir).filter(name => name.endsWith('.path')).sort();
    assert.equal(paths.length, 96 * stages.length);
    const inputs = paths.map(name => [name, fs.readFileSync(path.join(dir, name), 'utf8')]);
    const page = path.join(dir, 'paths.html');
    fs.writeFileSync(page, '<pre></pre><script>(' + scan + ')(' + JSON.stringify(inputs) + ');</script>');
    const dom = execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-first-run',
        '--user-data-dir=' + path.join(work, 'chrome'), '--dump-dom', pathToFileURL(page).href],
    { encoding: 'utf8', timeout: 60000, maxBuffer: 32 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
    const payload = dom.match(/<pre>([^<]+)<\/pre>/);
    assert.ok(payload, 'Browser did not return the glyph masks');
    const masks = JSON.parse(payload[1]);
    assert.deepEqual(Object.keys(masks).sort(), paths);
    for (const [name, data] of inputs) {
        const [, width, height] = data.split(/\r?\n/, 1)[0].split(' ');
        const bytes = Buffer.from(masks[name], 'base64');
        assert.equal(bytes.length, Number(width) * Number(height));
        fs.writeFileSync(path.join(dir, name.replace('.path', '.alpha')), bytes);
    }
    for (const stage of stages) capture(config, 'cc2d_ttf_stroke_replay', stage, dir, stage);
    for (const { size, style } of metadata.cases) {
        const file = size + '-' + style + '.rgba';
        const reference = fs.readFileSync(path.join(web, file));
        const production = fs.readFileSync(path.join(dir, 'production', file));
        assert.ok(production.equals(fs.readFileSync(path.join(dir, 'baseline', file))));
        const row = { size, style, webHash: hash(reference), stages: {} };
        for (const stage of ['production', ...stages]) {
            const image = fs.readFileSync(path.join(dir, stage, file));
            row.stages[stage] = { hash: hash(image), ...compareAlpha(image, reference) };
        }
        if (config === configs[0]) rows.push(row);
        else assert.deepEqual(row, rows.find(r => r.size === size && r.style === style));
    }
}
const renderer = path.resolve(__dirname, '../../cocos/platform/win32/modules/DirectWriteFont.cpp');
const report = { browser: metadata.userAgent, fontSha256: hash(fs.readFileSync(font)), rendererSha256: hash(fs.readFileSync(renderer)),
    text: metadata.text, strokeWidth: metadata.lineWidth, tolerance: 1, glyphMasks: 96, debugReleaseIdentical: true, rows };
fs.writeFileSync(path.join(work, 'comparison.json'), JSON.stringify(report, null, 2) + '\n');
console.log(path.join(work, 'comparison.json'));
