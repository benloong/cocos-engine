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

#include <array>

namespace cc {

// Value data and UV algorithms, independent of assets/JSB for parity testing.
struct SpriteFrameData final {
    float x{0}, y{0}, width{0}, height{0};
    float originalWidth{0}, originalHeight{0}, offsetX{0}, offsetY{0};
    float insetLeft{0}, insetRight{0}, insetTop{0}, insetBottom{0};
    float pixelsToUnit{100}, pivotX{0.5F}, pivotY{0.5F};
    int meshType{0};
    bool rotated{false}, flipUVX{false}, flipUVY{false}, packable{true};

    void resetGeometry() {
        x = y = width = height = originalWidth = originalHeight = offsetX = offsetY = 0;
        insetLeft = insetRight = insetTop = insetBottom = 0;
        rotated = false;
    }

    std::array<float, 8> calculateUV(float textureWidth, float textureHeight) const {
        float l = textureWidth == 0 ? 0 : x / textureWidth;
        float r = textureWidth == 0 ? 1 : (x + (rotated ? height : width)) / textureWidth;
        float t = textureHeight == 0 ? 0 : y / textureHeight;
        float b = textureHeight == 0 ? 1 : (y + (rotated ? width : height)) / textureHeight;
        if (flipUVX) { const float v = l; l = r; r = v; }
        if (flipUVY) { const float v = t; t = b; b = v; }
        return rotated ? std::array<float, 8>{l, t, l, b, r, t, r, b}
                       : std::array<float, 8>{l, b, r, b, l, t, r, t};
    }

    // Row-major 4x4 grid, interleaved u/v. Matches Web uvSliced, including
    // its convention that flipUVX/Y affect quad UV only, not sliced UV.
    std::array<float, 32> calculateSlicedUV(float textureWidth, float textureHeight) const {
        const float tw = textureWidth == 0 ? 1 : textureWidth;
        const float th = textureHeight == 0 ? 1 : textureHeight;
        const std::array<float, 4> us = rotated
            ? std::array<float, 4>{x / tw, (x + insetBottom) / tw, (x + height - insetTop) / tw, (x + height) / tw}
            : std::array<float, 4>{x / tw, (x + insetLeft) / tw, (x + width - insetRight) / tw, (x + width) / tw};
        const std::array<float, 4> vs = rotated
            ? std::array<float, 4>{y / th, (y + insetLeft) / th, (y + width - insetRight) / th, (y + width) / th}
            : std::array<float, 4>{(y + height) / th, (y + height - insetBottom) / th, (y + insetTop) / th, y / th};
        std::array<float, 32> result{};
        for (int row = 0; row < 4; ++row) {
            for (int col = 0; col < 4; ++col) {
                const int i = (row * 4 + col) * 2;
                result[i] = us[rotated ? row : col];
                result[i + 1] = vs[rotated ? col : row];
            }
        }
        return result;
    }
};

} // namespace cc
