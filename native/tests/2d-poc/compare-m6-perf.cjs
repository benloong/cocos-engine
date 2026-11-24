'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const args = process.argv.slice(2);
const usage = 'Usage: compare-m6-perf.cjs [--candidate commit | --paired commit | --gate commit] [--native-only] [--data-root directory] [--output-file file]';
function option (name, valueRequired) {
    const index = args.indexOf(name);
    if (index < 0) return undefined;
    const value = valueRequired ? args[index + 1] : true;
    if (valueRequired && (!value || value.startsWith('--'))) throw new Error(usage);
    args.splice(index, valueRequired ? 2 : 1);
    if (args.includes(name)) throw new Error('Duplicate option: ' + name);
    return value;
}
const nativeOnly = option('--native-only', false) === true;
const dataRoot = option('--data-root', true);
const outputFile = option('--output-file', true);
const out = dataRoot ? path.resolve(dataRoot) : path.join(__dirname, 'build');
const candidate = args[1];
const gate = args[0] === '--gate';
const paired = gate || args[0] === '--paired';
if ((args.length && (args.length !== 2 || !(paired || args[0] === '--candidate') || !(gate ? /^[0-9a-f]{10}$/ : /^[0-9a-f]{7,40}$/).test(candidate))) || (nativeOnly && !gate)) {
    throw new Error(usage);
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
const rounds = gate ? [1, 2, 3, 4, 5, 6] : [1, 2, 3];
const inputFile = (round, target) => path.join(out, `m6-perf-${gate ? 'gate' : 'paired'}-${candidate}-${round}-${target}.json`);
const configs = {};
for (const target of nativeOnly ? ['before', 'after'] : ['before', 'after', 'web']) {
    const measurements = {};
    const inputs = [];
    let renderer, vendor;
    for (const round of gate && target === 'web' ? [1] : rounds) {
        const file = paired ? inputFile(round, target)
            : path.join(out, candidate && target === 'after' ? 'm6-perf-' + series + '-' + round + '.json' : 'm6-perf-formal-' + round + '-' + target + '.json');
        const run = read(file);
        if (run.backend !== (target === 'web' ? 'web' : 'native') ||
            JSON.stringify(run.cases.map(c => c.name + '/' + c.phase)) !== JSON.stringify(expected)) throw new Error('Invalid scenario set: ' + file);
        if (gate && renderer && (renderer !== run.renderer || vendor !== run.vendor)) {
            throw new Error('Renderer changed between benchmark runs: ' + file);
        }
        renderer = run.renderer; vendor = run.vendor;
        inputs.push(digest(file));
        for (const result of run.cases) {
            if (result.samples.length !== 120 || result.samples.some(r => r.length !== 3 || r.some(x => !Number.isFinite(x) || x < 0) || !r[2])) {
                throw new Error('Invalid samples: ' + file);
            }
            if (gate && ('gcTrace' in result || !Number.isFinite(result.forcedGcMs) || result.forcedGcMs <= 0)) {
                throw new Error('Invalid untraced forced collection: ' + file);
            }
            const name = result.name + '/' + result.phase;
            const phaseMetrics = {};
            if (paired) {
                if (result.stages?.length !== result.samples.length || result.stages.some((s, i) =>
                    s.length !== 3 || s.some(x => !Number.isFinite(x) || x < 0)
                    || Math.abs(s[0] + s[1] + s[2] - result.samples[i][0]) > 1e-8)) {
                    throw new Error('Invalid per-stage CPU samples: ' + file);
                }
                ['setterMs', 'prepareMs', 'batchMs'].forEach((key, i) => {
                    phaseMetrics[key] = median(result.stages.map(s => s[i]));
                });
            }
            (measurements[name] ||= []).push({ cpuMs: median(result.samples.map(s => s[0])),
                ...phaseMetrics,
                jsbCalls: median(result.samples.map(s => s[1])), peakJsBytes: Math.max(...result.samples.map(s => s[2])),
                forcedGcMs: result.forcedGcMs });
        }
    }
    const metrics = Object.fromEntries(Object.entries(measurements).map(([id, rounds]) =>
        [id, Object.fromEntries(Object.keys(rounds[0]).map(key => [key, median(rounds.map(r => r[key]))]))]));
    const checkout = path.join(out, target === 'before' ? 'perf-before' : candidate && (target === 'after' || paired) ? 'perf-after-' + candidate : 'perf-after');
    configs[target] = { revision: execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], {encoding:'utf8'}).trim(),
        renderer, vendor, rawSha256: inputs, measurements, metrics };
    if (paired) {
        const binary = target === 'before' ? 'perf-bin-before' : (gate ? 'perf-bin-full-' : 'perf-bin-') + candidate;
        const webProject = gate ? 'perf-project-after-' + candidate : 'perf-project-after';
        const resources = path.join(out, target === 'web' ? path.join(webProject, 'build/web-mobile') : path.join(binary, 'Resources'));
        configs[target].entrySha256 = digest(path.join(resources, target === 'web' ? 'index.js' : 'main.js'));
        configs[target].engineSha256 = digest(path.join(resources, target === 'web' ? 'cocos-js/cc.js' : 'src/cocos-js/cc.js'));
        if (gate && target !== 'web') {
            const project = target === 'before' ? 'perf-project-before' : 'perf-project-after-' + candidate;
            const builtBundle = path.join(out, project, 'build/windows/data/src/cocos-js/cc.js');
            if (configs[target].engineSha256 !== digest(builtBundle)) {
                throw new Error('Wrong engine bundle in staged resources: ' + binary);
            }
        }
        if (target !== 'web') {
            configs[target].executableSha256 = digest(path.join(out, binary, 'native-2d-m6-gpu.exe'));
            if (gate) configs[target].v8Dlls = Object.fromEntries(['v8.dll', 'v8_libbase.dll', 'v8_libplatform.dll']
                .map(name => [name, digest(path.join(out, binary, name))]));
        }
    }
}
const change = {};
for (const id of expected) {
    const before = configs.before.metrics[id], after = configs.after.metrics[id];
    change[id] = Object.fromEntries(Object.keys(before).map(key => [key, before[key] === 0 ? null : 100*(1-after[key]/before[key])]));
}
const mixed = change['mixed/dirty'];
const result = { cpu: os.cpus()[0].model, os: os.version(), release: os.release(), arch: os.arch(), warmupFrames: 30,
    sampledFramesPerPhase: 120, rounds: rounds.length, configs, reductionPercent: change,
    mixedDirtyTargets: { cpu: mixed.cpuMs >= 50, jsb: mixed.jsbCalls >= 70, peakJsHeap: mixed.peakJsBytes >= 30 } };
if (candidate && !configs.after.revision.startsWith(candidate)) throw new Error('Candidate worktree revision mismatch');
if (paired) {
    result.mixedDirtyTargets.forcedGc = mixed.forcedGcMs > 0;
    result.workloadSha256 = digest(path.join(__dirname, 'm6-perf-workloads.js'));
    result.runOrder = rounds.map(round => (gate ? ['before', 'after'] : ['before', 'after', 'web']).sort((a, b) =>
        fs.statSync(inputFile(round, a)).mtimeMs - fs.statSync(inputFile(round, b)).mtimeMs));
}
if (gate) {
    const sceneFiles = folder => fs.readdirSync(folder, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => {
            const file = path.join(entry.parentPath ?? entry.path, entry.name);
            return [path.relative(folder, file).replaceAll('\\', '/'), file];
        })
        .filter(([name]) => name !== 'main.js' && !name.startsWith('src/cocos-js/'))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, file]) => [name, digest(file)]);
    const scene = sceneFiles(path.join(out, 'perf-project-before/build/windows/data'));
    for (const binary of ['perf-bin-before', 'perf-bin-full-' + candidate]) {
        if (JSON.stringify(scene) !== JSON.stringify(sceneFiles(path.join(out, binary, 'Resources')))) {
            throw new Error('Windows resource staging differs from the shared scene: ' + binary);
        }
    }
    result.windowsScene = {
        files: scene.length,
        sha256: crypto.createHash('sha256').update(JSON.stringify(scene)).digest('hex'),
        bootstrapSha256: digest(path.join(out, 'perf-project-before/build/windows/data/main.js')),
    };
    if (configs.before.renderer !== configs.after.renderer || configs.before.vendor !== configs.after.vendor ||
        JSON.stringify(configs.before.v8Dlls) !== JSON.stringify(configs.after.v8Dlls)) {
        throw new Error('Windows baseline and candidate used different renderer or V8 runtimes');
    }
    const before = configs.before.measurements['mixed/dirty'];
    const after = configs.after.measurements['mixed/dirty'];
    const pairs = before.map((row, i) => ({ beforeMs: row.forcedGcMs, afterMs: after[i].forcedGcMs }));
    result.mixedDirtyForcedGc = {
        pairs,
        improvedPairs: pairs.filter(row => row.afterMs < row.beforeMs).length,
        medianPairedDeltaMs: median(pairs.map(row => row.afterMs - row.beforeMs)),
    };
}
const output = gate ? 'm6-perf-gate-' + candidate + '-comparison.json' :
    (candidate ? 'm6-perf-' + series + '-comparison.json' : 'm6-perf-comparison.json');
if (nativeOnly) result.scope = 'Windows Native only; current Web implementation excluded';
const destination = outputFile ? path.resolve(outputFile) : path.join(out, output);
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ mixed, mixedDirtyTargets: result.mixedDirtyTargets }));

if (gate && !Object.values(result.mixedDirtyTargets).every(Boolean)) {
    console.error('M6_PERF_GATE_FAILED ' + Object.entries(result.mixedDirtyTargets).filter(([, passed]) => !passed).map(([name]) => name).join(', '));
    process.exitCode = 1;
}
