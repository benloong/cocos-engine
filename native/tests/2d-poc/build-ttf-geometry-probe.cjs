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
const designUnits = process.argv[3] === '--design-units';
if (designUnits) {
    // The origin grid contains one horizontal glyph per run. Request its
    // unscaled outline, then restore pixel coordinates before widening it.
    replaceOnce('ComOwner<ID2D1PathGeometry> path, stroke, united, sampled;', `DWRITE_FONT_METRICS metrics{};
        run->fontFace->GetMetrics(&metrics);
        if (run->glyphCount != 1 || run->glyphOffsets || run->isSideways || (run->bidiLevel & 1U) || !metrics.designUnitsPerEm) return E_INVALIDARG;
        ComOwner<ID2D1TransformedGeometry> path;
        ComOwner<ID2D1PathGeometry> raw, stroke, united, sampled;`);
    replaceOnce('CreatePathGeometry(path.out())', 'CreatePathGeometry(raw.out())');
    replaceOnce('hr = path->Open(sink.out())', 'hr = raw->Open(sink.out())');
    replaceOnce('GetGlyphRunOutline(run->fontEmSize, run->glyphIndices, run->glyphAdvances,',
        'GetGlyphRunOutline(metrics.designUnitsPerEm, run->glyphIndices, nullptr,');
    replaceOnce('// Italic belongs', `const float scaleToPixels = run->fontEmSize / metrics.designUnitsPerEm;
        hr = _factory->CreateTransformedGeometry(raw.get(), D2D1::Matrix3x2F::Scale(scaleToPixels, scaleToPixels), path.out());
        if (FAILED(hr)) return hr;
        // Italic belongs`);
    // For the rectangular I fixture, derive the exact miter-expanded fill
    // from its bounds. Everything after shape selection stays identical.
    replaceOnce('const float shear = italic', `ComOwner<ID2D1RectangleGeometry> rectangle;
        if (bold && lineWidth == 0 && std::getenv("CC2D_TEST_BOLD_RECTANGLE")) {
            D2D1_RECT_F box{};
            float area = 0;
            hr = path->GetBounds(nullptr, &box);
            if (SUCCEEDED(hr)) hr = path->ComputeArea(nullptr, .001F, &area);
            if (FAILED(hr) || std::fabs(area - (box.right - box.left) * (box.bottom - box.top)) > .01F) return E_INVALIDARG;
            const float half = thickness / 2;
            const auto expanded = D2D1::RectF(box.left - half, box.top - half, box.right + half, box.bottom + half);
            hr = _factory->CreateRectangleGeometry(expanded, rectangle.out());
            if (FAILED(hr)) return hr;
            shape = rectangle.get();
        }
        const float shear = italic`);
    source = '#include <cstdlib>\n' + source;
} else {
    replaceOnce('constexpr bool SNAP_OUTLINE_EDGES = true;', 'constexpr bool SNAP_OUTLINE_EDGES = false;');
    replaceOnce('constexpr bool FILTER_OUTLINE_MASK = true;', 'constexpr bool FILTER_OUTLINE_MASK = CC2D_TTF_GEOMETRY_FILTERED != 0;');
}
fs.mkdirSync(output, { recursive: true });
const file = path.join(output, designUnits ? 'DirectWriteFont-design-units.cpp' : 'DirectWriteFont-geometry.cpp');
fs.writeFileSync(file, source);
console.log(file);
