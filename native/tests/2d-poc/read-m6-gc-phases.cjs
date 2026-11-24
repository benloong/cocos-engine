'use strict';

const assert = require('node:assert/strict');

function measuredPhases (log, cases, ids, fields) {
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

module.exports = measuredPhases;
