'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const project = path.resolve(process.argv[2] || path.join(__dirname, '../../../../cocos-m1-test'));
const native = path.join(project, 'build/windows/proj/Debug/m6-bitmap-captures');
const web = path.join(__dirname, 'build/bitmap-web-captures');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const captures = [];
for (const consumer of ['bitmap', 'atlas']) for (const sampling of ['flat', 'rotated']) for (const stage of ['source', 'disabled', 'reset']) {
    const name = `${consumer}-${sampling}-${stage}`;
    const actual = fs.readFileSync(path.join(native, name + '.rgba'));
    const webName = `${consumer}-${sampling}-source`;
    const expected = fs.readFileSync(path.join(web, webName + '.rgba'));
    if (actual.length !== 262144 || expected.length !== 262144) throw new Error('Invalid RGBA size: ' + name);
    let maxDifference = 0, differingChannels = 0;
    for (let i = 0; i < actual.length; ++i) { const delta = Math.abs(actual[i] - expected[i]); maxDifference = Math.max(maxDifference, delta); if (delta) differingChannels++; }
    captures.push({ name, webName, maxDifference, differingChannels, nativeSha256: hash(actual), webSha256: hash(expected) });
}
const passed = captures.every(capture => capture.maxDifference <= 1);
fs.writeFileSync(path.join(__dirname, 'build/bitmap-gpu-comparison.json'), JSON.stringify({ tolerance: 1, passed, captures }, null, 2) + '\n');
for (const capture of captures) console.log(`${capture.name}: max=${capture.maxDifference}, channels=${capture.differingChannels}`);
if (!passed) process.exitCode = 1;
