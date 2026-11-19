'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const build = path.join(__dirname, 'build');
const work = fs.mkdtempSync(path.join(build, 'stroke-tolerances-'));
const font = path.resolve(__dirname, '../../../tests/fixtures/Thonburi.ttf');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const strokeWidth = Number(process.argv[2] ?? 4);
assert.ok(Number.isFinite(strokeWidth) && strokeWidth > 0);
execFileSync(process.execPath, [path.join(__dirname, 'run-ttf-raster-web.cjs'), 'green', 'latin', 'stroke-round', String(strokeWidth)]);
const web = path.join(build, 'ttf-raster-web-green-latin-stroke-round' + (strokeWidth === 4 ? '' : '-width-' + strokeWidth));
const metadata = JSON.parse(fs.readFileSync(path.join(web, 'metadata.json')));
assert.equal(metadata.text, 'Atlas 123');
assert.equal(metadata.lineWidth, strokeWidth);
assert.equal(metadata.cases.length, 12);
const references = metadata.cases.map(({ size, style }) => {
    const file = `${size}-${style}.rgba`;
    const bytes = fs.readFileSync(path.join(web, file));
    assert.equal(bytes.length, 256 * 128 * 4);
    return { size, style, file, bytes };
});
const report = { browser: metadata.userAgent, fontSha256: hash(fs.readFileSync(font)), strokeWidth,
    cases: references.map(({ size, style, bytes }) => ({ size, style, webSha256: hash(bytes) })), configurations: {}, samples: [] };
const tolerances = [0.001, 0.01, 0.05, 0.1, 0.25];
for (const config of ['out', 'out-release2']) {
    const directory = path.join(work, config);
    fs.mkdirSync(directory);
    const binary = name => path.join(__dirname, 'native', config, name + '.exe');
    const env = { ...process.env };
    for (const key of ['CC2D_STROKE_REPLAY', 'CC2D_STROKE_BOUNDARY', 'CC2D_DIRECT_STROKE', 'CC2D_WIDEN_TOLERANCE', 'CC2D_EDGE_TOLERANCE', 'CC2D_PEN_SCALE']) delete env[key];
    function capture(name, output, overrides = {}) {
        execFileSync(binary(name), [font, output, 'green', 'latin', 'stroke-round', String(strokeWidth)],
            { cwd: directory, env: { ...env, ...overrides }, stdio: 'pipe' });
    }
    const production = path.join(directory, 'production');
    capture('cc2d_ttf_raster', production);
    report.configurations[config] = hash(fs.readFileSync(binary('cc2d_ttf_raster')));
    const samples = [];
    for (const widen of tolerances) for (const edge of tolerances) {
        const output = path.join(directory, 'candidate');
        capture('cc2d_ttf_stroke_replay', output, { CC2D_WIDEN_TOLERANCE: String(widen), CC2D_EDGE_TOLERANCE: String(edge) });
        const cases = references.map(({ file, bytes }) => {
            const actual = fs.readFileSync(path.join(output, file));
            assert.equal(actual.length, bytes.length);
            if (widen === 0.01 && edge === 0.01) assert.ok(actual.equals(fs.readFileSync(path.join(production, file))), file);
            let pixels = 0, max = 0;
            for (let i = 3; i < bytes.length; i += 4) {
                const delta = Math.abs(actual[i] - bytes[i]);
                if (delta > 1) pixels++;
                max = Math.max(delta, max);
            }
            return { pixels, max, sha256: hash(actual) };
        });
        samples.push({ widen, edge, cases });
    }
    if (!report.samples.length) report.samples = samples;
    else assert.deepEqual(samples, report.samples);
}
const output = path.join(work, 'comparison.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(output);
