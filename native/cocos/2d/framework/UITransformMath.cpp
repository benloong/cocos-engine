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

#include "2d/framework/UITransformMath.h"

#include <algorithm>
#include <cmath>
#include <limits>

namespace cc {

Rect UITransformMath::getSelfBoundingBox(const Vec2 &contentSize, const Vec2 &anchorPoint) {
    return Rect(-anchorPoint.x * contentSize.x,
                -anchorPoint.y * contentSize.y,
                contentSize.x,
                contentSize.y);
}

Rect UITransformMath::transformRect(const Rect &rect, const Mat4 &matrix) {
    const Vec3 corners[4] = {
        Vec3(rect.x, rect.y, 0.F),
        Vec3(rect.x + rect.width, rect.y, 0.F),
        Vec3(rect.x, rect.y + rect.height, 0.F),
        Vec3(rect.x + rect.width, rect.y + rect.height, 0.F),
    };

    float minX = std::numeric_limits<float>::max();
    float minY = std::numeric_limits<float>::max();
    float maxX = -std::numeric_limits<float>::max();
    float maxY = -std::numeric_limits<float>::max();

    for (const auto &corner : corners) {
        Vec3 transformed;
        Vec3::transformMat4(corner, matrix, &transformed);
        minX = std::min(minX, transformed.x);
        minY = std::min(minY, transformed.y);
        maxX = std::max(maxX, transformed.x);
        maxY = std::max(maxY, transformed.y);
    }

    return Rect(minX, minY, maxX - minX, maxY - minY);
}

Vec3 UITransformMath::convertToNodeSpaceAR(const Vec3 &worldPoint, const Mat4 &worldMatrix) {
    const Mat4 inverseWorld = worldMatrix.getInversed();
    Vec3 localPoint;
    Vec3::transformMat4(worldPoint, inverseWorld, &localPoint);
    return localPoint;
}

Vec3 UITransformMath::convertToWorldSpaceAR(const Vec3 &nodePoint, const Mat4 &worldMatrix) {
    Vec3 worldPoint;
    Vec3::transformMat4(nodePoint, worldMatrix, &worldPoint);
    return worldPoint;
}

bool UITransformMath::containsWorldPoint(const Vec2 &worldPoint,
                                         const Vec2 &contentSize,
                                         const Vec2 &anchorPoint,
                                         const Mat4 &worldMatrix) {
    if (contentSize.x <= 0.F || contentSize.y <= 0.F) {
        return false;
    }

    const Vec3 localPoint = convertToNodeSpaceAR(Vec3(worldPoint.x, worldPoint.y, 0.F), worldMatrix);
    const Rect box = getSelfBoundingBox(contentSize, anchorPoint);
    return box.containsPoint(Vec2(localPoint.x, localPoint.y));
}

} // namespace cc
