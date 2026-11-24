'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const [executable, outputDirectory] = process.argv.slice(2);
if (!executable || !outputDirectory) throw new Error('Pass cc2d_ttf_raster and a new output directory');
fs.mkdirSync(outputDirectory);
const font = path.resolve(__dirname, '../../../tests/fixtures/Thonburi.ttf');
const cases = [
    ['bidi-override', 'bidi-visual'],
    ['bidi-nested', 'bidi-nested-visual'],
    ['bidi-lines', 'bidi-lines-visual'],
];
for (const [logical, visual] of cases) {
    const differences = [];
    for (const sample of [logical, visual]) {
        execFileSync(executable, [font, path.join(outputDirectory, sample), 'white', sample]);
    }
    for (const size of [12, 24, 36, 48]) {
        for (const style of [0, 1, 2]) {
            const name = size + '-' + style + '.rgba';
            const actual = fs.readFileSync(path.join(outputDirectory, logical, name));
            const expected = fs.readFileSync(path.join(outputDirectory, visual, name));
            assert.equal(actual.length, 256 * 128 * 4);
            assert.ok(actual.some((value, i) => i % 4 === 3 && value > 1), 'Missing glyphs: ' + name);
            if (!actual.equals(expected)) differences.push(name);
        }
    }
    console.log(logical + ': ' + (12 - differences.length) + '/12 exact RGBA matches');
    if (differences.length) {
        console.error('Different images: ' + differences.join(', '));
        process.exitCode = 1;
    }
}
