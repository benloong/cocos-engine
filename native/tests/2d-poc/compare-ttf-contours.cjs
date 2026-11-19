'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const build = path.join(__dirname, 'build');
const root = path.resolve(__dirname, '../../..');
const font = path.join(root, 'tests/fixtures/Thonburi.ttf');
const capture = process.argv[2] === '--capture';
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const read = file => fs.readFileSync(path.join(build, file));
const rows = [];
for (const [sample, text] of Object.entries({ latin: 'Atlas 123', stems: 'I E L', rounds: 'O S C' })) {
    for (const mode of ['fill', 'stroke-round', 'outline']) {
        const browser = 'ttf-raster-web' + (sample === 'latin' && mode === 'fill' ? '' : '-white-' + sample + (mode === 'fill' ? '' : '-' + mode));
        if (capture) {
            for (const config of ['out', 'out-release2']) {
                const exe = path.join(__dirname, 'native', config, 'cc2d_ttf_raster.exe');
                const output = path.join(build, 'font-contour-' + config + '-' + sample + '-' + mode);
                execFileSync(exe, [font, output, 'white', sample, mode], { stdio: 'inherit' });
            }
            execFileSync(process.execPath, [path.join(__dirname, 'run-ttf-raster-web.cjs'), 'white', sample, mode], { stdio: 'inherit' });
        }
        const metadata = JSON.parse(read(browser + '/metadata.json'));
        assert.equal(metadata.text, text);
        assert.equal(metadata.color, 'white');
        assert.equal(metadata.mode, mode);
        assert.equal(metadata.cases.length, 12);
        for (const size of [12, 24, 36, 48]) for (const [style, name] of ['normal', 'bold', 'italic'].entries()) {
            const file = size + '-' + style + '.rgba';
            const native = read('font-contour-out-' + sample + '-' + mode + '/' + file);
            const release = read('font-contour-out-release2-' + sample + '-' + mode + '/' + file);
            const web = read(browser + '/' + file);
            assert.ok(native.equals(release), sample + '/' + mode + '/' + file);
            assert.equal(native.length, 256 * 128 * 4);
            assert.equal(web.length, native.length);
            let maxRgb = 0, maxAlpha = 0, differentPixels = 0, alphaError = 0, nativeInk = 0, webInk = 0;
            for (let i = 0; i < native.length; i += 4) {
                const rgb = Math.max(Math.abs(native[i] - web[i]), Math.abs(native[i + 1] - web[i + 1]),
                    Math.abs(native[i + 2] - web[i + 2]));
                const alpha = Math.abs(native[i + 3] - web[i + 3]);
                maxRgb = Math.max(maxRgb, rgb);
                maxAlpha = Math.max(maxAlpha, alpha);
                differentPixels += Math.max(rgb, alpha) > 1 ? 1 : 0;
                alphaError += alpha;
                nativeInk += Math.max(0, native[i + 3] - 1);
                webInk += Math.max(0, web[i + 3] - 1);
            }
            assert.ok(nativeInk && webInk, 'Empty glyph mask: ' + file);
            rows.push({ sample, mode, style: name, size, maxRgb, maxAlpha, differentPixels, alphaError, nativeInk, webInk,
                nativeSha256: digest(native), webSha256: digest(web) });
        }
    }
}
const report = { width: 256, height: 128, tolerance: 1, debugReleaseByteEqual: true,
    sourceSha256: digest(fs.readFileSync(path.join(root, 'native/cocos/platform/win32/modules/DirectWriteFont.cpp'))),
    fontSha256: digest(fs.readFileSync(path.join(root, 'tests/fixtures/Thonburi.ttf'))),
    browser: JSON.parse(read('ttf-raster-web/metadata.json')).userAgent, rows };
fs.writeFileSync(path.join(build, 'font-contour-report.json'), JSON.stringify(report, null, 2) + '\n');
for (const sample of ['latin', 'stems', 'rounds']) for (const mode of ['fill', 'stroke-round', 'outline']) {
    const group = rows.filter(r => r.sample === sample && r.mode === mode);
    console.log(sample, mode, 'pass', group.filter(r => r.differentPixels === 0).length + '/' + group.length,
        'different pixels', group.reduce((n, r) => n + r.differentPixels, 0), 'max alpha', Math.max(...group.map(r => r.maxAlpha)),
        'max RGB', Math.max(...group.map(r => r.maxRgb)));
}
