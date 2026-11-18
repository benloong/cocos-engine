/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

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
****************************************************************************/
#pragma once
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <string>
#include <unordered_map>
#include <vector>

namespace cc {
struct BitmapLayoutOptions {
    double width{0}, height{0}, fontSize{16}, sourceFontSize{16}, lineHeight{16}, spacing{0};
    int overflow{0}, horizontal{0}, vertical{0};
    bool wrap{false};
};
struct BitmapGlyphPlacement {
    size_t glyph{0};
    double x{0}, y{0}, u{0}, v{0}, width{0}, height{0}; // top-left position; source-pixel rectangle
};
struct BitmapFrameRect {
    double x{0}, y{0}, width{0}, height{0}, originalWidth{0}, originalHeight{0}, offsetX{0}, offsetY{0};
    double textureWidth{0}, textureHeight{0};
    bool rotated{false};
};
struct BitmapGlyphVertex { double x{0}, y{0}, u{0}, v{0}; };
struct BitmapGlyphQuad {
    BitmapGlyphPlacement source;
    std::array<BitmapGlyphVertex, 4> vertices;
};
// Value result only. Frame and glyph inputs remain owned by their assets/layout.
inline BitmapGlyphQuad buildBitmapGlyphQuad(const BitmapGlyphPlacement &placement, double scale, const BitmapFrameRect &frame) {
    BitmapGlyphQuad out; out.source = placement;
    auto &rect = out.source;
    const double trimmedLeft = frame.offsetX + (frame.originalWidth - frame.width) * .5;
    const double trimmedTop = frame.offsetY - (frame.originalHeight - frame.height) * .5;
    if (frame.rotated) {
        rect.u = frame.x + frame.height - placement.v - placement.height - trimmedTop;
        rect.v = placement.u + frame.y - trimmedLeft;
        // Web determines the rect after its initial positive-height check.
        if (rect.v < 0) rect.height += trimmedTop;
    } else {
        rect.u += frame.x - trimmedLeft;
        rect.v += frame.y + trimmedTop;
    }
    if (!(frame.textureWidth > 0 && frame.textureHeight > 0)) return out;
    const double left = rect.u / frame.textureWidth, top = rect.v / frame.textureHeight;
    const double right = (rect.u + (frame.rotated ? rect.height : rect.width)) / frame.textureWidth;
    const double bottom = (rect.v + (frame.rotated ? rect.width : rect.height)) / frame.textureHeight;
    const double x = placement.x, y = placement.y, width = rect.width * scale, height = rect.height * scale;
    if (frame.rotated) {
        out.vertices = {{{x, y - height, left, top}, {x + width, y - height, left, bottom},
                         {x, y, right, top}, {x + width, y, right, bottom}}};
    } else {
        out.vertices = {{{x, y - height, left, bottom}, {x + width, y - height, right, bottom},
                         {x, y, left, top}, {x + width, y, right, top}}};
    }
    return out;
}
struct BitmapLayoutResult {
    double width{0}, height{0}, actualFontSize{0}, scale{1};
    std::vector<double> lineWidths;
    std::vector<BitmapGlyphPlacement> glyphs;
};
inline bool bitmapUnicodeSpace(int32_t c) {
    return (c >= 9 && c <= 13) || c == 32 || c == 133 || c == 160 || c == 5760 ||
        (c >= 8192 && c <= 8202) || c == 8232 || c == 8233 || c == 8239 || c == 8287 || c == 12288;
}
inline bool bitmapUnicodeCJK(int32_t c) {
    return (c >= 0x3400 && c <= 0x9fff) || (c >= 0x3000 && c <= 0x30ff) ||
        (c >= 0xff00 && c <= 0xffef) || (c >= 0x1100 && c <= 0x11ff) ||
        (c >= 0x3130 && c <= 0x318f) || (c >= 0xa960 && c <= 0xa97f) ||
        (c >= 0xac00 && c <= 0xd7ff) || (c >= 0x2605 && c <= 0x2606) ||
        (c >= 0x2190 && c <= 0x2195) || c == 0x203b;
}
// All inputs are borrowed for this call. The result owns positions and source rectangles.
// Mirrors the BMFont branch of Web TextProcessing, including its glyph-center horizontal clamp.
template<class Glyph>
BitmapLayoutResult layoutBitmapFont(const std::vector<int32_t> &text, const std::vector<Glyph> &glyphs,
    const std::unordered_map<int32_t, size_t> &glyphMap, const std::unordered_map<uint64_t, float> &kernings,
    const BitmapLayoutOptions &o) {
    BitmapLayoutResult out;
    out.actualFontSize = o.fontSize;
    if (!(o.sourceFontSize > 0) || !std::isfinite(o.fontSize)) return out;
    const double fixedWidth = o.overflow == 0 ? 0 : o.width;
    const double fixedHeight = o.overflow == 0 || o.overflow == 3 ? 0 : o.height;
    const bool wrapping = o.overflow == 0 ? false : (o.overflow == 3 || o.wrap);
    struct Letter { size_t glyph{0}, line{0}; double x{0}, y{0}; bool valid{false}; };
    std::vector<Letter> letters(text.size());
    double desiredHeight = 0, highest = 0, lowest = 0;
    auto find = [&](size_t i) -> const Glyph * {
        const auto it = glyphMap.find(text[i]); return it == glyphMap.end() ? nullptr : &glyphs[it->second];
    };
    auto kern = [&](size_t i) -> double {
        // Web horizontalKerning stores zero for the final character.
        if (i + 2 >= text.size()) return 0;
        const uint64_t key = (static_cast<uint64_t>(static_cast<uint32_t>(text[i])) << 32U) | static_cast<uint32_t>(text[i + 1]);
        const auto it = kernings.find(key); return it == kernings.end() ? 0 : it->second;
    };
    auto compose = [&]() {
        out.scale = out.actualFontSize / o.sourceFontSize;
        const double scale = out.scale;
        const double lineStep = o.lineHeight * (o.overflow == 2 ? scale : 1);
        out.lineWidths.clear(); std::fill(letters.begin(), letters.end(), Letter{});
        size_t line = 0; double nextX = 0, nextY = 0, right = 0, longest = 0;
        highest = lowest = 0;
        for (size_t i = 0; i < text.size();) {
            if (text[i] == '\n') { out.lineWidths.push_back(right); right = 0; ++line; nextX = 0; nextY -= lineStep; ++i; continue; }
            size_t length = 1;
            if (!bitmapUnicodeCJK(text[i]) && !bitmapUnicodeSpace(text[i])) {
                if (const auto *first = find(i)) {
                    double advance = first->xAdvance * scale + o.spacing;
                    for (size_t j = i + 1; j < text.size(); ++j) {
                        const auto *g = find(j); if (!g) break;
                        if (fixedWidth > 0 && advance + (g->offsetX + g->w) * scale > fixedWidth && !bitmapUnicodeSpace(text[j])) break;
                        advance += g->xAdvance * scale + o.spacing;
                        if (bitmapUnicodeCJK(text[j]) || bitmapUnicodeSpace(text[j])) break;
                        ++length;
                    }
                }
            }
            double tokenHigh = highest, tokenLow = lowest, tokenRight = right, cursor = nextX;
            bool newLine = false;
            for (size_t j = i; j < i + length; ++j) {
                if (text[j] == '\r') continue;
                const auto *g = find(j); if (!g) continue;
                const double x = cursor + g->offsetX * scale;
                if (wrapping && fixedWidth > 0 && nextX > 0 && x + g->w * scale > fixedWidth && !bitmapUnicodeSpace(text[j])) {
                    out.lineWidths.push_back(right); right = 0; ++line; nextX = 0; nextY -= lineStep; newLine = true; break;
                }
                const double y = nextY - g->offsetY * scale;
                letters[j] = {glyphMap.at(text[j]), line, x, y, true};
                cursor += (g->xAdvance + kern(j)) * scale + o.spacing;
                tokenRight = x + g->w * scale;
                tokenHigh = std::max(tokenHigh, y); tokenLow = std::min(tokenLow, y - g->h * scale);
            }
            if (newLine) continue;
            nextX = cursor; right = tokenRight;
            highest = std::max(highest, tokenHigh); lowest = std::min(lowest, tokenLow);
            longest = std::max(longest, right); i += length;
        }
        out.lineWidths.push_back(right);
        desiredHeight = (line + 1) * lineStep;
        out.width = fixedWidth > 0 ? fixedWidth : std::round(longest * 100) / 100;
        out.height = fixedHeight > 0 ? fixedHeight : std::round(desiredHeight * 100) / 100;
    };
    auto horizontalClamp = [&]() {
        if (fixedWidth <= 0) return false;
        for (const auto &l : letters) if (l.valid) {
            const double right = l.x + glyphs[l.glyph].w * out.scale;
            if ((!wrapping && right > out.width) || (wrapping && out.lineWidths[l.line] > out.width && (right > out.width || right < 0))) return true;
        }
        return false;
    };
    auto shrink = [&](bool vertical) {
        // ECMAScript ToInt32 used by Web fontSize | 0; avoid an out-of-range C++ cast.
        double bound = std::fmod(std::trunc(out.actualFontSize), 4294967296.0);
        if (bound >= 2147483648.0) bound -= 4294967296.0;
        if (bound < -2147483648.0) bound += 4294967296.0;
        int left = 0, right = static_cast<int32_t>(bound);
        while (left < right) {
            const uint32_t sum = static_cast<uint32_t>(left) + static_cast<uint32_t>(right) + 1U;
            const int64_t signedSum = sum >= 2147483648U ? static_cast<int64_t>(sum) - 4294967296LL : sum;
            const int mid = static_cast<int>(signedSum >= 0 ? signedSum / 2 : -((-signedSum + 1) / 2));
            if (mid <= 0) break;
            out.actualFontSize = mid; compose();
            if (vertical ? desiredHeight > out.height : horizontalClamp()) right = mid - 1; else left = mid;
        }
        if (left > 0) { out.actualFontSize = left; compose(); }
        else out.actualFontSize = .1; // Web keeps the last composition when zero cannot fit.
    };
    compose();
    if (o.overflow == 2 && o.fontSize > 0) {
        if (desiredHeight > out.height) shrink(true);
        if (std::any_of(out.lineWidths.begin(), out.lineWidths.end(), [&](double w) { return w > out.width; })) shrink(false);
    }
    const double lineStep = o.lineHeight * (o.overflow == 2 ? out.scale : 1);
    const double blank = out.height - desiredHeight + lineStep - o.sourceFontSize * out.scale;
    const double offsetY = o.vertical == 0 ? 0 : -(o.vertical == 2 ? blank : blank * .5);
    const double topLimit = out.height + std::max(highest, 0.0);
    const double bottomLimit = lowest < -desiredHeight ? desiredHeight + lowest : 0;
    for (const auto &l : letters) if (l.valid) {
        const auto &g = glyphs[l.glyph];
        const double offsetX = o.horizontal == 0 ? 0 : (out.width - out.lineWidths[l.line]) * (o.horizontal == 2 ? 1 : .5);
        double y = l.y + out.height + offsetY, v = g.v, h = g.h, w = g.w;
        if (fixedHeight > 0) {
            if (y > topLimit) { const double clip = y - topLimit; v += clip; h -= clip; y -= clip; }
            if (y - h * out.scale < bottomLimit && o.overflow == 1) h = y < bottomLimit ? 0 : (y - bottomLimit) / out.scale;
        }
        const double center = l.x + g.w * .5 * out.scale + offsetX;
        if (fixedWidth > 0 && (center > out.width || center < 0) && (!wrapping || out.lineWidths[l.line] > out.width) && o.overflow == 1) w = 0;
        if (h > 0 && w > 0) out.glyphs.push_back({l.glyph, l.x + offsetX, y - out.height, g.u, v, w, h});
    }
    return out;
}
} // namespace cc
