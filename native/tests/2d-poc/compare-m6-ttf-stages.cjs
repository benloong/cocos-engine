'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const commit = process.argv[2];
if (!/^[0-9a-f]{7,40}$/.test(commit || '')) throw new Error('Supply the benchmark checkout commit');
const out = path.join(__dirname, 'build');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const median = values => {
    const sorted = values.slice().sort((a, b) => a - b);
    return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
};
const revision = execFileSync('git', ['-C', path.join(out, 'perf-after-' + commit), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert(revision.startsWith(commit));
const roundCount = process.argv.includes('--six-rounds') ? 6 : 3;
const arms = process.argv.includes('--baseline') ? ['before', 'control', 'stages'] : ['control', 'stages'];
const sections = ['layout', 'canvasSetup', 'background', 'draw', 'readback', 'textureSetup', 'diagnostics', 'upload', 'finish'];
const glyphRuns = { empty: 0, sprites: 0, labels: 20, masks: 0, rich: 4, mixed: 24 };
const report = { revision, workloadSha256: sha(path.join(__dirname, 'm6-perf-workloads.js')), rounds: [], medians: {} };
for (let round = 1; round <= roundCount; round++) {
    const comparison = {};
    const finished = [];
    for (const kind of arms) {
        const file = path.join(out, `m6-ttf-${commit}-${round}-${kind}.json`);
        finished.push({ kind, time: fs.statSync(file).mtimeMs });
        const run = JSON.parse(fs.readFileSync(file));
        assert.equal(run.backend, 'native');
        assert.equal(run.os, 'Windows');
        report.renderer ??= run.renderer;
        assert.equal(run.renderer, report.renderer);
        assert.deepEqual(run.cases.map(c => c.name + '/' + c.phase), Object.keys(glyphRuns).flatMap(k => [k + '/steady', k + '/dirty']));
        const cases = {};
        for (const c of run.cases) {
            if (c.name === 'mixed') assert.deepEqual(c.count, [1000, 200, 50, 40]);
            assert.equal(c.samples.length, 120);
            assert.equal(c.stages.length, c.samples.length);
            for (const [i, row] of c.stages.entries()) {
                assert.equal(row.length, 3);
                assert.equal(c.samples[i].length, 3);
                assert(c.samples[i].every(n => Number.isFinite(n) && n >= 0));
                assert(row.every(n => Number.isFinite(n) && n >= 0));
                assert(Math.abs(c.samples[i][0] - row.reduce((a, b) => a + b, 0)) < 1e-6);
            }
            const summary = { cpuMs: median(c.samples.map(s => s[0])), setterMs: median(c.stages.map(s => s[0])),
                prepareMs: median(c.stages.map(s => s[1])), batchMs: median(c.stages.map(s => s[2])),
                jsbCalls: median(c.samples.map(s => s[1])), peakHeapBytes: Math.max(...c.samples.map(s => s[2])), forcedGcMs: c.forcedGcMs };
            if (kind === 'stages') {
                assert.equal(c.ttfStages.length, 120);
                for (const row of c.ttfStages) {
                    assert.equal(row.length, sections.length + 1);
                    assert(row.every(n => Number.isSafeInteger(n) && n >= 0));
                    assert.equal(row[0], c.phase === 'steady' ? 0 : glyphRuns[c.name]);
                    if (row[0] === 0) assert(row.every(n => n === 0));
                }
                summary.otherPrepareMs = median(c.ttfStages.map((row, i) =>
                    c.stages[i][1] - row.slice(1).reduce((a, b) => a + b, 0) / 1e6));
                summary.calls = median(c.ttfStages.map(row => row[0]));
                summary.ttfMs = median(c.ttfStages.map(row => row.slice(1).reduce((a, b) => a + b, 0) / 1e6));
                sections.forEach((name, i) => { summary[name] = median(c.ttfStages.map(row => row[i + 1] / 1e6)); });
            } else assert.equal(c.ttfStages, undefined);
            cases[c.name + '/' + c.phase] = summary;
        }
        comparison[kind] = { rawSha256: sha(file), cases };
    }
    comparison.completionOrder = finished.sort((a, b) => a.time - b.time).map(item => item.kind);
    report.rounds.push(comparison);
}
for (const kind of arms) {
    const bin = kind === 'before' ? 'perf-bin-before' : 'perf-bin-' + commit + (kind === 'control' ? '-ttf-control' : '');
    const binary = path.join(out, bin);
    const cases = {};
    for (const [id, sample] of Object.entries(report.rounds[0][kind].cases)) {
        cases[id] = Object.fromEntries(Object.keys(sample).map(k => [k, median(report.rounds.map(r => r[kind].cases[id][k]))]));
    }
    report.medians[kind] = { executableSha256: sha(path.join(binary, 'native-2d-m6-gpu.exe')),
        engineSha256: sha(path.join(binary, 'Resources/src/cocos-js/cc.js')), cases };
}
if (report.medians.before) {
    const prior = require('../../../docs/native-2d-m6-label-coverage-performance.json');
    assert.equal(report.workloadSha256, prior.workloadSha256);
    const baseline = prior.runs.m;
    report.runnerSha256 = sha(path.join(__dirname, 'run-m6-perf.ps1'));
    report.prepareSha256 = sha(path.join(__dirname, 'prepare-m6-perf.cjs'));
    report.probeSha256 = sha(path.join(__dirname, 'm6-perf-probe.h'));
    report.ttfTimerSha256 = sha(path.join(__dirname, 'm6-ttf-timer.h'));
    if (roundCount === 6) {
        assert.equal(new Set(report.rounds.map(r => r.completionOrder.join(','))).size, 6);
    }
    assert.equal(report.medians.before.executableSha256, baseline.exeSha256);
    assert.equal(report.medians.before.engineSha256, baseline.jsSha256);
    report.medians.before.revision = baseline.revision;
    const reference = report.medians.before.cases['mixed/dirty'].cpuMs;
    const current = report.medians.control.cases['mixed/dirty'].cpuMs;
    report.mixedDirty = { cpuReduction: 1 - current / reference, cpuBudgetMs: reference / 2,
        cpuExcessMs: current - reference / 2 };
}
assert.equal(report.medians.control.engineSha256, report.medians.stages.engineSha256);
fs.writeFileSync(path.join(out, 'm6-ttf-' + commit + '-comparison.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.medians.stages.cases['mixed/dirty']);
