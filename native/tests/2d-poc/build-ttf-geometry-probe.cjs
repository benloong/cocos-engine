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
} else if (process.argv[3] === '--stroke-replay') {
    source = '#include "ttf-stroke-replay.h"\n' + source;
    replaceOnce('strokePath->Widen(thickness, style.get(), nullptr, .01F, sink.get())',
        'strokePath->Widen(thickness, style.get(), nullptr, stroke_replay::tolerance("CC2D_WIDEN_TOLERANCE"), sink.get())');
    replaceOnce('SIMPLIFICATION_OPTION_LINES, &transform, .01F, adapter.get()',
        'SIMPLIFICATION_OPTION_LINES, &transform, stroke_replay::tolerance("CC2D_EDGE_TOLERANCE"), adapter.get()');
    replaceOnce('target->FillGeometry(sampled.get(), brush.get());', `if (std::getenv("CC2D_DIRECT_STROKE")) {
                target->SetTransform(transform);
                target->DrawGeometry(strokePath, brush.get(), thickness, style.get());
            } else target->FillGeometry(sampled.get(), brush.get());`);
    replaceOnce('const float shear = italic', `ComOwner<ID2D1PathGeometry> boundary;
        if (std::getenv("CC2D_STROKE_BOUNDARY")) {
            hr = _factory->CreatePathGeometry(boundary.out());
            if (SUCCEEDED(hr)) hr = boundary->Open(sink.out());
            if (SUCCEEDED(hr)) hr = shape->Outline(nullptr, .01F, sink.get());
            if (SUCCEEDED(hr)) hr = sink->Close();
            sink.reset();
            if (FAILED(hr)) return hr;
            shape = boundary.get();
        }
        const float shear = italic`);
    replaceOnce('hr = shape->Simplify', `static unsigned sequence = 0;
        const auto stem = std::to_string(++sequence);
        const char *replay = std::getenv("CC2D_STROKE_REPLAY");
        if (!replay) {
            if (lineWidth <= 0 ? !bold : join != DirectWriteFont::StrokeJoin::ROUND) return E_INVALIDARG;
            hr = stroke_replay::capture(stem + ".lines.path", shape, transform, D2D1_GEOMETRY_SIMPLIFICATION_OPTION_LINES, 0, columns * scale, rows);
            if (SUCCEEDED(hr)) hr = stroke_replay::capture(stem + ".widened.path", shape, transform, D2D1_GEOMETRY_SIMPLIFICATION_OPTION_CUBICS_AND_LINES, 0, columns * scale, rows);
            if (SUCCEEDED(hr)) hr = stroke_replay::capture(stem + ".center.path", strokePath, transform, D2D1_GEOMETRY_SIMPLIFICATION_OPTION_CUBICS_AND_LINES, thickness, columns * scale, rows);
            if (SUCCEEDED(hr) && lineWidth <= 0) hr = stroke_replay::capture(stem + ".pen.path", stroke.get(), transform, D2D1_GEOMETRY_SIMPLIFICATION_OPTION_CUBICS_AND_LINES, 0, columns * scale, rows);
            if (FAILED(hr)) return hr;
        }
        hr = shape->Simplify`);
    replaceOnce('std::vector<uint8_t> pixels(', `if (!replay && lineWidth == 0) {
            hr = stroke_replay::capture(stem + ".snapped.path", sampled.get(), D2D1::Matrix3x2F::Identity(),
                D2D1_GEOMETRY_SIMPLIFICATION_OPTION_LINES, 0, columns * scale, rows);
            if (FAILED(hr)) return hr;
        }
        std::vector<uint8_t> pixels(`);
    replaceOnce('mask.bounds = {std::max<LONG>', `if (replay && FAILED(stroke_replay::replaceAlpha(stem + "." + replay + ".alpha", pixels))) return E_FAIL;
        mask.bounds = {std::max<LONG>`);
} else {
    replaceOnce('BeginFigure(snap(point), type)', 'BeginFigure(point, type)');
    replaceOnce('const auto point = snap(points[i]);', 'const auto point = points[i];');
    replaceOnce('SnappedOutlineSink(sink.get(), bold && !italic && lineWidth <= 0)', 'SnappedOutlineSink(sink.get(), false)');
    replaceOnce('constexpr uint32_t scale = 4U;', 'constexpr uint32_t scale = CC2D_TTF_GEOMETRY_FILTERED ? 4U : 1U;');
    replaceOnce('unsigned channels[3] = {};', `if constexpr (scale == 1) {
                mask.coverage[row * maskWidth + column] = pixels[(static_cast<size_t>(row) * columns + localColumn) * 4 + 3];
                continue;
            }
            unsigned channels[3] = {};`);
}
fs.mkdirSync(output, { recursive: true });
const variant = designUnits ? 'design-units' : process.argv[3] === '--stroke-replay' ? 'stroke-replay' : 'geometry';
const file = path.join(output, 'DirectWriteFont-' + variant + '.cpp');
fs.writeFileSync(file, source);
console.log(file);
