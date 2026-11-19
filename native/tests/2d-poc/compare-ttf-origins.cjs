'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const build = path.join(__dirname, 'build');
const font = path.join(__dirname, '../../../tests/fixtures/Thonburi.ttf');
const capture = process.argv[2] === '--capture';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => fs.readFileSync(path.join(build, file));

// Compare coverage after removing only the whole-tile translation. Equal tiles
// mean the rasterizer returned the same mask at two different input origins.
function tile(pixels, row, col) {
    const alpha = Buffer.alloc(64 * 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const offset = ((64 * row + y) * 512 + 64 * col + x) * 4;
        assert.ok(pixels[offset] === 255 && pixels[offset + 1] === 255 && pixels[offset + 2] === 255);
        alpha[y * 64 + x] = pixels[offset + 3];
        if (!x || !y || x === 63 || y === 63) assert.equal(alpha[y * 64 + x], 1, 'Glyph touched a tile edge');
    }
    assert.ok(alpha.some(value => value > 1), 'Empty glyph');
    return alpha;
}

if (process.argv[2] === '--check-bold-stem') {
    assert.equal(process.argv.length, 4, 'Pass the Windows raster executable');
    const exe = path.resolve(process.argv[3]);
    const native = path.join(path.dirname(exe), 'ttf-bold-stem');
    execFileSync(exe, [font, native, 'white', 'origin-stem', 'fill'], { stdio: 'inherit' });
    execFileSync(process.execPath, [path.join(__dirname, 'run-ttf-raster-web.cjs'), 'white', 'origin-stem', 'fill'], { stdio: 'inherit' });
    const web = path.join(build, 'ttf-raster-web-white-origin-stem');
    const browser = JSON.parse(fs.readFileSync(path.join(web, 'metadata.json')));
    const fontSha256 = hash(fs.readFileSync(font));
    assert.equal(browser.fontSha256, fontSha256);
    assert.equal(browser.text, 'I');
    const cases = [];
    for (const size of [12, 24, 36, 48]) {
        const file = size + '-1.rgba'; // Style 1 is upright synthetic bold.
        const actual = fs.readFileSync(path.join(native, file)), reference = fs.readFileSync(path.join(web, file));
        assert.equal(actual.length, 512 * 512 * 4);
        assert.equal(reference.length, actual.length);
        let passed = 0, maxAlpha = 0;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
            const a = tile(actual, y, x), b = tile(reference, y, x);
            if (a.equals(b)) passed++;
            for (let i = 0; i < a.length; i++) maxAlpha = Math.max(maxAlpha, Math.abs(a[i] - b[i]));
        }
        cases.push({ size, passed, total: 64, maxAlpha, nativeSha256: hash(actual), webSha256: hash(reference) });
    }
    fs.writeFileSync(path.join(native, 'report.json'), JSON.stringify({ fontSha256, browser: browser.userAgent, cases }, null, 2) + '\n');
    for (const row of cases) console.log(`Bold I at ${row.size}px: ${row.passed}/64 origins byte-identical, max alpha difference ${row.maxAlpha}`);
    process.exit(cases.every(row => row.passed === row.total) ? 0 : 1);
}

const rows = [];
let browser;
for (const [sample, text] of [['origin-stem', 'I'], ['origin-curve', 'O']]) {
    for (const mode of ['fill', 'stroke-round']) {
        if (capture) {
            const debug = path.resolve(__dirname, process.argv[3] || 'native/out');
            const release = path.resolve(__dirname, process.argv[4] || 'native/out-release2');
            for (const [config, dir, target] of [['Debug', debug, 'cc2d_ttf_raster'], ['Release', release, 'cc2d_ttf_raster'],
                ['Unsnapped', release, 'cc2d_ttf_geometry_filtered']]) {
                execFileSync(path.join(dir, target + '.exe'),
                    [font, path.join(build, config + '-' + sample + '-' + mode), 'white', sample, mode], { stdio: 'inherit' });
            }
            execFileSync(process.execPath, [path.join(__dirname, 'run-ttf-raster-web.cjs'), 'white', sample, mode], { stdio: 'inherit' });
        }
        const webDir = 'ttf-raster-web-white-' + sample + (mode === 'fill' ? '' : '-' + mode);
        const metadata = JSON.parse(read(webDir + '/metadata.json'));
        assert.equal(metadata.text, text);
        assert.equal(metadata.mode, mode);
        assert.equal(metadata.color, 'white');
        assert.equal(metadata.cases.length, 16);
        browser ??= metadata.userAgent;
        assert.equal(metadata.userAgent, browser);
        for (const size of [12, 24, 36, 48]) for (const [index, style] of ['regular', 'bold', 'italic', 'bold-italic'].entries()) {
            const file = '/' + size + '-' + index + '.rgba';
            const native = read('Debug-' + sample + '-' + mode + file);
            const unsnapped = read('Unsnapped-' + sample + '-' + mode + file);
            const web = read(webDir + file);
            assert.equal(native.length, 512 * 512 * 4);
            assert.equal(web.length, native.length);
            assert.equal(unsnapped.length, native.length);
            assert.ok(native.equals(read('Release-' + sample + '-' + mode + file)), 'Debug/Release mismatch');
            const nativeMasks = [], webMasks = [];
            let passingTiles = 0, differentPixels = 0, maxAlpha = 0;
            let integerOriginMaxAlpha = 0;
            let unsnappedMaxAlpha = 0, unsnappedDifferentPixels = 0, unsnappedPassingTiles = 0;
            for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
                const a = tile(native, y, x), b = tile(web, y, x);
                const control = tile(unsnapped, y, x);
                nativeMasks.push(hash(a)); webMasks.push(hash(b));
                let different = 0, controlDifferent = 0;
                for (let i = 0; i < a.length; i++) {
                    const delta = Math.abs(a[i] - b[i]);
                    if (delta > 1) different++;
                    maxAlpha = Math.max(maxAlpha, delta);
                    if (x === 0 && y === 0) integerOriginMaxAlpha = Math.max(integerOriginMaxAlpha, delta);
                    const controlDelta = Math.abs(control[i] - b[i]);
                    if (controlDelta > 1) controlDifferent++;
                    unsnappedMaxAlpha = Math.max(unsnappedMaxAlpha, controlDelta);
                }
                differentPixels += different;
                if (!different) passingTiles++;
                unsnappedDifferentPixels += controlDifferent;
                if (!controlDifferent) unsnappedPassingTiles++;
            }
            const classes = masks => masks.map(mask => masks.indexOf(mask));
            const phasesEqual = JSON.stringify(classes(nativeMasks)) === JSON.stringify(classes(webMasks));
            rows.push({ text, mode, size, style, phasesEqual, nativeDistinctMasks: new Set(nativeMasks).size,
                webDistinctMasks: new Set(webMasks).size, passingTiles, differentPixels, maxAlpha, integerOriginMaxAlpha,
                nativeSha256: hash(native), webSha256: hash(web),
                unsnapped: { maxAlpha: unsnappedMaxAlpha, differentPixels: unsnappedDifferentPixels,
                    passingTiles: unsnappedPassingTiles, sha256: hash(unsnapped) } });
        }
    }
}
const report = { browser, fontSha256: hash(fs.readFileSync(font)),
    rendererSha256: hash(fs.readFileSync(path.join(__dirname, '../../cocos/platform/win32/modules/DirectWriteFont.cpp'))),
    tolerance: 1, originStep: 0.125, originsPerGlyph: 64, debugReleaseByteEqual: true, rows };
fs.writeFileSync(path.join(build, 'ttf-origin-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Identical origin partitions:', rows.filter(row => row.phasesEqual).length, '/', rows.length);
for (const mode of ['fill', 'stroke-round']) for (const text of ['I', 'O']) {
    for (const style of ['regular','bold','italic','bold-italic']) {
        const group = rows.filter(row => row.mode === mode && row.text === text && row.style === style);
        console.log(mode, text, style, 'pass', group.reduce((n, row) => n + row.passingTiles, 0),
            '/ 256, max alpha', Math.max(...group.map(row => row.maxAlpha)));
    }
}
