'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const build = path.join(__dirname, 'build');
const project = path.join(build, 'old-ui-opacity-project');
const prefabId = '68eb84a9-bd0f-479b-b6ab-b82a8927d235';
const spriteFrameId = 'b730527c-3233-41c2-aaf7-7cdab58f9749@f9941';
const expected = {
    serialized: [128, 128],
    independent: [64, 192],
    disabled: [255, 255],
    're-enabled': [64, 192],
    clamped: [0, 255],
    'disabled-on-attach': [128, 255],
    'enabled-after-attach': [128, 128],
    'component-removed': [128, 255],
    'cold-reload': [128, 128],
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fileSha = file => sha(fs.readFileSync(file));

function report (directory, implementation) {
    const log = path.join(build, directory, 'console.log');
    const text = fs.readFileSync(log, 'utf8');
    const marker = field => [...text.matchAll(new RegExp(`M6_OLD_OPACITY_${field} (.*)$`, 'gm'))].map(match => JSON.parse(match[1]));
    assert(!text.includes('M6_OLD_OPACITY_FAIL'), directory);
    const [done, ...others] = marker('DONE');
    assert(done && !others.length, `${directory} result missing or duplicated`);
    assert.equal(done.implementation, implementation, directory);
    assert.equal(done.prefabId, prefabId);
    assert.equal(done.spriteFrameId, spriteFrameId);
    assert.equal(done.samples.length, 31);
    assert(done.samples.every(sample => Number.isFinite(sample) && sample >= 0));
    const captures = marker('CAPTURE');
    assert.deepEqual(captures.map(capture => capture.name), Object.keys(expected), directory);
    const regions = new Map(captures.map(({ name, regions }) => {
        assert.equal(regions.length, 2);
        return [name, regions.map(region => {
            assert.match(region, /^[0-9a-f]{512}$/, `${directory}/${name} 8x8 RGBA readback`);
            return Buffer.from(region, 'hex');
        })];
    }));
    const fullOpacity = regions.get('disabled');
    const pixels = {};
    for (const [name, pair] of regions) {
        pixels[name] = pair.map((rgba, index) => {
            for (let i = 0; i < rgba.length; i += 4) {
                const full = fullOpacity[index][i + index];
                const actual = rgba[i + index];
                assert(full >= 220 && full <= 255, `${directory}/${name} old SpriteFrame was not drawn`);
                assert(Math.abs(actual - full * expected[name][index] / 255) <= 1,
                    `${directory}/${name} ${index ? 'prefab' : 'scene'} pixel ${i / 4} was ${actual}; expected opacity ${expected[name][index]} over ${full}`);
                assert.equal(rgba[i + (1 - index)], 0);
                assert.equal(rgba[i + 2], 0);
                assert.equal(rgba[i + 3], 255);
            }
            return { rgba: [...rgba.subarray(0, 4)], sha256: sha(rgba) };
        });
    }
    const medianMs = [...done.samples].sort((a, b) => a - b)[15];
    return { implementation, logSha256: fileSha(log), pixels, benchmark: { settersPerBatch: 8192, medianMs, samplesMs: done.samples } };
}

const web = report('old-ui-opacity-web', 'js');
const configurations = {};
for (const config of ['Debug', 'Release']) {
    const phases = {};
    for (const phase of ['native-before', 'js', 'native-restored']) {
        const directory = `old-ui-opacity-${config}-${phase}`;
        const result = report(directory, phase === 'js' ? 'js' : 'native');
        assert.deepEqual(result.pixels, web.pixels, `${config}/${phase} pixel regions differ from Web`);
        const identities = JSON.parse(fs.readFileSync(path.join(build, directory, 'build-identities.json'), 'utf8'));
        phases[phase] = { ...identities, implementation: result.implementation, logSha256: result.logSha256, benchmark: result.benchmark };
    }
    const initial = phases['native-before'];
    for (const phase of Object.values(phases)) assert.equal(phase.executableSha256, initial.executableSha256);
    assert.equal(phases['native-restored'].engineSha256, initial.engineSha256);
    assert.notEqual(phases.js.engineSha256, initial.engineSha256);
    configurations[config] = phases;
}

const inputs = Object.fromEntries(['assets/scenes/m1-test.scene', 'assets/resources/M1Prefab.prefab', 'assets/resources/M1Prefab.prefab.meta',
    'settings/v2/packages/engine.json', 'assets/scripts/M1Test.ts'].map(file => [file, fileSha(path.join(project, file))]));
const result = { prefabId, spriteFrameId, inputs, web, configurations };
const json = JSON.stringify(result, null, 2) + '\n';
fs.writeFileSync(process.argv[2] || path.join(build, 'old-ui-opacity-comparison.json'), json);
console.log('Old UIOpacity: 18 RGBA regions match Web in each of six Windows runs');
