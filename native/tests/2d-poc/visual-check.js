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

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { comparePng, writeDiffPng } = require('./compare-png');

function sha256 (file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function createReport (options) {
    const report = comparePng(options.reference, options.actual, options.tolerance);
    const result = {
        scene: options.scene || '',
        reference: options.reference,
        referenceSha256: sha256(options.reference),
        actual: options.actual,
        actualSha256: sha256(options.actual),
        webEngine: options.webEngine || '',
        nativeEngine: options.nativeEngine || '',
        width: report.width,
        height: report.height,
        totalPixels: report.totalPixels,
        diffPixels: report.diffPixels,
        maxChannelDelta: report.maxChannelDelta,
        tolerance: report.tolerance,
        passed: report.passed,
        diffImage: options.diff || null,
    };
    if (options.diff) {
        writeDiffPng(report, options.diff);
    }
    return result;
}

function main () {
    const args = process.argv.slice(2);
    const options = {
        reference: null,
        actual: null,
        scene: '',
        webEngine: '',
        nativeEngine: '',
        tolerance: 1,
        diff: null,
        out: null,
        failOnDiff: false,
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
        case '--reference': options.reference = args[++i]; break;
        case '--actual': options.actual = args[++i]; break;
        case '--scene': options.scene = args[++i]; break;
        case '--web-engine': options.webEngine = args[++i]; break;
        case '--native-engine': options.nativeEngine = args[++i]; break;
        case '--tolerance': options.tolerance = Number(args[++i]); break;
        case '--diff': options.diff = args[++i]; break;
        case '--out': options.out = args[++i]; break;
        case '--fail-on-diff': options.failOnDiff = true; break;
        default:
            console.error(`unknown argument: ${args[i]}`);
            process.exit(2);
        }
    }

    if (!options.reference || !options.actual) {
        console.error('usage: visual-check.js --reference ref.png --actual actual.png [--scene name] [--web-engine ver] [--native-engine ver] [--tolerance N] [--diff diff.png] [--out report.json] [--fail-on-diff]');
        process.exit(2);
    }

    const report = createReport(options);
    const json = JSON.stringify(report, null, 2);
    console.log(json);
    if (options.out) {
        fs.mkdirSync(path.dirname(options.out), { recursive: true });
        fs.writeFileSync(options.out, json);
    }
    process.exit(options.failOnDiff && !report.passed ? 1 : 0);
}

if (require.main === module) {
    main();
}

module.exports = { createReport };
