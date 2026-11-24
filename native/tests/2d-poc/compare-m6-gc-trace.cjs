'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const candidate = process.argv[2];
if (candidate !== undefined && !/^[a-f0-9]{10}$/.test(candidate)) throw new Error('Expected a ten-character candidate revision');
const build = path.join(__dirname, 'build');
const directory = candidate ? path.join(build, 'm6-gc-trace-' + candidate) : build;
const markSweepCompact = 4;
const forced = 4;
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const gate = candidate ? JSON.parse(fs.readFileSync(path.join(build, 'm6-perf-' + candidate, 'gate.json'))) : null;
const forcedMajorGc = event => event.type === markSweepCompact && (event.flags & forced);
const median = values => {
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = sorted.length >> 1;
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const ids = ['empty', 'sprites', 'labels', 'masks', 'rich', 'mixed'].flatMap(name =>
    ['steady', 'dirty'].map(phase => name + '/' + phase));
const rounds = Array.from({ length: 6 }, (_, i) => {
    const round = i + 1;
    const data = { round, order: round % 2 ? ['before', 'after'] : ['after', 'before'] };
    const completed = {};
    for (const target of ['before', 'after']) {
        const file = path.join(directory, 'm6-gc-trace-' + round + '-' + target + '.json');
        const report = JSON.parse(fs.readFileSync(file));
        completed[target] = fs.statSync(file).mtimeMs;
        if (gate) {
            assert.equal(report.renderer, gate.configs[target].renderer);
            assert.equal(report.vendor, gate.configs[target].vendor);
        }
        assert.equal(report.backend, 'native');
        assert.deepEqual(report.cases.map(row => row.name + '/' + row.phase), ids);
        data[target] = { rawSha256: hash(file), cases: [] };
        for (const row of report.cases) {
            assert.equal(row.samples.length, 120);
            const trace = row.gcTrace;
            assert.ok(trace.usedBefore >= 0 && trace.usedAfter >= 0, file);
            assert.ok(trace.wrappersBefore >= 0 && trace.wrappersAfter >= 0, file);
            assert.equal(trace.wallMs, row.forcedGcMs, file);
            assert.ok(trace.events.every(event => Number.isInteger(event.type) && Number.isInteger(event.flags)
                && Number.isFinite(event.ms) && event.ms >= 0 && event.ms <= trace.wallMs), file);
            const major = trace.events.filter(forcedMajorGc);
            assert.equal(major.length, 1, file + ' must contain one forced major GC per workload phase');
            data[target].cases.push({ name: row.name + '/' + row.phase, ...trace });
        }
    }
    if (candidate) assert(completed[data.order[0]] < completed[data.order[1]], 'Wrong launch order in pair ' + round);
    return data;
});
const cases = Object.fromEntries(ids.map((id, i) => {
    const row = {};
    for (const target of ['before', 'after']) {
        const samples = rounds.map(round => round[target].cases[i]);
        const major = sample => sample.events.find(forcedMajorGc).ms;
        row[target] = {
            wallMs: median(samples.map(sample => sample.wallMs)),
            majorMs: median(samples.map(major)),
            outsideMajorMs: median(samples.map(sample => sample.wallMs - major(sample))),
            usedAfter: median(samples.map(sample => sample.usedAfter)),
            wrappersAfter: median(samples.map(sample => sample.wrappersAfter)),
        };
    }
    return [id, row];
}));
const configurations = {};
for (const target of ['before', 'after']) {
    const binary = candidate && target === 'after' ? path.join(directory, 'bin') : path.join(build, 'perf-bin-gc-trace-' + target);
    const revision = target === 'before' ? '7e83734299' : candidate || '76b9679ae9';
    const config = {
        revision,
        executableSha256: hash(path.join(binary, 'native-2d-m6-gpu.exe')),
        v8Dlls: Object.fromEntries(['v8.dll', 'v8_libbase.dll', 'v8_libplatform.dll'].map(file => [file, hash(path.join(binary, file))])),
    };
    configurations[target] = config;
    if (gate) {
        config.engineSha256 = hash(path.join(binary, 'Resources/src/cocos-js/cc.js'));
        assert.equal(config.engineSha256, gate.configs[target].engineSha256);
        assert.deepEqual(config.v8Dlls, gate.configs[target].v8Dlls);
        assert(gate.configs[target].revision.startsWith(revision));
        if (target === 'after') {
            const checkout = path.join(directory, 'build', 'perf-after-' + revision);
            assert.equal(execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), gate.configs.after.revision);
        } else {
            const prior = require('../../../docs/native-2d-m6-gc-trace.json');
            assert.equal(config.executableSha256, prior.configurations.before.executableSha256);
        }
    }
}
const workloadSha256 = hash(path.join(candidate ? directory : __dirname, 'm6-perf-workloads.js'));
if (gate) assert.equal(workloadSha256, gate.workloadSha256);
const result = { configurations, workloadSha256, rounds: rounds.map(({ before, after, ...meta }) => ({
    ...meta,
    before: { rawSha256: before.rawSha256, mixedDirty: before.cases[11] },
    after: { rawSha256: after.rawSha256, mixedDirty: after.cases[11] },
})), cases };
if (gate) {
    const mixed = result.rounds.map(round => ({
        before: round.before.mixedDirty,
        after: round.after.mixedDirty,
    }));
    const deltas = mixed.map(({ before, after }) => after.wallMs - before.wallMs);
    result.mixedDirty = {
        formalGateReportSha256: hash(path.join(build, 'm6-perf-' + candidate, 'gate.json')),
        formalGatePassed: gate.mixedDirtyTargets.forcedGc,
        formalMedianPairedDeltaMs: gate.mixedDirtyForcedGc.medianPairedDeltaMs,
        tracedMedianPairedDeltaMs: median(deltas),
        tracedImprovedPairs: deltas.filter(delta => delta < 0).length,
    };
    for (const target of ['before', 'after']) {
        result.mixedDirty[target] = {
            formalWallMs: gate.configs[target].metrics['mixed/dirty'].forcedGcMs,
            tracedWallMs: cases['mixed/dirty'][target].wallMs,
            medianReclaimedHeapBytes: median(mixed.map(row => row[target].usedBefore - row[target].usedAfter)),
            medianRemovedWrapperMappings: median(mixed.map(row => row[target].wrappersBefore - row[target].wrappersAfter)),
        };
    }
}
fs.writeFileSync(path.join(directory, 'm6-gc-trace-summary.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(cases['mixed/dirty']));
