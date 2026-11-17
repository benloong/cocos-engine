'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '../../..');
const native = path.resolve(process.argv[2] || path.join(__dirname, 'build/ttf-raster-native'));
const web = path.resolve(process.argv[3] || path.join(__dirname, 'build/ttf-raster-web'));
const metadata = JSON.parse(fs.readFileSync(path.join(web, 'metadata.json'), 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const cases = [];
for (const size of [12, 24, 36, 48]) for (let style = 0; style < 3; ++style) {
    const name = `${size}-${style}.rgba`;
    const a = fs.readFileSync(path.join(native, name));
    const b = fs.readFileSync(path.join(web, name));
    if (a.length !== 256 * 128 * 4 || b.length !== a.length) throw new Error('Invalid capture dimensions: ' + name);
    let maxChannelDifference = 0, differentPixels = 0, nativeCoverage = 0, webCoverage = 0;
    for (let i = 0; i < a.length; i += 4) {
        let different = false;
        for (let c = 0; c < 4; ++c) {
            const delta = Math.abs(a[i + c] - b[i + c]);
            maxChannelDifference = Math.max(maxChannelDifference, delta);
            different ||= delta > 1;
        }
        if (different) ++differentPixels;
        nativeCoverage += Math.max(0, a[i + 3] - 1);
        webCoverage += Math.max(0, b[i + 3] - 1);
    }
    if (!nativeCoverage || !webCoverage) throw new Error('Empty glyph capture: ' + name);
    cases.push({ size, style: ['normal', 'bold', 'italic'][style], maxChannelDifference, differentPixels,
        nativeCoverage, webCoverage, coverageRatio: nativeCoverage / webCoverage,
        nativeSha256: hash(path.join(native, name)), webSha256: hash(path.join(web, name)),
        passed: maxChannelDifference <= 1 });
}
const result = {
    diagnosticOnly: true, width: 256, height: 128, text: metadata.text || 'Atlas 123',
    browser: metadata,
    nativeDirectory: path.basename(native),
    sourceSha256: hash(path.join(root, 'native/cocos/platform/win32/modules/DirectWriteFont.cpp')),
    fontSha256: hash(path.join(root, 'tests/fixtures/Thonburi.ttf')),
    // Hashes describe files at comparison time; this diagnostic does not prove
    // binary/source freshness or replace the full application's snapshot gate.
    cases, passed: cases.filter(item => item.passed).length, total: cases.length,
};
const file = path.join(__dirname, 'build', path.basename(native) + '-comparison.json');
fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.passed === result.total ? 0 : 1;
