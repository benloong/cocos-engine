'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const revision = process.argv[2];
assert.match(revision || '', /^[a-f0-9]{10}$/, 'Supply a ten-character candidate revision');
const build = path.join(__dirname, 'build');
const dir = path.join(build, 'm6-gc-phases-' + revision);
const official = JSON.parse(fs.readFileSync(path.join(build, 'm6-perf-' + revision, 'gate.json')));
assert(official.configs.after.revision.startsWith(revision));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ids = Object.keys(official.configs.after.metrics);
const fields = ['pause', 'mark', 'mark.roots', 'mark.full_closure_parallel', 'mark.ephemeron.marking',
    'evacuate', 'evacuate.copy', 'evacuate.update_pointers', 'sweep', 'heap.external.weak_global_handles'];
const median = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return (sorted[(sorted.length - 1) >> 1] + sorted[sorted.length >> 1]) / 2;
};

function measuredPhases (log, cases) {
    const rows = {};
    let active = null;
    let entry;
    for (const line of log.split(/\r?\n/)) {
        const begin = /M6_GC_BEGIN (\w+\/\w+)$/.exec(line);
        const end = /M6_PERF_PHASE (\w+\/\w+)$/.exec(line);
        if (begin) {
            assert.equal(active, null);
            active = begin[1];
            entry = null;
        } else if (end) {
            assert.equal(end[1], active);
            assert.ok(entry, 'Missing major collection for ' + active);
            assert(!Object.hasOwn(rows, active));
            rows[active] = entry;
            active = null;
        } else if (active && line.includes(' gc=mc ')) {
            assert.equal(entry, null, 'Multiple major collections for ' + active);
            entry = {};
            const metrics = Object.fromEntries([...line.matchAll(/ ([\w.]+)=([\d.]+)(?=\s|$)/g)].map(m => [m[1], Number(m[2])]));
            for (const field of [...fields, 'total_size_before', 'total_size_after']) {
                assert(Number.isFinite(metrics[field]) && metrics[field] >= 0, 'Invalid ' + active + '/' + field);
                entry[field] = metrics[field];
            }
        }
    }
    assert.equal(active, null);
    assert.deepEqual(Object.keys(rows), ids);
    assert.deepEqual(cases.map(c => c.name + '/' + c.phase), ids);
    for (const c of cases) {
        assert.equal(c.samples.length, 120);
        assert.equal(c.gcTrace.events.filter(e => e.type === 4 && (e.flags & 4)).length, 1);
    }
    return rows;
}

const rounds = [];
const samples = { before: [], after: [] };
const configurations = {};
const workload = fs.readFileSync(path.join(__dirname, 'm6-perf-workloads.js'), 'utf8');
const instrumented = fs.readFileSync(path.join(dir, 'm6-perf-workloads.js'), 'utf8');
assert.equal(instrumented.replace(/ +console\.log\('M6_GC_BEGIN ' \+ name \+ '\/' \+ phase\);\r?\n/, ''), workload);
assert.equal(hash(path.join(__dirname, 'm6-perf-workloads.js')), official.workloadSha256);
for (const arm of Object.keys(samples)) {
    const bin = path.join(dir, arm);
    const traceBuild = arm === 'before' ? path.join(build, 'perf-bin-gc-trace-before') : path.join(build, 'm6-gc-trace-' + revision, 'bin');
    const bundle = hash(path.join(bin, 'Resources/src/cocos-js/cc.js'));
    assert.equal(bundle, official.configs[arm].engineSha256);
    for (const [dll, digest] of Object.entries(official.configs[arm].v8Dlls)) assert.equal(hash(path.join(bin, dll)), digest);
    configurations[arm] = { revision: official.configs[arm].revision, engineSha256: bundle,
        executableSha256: hash(path.join(bin, 'native-2d-m6-gpu.exe')),
        engineLibrarySha256: hash(path.join(traceBuild, 'cocos_engine.lib')),
        diagnosticScriptEngineSha256: hash(path.join(bin, 'ScriptEngine.cpp')) };
}
let previous = 0;
for (let round = 1; round <= 6; ++round) {
    const order = round % 2 ? ['before', 'after'] : ['after', 'before'];
    const pair = { round, order };
    for (const arm of order) {
        const prefix = path.join(dir, round + '-' + arm);
        const finished = fs.statSync(prefix + '.json').mtimeMs;
        assert(finished > previous, 'Unexpected run order');
        previous = finished;
        const result = JSON.parse(fs.readFileSync(prefix + '.json'));
        assert.equal(result.backend, 'native');
        assert.equal(result.renderer, official.configs[arm].renderer);
        assert.equal(result.vendor, official.configs[arm].vendor);
        const phases = measuredPhases(fs.readFileSync(prefix + '.log', 'utf8'), result.cases);
        samples[arm].push(phases);
        pair[arm] = { resultSha256: hash(prefix + '.json'), logSha256: hash(prefix + '.log'), mixedDirty: phases['mixed/dirty'] };
    }
    rounds.push(pair);
}
const mixedDirty = Object.fromEntries(Object.entries(samples).map(([arm, phases]) => [arm,
    Object.fromEntries(fields.map(field => [field, median(phases.map(p => p['mixed/dirty'][field]))]))]));
const pairedDeltaMs = Object.fromEntries(fields.map(field => [field, median(rounds.map(pair =>
    pair.after.mixedDirty[field] - pair.before.mixedDirty[field]))]));
const pairsByFirstRun = Object.fromEntries(Object.keys(configurations).map(first => {
    const pairs = rounds.filter(pair => pair.order[0] === first);
    return [first, {
        rounds: pairs.map(pair => pair.round),
        medianPairedDeltaMs: Object.fromEntries(['pause', 'mark', 'evacuate', 'sweep'].map(field =>
            [field, median(pairs.map(pair => pair.after.mixedDirty[field] - pair.before.mixedDirty[field]))])),
    }];
}));
const summary = { configurations, workloadSha256: official.workloadSha256, diagnosticWorkloadSha256: hash(path.join(dir, 'm6-perf-workloads.js')),
    artifacts: path.relative(path.join(__dirname, '../../..'), dir).replaceAll('\\', '/'),
    measuredCollections: rounds.length * 2 * ids.length,
    method: 'V8 trace-gc-nvp internal pause and phase timers in milliseconds. Stages can nest. Callback wall times include verbose output. Official forced GC gate remains separate.',
    mixedDirty, pairedDeltaMs, pairsByFirstRun, rounds };
summary.parallelMarkByWorkload = Object.fromEntries(ids.map(id => {
    const delta = samples.after.map((run, i) => run[id]['mark.full_closure_parallel'] - samples.before[i][id]['mark.full_closure_parallel']);
    return [id, {
        afterMinusBeforeMs: delta,
        slowerPairs: delta.filter(ms => ms > 0).length,
        baselineFirstMedianMs: median(delta.filter((_, i) => rounds[i].order[0] === 'before')),
        candidateFirstMedianMs: median(delta.filter((_, i) => rounds[i].order[0] === 'after')),
    }];
}));
fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ collections: summary.measuredCollections, mixedDirty }));
