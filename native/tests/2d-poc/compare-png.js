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
const path = require('path');

function loadPngjs () {
    const local = path.join(__dirname, '../../../node_modules/pngjs');
    if (fs.existsSync(local)) {
        return require(local);
    }
    return require('pngjs');
}

const { PNG } = loadPngjs();

function readPng (file) {
    return PNG.sync.read(fs.readFileSync(file));
}

/**
 * Compare two same-size PNGs and return a report. A pixel is counted as
 * different when any RGBA channel differs by more than tolerance.
 */
function comparePng (referenceFile, actualFile, tolerance = 1) {
    const reference = readPng(referenceFile);
    const actual = readPng(actualFile);

    if (reference.width !== actual.width || reference.height !== actual.height) {
        throw new Error(`image size mismatch: ${reference.width}x${reference.height} vs ${actual.width}x${actual.height}`);
    }

    const { width, height } = reference;
    const totalPixels = width * height;
    let diffPixels = 0;
    let maxChannelDelta = 0;
    const diff = new PNG({ width, height });

    for (let i = 0; i < totalPixels; i++) {
        const offset = i * 4;
        let pixelDiff = 0;
        for (let channel = 0; channel < 4; channel++) {
            const delta = Math.abs(reference.data[offset + channel] - actual.data[offset + channel]);
            if (delta > pixelDiff) {
                pixelDiff = delta;
            }
            if (delta > maxChannelDelta) {
                maxChannelDelta = delta;
            }
        }

        if (pixelDiff > tolerance) {
            diffPixels++;
            diff.data[offset + 0] = 255;
            diff.data[offset + 1] = 0;
            diff.data[offset + 2] = 0;
            diff.data[offset + 3] = 255;
        } else {
            const grey = Math.round((actual.data[offset] + actual.data[offset + 1] + actual.data[offset + 2]) / 3);
            diff.data[offset + 0] = grey;
            diff.data[offset + 1] = grey;
            diff.data[offset + 2] = grey;
            diff.data[offset + 3] = 255;
        }
    }

    return {
        width,
        height,
        totalPixels,
        diffPixels,
        maxChannelDelta,
        tolerance,
        passed: diffPixels === 0,
        diff,
    };
}

function writeDiffPng (report, file) {
    fs.writeFileSync(file, PNG.sync.write(report.diff));
}

function main () {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('usage: compare-png.js <reference.png> <actual.png> [--tolerance N] [--diff out.png] [--fail-on-diff]');
        process.exit(2);
    }

    const referenceFile = args[0];
    const actualFile = args[1];
    let tolerance = 1;
    let diffFile = null;
    let failOnDiff = false;

    for (let i = 2; i < args.length; i++) {
        if (args[i] === '--tolerance') {
            tolerance = Number(args[++i]);
        } else if (args[i] === '--diff') {
            diffFile = args[++i];
        } else if (args[i] === '--fail-on-diff') {
            failOnDiff = true;
        } else {
            console.error(`unknown argument: ${args[i]}`);
            process.exit(2);
        }
    }

    const report = comparePng(referenceFile, actualFile, tolerance);
    if (diffFile) {
        writeDiffPng(report, diffFile);
    }

    console.log(JSON.stringify({
        reference: referenceFile,
        actual: actualFile,
        width: report.width,
        height: report.height,
        totalPixels: report.totalPixels,
        diffPixels: report.diffPixels,
        maxChannelDelta: report.maxChannelDelta,
        tolerance: report.tolerance,
        passed: report.passed,
        diffFile,
    }, null, 2));

    process.exit(failOnDiff && !report.passed ? 1 : 0);
}

if (require.main === module) {
    main();
}

module.exports = { comparePng, writeDiffPng };
