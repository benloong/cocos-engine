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

#include "core/component/Component.h"
#include "math/Geometry.h"
#include "math/Vec2.h"

namespace cc {

/**
 * Native data/logic for the 2D UITransform.
 *
 * This is intentionally not a JSB Component yet: the JS UITransform shell owns
 * the Component identity, serialization and lifecycle, while this class owns
 * the transform data and math. The shell attaches it to a Node on onLoad().
 *
 * M0 scope: content size, anchor point, priority, local/world bounding box and
 * point conversion. Child aggregation and camera-aware hit tests are M1.
 */
class UITransform final : public Component {
public:
    static constexpr uint32_t TYPE_ID = 1;

    UITransform() = default;
    explicit UITransform(Node *node);

    uint32_t getTypeId() const override { return TYPE_ID; }

    const Vec2 &getContentSize() const { return _contentSize; }
    void setContentSize(const Vec2 &size);
    void setContentSize(float width, float height);
    void setContentSizeXY(float width, float height) { setContentSize(width, height); }

    float getWidth() const { return _contentSize.x; }
    void setWidth(float width) { setContentSize(width, _contentSize.y); }

    float getHeight() const { return _contentSize.y; }
    void setHeight(float height) { setContentSize(_contentSize.x, height); }

    const Vec2 &getAnchorPoint() const { return _anchorPoint; }
    void setAnchorPoint(const Vec2 &anchor);
    void setAnchorPoint(float x, float y);
    void setAnchorPointXY(float x, float y) { setAnchorPoint(x, y); }

    float getAnchorX() const { return _anchorPoint.x; }
    void setAnchorX(float x) { setAnchorPoint(x, _anchorPoint.y); }

    float getAnchorY() const { return _anchorPoint.y; }
    void setAnchorY(float y) { setAnchorPoint(_anchorPoint.x, y); }

    int32_t getPriority() const { return _priority; }
    void setPriority(int32_t priority) { _priority = priority; }

    /**
     * Bounding box in the parent coordinate space (self only).
     */
    Rect getBoundingBox() const;

    /**
     * Bounding box in world space (self only for the M0 PoC).
     */
    Rect getBoundingBoxToWorld() const;

    Vec2 convertToNodeSpaceAR(const Vec2 &worldPoint) const;
    Vec2 convertToWorldSpaceAR(const Vec2 &nodePoint) const;
    bool containsWorldPoint(const Vec2 &worldPoint) const;

private:
    Vec2 _contentSize{100.F, 100.F};
    Vec2 _anchorPoint{0.5F, 0.5F};
    int32_t _priority{0};
};

} // namespace cc
