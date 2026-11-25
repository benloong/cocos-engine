'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const [output, ...inputs] = process.argv.slice(2);
if (!output || !inputs.length) throw new Error('Usage: node check-m6-mesh-upload-audit.cjs <report.json> <audit-run.json> [...]');

const fields = [
    'drawInfos', 'checkedVertices', 'checkedIndices', 'staleBuffers', 'vertexWrites', 'indexWrites',
    'vertexBytes', 'indexBytes', 'repeatedVertices', 'repeatedIndices', 'updateNs', 'generateNs',
    'retainNs', 'appendNs', 'uploadNs', 'resetNs', 'deviceDraws', 'triangles',
];
const median = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
};
const scenes = ['empty', 'sprites', 'labels', 'masks', 'rich', 'mixed'];
const expected = scenes.flatMap(name => ['steady', 'dirty'].map(phase => name + '/' + phase));
const report = { samplesPerPhase: 120, runs: [], checkedBuffers: 0, medians: {} };
for (const file of inputs) {
    const bytes = fs.readFileSync(file);
    const raw = JSON.parse(bytes);
    assert.equal(raw.backend, 'native');
    assert.equal(raw.os, 'Windows');
    if (!report.renderer) {
        report.renderer = raw.renderer;
        report.vendor = raw.vendor;
    }
    assert.equal(raw.renderer, report.renderer);
    assert.equal(raw.vendor, report.vendor);
    assert.deepEqual(raw.cases.map(c => c.name + '/' + c.phase), expected);
    const cases = {};
    for (const c of raw.cases) {
        const key = c.name + '/' + c.phase;
        assert.equal(c.ttfStages.length, 120, key);
        const rows = c.ttfStages.map(counters => {
            assert.equal(counters.length, fields.length, key);
            assert(counters.every(x => Number.isSafeInteger(x) && x >= 0), key);
            return Object.fromEntries(fields.map((field, i) => [field, counters[i]]));
        });
        for (const row of rows) {
            assert.equal(row.staleBuffers, 0, 'Skipped buffer differs from its last upload: ' + key);
            assert.equal(row.checkedVertices + row.vertexWrites, row.drawInfos, key);
            assert.equal(row.checkedIndices + row.indexWrites, row.drawInfos, key);
            report.checkedBuffers += row.checkedVertices + row.checkedIndices;
            // All six benchmark scenes keep their topology after warmup.
            assert.equal(row.indexWrites, 0, key);
            if (c.phase === 'steady') assert.equal(row.vertexWrites + row.indexWrites, 0, key);
            if (c.name === 'mixed') {
                assert(row.drawInfos > 0 && row.drawInfos <= 341, key);
                assert(row.deviceDraws > 0 && row.deviceDraws <= 391, key);
                assert.equal(row.triangles, 2780, key);
                // One sprite page, 20 labels and at most eight rich-text segment writes.
                if (c.phase === 'dirty') assert(row.vertexWrites > 0 && row.vertexWrites <= 29, key);
            }
        }
        cases[key] = Object.fromEntries(fields.map(field => [field, median(rows.map(row => row[field]))]));
    }
    report.runs.push({ sha256: crypto.createHash('sha256').update(bytes).digest('hex'), cases });
}
for (const key of expected) {
    report.medians[key] = Object.fromEntries(fields.map(field => [field, median(report.runs.map(run => run.cases[key][field]))]));
}
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log('M6 mesh upload audit passed for ' + inputs.length + ' runs and ' + report.checkedBuffers + ' skipped buffers.');
