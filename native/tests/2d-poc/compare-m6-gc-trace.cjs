'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const directory = path.join(__dirname, 'build');
const markSweepCompact = 4;
const forced = 4;
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, file))).digest('hex');
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
    for (const target of ['before', 'after']) {
        const file = 'm6-gc-trace-' + round + '-' + target + '.json';
        const report = JSON.parse(fs.readFileSync(path.join(directory, file)));
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
const configurations = {
    before: { revision: '7e83734299', executableSha256: hash('perf-bin-gc-trace-before/native-2d-m6-gpu.exe') },
    after: { revision: '76b9679ae9', executableSha256: hash('perf-bin-gc-trace-after/native-2d-m6-gpu.exe') },
};
for (const target of ['before', 'after']) {
    configurations[target].v8Dlls = Object.fromEntries(['v8.dll', 'v8_libbase.dll', 'v8_libplatform.dll'].map(file =>
        [file, hash('perf-bin-gc-trace-' + target + '/' + file)]));
}
const result = { configurations, workloadSha256: hash('../m6-perf-workloads.js'), rounds: rounds.map(({ before, after, ...meta }) => ({
    ...meta,
    before: { rawSha256: before.rawSha256, mixedDirty: before.cases[11] },
    after: { rawSha256: after.rawSha256, mixedDirty: after.cases[11] },
})), cases };
fs.writeFileSync(path.join(directory, 'm6-gc-trace-summary.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(cases['mixed/dirty']));
