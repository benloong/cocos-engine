'use strict';
// Inject only the diagnostic bold rasterizer into a copy of the production
// implementation. Never overwrite the production source or its build outputs.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const output = path.resolve(process.argv[2] || path.join(__dirname, 'build/ttf-geometry'));
let source = fs.readFileSync(path.join(root, 'native/cocos/platform/win32/modules/DirectWriteFont.cpp'), 'utf8');
function replaceOnce (marker, replacement) {
    if (source.split(marker).length !== 2) throw new Error('Production source changed; review diagnostic anchor: ' + marker);
    source = source.replace(marker, replacement);
}
replaceOnce('#include <dwrite.h>', '#include <dwrite.h>\n#include <d2d1.h>\n#include <wincodec.h>');
replaceOnce('std::wstring wide(', `#include ${JSON.stringify(path.join(__dirname, 'ttf-geometry-probe.h').replaceAll('\\', '/'))}\nstd::wstring wide(`);
replaceOnce('if (_bold) {', 'if (false) { // Diagnostic uses the regular face outline, not DWrite bold simulation.');
// Retain the production mask preblend and compositor verbatim. Replace only
// where the mask bytes originate, so a future blend fix cannot drift here.
replaceOnce('        RECT bounds{};', '');
replaceOnce('        constexpr size_t stride = 3;', '');
replaceOnce('        const size_t rowWidth = static_cast<size_t>(bounds.right - bounds.left);',
    '        rowWidth = static_cast<size_t>(bounds.right - bounds.left);');
replaceOnce('        std::vector<uint8_t> alpha(count);', '        alpha.resize(count);');
const marker = '        ComOwner<IDWriteGlyphRunAnalysis> analysis;';
replaceOnce(marker, `        RECT bounds{};
        size_t rowWidth = 0;
        constexpr size_t stride = 3;
        std::vector<uint8_t> alpha;
        if (_bold) {
            std::vector<uint8_t> pixels;
            const auto hr = geometryProbe(run, x, y, _italic, _width, _height, pixels);
            if (FAILED(hr)) return hr;
            bounds = {0, 0, static_cast<LONG>(_width), static_cast<LONG>(_height)};
            rowWidth = _width;
            alpha.resize(pixels.size() / 4 * 3);
            for (size_t i = 0; i < pixels.size() / 4; ++i) {
                alpha[i * 3] = alpha[i * 3 + 1] = alpha[i * 3 + 2] = pixels[i * 4 + 3];
            }
        } else {
${marker}`);
replaceOnce('        const auto &preblend = coverageTable(_color);', '        }\n        const auto &preblend = coverageTable(_color);');
fs.mkdirSync(output, { recursive: true });
const file = path.join(output, 'DirectWriteFont-geometry.cpp');
fs.writeFileSync(file, source);
console.log(file);
