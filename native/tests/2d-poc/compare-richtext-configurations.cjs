'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');

const files = process.argv.slice(2);
if (files.length !== 3) throw new Error('Pass Debug, Release and ASan RichText comparison reports in order');
const reports = files.map(file => JSON.parse(fs.readFileSync(file, 'utf8')));
const reference = reports[0];
const cases = report => report.results.map(({ name, nativeSha256, webSha256, layoutEqual, max, pixels, pass }) =>
    ({ name, nativeSha256, webSha256, layoutEqual, max, pixels, pass }));

assert.deepEqual(reference.results.map(row => row.name), require('./richtext-gpu-cases.cjs').captures);
for (const report of reports) {
    assert.equal(report.snapshot, reference.snapshot);
    assert.equal(report.font.sha256, reference.font.sha256);
    assert.deepEqual(cases(report), cases(reference));
    assert.ok(report.results.every(row => row.layoutEqual));
    const state = report.font.lifecycle;
    assert.equal(state.cycles, 1000);
    assert.equal(state.cacheHits, state.cycles);
    assert.ok(Number.isInteger(state.cacheBefore));
    assert.equal(state.cacheAfter, state.cacheBefore);
    for (const outcome of ['assignmentFailureRolledBack', 'retrySucceeded', 'missingRejected', 'deferredDestroyFinished']) {
        assert.equal(state[outcome], true, outcome);
    }
}
const summary = { snapshot: reference.snapshot, font: reference.font, configs: ['Debug', 'Release', 'ASan'],
    reportHashes: files.map(file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')),
    configurationParity: true, strictWebParity: reference.pass, cases: cases(reference) };
console.log(JSON.stringify(summary, null, 2));
