'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const build = path.join(__dirname, 'build');
const result = { framesPerWindow:48, trials:3, targets:{} };
const expected = {
    empty:[0,0,0], 'graphics-one-component':[1,64,2048], 'graphics-32-components':[32,64,2048],
    'rect-mask':[3,6,6400], 'ellipse-mask':[3,66,5024], 'sprite-mask':[3,6,6400], 'nested-mask':[5,10,3600],
};
for (const [target, dir, file] of [
    ['WindowsDebug','m6-graphics-metrics-debug','graphics-metrics.json'],
    ['WindowsRelease','m6-graphics-metrics-release','graphics-metrics.json'],
    ['Web','graphics-metrics-web/results','manifest.json'],
]) {
    const raw = fs.readFileSync(path.join(build, dir, file));
    const data = JSON.parse(raw);
    assert.equal(data.backend, target === 'Web' ? 'web' : 'native');
    assert.equal(data.controlBytes, 4096);
    assert.equal(data.groups.length, Object.keys(expected).length * 3 * result.trials);
    const rows = [];
    for (const [name,[draws,triangles,area]] of Object.entries(expected)) {
        for (const phase of ['setup','steady','dirty']) {
            const samples = data.groups.filter(row => row.name === name && row.phase === phase);
            assert.deepEqual(samples.map(row => row.trial), [0,1,2]);
            for (const s of samples) {
                assert.equal(s.frames, phase === 'setup' ? 1 : result.framesPerWindow);
                assert.equal(s.draws, draws * s.frames, name);
                assert.equal(s.batches, draws * s.frames, name);
                assert.equal(s.triangles, triangles * s.frames, name);
                assert.equal(s.colored, area, name);
                assert.equal(s.uploadBytes, 0, name);
                assert.ok(Number.isFinite(s.batchNs) && s.batchNs >= 0 && Number.isFinite(s.editMs) && s.editMs >= 0);
            }
            const batchUs = samples.map(s => Number((s.batchNs / s.frames / 1000).toFixed(3)));
            const editUs = samples.map(s => Number((s.editMs * 1000 / s.frames).toFixed(3)));
            rows.push({name, phase, batchesPerFrame:draws, drawsPerFrame:draws, trianglesPerFrame:triangles, coloredPixels:area,
                uploadBytesPerWindow:0, batchUpdateUsPerFrame:batchUs, editUsPerFrame:editUs});
        }
    }
    const artifact = target === 'Web' ? path.join(build, 'graphics-metrics-web/app/cocos-js/cc.js')
        : path.join(build, dir, 'native-2d-m6-gpu.exe');
    result.targets[target] = {renderer:data.renderer, artifactSha256:createHash('sha256').update(fs.readFileSync(artifact)).digest('hex'),
        rawSha256:createHash('sha256').update(raw).digest('hex'),
        controlBytes:data.controlBytes, rows};
}
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
