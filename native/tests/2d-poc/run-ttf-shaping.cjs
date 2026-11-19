'use strict';

const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { compareCaptures } = require('./compare-ttf-raster.cjs');

if (process.argv.length !== 3) throw new Error('Pass the Windows cc2d_ttf_raster executable');
const exe = path.resolve(process.argv[2]);
const output = path.join(path.dirname(exe), 'ttf-shaping');
const fixtures = [
    [path.join(__dirname, '../../../tests/fixtures/Thonburi.ttf'), ['bidi-override', 'bidi-visual', 'thai-marks']],
    [path.join(process.env.WINDIR, 'Fonts', 'arial.ttf'), ['hebrew', 'arabic', 'hebrew-mixed', 'arabic-marks', 'latin-space', 'latin-kern']],
];
const comparisons = [];
const failures = [];
for (const [font, samples] of fixtures) {
    const hash = createHash('sha256').update(fs.readFileSync(font)).digest('hex');
    for (const sample of samples) {
        const native = path.join(output, sample);
        execFileSync(exe, [font, native, 'white', sample], { stdio: 'inherit' });
        execFileSync(process.execPath, [path.join(__dirname, 'run-ttf-raster-web.cjs'), 'white', sample], { stdio: 'inherit' });
        const web = path.join(__dirname, 'build/ttf-raster-web-white-' + sample);
        const result = compareCaptures(native, web);
        if (hash !== result.browser.fontSha256) throw new Error('Font mismatch for ' + sample);
        comparisons.push({ sample, ...result });
        for (const row of result.cases) {
            if (row.style !== 'bold' && !row.passed) failures.push(`${sample} ${row.size}px ${row.style}: max=${row.maxChannelDifference}`);
        }
    }
}
fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(comparisons, null, 2) + '\n');
if (failures.length) throw new Error(failures.join('\n'));
const rows = comparisons.flatMap(r => r.cases);
const bold = rows.filter(r => r.style === 'bold');
console.log(`Normal and italic shaping passed ${rows.length - bold.length} cases. Synthetic bold passed ${bold.filter(r => r.passed).length}/${bold.length}.`);
