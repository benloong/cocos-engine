'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const revision = process.argv[2];
assert.match(revision || '', /^[a-f0-9]{10}$/);
const root = path.resolve(__dirname, '../../..');
const median = values => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return (sorted[mid] + sorted[Math.floor((sorted.length - 1) / 2)]) / 2;
};

function collections (text) {
    return text.split(/\r?\n/).filter(line => /\bgc=/.test(line)).map(line => {
        const match = /\bms: pause=([\d.]+) mutator=[\d.]+ gc=(\w+) /.exec(line);
        assert(match, 'Unrecognized GC trace event');
        const pauseMs = Number(match[1]);
        assert(Number.isFinite(pauseMs));
        return { type: match[2], pauseMs };
    });
}

function readWindow (file, expectedHash) {
    const bytes = fs.readFileSync(file);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expectedHash);
    const sections = bytes.toString('utf8').split(/M6_PERF_PHASE mixed\/steady\r?\n|M6_GC_BEGIN mixed\/dirty\r?\n|M6_PERF_PHASE mixed\/dirty\r?\n/);
    assert.equal(sections.length, 4);
    const preceding = collections(sections[1]);
    const forced = collections(sections[2]);
    assert.equal(forced.length, 1);
    assert.equal(forced[0].type, 'mc');
    const total = preceding.reduce((sum, event) => sum + event.pauseMs, forced[0].pauseMs);
    return { logSha256: expectedHash, preceding, forcedPauseMs: forced[0].pauseMs, totalPauseMs: Number(total.toFixed(1)) };
}

const batches = ['phases', 'marking-control'].map(name => {
    const source = 'docs/native-2d-m6-gc-' + name + '-' + revision + '.json';
    const manifest = JSON.parse(fs.readFileSync(path.join(root, source)));
    const rounds = manifest.rounds.map(round => {
        const pair = { round: round.round };
        for (const arm of ['before', 'after']) {
            const key = name === 'phases' ? arm : 'default-' + arm;
            const entry = (round.runs || round)[key];
            const file = path.join(root, manifest.artifacts, round.round + '-' + key + '.log');
            pair[arm] = readWindow(file, entry.logSha256);
        }
        return pair;
    });
    const summary = {};
    for (const arm of ['before', 'after']) {
        summary[arm] = { totalPauseMedianMs: median(rounds.map(pair => pair[arm].totalPauseMs)),
            forcedPauseMedianMs: median(rounds.map(pair => pair[arm].forcedPauseMs)) };
    }
    return { source, rounds, summary };
});
console.log(JSON.stringify({ revision, scope: 'Default V8 marking, from the mixed/steady completion marker through mixed/dirty completion. Totals sum V8 pause times, including collections before the forced call. Formal acceptance measures the forced call alone.', batches }, null, 2));
