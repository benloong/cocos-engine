'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const build = path.join(__dirname, 'build');
const boldFill = process.argv[2] === '--bold';
const mode = boldFill ? 'fill' : 'stroke-round';
const glyphMasks = boldFill ? 32 : 96;
const work = fs.mkdtempSync(path.join(build, boldFill ? 'bold-replay-' : 'stroke-replay-'));
const font = path.resolve(__dirname, '../../../tests/fixtures/Thonburi.ttf');
const chrome = process.env.CC_GPU_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const stages = boldFill ? ['snapped', 'lines', 'widened', 'boundary', 'left', 'right'] : ['lines', 'widened', 'center', 'quadraticCenter', 'boundary', 'freetype'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

// Runs inside Chrome. The mask is four samples wide per destination pixel.
// Centerline variants use the Canvas pen. Expanded paths already describe filled areas.
function scan(paths) {
    const result = {};
    const rectangles = {};
    function mask(ctx) {
        const image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
        let bytes = '';
        for (let i = 3; i < image.length; i += 4) bytes += String.fromCharCode(image[i]);
        return btoa(bytes);
    }
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
            case 'Q': outline.quadraticCurveTo(...v); break;
            case 'E': if (v[0]) outline.closePath(); break;
            default: throw new Error('Unexpected path command ' + op);
            }
        }
        if (stroke) ctx.stroke(outline);
        else ctx.fill(outline, fillRule);
        result[name] = mask(ctx);
        if (!name.endsWith('.center.path')) continue;
        const commands = text.trim().split(/\r?\n/).slice(3);
        if (commands.map(line => line[0]).join('') !== 'MLLLE' || commands[4] !== 'E 1') continue;
        const corners = commands.slice(0, 4).map(line => line.split(' ').slice(1).map(Number));
        if (!corners.every(([x, y], i) => {
            const [nextX, nextY] = corners[(i + 1) % 4];
            return (x === nextX) !== (y === nextY);
        })) continue;
        const xs = [...new Set(corners.map(p => p[0]))], ys = [...new Set(corners.map(p => p[1]))];
        if (xs.length !== 2 || ys.length !== 2) continue;
        const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
        const radius = ctx.lineWidth / 2;
        const arc = new Path2D();
        arc.roundRect(left - radius, top - radius, right - left + 2 * radius, bottom - top + 2 * radius, radius);
        // Same end points and tangents as the circular arcs, represented by cubic Beziers.
        const cubic = new Path2D(), k = radius * 4 * (Math.SQRT2 - 1) / 3;
        cubic.moveTo(left, top - radius);
        cubic.lineTo(right, top - radius);
        cubic.bezierCurveTo(right + k, top - radius, right + radius, top - k, right + radius, top);
        cubic.lineTo(right + radius, bottom);
        cubic.bezierCurveTo(right + radius, bottom + k, right + k, bottom + radius, right, bottom + radius);
        cubic.lineTo(left, bottom + radius);
        cubic.bezierCurveTo(left - k, bottom + radius, left - radius, bottom + k, left - radius, bottom);
        cubic.lineTo(left - radius, top);
        cubic.bezierCurveTo(left - radius, top - k, left - k, top - radius, left, top - radius);
        cubic.closePath();
        const pair = {};
        for (const [kind, path] of [['arc', arc], ['cubic', cubic]]) {
            if (right - left > 2 * radius && bottom - top > 2 * radius) {
                path.rect(left + radius, top + radius, right - left - 2 * radius, bottom - top - 2 * radius);
            }
            ctx.save();
            ctx.resetTransform();
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.restore();
            ctx.fill(path, 'evenodd');
            pair[kind] = mask(ctx);
        }
        rectangles[name] = pair;
    }
    document.querySelector('pre').textContent = JSON.stringify({ masks: result, rectangles });
}

function capture(config, binary, output, cwd, stage, variant) {
    const env = { ...process.env };
    delete env.CC2D_STROKE_REPLAY;
    delete env.CC2D_STROKE_BOUNDARY;
    delete env.CC2D_DIRECT_STROKE;
    if (variant) env[variant] = '1';
    if (stage) env.CC2D_STROKE_REPLAY = stage;
    execFileSync(path.join(__dirname, 'native', config, binary + '.exe'),
        [font, output, 'green', 'latin', mode], { cwd, env, stdio: 'inherit' });
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

// TrueType quadratic segments arrive from DirectWrite as degree-elevated cubics.
// Verify both control points give the same quadratic before reducing the degree.
function quadraticPath(text) {
    let previous;
    return text.split(/\r?\n/).map(line => {
        const [command, ...fields] = line.split(' ');
        const v = fields.map(Number);
        if (command === 'C') {
            const end = v.slice(4);
            const control = end.map((coordinate, axis) => {
                const left = (3 * v[axis] - previous[axis]) / 2;
                const right = (3 * v[axis + 2] - coordinate) / 2;
                assert.ok(Math.abs(left - right) < 0.00001, 'Genuine cubic in the TrueType control');
                return (left + right) / 2;
            });
            previous = end;
            return ['Q', ...control, ...end].join(' ');
        }
        if (command === 'M' || command === 'L') previous = v;
        return line;
    }).join('\n');
}

execFileSync(process.execPath, [path.join(__dirname, 'run-ttf-raster-web.cjs'), 'green', 'latin', mode], { stdio: 'inherit' });
const web = path.join(build, 'ttf-raster-web-green-latin' + (boldFill ? '' : '-stroke-round'));
const metadata = JSON.parse(fs.readFileSync(path.join(web, 'metadata.json')));
assert.equal(metadata.cases.length, 12);
assert.equal(metadata.text, 'Atlas 123');
assert.equal(metadata.lineWidth, 4);
const configs = ['out', 'out-release2'];
const rows = [];
let rectangleControls;
for (const config of configs) {
    const dir = path.join(work, config);
    fs.mkdirSync(dir);
    capture(config, 'cc2d_ttf_raster', 'production', dir);
    capture(config, 'cc2d_ttf_stroke_replay', 'baseline', dir);
    const outlined = path.join(dir, 'outlined');
    fs.mkdirSync(outlined);
    capture(config, 'cc2d_ttf_stroke_replay', path.join(dir, 'boundaryNative'), outlined, undefined, 'CC2D_STROKE_BOUNDARY');
    for (const file of fs.readdirSync(outlined).filter(file => file.endsWith('.widened.path'))) {
        fs.copyFileSync(path.join(outlined, file), path.join(dir, file.replace('.widened.path', '.boundary.path')));
    }
    if (!boldFill) {
        capture(config, 'cc2d_ttf_stroke_replay', path.join(dir, 'directStroke'), dir, undefined, 'CC2D_DIRECT_STROKE');
        for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.center.path'))) {
            const source = fs.readFileSync(path.join(dir, file), 'utf8');
            fs.writeFileSync(path.join(dir, file.replace('.center.path', '.quadraticCenter.path')), quadraticPath(source));
        }
    }
    execFileSync(path.join(__dirname, 'native', config, 'cc2d_ttf_stroke_freetype.exe'), boldFill ? [dir, '--bold'] : [dir], { stdio: 'inherit' });
    const paths = fs.readdirSync(dir).filter(name => stages.some(stage => name.endsWith('.' + stage + '.path'))).sort();
    for (const stage of stages) assert.equal(paths.filter(name => name.endsWith('.' + stage + '.path')).length, glyphMasks);
    const inputs = paths.map(name => [name, fs.readFileSync(path.join(dir, name), 'utf8')]);
    const page = path.join(dir, 'paths.html');
    fs.writeFileSync(page, '<pre></pre><script>(' + scan + ')(' + JSON.stringify(inputs) + ');</script>');
    const dom = execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-first-run',
        '--user-data-dir=' + path.join(work, 'chrome'), '--dump-dom', pathToFileURL(page).href],
    { encoding: 'utf8', timeout: 60000, maxBuffer: 32 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
    const payload = dom.match(/<pre>([^<]+)<\/pre>/);
    assert.ok(payload, 'Browser did not return the glyph masks');
    const { masks, rectangles } = JSON.parse(payload[1]);
    assert.deepEqual(Object.keys(masks).sort(), paths);
    const controls = Object.entries(rectangles).map(([name, pair]) => {
        const reference = Buffer.from(masks[name], 'base64');
        const row = { glyph: name };
        for (const [kind, encoded] of Object.entries(pair)) {
            const samples = Buffer.from(encoded, 'base64');
            assert.equal(samples.length, reference.length);
            let count = 0, max = 0;
            for (let i = 0; i < samples.length; i++) {
                const delta = Math.abs(samples[i] - reference[i]);
                if (delta > 1) count++;
                max = Math.max(max, delta);
            }
            row[kind] = { count, max };
        }
        assert.equal(row.arc.max, 0, 'Rounded rectangle does not reproduce the captured stroke: ' + name);
        return row;
    });
    assert.equal(controls.length, boldFill ? 0 : 8);
    if (rectangleControls) assert.deepEqual(controls, rectangleControls);
    else rectangleControls = controls;
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
        if (boldFill && style !== 1) continue;
        const row = { size, style, webHash: hash(reference), stages: {} };
        const nativeStages = boldFill ? ['production', 'boundaryNative'] : ['production', 'boundaryNative', 'directStroke'];
        for (const stage of [...nativeStages, ...stages]) {
            const image = fs.readFileSync(path.join(dir, stage, file));
            row.stages[stage] = { hash: hash(image), ...compareAlpha(image, reference) };
        }
        if (config === configs[0]) rows.push(row);
        else assert.deepEqual(row, rows.find(r => r.size === size && r.style === style));
    }
}
const renderer = path.resolve(__dirname, '../../cocos/platform/win32/modules/DirectWriteFont.cpp');
const report = { browser: metadata.userAgent, fontSha256: hash(fs.readFileSync(font)), rendererSha256: hash(fs.readFileSync(renderer)),
    text: metadata.text, ...(boldFill ? { mode: 'synthetic-bold-fill' } : { strokeWidth: metadata.lineWidth }), tolerance: 1, glyphMasks, debugReleaseIdentical: true, rectangleControls, rows };
fs.writeFileSync(path.join(work, 'comparison.json'), JSON.stringify(report, null, 2) + '\n');
console.log(path.join(work, 'comparison.json'));
