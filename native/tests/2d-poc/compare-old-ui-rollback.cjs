'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const build = path.join(__dirname, 'build');
const args = process.argv.slice(2);
const rootProbe = args[0] === '--render-root';
const probe = rootProbe ? 'old-render-root' : 'old-ui-opacity';
const markerPrefix = rootProbe ? 'M6_OLD_ROOT' : 'M6_OLD_OPACITY';
const project = path.join(build, `${probe}-project`);
const prefabId = '68eb84a9-bd0f-479b-b6ab-b82a8927d235';
const spriteFrameId = 'b730527c-3233-41c2-aaf7-7cdab58f9749@f9941';
const expected = rootProbe ? {
    'initially-disabled': [255, 0],
    both: [255, 255],
    'prefab-only': [0, 255],
    'both-disabled': [0, 0],
    're-enabled': [255, 255],
    'prefab-node-inactive': [255, 0],
    'prefab-node-active': [255, 255],
    'root-removed': [255, 0],
    'cold-reload': [255, 255],
    'final-release': [255, 0],
} : {
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
    const marker = field => [...text.matchAll(new RegExp(`${markerPrefix}_${field} (.*)$`, 'gm'))].map(match => JSON.parse(match[1]));
    assert(!text.includes(`${markerPrefix}_FAIL`), directory);
    const [done, ...others] = marker('DONE');
    assert(done && !others.length, `${directory} result missing or duplicated`);
    assert.equal(done.implementation, implementation, directory);
    assert.equal(done.prefabId, prefabId);
    assert.equal(done.spriteFrameId, spriteFrameId);
    assert.equal(done.samples.length, 31);
    assert(done.samples.every(sample => Number.isFinite(sample) && sample >= 0));
    const captures = marker('CAPTURE');
    assert.deepEqual(captures.map(capture => capture.name), Object.keys(expected), directory);
    const regions = new Map(captures.map(({ name, regions, visited }) => {
        if (rootProbe) assert.deepEqual(visited, expected[name].map(Boolean), `${directory}/${name} descendant traversal`);
        assert.equal(regions.length, 2);
        return [name, regions.map(region => {
            assert.match(region, /^[0-9a-f]{512}$/, `${directory}/${name} 8x8 RGBA readback`);
            return Buffer.from(region, 'hex');
        })];
    }));
    const fullOpacity = regions.get(rootProbe ? 'both' : 'disabled');
    const pixels = {};
    for (const [name, pair] of regions) {
        pixels[name] = pair.map((rgba, index) => {
            for (let i = 0; i < rgba.length; i += 4) {
                const full = fullOpacity[index][i + index];
                const actual = rgba[i + index];
                const baselineValid = rootProbe ? full === 121 : full >= 220 && full <= 255;
                assert(baselineValid, `${directory}/${name} old SpriteFrame coverage was ${full}`);
                const expectedChannel = full * expected[name][index] / 255;
                assert(Math.abs(actual - expectedChannel) <= (rootProbe ? 0 : 1),
                    `${directory}/${name} ${index ? 'prefab' : 'scene'} pixel ${i / 4} was ${actual}; expected ${expectedChannel}`);
                assert.equal(rgba[i + (1 - index)], 0);
                assert.equal(rgba[i + 2], 0);
                assert.equal(rgba[i + 3], 255);
            }
            return { rgba: [...rgba.subarray(0, 4)], sha256: sha(rgba) };
        });
    }
    const medianMs = [...done.samples].sort((a, b) => a - b)[15];
    const operation = rootProbe ? { disableEnablePairsPerBatch: 256 } : { settersPerBatch: 8192 };
    const traversal = rootProbe ? { traversal: Object.fromEntries(captures.map(({ name, visited }) => [name, visited])) } : {};
    return { implementation, logSha256: fileSha(log), pixels, ...traversal, benchmark: { ...operation, medianMs, samplesMs: done.samples } };
}

const web = report(`${probe}-web`, 'js');
const configurations = {};
for (const config of ['Debug', 'Release']) {
    const phases = {};
    for (const phase of ['native-before', 'js', 'native-restored']) {
        const directory = `${probe}-${config}-${phase}`;
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
fs.writeFileSync(args[rootProbe ? 1 : 0] || path.join(build, `${probe}-comparison.json`), json);
console.log(`${probe}: ${Object.keys(expected).length * 2} RGBA regions match Web in each of six Windows runs`);
