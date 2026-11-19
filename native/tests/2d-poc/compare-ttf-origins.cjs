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
