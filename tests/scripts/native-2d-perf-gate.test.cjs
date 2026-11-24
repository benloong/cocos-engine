'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const tool = path.join(root, 'native/tests/2d-poc/compare-m6-perf.cjs');
const build = fs.realpathSync(path.join(root, 'native/tests/2d-poc/build'));
const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
const commit = (folder, message) => execFileSync('git', ['-C', folder, '-c', 'user.name=M6 Fixture', '-c', 'user.email=m6-fixture@invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=' + path.join(folder, '.git/m6-empty-hooks'), 'commit', '--allow-empty', '-qm', message]);
function fixture (t) {
    const dir = fs.mkdtempSync(path.join(build, 'm6-perf-contract-'));
    t.after(() => {
        const resolved = fs.realpathSync(dir);
        assert.equal(path.dirname(resolved), build);
        assert.match(path.basename(resolved), /^m6-perf-contract-/);
        fs.rmSync(resolved, { recursive: true, force: true });
    });
    const init = (folder, message) => { execFileSync('git', ['init', '-q', '--template=', folder]); commit(folder, message); };
    init(path.join(dir, 'perf-before'), 'baseline');
    const checkout = path.join(dir, 'candidate'); init(checkout, 'candidate');
    const revision = execFileSync('git', ['-C', checkout, 'rev-parse', '--short=10', 'HEAD'], { encoding: 'utf8' }).trim();
    const afterCheckout = path.join(dir, 'perf-after-' + revision); fs.renameSync(checkout, afterCheckout);
    const input = (round, target) => path.join(dir, `m6-perf-gate-${revision}-${round}-${target}.json`);
    const run = (target, cpu = target === 'before' ? 10 : 4, gc = target === 'before' ? 10 : 5) => ({
        backend: 'native', renderer: 'fixture-renderer', vendor: 'fixture-vendor',
        cases: ['empty','sprites','labels','masks','rich','mixed'].flatMap(name => ['steady','dirty'].map(phase => ({
            name, phase, samples: Array.from({ length: 120 }, () => [cpu, target === 'before' ? 100 : 20, target === 'before' ? 1000 : 500]),
            stages: Array.from({ length: 120 }, () => [cpu * 0.4, cpu * 0.4, cpu * 0.2]), forcedGcMs: gc,
        }))),
    });
    for (let round = 1; round <= 6; ++round) for (const target of ['before','after']) {
        write(input(round, target), JSON.stringify(run(target)));
        const time = 1700000000 + round * 2 + (target === (round % 2 ? 'after' : 'before') ? 1 : 0);
        fs.utimesSync(input(round, target), time, time);
    }
    for (const target of ['before','after']) {
        const binary = path.join(dir, target === 'before' ? 'perf-bin-before' : 'perf-bin-full-' + revision);
        write(path.join(binary, 'native-2d-m6-gpu.exe'), target + '-fixture');
        for (const file of ['v8.dll','v8_libbase.dll','v8_libplatform.dll']) write(path.join(binary, file), 'same runtime ' + file);
        const bundle = target + '-engine';
        const project = path.join(dir, target === 'before' ? 'perf-project-before' : 'perf-project-after-' + revision, 'build/windows/data');
        write(path.join(project, 'src/cocos-js/cc.js'), bundle);
        write(path.join(project, 'main.js'), 'shared bootstrap');
        write(path.join(project, 'assets/scene.json'), 'shared scene');
        write(path.join(binary, 'Resources/src/cocos-js/cc.js'), bundle);
        write(path.join(binary, 'Resources/main.js'), target + ' instrumented entry');
        write(path.join(binary, 'Resources/assets/scene.json'), 'shared scene');
    }
    const report = path.join(dir, 'reports/result.json');
    const invoke = (extra = ['--native-only']) => spawnSync(process.execPath,
        [tool, '--gate', revision, ...extra, '--data-root', dir, '--output-file', report], { encoding: 'utf8' });
    return { dir, revision, report, input, run, invoke, afterCheckout };
}
test('Native gate works without Web files and preserves six-pair provenance', t => {
    const f = fixture(t), result = f.invoke(); assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(fs.readFileSync(f.report, 'utf8'));
    assert.deepEqual(Object.keys(report.configs), ['before', 'after']);
    assert.equal(report.rounds, 6); assert.equal(report.mixedDirtyForcedGc.pairs.length, 6);
    assert.equal(report.configs.after.rawSha256.length, 6); assert.equal(report.windowsScene.files, 1);
    assert.deepEqual(report.runOrder[0], ['before', 'after']); assert.deepEqual(report.runOrder[1], ['after', 'before']);
    assert.ok(Object.values(report.mixedDirtyTargets).every(Boolean)); assert.match(report.scope, /Native only/);
});
test('historical default comparison still requires its Web input', t => {
    const f = fixture(t), result = f.invoke([]); assert.notEqual(result.status, 0); assert.match(result.stderr, /1-web\.json/);
});
test('Native gate rejects a missing sixth paired sample', t => {
    const f = fixture(t); fs.unlinkSync(f.input(6, 'after'));
    const result = f.invoke(); assert.notEqual(result.status, 0); assert.match(result.stderr, /6-after\.json/);
});
test('Native gate retains per-stage CPU accounting checks', t => {
    const f = fixture(t), run = f.run('after'); run.cases[0].stages[0][0] += 1; write(f.input(1, 'after'), JSON.stringify(run));
    const result = f.invoke(); assert.notEqual(result.status, 0); assert.match(result.stderr, /Invalid per-stage CPU samples/);
});
test('Native gate rejects a wrong deployed engine bundle', t => {
    const f = fixture(t); write(path.join(f.dir, 'perf-bin-full-' + f.revision, 'Resources/src/cocos-js/cc.js'), 'wrong engine');
    const result = f.invoke(); assert.notEqual(result.status, 0); assert.match(result.stderr, /Wrong engine bundle/);
});
test('Native gate rejects mismatched V8 runtimes', t => {
    const f = fixture(t); write(path.join(f.dir, 'perf-bin-full-' + f.revision, 'v8.dll'), 'different runtime');
    const result = f.invoke(); assert.notEqual(result.status, 0); assert.match(result.stderr, /different renderer or V8 runtimes/);
});
test('Native gate returns failure and retains evidence when CPU misses its target', t => {
    const f = fixture(t); for (let i = 1; i <= 6; ++i) write(f.input(i, 'after'), JSON.stringify(f.run('after', 8)));
    const result = f.invoke(); assert.equal(result.status, 1); assert.match(result.stderr, /M6_PERF_GATE_FAILED cpu/);
    const report = JSON.parse(fs.readFileSync(f.report)); assert.equal(report.mixedDirtyTargets.cpu, false);
    assert.equal(report.mixedDirtyTargets.jsb, true); assert.equal(report.mixedDirtyTargets.peakJsHeap, true);
});
test('Native gate returns failure and retains evidence for a GC regression', t => {
    const f = fixture(t); for (let i = 1; i <= 6; ++i) write(f.input(i, 'after'), JSON.stringify(f.run('after', 4, 12)));
    const result = f.invoke(); assert.equal(result.status, 1); assert.match(result.stderr, /M6_PERF_GATE_FAILED forcedGc/);
    assert.equal(JSON.parse(fs.readFileSync(f.report)).mixedDirtyTargets.forcedGc, false);
});
test('Native gate checks the actual candidate checkout revision', t => {
    const f = fixture(t); commit(f.afterCheckout, 'unexpected candidate change');
    const result = f.invoke(); assert.notEqual(result.status, 0); assert.match(result.stderr, /Candidate worktree revision mismatch/);
});
test('Native gate rejects changed shared scene resources', t => {
    const f = fixture(t); write(path.join(f.dir, 'perf-bin-before/Resources/assets/scene.json'), 'other scene');
    const result = f.invoke(); assert.notEqual(result.status, 0); assert.match(result.stderr, /resource staging differs/);
});
test('Native-only is an explicit gate option and duplicate options are rejected', t => {
    const f = fixture(t), result = f.invoke(['--native-only', '--native-only']);
    assert.notEqual(result.status, 0); assert.match(result.stderr, /Duplicate option/);
    const invalid = spawnSync(process.execPath, [tool, '--paired', f.revision, '--native-only'], { encoding: 'utf8' });
    assert.notEqual(invalid.status, 0); assert.match(invalid.stderr, /Usage:/);
});
for (const exitCode of [0, 1]) {
    test('Windows Native-only runner skips Web and propagates comparator status ' + exitCode, { skip: process.platform !== 'win32' }, t => {
        const f = fixture(t), runner = path.join(f.dir, 'flow/run-m6-perf-gate.ps1');
        write(runner, fs.readFileSync(path.join(root, 'native/tests/2d-poc/run-m6-perf-gate.ps1')));
        fs.mkdirSync(path.join(f.dir, 'flow/build'), { recursive: true });
        write(path.join(f.dir, 'flow/run-m6-perf.ps1'), `param([string]$Target,[string]$ResourceTemplateDirectory,[string]$ProjectRevision,[string]$BinaryDirectory)
$ErrorActionPreference='Stop'
if($Target -eq 'web'){throw 'Unexpected Web execution'}
Add-Content (Join-Path $PSScriptRoot 'targets.txt') $Target
'{"fixture":true}' | Set-Content (Join-Path $PSScriptRoot "build/m6-perf-$Target-results.json")
exit 0
`);
        write(path.join(f.dir, 'flow/compare-m6-perf.cjs'), `require('fs').writeFileSync(process.argv[process.argv.indexOf('--output-file')+1],JSON.stringify(process.argv.slice(2)));process.exit(${exitCode});`);
        const output = path.join(f.dir, 'forwarded args.json');
        const result = spawnSync('pwsh', ['-NoProfile', '-File', runner, '-CandidateRevision', f.revision, '-NativeOnly', '-OutputFile', output], { encoding: 'utf8' });
        assert.equal(result.status, exitCode, result.stderr);
        const targets = fs.readFileSync(path.join(f.dir, 'flow/targets.txt'), 'utf8').trim().split(/\r?\n/);
        assert.deepEqual(targets, Array.from({ length: 6 }, (_, i) => i % 2 ? ['after','before'] : ['before','after']).flat());
        assert.deepEqual(JSON.parse(fs.readFileSync(output)), ['--gate', f.revision, '--native-only', '--output-file', output]);
    });
}
