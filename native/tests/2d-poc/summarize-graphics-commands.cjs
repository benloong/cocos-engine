'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const build = path.join(__dirname, 'build');
const webDir = path.join(build, 'graphics-command-web/results');
const web = JSON.parse(fs.readFileSync(path.join(webDir, 'manifest.json')));
assert.equal(web.backend, 'web');
const expected = ['rect','path'].flatMap(shape => [1,32,256].map(count => shape + '-' + count));
assert.deepEqual(web.captures, expected);
const report = {framesPerWindow:24, trials:3, pixelHashes:{}, configurations:{}};
for (const config of ['debug','release']) {
    const dir = path.join(build, 'm6-graphics-metrics-' + config);
    const raw = fs.readFileSync(path.join(dir, 'graphics-command.json'));
    const data = JSON.parse(raw);
    const hash = input => createHash('sha256').update(input).digest('hex');
    assert.equal(data.backend, 'native');
    assert.deepEqual(data.captures, expected);
    assert.equal(data.groups.length, 54);
    const rows = [];
    for (const name of expected) {
        const pixels = fs.readFileSync(path.join(dir, 'graphics-command.json-' + name + '.rgba'));
        assert.equal(pixels.length, 256*256*4);
        assert.ok(pixels.equals(fs.readFileSync(path.join(webDir, name+'.rgba'))), name);
        report.pixelHashes[name] = hash(pixels);
        const [shape, size] = name.split('-');
        const count = Number(size);
        for (const mode of ['direct','new-buffer','reused-buffer']) {
            const groups = data.groups.filter(g => g.shape === shape && g.count === count && g.mode === mode);
            assert.deepEqual(groups.map(g => g.trial), [0,1,2]);
            const calls = mode === 'direct' ? (shape === 'rect' ? 1 : 5)*count+2 : 3;
            const stagingBytes = count*(shape === 'rect' ? 5 : 13)*8;
            for (const g of groups) {
                assert.equal(g.frames, 24);
                assert.equal(g.commandCalls, calls);
                assert.equal(g.newBufferBytesPerFrame, mode === 'new-buffer' ? stagingBytes : 0);
                const [frames,batches,ns,uploads,draws,tris] = g.metrics;
                assert.deepEqual([frames,batches,uploads,draws,tris], [24,24,0,24,48*count]);
                assert.ok(Number.isFinite(ns) && ns > 0 && Number.isFinite(g.cpuNs) && g.cpuNs > 0);
                if (config === 'debug') assert.ok(g.allocs > 0 && g.bytes > 0);
            }
            const perFrame = (fn, divisor=1) => groups.map(g => Number((fn(g)/g.frames/divisor).toFixed(3)));
            const row = {name,mode,callsPerFrame:calls,submitUs:perFrame(g=>g.cpuNs,1000),batchUs:perFrame(g=>g.metrics[2],1000),
                stagingBytes:mode === 'direct' ? 0 : stagingBytes,newBufferBytesPerFrame:groups[0].newBufferBytesPerFrame};
            if (config === 'debug') {
                row.crtAllocations = perFrame(g=>g.allocs);
                row.crtAllocatedBytes = perFrame(g=>g.bytes);
            }
            rows.push(row);
        }
    }
    report.configurations[config] = {rawSha256:hash(raw),binarySha256:hash(fs.readFileSync(path.join(dir,'native-2d-m6-gpu.exe'))),rows};
}
process.stdout.write(JSON.stringify(report,null,2)+'\n');
