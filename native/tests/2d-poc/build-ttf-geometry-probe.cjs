'use strict';
// Compare sampling stages in source copies, without product build switches.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const output = path.resolve(process.argv[2] || path.join(__dirname, 'build/ttf-geometry'));
let source = fs.readFileSync(path.join(root, 'native/cocos/platform/win32/modules/DirectWriteFont.cpp'), 'utf8');
function replaceOnce (marker, replacement) {
    if (source.split(marker).length !== 2) throw new Error('Production source changed; review diagnostic anchor: ' + marker);
    source = source.replace(marker, replacement);
}
replaceOnce('constexpr bool SNAP_OUTLINE_EDGES = true;', 'constexpr bool SNAP_OUTLINE_EDGES = false;');
replaceOnce('constexpr bool FILTER_OUTLINE_MASK = true;', 'constexpr bool FILTER_OUTLINE_MASK = CC2D_TTF_GEOMETRY_FILTERED != 0;');
fs.mkdirSync(output, { recursive: true });
const file = path.join(output, 'DirectWriteFont-geometry.cpp');
fs.writeFileSync(file, source);
console.log(file);
