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
const { createReport } = require('./visual-check');

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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-2d-visual-'));
    const reference = path.join(dir, 'reference.png');
    const actual = path.join(dir, 'actual.png');
    const diff = path.join(dir, 'diff.png');

    writeSolidPng(reference, 2, 2, [10, 20, 30, 255]);
    writeSolidPng(actual, 2, 2, [10, 20, 30, 255]);

    let checks = 0;
    let failures = 0;
    const check = (condition, message) => {
        checks++;
        if (!condition) {
            failures++;
            console.log(`FAIL: ${message}`);
        }
    };

    const pass = createReport({
        reference,
        actual,
        scene: 'solid-red',
        webEngine: '4.0.0-web',
        nativeEngine: '4.0.0-native',
        tolerance: 1,
        diff,
    });
    check(pass.passed, 'identical images pass');
    check(pass.diffPixels === 0, 'no diff pixels');
    check(pass.totalPixels === 4, 'reports total pixels');
    check(pass.referenceSha256.length === 64, 'reference sha256');
    check(pass.actualSha256.length === 64, 'actual sha256');
    check(pass.scene === 'solid-red', 'keeps scene name');
    check(fs.existsSync(diff), 'writes diff image');

    writeSolidPng(actual, 2, 2, [30, 20, 30, 255]);
    const fail = createReport({
        reference,
        actual,
        tolerance: 1,
        diff: null,
    });
    check(!fail.passed, 'different images fail');
    check(fail.diffPixels === 4, 'counts diff pixels');
    check(fail.maxChannelDelta === 20, 'reports max channel delta');

    console.log(`${checks} checks, ${failures} failures`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
