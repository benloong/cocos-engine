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

const FILE = path.join(__dirname, '../../../cocos/2d/poc/native-2d-poc.jsb.ts');
const MAX_CODE_LINES = 200;

const FORBIDDEN_PATTERNS = [
    { pattern: /from ['"][^'"]*assembler[^'"]*['"]/, message: 'must not import assembler' },
    { pattern: /from ['"][^'"]*text-[^'"]*['"]/, message: 'must not import text layout' },
    { pattern: /from ['"][^'"]*geometry[^'"]*['"]/i, message: 'must not import geometry' },
    { pattern: /\bupdate\s*\(/, message: 'must not implement update()' },
    { pattern: /\blateUpdate\s*\(/, message: 'must not implement lateUpdate()' },
    { pattern: /\b_render\s*\(/, message: 'must not implement _render()' },
    { pattern: /\blineTo\s*\(/, message: 'must not build paths' },
    { pattern: /\bJSB\b/, message: 'must not branch on JSB inside the shell' },
];

function main () {
    const source = fs.readFileSync(FILE, 'utf8');
    const lines = source.split(/\r?\n/);

    let checks = 0;
    let failures = 0;
    const check = (condition, message) => {
        checks++;
        if (!condition) {
            failures++;
            console.log(`FAIL: ${message}`);
        }
    };

    let inBlockComment = false;
    let codeLines = 0;
    for (const line of lines) {
        const text = line.trim();
        if (text === '') continue;
        if (text.startsWith('/*')) inBlockComment = true;
        if (inBlockComment) {
            if (text.includes('*/')) inBlockComment = false;
            continue;
        }
        if (text.startsWith('//')) continue;
        codeLines++;
    }
    check(codeLines <= MAX_CODE_LINES, `shell has ${codeLines} code lines (max ${MAX_CODE_LINES}, ${lines.length} total)`);
    console.log(`shell: ${codeLines} code lines, ${lines.length} total lines`);

    for (const item of FORBIDDEN_PATTERNS) {
        check(!item.pattern.test(source), item.message);
    }

    // The shell may only define lifecycle forwarding, serialization accessors
    // and public-API pass-through. Per-frame entry points are forbidden above;
    // this also guards against accidental geometry state in JS.
    check(!/_renderData\b/.test(source), 'must not keep JS RenderData state');
    check(!/new\s+RenderData\b/.test(source), 'must not allocate JS RenderData');
    check(!/byteLength|Float32Array|Uint16Array/.test(source), 'must not build vertex buffers in JS');

    const { build, shellHotPaths } = require('./audit-m6.cjs');
    const report = build();
    const { shellSizes } = require('./measure-shell-lines.cjs');
    for (const { name, file, counted, limit } of shellSizes(report)) {
        check(counted <= limit, file + ' has ' + counted + ' lines, limit ' + limit);
        console.log(name + ': ' + counted + '/' + limit + ' lines');
    }
    const hotPaths = shellHotPaths(report);
    check(!hotPaths.length, hotPaths.map(({ component, file }) => component + ' imports ' + file).join('\n'));
    console.log('Checked transitive 2D runtime imports for ' + report.classes.length + ' classes.');
    console.log(`${checks} checks, ${failures} failures`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
