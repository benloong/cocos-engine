'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const readPhases = require('./read-m6-gc-phases.cjs');

const revision = process.argv[2];
assert.match(revision || '', /^[a-f0-9]{10}$/);
const build = path.join(__dirname, 'build');
const dir = path.join(build, 'm6-gc-foreground-mark-' + revision);
const original = path.join(build, 'm6-gc-phases-' + revision);
const read = file => fs.readFileSync(file, 'utf8');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const official = JSON.parse(read(path.join(build, 'm6-perf-' + revision, 'gate.json')));
const previous = JSON.parse(read(path.join(original, 'summary.json')));
assert(official.configs.after.revision.startsWith(revision));
assert.equal(hash(path.join(dir, 'm6-perf-workloads.js')), previous.diagnosticWorkloadSha256);
const ids = Object.keys(official.configs.after.metrics);
const fields = ['pause', 'mark', 'mark.full_closure_parallel', 'mark.full_closure', 'background.mark'];
const focus = ['labels/steady', 'mixed/dirty'];
const median = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return (sorted[(sorted.length - 1) >> 1] + sorted[sorted.length >> 1]) / 2;
};
const orders = [
    ['default-before', 'default-after', 'serial-after', 'serial-before'],
    ['default-after', 'serial-before', 'default-before', 'serial-after'],
    ['serial-before', 'serial-after', 'default-after', 'default-before'],
    ['serial-after', 'default-before', 'serial-before', 'default-after'],
];
const configs = {};
for (const kind of orders[0]) {
    const [mode, arm] = kind.split('-');
    const bin = path.join(dir, mode === 'serial' ? arm : kind);
    const executable = hash(path.join(bin, 'native-2d-m6-gpu.exe'));
    const prior = previous.configurations[arm];
    if (mode === 'default') assert.equal(executable, prior.executableSha256);
    else {
        const control = read(path.join(original, arm, 'ScriptEngine.cpp'));
        const flag = ' --no-parallel-marking --no-concurrent-marking';
        const modified = read(path.join(bin, 'ScriptEngine.cpp'));
        assert.equal(modified.split(flag).length, 2);
        assert.equal(modified.replace(flag, ''), control);
    }
    const engine = hash(path.join(bin, 'Resources/src/cocos-js/cc.js'));
    assert.equal(engine, official.configs[arm].engineSha256);
    for (const [dll, expected] of Object.entries(official.configs[arm].v8Dlls)) assert.equal(hash(path.join(bin, dll)), expected);
    configs[kind] = { revision: official.configs[arm].revision, executableSha256: executable, engineSha256: engine };
}
let lastRun = 0;
const rounds = orders.map((order, index) => {
    const round = index + 1;
    const runs = {};
    for (const kind of order) {
        const arm = kind.split('-')[1];
        const prefix = path.join(dir, round + '-' + kind);
        const resultFile = prefix + '.json';
        const time = fs.statSync(resultFile).mtimeMs;
        assert(time > lastRun, 'Unexpected launch order');
        lastRun = time;
        const result = JSON.parse(read(resultFile));
        assert.equal(result.backend, 'native');
        assert.equal(result.renderer, official.configs[arm].renderer);
        assert.equal(result.vendor, official.configs[arm].vendor);
        const log = read(prefix + '.log');
        assert.doesNotMatch(log + read(prefix + '.err'), /unrecognized flag|unknown flag/i);
        const rows = readPhases(log, result.cases, ids, fields);
        for (const id of focus) {
            const row = rows[id];
            if (kind.startsWith('serial-')) {
                assert.equal(row['background.mark'], 0);
                assert.equal(row['mark.full_closure_parallel'], 0);
                assert(row['mark.full_closure'] > 0);
            } else {
                assert(row['background.mark'] > 0);
                assert(row['mark.full_closure_parallel'] > 0);
            }
        }
        runs[kind] = { rawSha256: hash(resultFile), logSha256: hash(prefix + '.log'),
            cases: Object.fromEntries(focus.map(id => [id, rows[id]])) };
    }
    return { round, order, runs };
});
const comparison = {};
for (const id of focus) {
    const byMode = {};
    for (const mode of ['default', 'serial']) {
        const fieldSummary = {};
        for (const field of fields) {
            const values = arm => rounds.map(r => r.runs[mode + '-' + arm].cases[id][field]);
            const before = values('before');
            const after = values('after');
            fieldSummary[field] = { baselineMedianMs: median(before), candidateMedianMs: median(after),
                pairedDeltaMedianMs: median(after.map((v, i) => v - before[i])) };
        }
        byMode[mode] = fieldSummary;
    }
    comparison[id] = byMode;
}
const priorLabelSteady = previous.rounds.map(pair => {
    const metrics = {};
    for (const arm of pair.order) {
        const prefix = path.join(original, pair.round + '-' + arm);
        assert.equal(hash(prefix + '.log'), pair[arm].logSha256);
        assert.equal(hash(prefix + '.json'), pair[arm].resultSha256);
        const row = readPhases(read(prefix + '.log'), JSON.parse(read(prefix + '.json')).cases, ids, fields)['labels/steady'];
        metrics[arm] = { backgroundMarkMs: row['background.mark'], parallelClosureMs: row['mark.full_closure_parallel'] };
    }
    return { round: pair.round, ...metrics };
});
const summary = { measuredCollections: rounds.length * orders[0].length * ids.length,
    artifacts: path.relative(path.join(__dirname, '../../..'), dir).replaceAll('\\', '/'),
    method: 'Four counterbalanced launch orders. Serial disables both parallel and concurrent marking on both builds. Background timer values are not instruction counts. Forced GC acceptance uses the uninstrumented gate.',
    priorLabelSteady,
    workloadSha256: previous.diagnosticWorkloadSha256, configs, comparison, rounds };
const exclusions = path.join(dir, 'excluded.json');
if (fs.existsSync(exclusions)) {
    summary.excludedAttempts = JSON.parse(read(exclusions));
    for (const attempt of summary.excludedAttempts) {
        const log = path.join(dir, attempt.file);
        assert.equal(hash(log), attempt.sha256);
        assert(read(log).includes(attempt.message));
    }
}
fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ measuredCollections: summary.measuredCollections, comparison }));
