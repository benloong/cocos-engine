'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const [debug, release, output] = process.argv.slice(2);
if (!output) throw new Error('Usage: node compare-m6-behavior.cjs <Debug stage> <Release stage> <output.json>');

// An inventory alone cannot detect the disappearance of cases without direct declarations.
const required = [
    'complex text shaping and bidi in uploaded glyph pixels',
    'bitmap font metadata reload across rotation and UV flips',
    'out-of-order imported dependencies and retired atlas owners',
    'cancel pending local native transfer and retry font import',
    'balance persistent node and dynamic scene asset references',
    'retained, pooled and collected segment wrappers across scene launches',
    'reload imported prefab and cloned frame across three scene changes',
];

function contracts(stage) {
    const report = read(path.join(stage, 'checks.json'));
    assert.equal(report.complete, true);
    assert.equal(report.passed, true);
    assert.deepEqual(report.missing, []);
    assert.deepEqual(report.unexpected, []);
    const inventory = read(path.join(stage, 'Resources/m1-m5-public-members.json'));
    const members = {};
    const cases = {};
    for (const result of report.cases) {
        assert.equal(result.passed, true, result.name);
        const key = result.owner + ': ' + result.name;
        assert(!Object.hasOwn(cases, key), 'Duplicate case ' + key);
        cases[key] = result.observed ?? true;
        for (const member of result.members) {
            const id = result.owner + '.' + member.replace(/^@/, 'static.');
            assert(!Object.hasOwn(members, id), 'Duplicate behavior for ' + id);
            members[id] = key;
        }
    }
    for (const name of required) assert(report.cases.some(c => c.name === name), 'Missing scenario ' + name);
    const declared = Object.entries(inventory).flatMap(([owner, entries]) =>
        entries.map(member => owner + '.' + (member.isStatic ? 'static.' : '') + member.key));
    assert.deepEqual(Object.keys(members).sort(), declared.sort());
    return { classes: Object.fromEntries(Object.entries(inventory).map(([name, entries]) => [name, entries.length])),
        memberCount: declared.length, caseCount: report.cases.length, members, cases };
}

const result = contracts(debug);
assert.deepEqual(contracts(release), result, 'Windows Debug and Release behavior differs');
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log('M6 Windows behavior passed: %d members, %d cases per configuration', result.memberCount, result.caseCount);
