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

    const float horizontalInsets = params.insetLeft + params.insetRight;
    const float verticalInsets = params.insetBottom + params.insetTop;
    const float xScale = horizontalInsets == 0.F ? 1.F : std::min(1.F, width / horizontalInsets);
    const float yScale = verticalInsets == 0.F ? 1.F : std::min(1.F, height / verticalInsets);
    const float x1 = left + params.insetLeft * xScale;
    const float y1 = bottom + params.insetBottom * yScale;
    const float xs[4] = {left, x1, x1 + std::max(0.F, width - horizontalInsets), right};
    const float ys[4] = {bottom, y1, y1 + std::max(0.F, height - verticalInsets), top};
    const float sourceX[4] = {0.F, params.insetLeft, rect.width - params.insetRight, rect.width};
    const float sourceY[4] = {0.F, params.insetBottom, rect.height - params.insetTop, rect.height};
    mesh.vertices.reserve(16);
    for (uint32_t row = 0; row < 4; ++row) {
        for (uint32_t col = 0; col < 4; ++col) {
            SpriteVertex vertex;
            vertex.position.set(xs[col], ys[row], 0.F);
            if (params.rotated) {
                vertex.uv.set((rect.x + sourceY[row]) / textureWidth, (rect.y + sourceX[col]) / textureHeight);
            } else {
                vertex.uv.set((rect.x + sourceX[col]) / textureWidth, (rect.y + (rect.height - sourceY[row])) / textureHeight);
            }
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
    const double width = params.contentSize.x, height = params.contentSize.y;
    if (width <= 0 || height <= 0 || params.textureSize.x <= 0 || params.textureSize.y <= 0
        || params.frameRect.width <= 0 || params.frameRect.height <= 0
        || !std::isfinite(params.fillStart) || !std::isfinite(params.fillRange)) return mesh;

    // Match radial-filled.ts: normalized center, positive CCW interval, and
    // one triangle for each intersected rectangle edge rather than arc samples.
    constexpr double PI = 3.14159265358979323846;
    constexpr double TURN = PI * 2;
    constexpr double EPSILON = 1e-6;
    struct Point { double x{0}; double y{0}; };
    const double left = -params.anchorPoint.x * width, bottom = -params.anchorPoint.y * height;
    const double right = left + width, top = bottom + height;
    const Point center{left + std::clamp(static_cast<double>(params.fillCenter.x), 0.0, 1.0) * width,
                       bottom + std::clamp(static_cast<double>(params.fillCenter.y), 0.0, 1.0) * height};
    const Point corners[4] = {{left, bottom}, {right, bottom}, {right, top}, {left, top}};
    size_t edges[4][2] = {};
    if (center.x != left) { edges[0][0] = 3; edges[0][1] = 0; }
    if (center.y != bottom) { edges[1][0] = 0; edges[1][1] = 1; }
    if (center.x != right) { edges[2][0] = 1; edges[2][1] = 2; }
    if (center.y != top) { edges[3][0] = 2; edges[3][1] = 3; }

    double start = params.fillStart, range = params.fillRange;
    if (range < 0) { start += range; range = -range; }
    start = (start - std::floor(start)) * TURN;
    range *= TURN;
    const double end = start + range;
    auto intersect = [&](double angle, Point (&points)[4]) {
        double sine = std::sin(angle), cosine = std::cos(angle);
        if (std::abs(sine) <= EPSILON) sine = 0;
        if (std::abs(cosine) <= EPSILON) cosine = 0;
        if (cosine != 0) {
            const double tangent = sine / cosine;
            if ((left - center.x) * cosine > 0) points[0] = {left, center.y + tangent * (left - center.x)};
            if ((right - center.x) * cosine > 0) points[2] = {right, center.y + tangent * (right - center.x)};
        }
        if (sine != 0) {
            const double cotangent = cosine / sine;
            if ((bottom - center.y) * sine > 0) points[1] = {center.x + cotangent * (bottom - center.y), bottom};
            if ((top - center.y) * sine > 0) points[3] = {center.x + cotangent * (top - center.y), top};
        }
    };
    Point first[4], last[4];
    intersect(start, first); intersect(end, last);
    auto angleOf = [&](const Point &point) {
        const double x = point.x - center.x, y = point.y - center.y;
        if (x == 0) return y == 0 ? 0.0 : (y > 0 ? PI * 0.5 : PI * 1.5);
        return std::atan(y / x) + (x < 0 ? PI : 0);
    };
    auto emit = [&](const Point &a, const Point &b, const Point &c) {
        for (const auto &point : {a, b, c}) {
            SpriteVertex vertex;
            vertex.position.set(static_cast<float>(point.x), static_cast<float>(point.y), 0.F);
            vertex.uv = frameUV(static_cast<float>((point.x - left) / width), static_cast<float>((point.y - bottom) / height),
                                params.frameRect, params.textureSize, params.rotated);
            mesh.indices.push_back(static_cast<uint16_t>(mesh.vertices.size()));
            mesh.vertices.push_back(vertex);
        }
    };
    mesh.vertices.reserve(36); mesh.indices.reserve(36);
    for (size_t edge = 0; edge < 4; ++edge) {
        const auto &a = corners[edges[edge][0]], &b = corners[edges[edge][1]];
        if (range >= TURN) { emit(center, a, b); continue; }
        double edgeStart = angleOf(a), edgeEnd = angleOf(b);
        if (edgeEnd < edgeStart) edgeEnd += TURN;
        edgeStart -= TURN; edgeEnd -= TURN;
        for (int turn = 0; turn < 3; ++turn) {
            if (edgeStart >= end) {
                // No overlap with this turn.
            } else if (edgeStart >= start) {
                emit(center, a, edgeEnd >= end ? last[edge] : b);
            } else if (edgeEnd > start) {
                emit(center, first[edge], edgeEnd <= end ? b : last[edge]);
            }
            edgeStart += TURN; edgeEnd += TURN;
        }
    }
    mesh.valid = !mesh.vertices.empty();
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
