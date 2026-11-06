#!/usr/bin/env node
/*
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function loadPngjs () {
    const local = path.join(__dirname, '../../../node_modules/pngjs');
    if (fs.existsSync(local)) {
        return require(local);
    }
    return require('pngjs');
}

const { PNG } = loadPngjs();
const { comparePng } = require('./compare-png');

function writeSolidPng (file, width, height, rgba) {
    const png = new PNG({ width, height });
    for (let i = 0; i < width * height; i++) {
        const offset = i * 4;
        png.data[offset + 0] = rgba[0];
        png.data[offset + 1] = rgba[1];
        png.data[offset + 2] = rgba[2];
        png.data[offset + 3] = rgba[3];
    }
    fs.writeFileSync(file, PNG.sync.write(png));
}

function main () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-2d-poc-png-'));
    const reference = path.join(dir, 'reference.png');
    const same = path.join(dir, 'same.png');
    const tolerant = path.join(dir, 'tolerant.png');
    const different = path.join(dir, 'different.png');

    writeSolidPng(reference, 2, 2, [10, 20, 30, 255]);
    writeSolidPng(same, 2, 2, [10, 20, 30, 255]);
    writeSolidPng(tolerant, 2, 2, [11, 21, 31, 255]);
    writeSolidPng(different, 2, 2, [20, 30, 40, 255]);

    let checks = 0;
    let failures = 0;
    const check = (condition, message) => {
        checks++;
        if (!condition) {
            failures++;
            console.log(`FAIL: ${message}`);
        }
    };

    const identical = comparePng(reference, same, 1);
    check(identical.passed, 'identical images pass');
    check(identical.diffPixels === 0, 'identical images have no diff pixels');

    const withinTolerance = comparePng(reference, tolerant, 1);
    check(withinTolerance.passed, 'channel delta 1 passes tolerance 1');
    check(withinTolerance.maxChannelDelta === 1, 'max channel delta is 1');

    const outsideTolerance = comparePng(reference, different, 1);
    check(!outsideTolerance.passed, 'channel delta 10 fails tolerance 1');
    check(outsideTolerance.diffPixels === 4, 'all four pixels differ');
    check(outsideTolerance.maxChannelDelta === 10, 'max channel delta is 10');

    console.log(`${checks} checks, ${failures} failures`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
