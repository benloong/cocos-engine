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

} // namespace cc
