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
#include <cmath>

namespace cc {

namespace {

Vec2 frameUV(float fx, float fy, const Rect &rect, const Vec2 &textureSize, bool rotated) {
    const float texW = textureSize.x <= 0.F ? 1.F : textureSize.x;
    const float texH = textureSize.y <= 0.F ? 1.F : textureSize.y;
    if (rotated) {
        return Vec2(
            (rect.x + fy * rect.height) / texW,
            (rect.y + fx * rect.width) / texH);
    }
    return Vec2(
        (rect.x + fx * rect.width) / texW,
        (rect.y + (1.F - fy) * rect.height) / texH);
}

} // namespace


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

    quad.vertices[0].uv = frameUV(0.F, 0.F, rect, params.textureSize, params.rotated);
    quad.vertices[1].uv = frameUV(1.F, 0.F, rect, params.textureSize, params.rotated);
    quad.vertices[2].uv = frameUV(0.F, 1.F, rect, params.textureSize, params.rotated);
    quad.vertices[3].uv = frameUV(1.F, 1.F, rect, params.textureSize, params.rotated);

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

    const float xs[4] = {left, x1, x2, right};
    const float ys[4] = {bottom, y1, y2, top};
    const float us[4] = {0.F, insetLeft / rect.width, 1.F - insetRight / rect.width, 1.F};
    const float vs[4] = {0.F, insetBottom / rect.height, 1.F - insetTop / rect.height, 1.F};
    mesh.vertices.reserve(16);
    for (uint32_t row = 0; row < 4; ++row) {
        for (uint32_t col = 0; col < 4; ++col) {
            SpriteVertex vertex;
            vertex.position.set(xs[col], ys[row], 0.F);
            vertex.uv = frameUV(us[col], vs[row], rect, params.textureSize, params.rotated);
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

SpriteMesh buildTiledSpriteMesh(const TiledSpriteGeometryParams &params) {
    SpriteMesh mesh;
    const float width = params.contentSize.x;
    const float height = params.contentSize.y;
    const float textureWidth = params.textureSize.x;
    const float textureHeight = params.textureSize.y;
    const Rect &rect = params.frameRect;
    if (width <= 0.F || height <= 0.F || textureWidth <= 0.F || textureHeight <= 0.F ||
        rect.width <= 0.F || rect.height <= 0.F) {
        return mesh;
    }

    const float appX = params.anchorPoint.x * width;
    const float appY = params.anchorPoint.y * height;
    const float left = -appX;
    const float bottom = -appY;

    const uint32_t columns = static_cast<uint32_t>(std::ceil(width / rect.width));
    const uint32_t rows = static_cast<uint32_t>(std::ceil(height / rect.height));

    for (uint32_t row = 0; row < rows; ++row) {
        const float tileY = std::min(rect.height, height - static_cast<float>(row) * rect.height);
        const float y0 = bottom + static_cast<float>(row) * rect.height;
        const float y1 = y0 + tileY;
        for (uint32_t col = 0; col < columns; ++col) {
            const float tileX = std::min(rect.width, width - static_cast<float>(col) * rect.width);
            const float x0 = left + static_cast<float>(col) * rect.width;
            const float x1 = x0 + tileX;
            const uint16_t base = static_cast<uint16_t>(mesh.vertices.size());

            SpriteVertex v00;
            SpriteVertex v10;
            SpriteVertex v01;
            SpriteVertex v11;
            v00.position.set(x0, y0, 0.F);
            v10.position.set(x1, y0, 0.F);
            v01.position.set(x0, y1, 0.F);
            v11.position.set(x1, y1, 0.F);
            const float fx1 = tileX / rect.width;
            const float fy1 = tileY / rect.height;
            v00.uv = frameUV(0.F, 0.F, rect, params.textureSize, params.rotated);
            v10.uv = frameUV(fx1, 0.F, rect, params.textureSize, params.rotated);
            v01.uv = frameUV(0.F, fy1, rect, params.textureSize, params.rotated);
            v11.uv = frameUV(fx1, fy1, rect, params.textureSize, params.rotated);
            mesh.vertices.insert(mesh.vertices.end(), {v00, v10, v01, v11});
            mesh.indices.insert(mesh.indices.end(), {
                base, static_cast<uint16_t>(base + 1), static_cast<uint16_t>(base + 2),
                static_cast<uint16_t>(base + 1), static_cast<uint16_t>(base + 3), static_cast<uint16_t>(base + 2),
            });
        }
    }

    mesh.valid = true;
    return mesh;
}

SpriteMesh buildRadialSpriteMesh(const FilledSpriteGeometryParams &params) {
    SpriteMesh mesh;
    const float width = params.contentSize.x;
    const float height = params.contentSize.y;
    const float textureWidth = params.textureSize.x;
    const float textureHeight = params.textureSize.y;
    const Rect &rect = params.frameRect;
    if (width <= 0.F || height <= 0.F || textureWidth <= 0.F || textureHeight <= 0.F ||
        rect.width <= 0.F || rect.height <= 0.F) {
        return mesh;
    }

    const float range = std::clamp(params.fillRange, 0.F, 1.F);
    if (range <= 0.F) {
        return mesh;
    }

    const float appX = params.anchorPoint.x * width;
    const float appY = params.anchorPoint.y * height;
    const float left = -appX;
    const float bottom = -appY;
    const float right = width - appX;
    const float top = height - appY;
    const float cx = params.fillCenter.x;
    const float cy = params.fillCenter.y;

    constexpr float PI = 3.14159265358979323846F;
    const float startAngle = PI * 0.5F - 2.F * PI * params.fillStart;
    const uint32_t segments = std::max(3U, static_cast<uint32_t>(std::ceil(48.F * range)));

    auto radiusToEdge = [&](float dx, float dy) {
        float distance = 1e30F;
        constexpr float EPSILON = 1e-6F;
        if (dx > EPSILON) {
            distance = std::min(distance, (right - cx) / dx);
        } else if (dx < -EPSILON) {
            distance = std::min(distance, (left - cx) / dx);
        }
        if (dy > EPSILON) {
            distance = std::min(distance, (top - cy) / dy);
        } else if (dy < -EPSILON) {
            distance = std::min(distance, (bottom - cy) / dy);
        }
        return std::max(0.F, distance);
    };

    auto makeVertex = [&](float x, float y) {
        SpriteVertex vertex;
        vertex.position.set(x, y, 0.F);
        vertex.uv = frameUV((x - left) / width, (y - bottom) / height, rect, params.textureSize, params.rotated);
        return vertex;
    };

    mesh.vertices.reserve(segments + 2);
    mesh.vertices.push_back(makeVertex(cx, cy));

    for (uint32_t i = 0; i <= segments; ++i) {
        const float t = static_cast<float>(i) / static_cast<float>(segments);
        const float angle = startAngle - 2.F * PI * range * t;
        const float dx = std::cos(angle);
        const float dy = std::sin(angle);
        const float distance = radiusToEdge(dx, dy);
        mesh.vertices.push_back(makeVertex(cx + dx * distance, cy + dy * distance));
    }

    mesh.indices.reserve(segments * 3);
    for (uint32_t i = 1; i <= segments; ++i) {
        mesh.indices.push_back(0);
        mesh.indices.push_back(static_cast<uint16_t>(i));
        mesh.indices.push_back(static_cast<uint16_t>(i + 1));
    }

    mesh.valid = true;
    return mesh;
}

SpriteMesh buildFilledSpriteMesh(const FilledSpriteGeometryParams &params) {
    if (params.fillType == 2) {
        return buildRadialSpriteMesh(params);
    }
    SpriteMesh mesh;
    const float width = params.contentSize.x;
    const float height = params.contentSize.y;
    const float textureWidth = params.textureSize.x;
    const float textureHeight = params.textureSize.y;
    const Rect &rect = params.frameRect;
    if (width <= 0.F || height <= 0.F || textureWidth <= 0.F || textureHeight <= 0.F ||
        rect.width <= 0.F || rect.height <= 0.F) {
        return mesh;
    }

    const float first = params.fillStart;
    const float last = params.fillStart + params.fillRange;
    const float start = std::clamp(std::min(first, last), 0.F, 1.F);
    const float end = std::clamp(std::max(first, last), 0.F, 1.F);
    if (end <= start) {
        return mesh;
    }

    const float appX = params.anchorPoint.x * width;
    const float appY = params.anchorPoint.y * height;
    const float left = -appX;
    const float bottom = -appY;
    const float right = width - appX;
    const float top = height - appY;

    float x0 = left;
    float x1 = right;
    float y0 = bottom;
    float y1 = top;
    float fx0 = 0.F;
    float fx1 = 1.F;
    float fy0 = 0.F;
    float fy1 = 1.F;

    if (params.fillType == 0) {
        x0 = left + width * start;
        x1 = left + width * end;
        fx0 = start;
        fx1 = end;
    } else {
        y0 = bottom + height * start;
        y1 = bottom + height * end;
        fy0 = start;
        fy1 = end;
    }
    SpriteVertex v00;
    SpriteVertex v10;
    SpriteVertex v01;
    SpriteVertex v11;
    v00.position.set(x0, y0, 0.F);
    v10.position.set(x1, y0, 0.F);
    v01.position.set(x0, y1, 0.F);
    v11.position.set(x1, y1, 0.F);
    v00.uv = frameUV(fx0, fy0, rect, params.textureSize, params.rotated);
    v10.uv = frameUV(fx1, fy0, rect, params.textureSize, params.rotated);
    v01.uv = frameUV(fx0, fy1, rect, params.textureSize, params.rotated);
    v11.uv = frameUV(fx1, fy1, rect, params.textureSize, params.rotated);

    mesh.vertices = {v00, v10, v01, v11};
    mesh.indices = {0, 1, 2, 1, 3, 2};
    mesh.valid = true;
    return mesh;
}

} // namespace cc
