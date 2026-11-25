'use strict';

const fs = require('node:fs');
const lines = fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/);

function readMarker(name) {
    const marker = name + ' ';
    const matches = lines.filter(line => line.includes(marker));
    if (matches.length !== 1) throw new Error('Expected exactly one ' + name + ', found ' + matches.length);
    return JSON.parse(matches[0].slice(matches[0].indexOf(marker) + marker.length));
}

const screen = readMarker('M1_HIT');
const offscreen = readMarker('M1_HIT_OFFSCREEN');
const { windowId, center, outside, windowSize, projected } = screen;
const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 0.5;
const validScreen = screen.screenTarget === true && Number.isInteger(windowId) && windowId > 0;
const centerMatches = near(center.x, windowSize.width / 2) && near(center.y, windowSize.height / 2)
    && near(center.x, projected[0]) && near(center.y, projected[1]);

const checks = [
    { name: 'M1.activeWindow', passed: validScreen && centerMatches && outside.x === 10 && outside.y === 10
        && screen.hit === true && screen.miss === false, windowId, center, outside, projected, windowSize,
        screenTarget: screen.screenTarget, hit: screen.hit, miss: screen.miss },
    { name: 'M1.omittedWindow', passed: validScreen && screen.omitted === false && screen.explicitZero === false,
        windowId, omitted: screen.omitted, explicitZero: screen.explicitZero },
    { name: 'M1.wrongWindow', passed: validScreen && Number.isInteger(screen.wrongWindowId)
        && screen.wrongWindowId > 0 && screen.wrongWindowId !== windowId && screen.wrongWindow === false,
        windowId, wrongWindowId: screen.wrongWindowId, hit: screen.wrongWindow },
    { ...offscreen, name: 'M1.offscreen', passed: validScreen && offscreen.offscreenTarget === true && offscreen.windowId === windowId
        && offscreen.size[0] > 0 && offscreen.size[1] > 0
        && near(offscreen.projected[0], offscreen.size[0] / 2) && near(offscreen.projected[1], offscreen.size[1] / 2)
        && offscreen.hit === false },
];
console.log(JSON.stringify(checks, null, 2));
if (checks.some(check => !check.passed)) process.exitCode = 1;
