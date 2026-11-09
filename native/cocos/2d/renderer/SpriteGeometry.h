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

#include <cstdint>
#include <vector>

#include "math/Geometry.h"
#include "math/Mat4.h"
#include "math/Vec2.h"
#include "math/Vec3.h"

namespace cc {

struct SpriteVertex final {
    Vec3 position;
    Vec2 uv;
};

/**
 * One quad emitted by the simple sprite mode. The order matches the JS
 * simple assembler: left-bottom, right-bottom, left-top, right-top.
 */
struct SpriteQuad final {
    SpriteVertex vertices[4];
    uint16_t indices[6]{0, 1, 2, 1, 3, 2};
    bool valid{false};
};

struct SimpleSpriteGeometryParams final {
    Vec2 contentSize{100.F, 100.F};
    Vec2 anchorPoint{0.5F, 0.5F};
    Rect frameRect;
    Vec2 originalSize;
    Vec2 offset;
    Vec2 textureSize;
    bool trim{true};
    bool rotated{false};
};

/**
 * Dynamic mesh for the multi-quad Sprite modes (sliced/tiled/filled).
 */
struct SpriteMesh final {
    std::vector<SpriteVertex> vertices;
    std::vector<uint16_t> indices;
    bool valid{false};
};

struct SlicedSpriteGeometryParams final {
    Vec2 contentSize{100.F, 100.F};
    Vec2 anchorPoint{0.5F, 0.5F};
    Rect frameRect;
    Vec2 textureSize;
    float insetLeft{0.F};
    float insetRight{0.F};
    float insetTop{0.F};
    float insetBottom{0.F};
};

/**
 * Build the 9-slice geometry for Sprite.Type.SLICED.
 *
 * Produces a 4x4 vertex grid and 9 quads (54 indices). Insets are clamped to
 * the content size so degenerate frames do not produce inverted quads.
 */
SpriteMesh buildSlicedSpriteMesh(const SlicedSpriteGeometryParams &params);

void transformSpriteMesh(SpriteMesh &mesh, const Mat4 &worldMatrix);

/**
 * Build the geometry for Sprite.Type.SIMPLE.
 *
 * Mirrors cocos/2d/assembler/sprite/simple.ts:
 * - trim = true uses the content size directly.
 * - trim = false restores the original (untrimmed) frame size from the
 *   trimmed rect and offset.
 * - rotated atlas frames get the same UV permutation as SpriteFrame.
 */
SpriteQuad buildSimpleSpriteQuad(const SimpleSpriteGeometryParams &params);

/**
 * Apply the node world matrix to the four local-space vertices.
 */
void transformSpriteQuad(SpriteQuad &quad, const Mat4 &worldMatrix);

} // namespace cc
