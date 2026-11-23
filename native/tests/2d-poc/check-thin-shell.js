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

function main () {
    let checks = 0;
    let failures = 0;
    const check = (condition, message) => {
        checks++;
        if (!condition) {
            failures++;
            console.log(`FAIL: ${message}`);
        }
    };

    const { build, shellHotPaths } = require('./audit-m6.cjs');
    const report = build();
    // These shared classes intentionally run the same TypeScript on Web and native.
    const shared = new Set(['UIRenderer', 'LabelOutline', 'LabelShadow']);
    for (const shell of report.classes) {
        if (shared.has(shell.name) && !shell.overridden) continue;
        const findings = report.files.find(file => file.file === shell.runtime);
        check(shell.overridden, shell.name + ' must use its native override');
        const frameMethods = findings.frameMethods.filter(method => !(shell.name === 'Graphics' && method.nativeFlush));
        check(!frameMethods.length, shell.runtime + ' implements a frame method: ' + JSON.stringify(frameMethods));
        check(!findings.allocations.length, shell.runtime + ' creates rendering data: ' + JSON.stringify(findings.allocations));
    }
    const hotPaths = shellHotPaths(report);
    check(!hotPaths.length, hotPaths.map(({ component, file }) => component + ' imports ' + file).join('\n'));
    console.log('Checked transitive 2D runtime imports for ' + report.classes.length + ' classes.');
    console.log(`${checks} checks, ${failures} failures`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
