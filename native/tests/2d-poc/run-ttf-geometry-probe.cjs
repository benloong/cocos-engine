'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');
const repo = path.resolve(__dirname, '../../..');
const build = path.join(__dirname, 'build');
const production = path.join(repo, 'native/cocos/platform/win32/modules/DirectWriteFont.cpp');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const before = hash(production);
const runs = [];
for (const variant of ['raster', 'geometry', 'geometry_filtered']) {
    const output = path.join(build, 'ttf-outline-' + variant);
    const release = output + '-release';
    const binaryHashes = {};
    for (const [configuration, destination] of [['out', output], ['out-release2', release]]) {
        const binary = path.join(__dirname, 'native', configuration, `cc2d_ttf_${variant}.exe`);
        execFileSync(binary, [path.join(repo, 'tests/fixtures/Thonburi.ttf'), destination]);
        binaryHashes[configuration] = hash(binary);
    }
    for (const size of [12, 24, 36, 48]) for (let style = 0; style < 3; ++style) {
        const name = `${size}-${style}.rgba`;
        if (!fs.readFileSync(path.join(output, name)).equals(fs.readFileSync(path.join(release, name)))) {
            throw new Error('Debug/Release mismatch: ' + variant + '/' + name);
        }
    }
    const compare = spawnSync(process.execPath, [path.join(__dirname, 'compare-ttf-raster.cjs'), output], { encoding: 'utf8' });
    if (![0, 1].includes(compare.status)) throw new Error(compare.stderr || 'Comparator did not execute');
    const comparison = JSON.parse(compare.stdout);
    if (comparison.cases.length !== 12) throw new Error('Incomplete raw matrix');
    runs.push({ variant, debugReleaseByteEqual: true, binaryHashes, comparisonExitCode: compare.status, comparison });
    console.log(variant + ': strict ' + comparison.passed + '/' + comparison.total);
}
if (before !== hash(production)) throw new Error('Diagnostic changed production source');
for (const run of runs.slice(1)) for (const entry of run.comparison.cases) {
    if (entry.style === 'bold') continue;
    const reference = runs[0].comparison.cases.find(item => item.size === entry.size && item.style === entry.style);
    if (reference.nativeSha256 !== entry.nativeSha256) throw new Error('Diagnostic changed a non-bold capture');
}
const generated = ['out', 'out-release2'].map(configuration => hash(path.join(__dirname, 'native', configuration, 'ttf-geometry/DirectWriteFont-geometry.cpp')));
if (generated[0] !== generated[1]) throw new Error('Generated diagnostic sources differ');
const report = {
    diagnosticOnly: true, productionUnchanged: true, nonBoldByteEqual: true, productionSourceSha256: before,
    generatorSha256: hash(path.join(__dirname, 'build-ttf-geometry-probe.cjs')),
    helperSha256: hash(path.join(__dirname, 'ttf-geometry-probe.h')),
    generatedSourceSha256: generated[0], runs,
};
fs.writeFileSync(path.join(build, 'ttf-outline-probe-results.json'), JSON.stringify(report, null, 2) + '\n');
// Running the experiment is successful even when its strict image gate fails.
// Each unmodified comparator status and full pixel result is retained above.
