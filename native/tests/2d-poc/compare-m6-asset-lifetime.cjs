'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const dir = path.join(__dirname, 'build');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = { windows: {} };
function cycles (run) {
    assert.deepEqual(run.result, { cycles: 1000, checkedAssets: 5000, pixelChecks: 22 });
    assert.equal(run.samples.length, 11);
    for (const [index, sample] of run.samples.entries()) {
        assert.equal(sample.cycle, index * 100);
        assert.equal(sample.wrappers, index === 0 ? 0 : 500);
        assert.ok(sample.liveWrappers <= 5);
    }
}
for (const [config, folder] of Object.entries({ Debug: 'm6-asset-debug-v8-runs', Release: 'm6-asset-release-runs',
    ASan: 'm6-asset-project-asan-runs', CRT: 'm6-asset-crt-v8-runs', snapshots: 'm6-native-crt-snapshots' })) {
    const runDir = path.join(dir, folder);
    const file = fs.readdirSync(runDir).filter(n => /^\d.*(?<!\.v8)\.json$/.test(n)).sort().at(-1);
    const run = read(path.join(runDir, file));
    assert.equal(run.passed, true); cycles(run);
    const stdout = fs.readFileSync(run.stdout, 'utf8');
    const stderr = fs.readFileSync(run.stderr, 'utf8');
    if (config === 'ASan') {
        assert.equal(stderr.trim(), '');
        assert.doesNotMatch(stdout, /ERROR: AddressSanitizer|SUMMARY: AddressSanitizer/);
    }
    const item = { appSha256: run.appSha256, scenarioSha256: run.scenarioSha256, result: run.result,
        samples: run.samples, stdoutSha256: sha(run.stdout), stderrBytes: fs.statSync(run.stderr).size };
    const v8File = path.join(runDir, file.replace(/\.json$/, '.v8.json'));
    if (fs.existsSync(v8File)) {
        item.v8 = read(v8File); assert.equal(item.v8.length, 11);
        item.v8.forEach((s,i) => { assert.equal(s.cycle, i*100); assert.ok(s.usedSize > 0); });
        if (config === 'CRT') {
            for (const s of item.v8) assert.ok(s.nativeCrtBytes > 0 && s.nativeCrtBlocks > 0);
            for (const metric of ['nativeCrtBytes','nativeCrtBlocks']) {
                assert.ok(item.v8.at(-1)[metric] <= Math.max(...item.v8.slice(1,-1).map(s => s[metric])));
            }
        }
    }
    report.windows[config] = item;
}
const web = read(path.join(dir,'static-atlas-heap/manifest.json'));
cycles(web);
report.web = { result: web.result, samples: web.samples };
for (const [backend, folder, diff] of [['windows','m6-native-crt-snapshots','m6-native-crt-snapshots/diff.json'],
    ['web','static-atlas-heap','m6-current-web-heap-diff.json']]) {
    const heap = read(path.join(dir,diff));
    const manifest = read(path.join(dir,folder,'manifest.json'));
    const snapshots = manifest.snapshots.map(s => ({ cycle: s.cycle, sha256: sha(path.join(dir,folder,s.file)) }));
    let retainedRenderers;
    if (backend === 'web') {
        retainedRenderers = read(path.join(dir,'m6-render-retainers.json'));
        const byId = new Map(retainedRenderers.map(object => [object.id, object]));
        function attached (object) {
            return object && object.name === 'RenderData' && object.owners.length > 0 && object.owners.every(owner =>
                owner.label === '_renderData' && ['Label','Sprite'].includes(owner.name)
                    && owner.chain?.at(-1)?.type === 'Scene' && owner.chain.at(-1).name === 'm1-test');
        }
        for (const object of retainedRenderers) {
            if (object.name === 'RenderData') assert.ok(attached(object), 'Detached RenderData');
            else assert.ok(object.name === 'StaticVBChunk' && object.owners.length > 0 && object.owners.every(owner =>
                owner.label === 'chunk' && attached(byId.get(owner.id))), 'Detached StaticVBChunk');
        }
    }
    for (const row of heap.assetCounts) {
        if (row.countDelta > 0) {
            const live = retainedRenderers?.filter(object => 'object:' + object.name === row.key);
            assert.ok(live && live.length >= row.countDelta, backend + ': unexplained growth in ' + row.key);
        }
    }
    report[backend].heap = { snapshots, retainedRenderers, totalSelfBytesDelta: heap.totalSelfBytesDelta,
        codeBytesDelta: heap.byType.find(row => row.key === 'code').selfBytesDelta, assetCounts: heap.assetCounts };
}
fs.writeFileSync(path.join(dir,'m6-asset-lifetime.json'), JSON.stringify(report,null,2) + '\n');
console.log('M6_ASSET_LIFETIME_READY');
