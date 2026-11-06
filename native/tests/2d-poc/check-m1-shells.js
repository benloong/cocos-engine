#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const FILES = [
    { file: path.join(__dirname, '../../../cocos/2d/components/ui-opacity.jsb.ts'), max: 200 },
    { file: path.join(__dirname, '../../../cocos/2d/framework/ui-transform.jsb.ts'), max: 300 },
];
const FORBIDDEN = [
    { pattern: /\bupdate\s*\(/, message: 'must not implement update()' },
    { pattern: /\blateUpdate\s*\(/, message: 'must not implement lateUpdate()' },
    { pattern: /\b_render\s*\(/, message: 'must not implement _render()' },
    { pattern: /\bassembler\b/, message: 'must not import/use assembler' },
    { pattern: /\bRenderData\b/, message: 'must not allocate RenderData' },
    { pattern: /Float32Array|Uint16Array/, message: 'must not build vertex buffers' },
];

let checks = 0;
let failures = 0;
const check = (ok, message) => {
    checks++;
    if (!ok) {
        failures++;
        console.log(`FAIL: ${message}`);
    }
};

for (const item of FILES) {
    const source = fs.readFileSync(item.file, 'utf8');
    const lines = source.split(/\r?\n/);
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
    check(codeLines <= item.max, `${path.basename(item.file)} has ${codeLines} code lines (max ${item.max})`);
    for (const rule of FORBIDDEN) {
        check(!rule.pattern.test(source), `${path.basename(item.file)}: ${rule.message}`);
    }
    console.log(`${path.basename(item.file)}: ${codeLines} code lines`);
}

console.log(`${checks} checks, ${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
