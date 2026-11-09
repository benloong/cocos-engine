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

#include "2d/renderer/SpriteGeometry.h"

#include <algorithm>

namespace cc {

SpriteQuad buildSimpleSpriteQuad(const SimpleSpriteGeometryParams &params) {
    SpriteQuad quad;

    const float cw = params.contentSize.x;
    const float ch = params.contentSize.y;
    const float appX = params.anchorPoint.x * cw;
    const float appY = params.anchorPoint.y * ch;

    float left = 0.F;
    float bottom = 0.F;
    float right = 0.F;
    float top = 0.F;

    if (params.trim) {
        left = -appX;
        bottom = -appY;
        right = cw - appX;
        top = ch - appY;
    } else {
        const float ow = params.originalSize.x;
        const float oh = params.originalSize.y;
        if (ow <= 0.F || oh <= 0.F) {
            return quad;
        }

        const float scaleX = cw / ow;
        const float scaleY = ch / oh;
        const float halfTrimmedWidth = (ow - params.frameRect.width) * 0.5F;
        const float halfTrimmedHeight = (oh - params.frameRect.height) * 0.5F;

        // Same layout as SpriteFrame.trimmedBorder: x=left, y=right,
        // z=bottom, w=top.
        const float borderLeft = params.offset.x + halfTrimmedWidth;
        const float borderRight = params.offset.x - halfTrimmedWidth;
        const float borderBottom = params.offset.y + halfTrimmedHeight;
        const float borderTop = params.offset.y - halfTrimmedHeight;

        left = borderLeft * scaleX - appX;
        bottom = borderBottom * scaleY - appY;
        right = cw + borderRight * scaleX - appX;
        top = ch + borderTop * scaleY - appY;
    }

    quad.vertices[0].position.set(left, bottom, 0.F);
    quad.vertices[1].position.set(right, bottom, 0.F);
    quad.vertices[2].position.set(left, top, 0.F);
    quad.vertices[3].position.set(right, top, 0.F);

    const float texW = params.textureSize.x;
    const float texH = params.textureSize.y;
    const Rect &rect = params.frameRect;

    if (params.rotated) {
        const float l = texW <= 0.F ? 0.F : rect.x / texW;
        const float r = texW <= 0.F ? 1.F : (rect.x + rect.height) / texW;
        const float t = texH <= 0.F ? 0.F : rect.y / texH;
        const float b = texH <= 0.F ? 1.F : (rect.y + rect.width) / texH;

        quad.vertices[0].uv.set(l, t);
        quad.vertices[1].uv.set(l, b);
        quad.vertices[2].uv.set(r, t);
        quad.vertices[3].uv.set(r, b);
    } else {
        const float l = texW <= 0.F ? 0.F : rect.x / texW;
        const float r = texW <= 0.F ? 1.F : (rect.x + rect.width) / texW;
        const float b = texH <= 0.F ? 1.F : (rect.y + rect.height) / texH;
        const float t = texH <= 0.F ? 0.F : rect.y / texH;

        quad.vertices[0].uv.set(l, b);
        quad.vertices[1].uv.set(r, b);
        quad.vertices[2].uv.set(l, t);
        quad.vertices[3].uv.set(r, t);
    }

    quad.valid = true;
    return quad;
}

void transformSpriteQuad(SpriteQuad &quad, const Mat4 &worldMatrix) {
    if (!quad.valid) {
        return;
    }

    for (auto &vertex : quad.vertices) {
        Vec3 transformed;
        Vec3::transformMat4(vertex.position, worldMatrix, &transformed);
        vertex.position = transformed;
    }
}

SpriteMesh buildSlicedSpriteMesh(const SlicedSpriteGeometryParams &params) {
    SpriteMesh mesh;

    const float width = params.contentSize.x;
    const float height = params.contentSize.y;
    const float textureWidth = params.textureSize.x;
    const float textureHeight = params.textureSize.y;
    if (width <= 0.F || height <= 0.F || textureWidth <= 0.F || textureHeight <= 0.F) {
        return mesh;
    }

    const Rect &rect = params.frameRect;
    if (rect.width <= 0.F || rect.height <= 0.F) {
        return mesh;
    }

    const float appX = params.anchorPoint.x * width;
    const float appY = params.anchorPoint.y * height;
    const float left = -appX;
    const float bottom = -appY;
    const float right = width - appX;
    const float top = height - appY;

    const float insetLeft = std::clamp(params.insetLeft, 0.F, width);
    const float insetRight = std::clamp(params.insetRight, 0.F, width);
    const float insetBottom = std::clamp(params.insetBottom, 0.F, height);
    const float insetTop = std::clamp(params.insetTop, 0.F, height);

    const float x1 = std::min(left + insetLeft, right);
    const float x2 = std::max(right - insetRight, left);
    const float y1 = std::min(bottom + insetBottom, top);
    const float y2 = std::max(top - insetTop, bottom);

    const float u0 = rect.x / textureWidth;
    const float u3 = (rect.x + rect.width) / textureWidth;
    const float u1 = std::min(u0 + insetLeft / textureWidth, u3);
    const float u2 = std::max(u3 - insetRight / textureWidth, u0);

    const float vBottom = (rect.y + rect.height) / textureHeight;
    const float vTop = rect.y / textureHeight;
    const float v1 = std::max(vBottom - insetBottom / textureHeight, vTop);
    const float v2 = std::min(vTop + insetTop / textureHeight, vBottom);

    const float xs[4] = {left, x1, x2, right};
    const float ys[4] = {bottom, y1, y2, top};
    const float us[4] = {u0, u1, u2, u3};
    const float vs[4] = {vBottom, v1, v2, vTop};

    mesh.vertices.reserve(16);
    for (uint32_t row = 0; row < 4; ++row) {
        for (uint32_t col = 0; col < 4; ++col) {
            SpriteVertex vertex;
            vertex.position.set(xs[col], ys[row], 0.F);
            vertex.uv.set(us[col], vs[row]);
            mesh.vertices.push_back(vertex);
        }
    }

    mesh.indices.reserve(54);
    for (uint32_t row = 0; row < 3; ++row) {
        for (uint32_t col = 0; col < 3; ++col) {
            const uint16_t v00 = static_cast<uint16_t>(row * 4 + col);
            const uint16_t v10 = static_cast<uint16_t>(v00 + 1);
            const uint16_t v01 = static_cast<uint16_t>(v00 + 4);
            const uint16_t v11 = static_cast<uint16_t>(v01 + 1);
            mesh.indices.insert(mesh.indices.end(), {v00, v10, v01, v10, v11, v01});
        }
    }

    mesh.valid = true;
    return mesh;
}

void transformSpriteMesh(SpriteMesh &mesh, const Mat4 &worldMatrix) {
    if (!mesh.valid) {
        return;
    }
    for (auto &vertex : mesh.vertices) {
        Vec3 transformed;
        Vec3::transformMat4(vertex.position, worldMatrix, &transformed);
        vertex.position = transformed;
    }
}

} // namespace cc
