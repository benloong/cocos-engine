'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const out = path.join(__dirname, 'build');
const candidate = process.argv[3];
if (process.argv.length > 2 && (process.argv.length !== 4 || process.argv[2] !== '--candidate' || !/^[0-9a-f]{7,40}$/.test(candidate))) {
    throw new Error('Usage: compare-m6-perf.cjs [--candidate commit]');
}
// The first frozen candidate used the original pages series file names.
const series = candidate === 'cfe140f062' ? 'pages' : candidate;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const median = values => {
    const copy = values.slice().sort((a,b) => a-b);
    const mid = Math.floor(copy.length / 2);
    return copy.length % 2 ? copy[mid] : (copy[mid-1] + copy[mid]) / 2;
};
const expected = ['empty', 'sprites', 'labels', 'masks', 'rich', 'mixed'].flatMap(name => ['steady', 'dirty'].map(phase => name + '/' + phase));
const configs = {};
for (const target of ['before', 'after', 'web']) {
    const measurements = {};
    const inputs = [];
    let renderer, vendor;
    for (const round of [1,2,3]) {
        const file = path.join(out, candidate && target === 'after' ? 'm6-perf-' + series + '-' + round + '.json' : 'm6-perf-formal-' + round + '-' + target + '.json');
        const run = read(file);
        if (run.backend !== (target === 'web' ? 'web' : 'native') ||
            JSON.stringify(run.cases.map(c => c.name + '/' + c.phase)) !== JSON.stringify(expected)) throw new Error('Invalid scenario set: ' + file);
        renderer = run.renderer; vendor = run.vendor;
        inputs.push(digest(file));
        for (const result of run.cases) {
            if (result.samples.length !== 120 || result.samples.some(r => r.length !== 3 || r.some(x => !Number.isFinite(x) || x < 0) || !r[2])) {
                throw new Error('Invalid samples: ' + file);
            }
            const name = result.name + '/' + result.phase;
            (measurements[name] ||= []).push({ cpuMs: median(result.samples.map(s => s[0])),
                jsbCalls: median(result.samples.map(s => s[1])), peakJsBytes: Math.max(...result.samples.map(s => s[2])),
                forcedGcMs: result.forcedGcMs });
        }
    }
    const metrics = Object.fromEntries(Object.entries(measurements).map(([id, rounds]) =>
        [id, Object.fromEntries(Object.keys(rounds[0]).map(key => [key, median(rounds.map(r => r[key]))]))]));
    const checkout = path.join(out, target === 'before' ? 'perf-before' : candidate && target === 'after' ? 'perf-after-' + candidate : 'perf-after');
    configs[target] = { revision: execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], {encoding:'utf8'}).trim(),
        renderer, vendor, rawSha256: inputs, measurements, metrics };
}
const change = {};
for (const id of expected) {
    const before = configs.before.metrics[id], after = configs.after.metrics[id];
    change[id] = Object.fromEntries(Object.keys(before).map(key => [key, before[key] === 0 ? null : 100*(1-after[key]/before[key])]));
}
const mixed = change['mixed/dirty'];
const result = { cpu: os.cpus()[0].model, os: os.version(), release: os.release(), arch: os.arch(), warmupFrames: 30,
    sampledFramesPerPhase: 120, rounds: 3, configs, reductionPercent: change,
    mixedDirtyTargets: { cpu: mixed.cpuMs >= 50, jsb: mixed.jsbCalls >= 70, peakJsHeap: mixed.peakJsBytes >= 30 } };
if (candidate && !configs.after.revision.startsWith(candidate)) throw new Error('Candidate worktree revision mismatch');
fs.writeFileSync(path.join(out, candidate ? 'm6-perf-' + series + '-comparison.json' : 'm6-perf-comparison.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ mixed, mixedDirtyTargets: result.mixedDirtyTargets }));
