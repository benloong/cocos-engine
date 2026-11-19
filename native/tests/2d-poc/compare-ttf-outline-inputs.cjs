'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const build = path.join(__dirname, 'build');
const font = path.resolve(__dirname, '../../../tests/fixtures/Thonburi.ttf');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const capture = process.argv.includes('--capture');

function captureNative(config, control, sample, mode) {
    const env = { ...process.env };
    delete env.CC2D_TEST_BOLD_RECTANGLE;
    if (control === 'rectangle') env.CC2D_TEST_BOLD_RECTANGLE = '1';
    const binary = control === 'raster' ? 'cc2d_ttf_raster.exe' : 'cc2d_ttf_design_units.exe';
    const directory = path.join(build, ['em', config, control, sample, mode].join('-'));
    if (capture) execFileSync(path.join(__dirname, 'native', config, binary),
        [font, directory, 'white', sample, mode], { env, stdio: 'inherit' });
    return directory;
}

function compare(a, b) {
    assert.equal(a.length, 512 * 512 * 4);
    assert.equal(b.length, a.length);
    let max = 0, pixelsOverTolerance = 0, inkPixels = 0;
    const integerOriginRows = new Set();
    for (let i = 0; i < a.length; i += 4) {
        let delta = 0;
        for (let channel = 0; channel < 4; ++channel) delta = Math.max(delta, Math.abs(a[i + channel] - b[i + channel]));
        max = Math.max(max, delta);
        if (a[i + 3] > 1) ++inkPixels;
        if (delta > 1) {
            ++pixelsOverTolerance;
            const y = Math.floor(i / (512 * 4));
            if (y < 64 && (i / 4) % 512 < 64) integerOriginRows.add(y);
        }
    }
    assert.ok(inkPixels, 'Empty native glyph mask');
    return { max, pixelsOverTolerance, integerOriginRows: [...integerOriginRows] };
}

const rows = [];
let browser;
for (const [sample, glyph] of [['origin-stem', 'I'], ['origin-curve', 'O']]) {
    for (const mode of ['fill', 'stroke-round']) {
        if (capture) execFileSync(process.execPath, [path.join(__dirname, 'run-ttf-raster-web.cjs'), 'white', sample, mode], { stdio: 'inherit' });
        const web = path.join(build, 'ttf-raster-web-white-' + sample + (mode === 'fill' ? '' : '-' + mode));
        const metadata = JSON.parse(fs.readFileSync(path.join(web, 'metadata.json')));
        assert.equal(metadata.text, glyph);
        assert.equal(metadata.mode, mode);
        assert.equal(metadata.color, 'white');
        assert.equal(metadata.cases.length, 16);
        browser ??= metadata.userAgent;
        assert.equal(metadata.userAgent, browser);
        const controls = ['raster', 'design_units'];
        if (glyph === 'I' && mode === 'fill') controls.push('rectangle');
        const dirs = controls.map(control => ['out', 'out-release2'].map(config => captureNative(config, control, sample, mode)));
        for (const size of [12, 24, 36, 48]) for (const [index, style] of ['regular', 'bold', 'italic', 'bold-italic'].entries()) {
            const file = size + '-' + index + '.rgba';
            const expected = fs.readFileSync(path.join(web, file));
            const images = dirs.map(([debug, release]) => {
                const image = fs.readFileSync(path.join(debug, file));
                assert.ok(image.equals(fs.readFileSync(path.join(release, file))), 'Debug/Release mismatch: ' + debug + '/' + file);
                return image;
            });
            const row = { glyph, mode, size, style, webHash: hash(expected), controls: {} };
            controls.forEach((control, i) => {
                row.controls[control] = { hash: hash(images[i]), vsWeb: compare(images[i], expected) };
            });
            rows.push(row);
        }
    }
}
const renderer = path.resolve(__dirname, '../../cocos/platform/win32/modules/DirectWriteFont.cpp');
const report = { browser, fontSha256: hash(fs.readFileSync(font)), rendererSha256: hash(fs.readFileSync(renderer)),
    tolerance: 1, originsPerImage: 64, debugReleaseIdentical: true, rows };
fs.writeFileSync(path.join(build, 'ttf-outline-inputs.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Design-unit and pixel-size masks identical:', rows.filter(row => row.controls.raster.hash === row.controls.design_units.hash).length, '/', rows.length);
