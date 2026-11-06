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

#include "math/Geometry.h"
#include "math/Mat4.h"
#include "math/Vec2.h"
#include "math/Vec3.h"

namespace cc {

/**
 * Pure math used by the native 2D UITransform.
 *
 * The functions take matrices explicitly so they can be unit tested without a
 * Node instance. The component wrapper (UITransform) supplies the node's world
 * matrix.
 */
struct UITransformMath final {
    UITransformMath() = delete;

    /**
     * Bounding box in the node's own coordinate space. The rect origin is the
     * bottom-left corner after applying the anchor point.
     */
    static Rect getSelfBoundingBox(const Vec2 &contentSize, const Vec2 &anchorPoint);

    /**
     * Axis-aligned bounding box after transforming the four corners by matrix.
     */
    static Rect transformRect(const Rect &rect, const Mat4 &matrix);

    /**
     * worldPoint -> node local space (relative to the anchor point).
     */
    static Vec3 convertToNodeSpaceAR(const Vec3 &worldPoint, const Mat4 &worldMatrix);

    /**
     * node local space -> world space.
     */
    static Vec3 convertToWorldSpaceAR(const Vec3 &nodePoint, const Mat4 &worldMatrix);

    /**
     * Hit test in world space. Returns false for zero-sized transforms.
     */
    static bool containsWorldPoint(const Vec2 &worldPoint,
                                   const Vec2 &contentSize,
                                   const Vec2 &anchorPoint,
                                   const Mat4 &worldMatrix);
};

} // namespace cc
