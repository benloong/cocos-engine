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

#include "2d/framework/UITransform.h"

#include "2d/framework/UITransformMath.h"
#include "core/scene-graph/Node.h"
#include "math/Mat4.h"
#include "math/Vec3.h"

namespace cc {

UITransform::UITransform(Node *node)
: _node(node) {
}

void UITransform::setContentSize(const Vec2 &size) {
    if (_contentSize.equals(size)) {
        return;
    }
    _contentSize.set(size);
}

void UITransform::setContentSize(float width, float height) {
    setContentSize(Vec2(width, height));
}

void UITransform::setAnchorPoint(const Vec2 &anchor) {
    if (_anchorPoint.equals(anchor)) {
        return;
    }
    _anchorPoint.set(anchor);
}

void UITransform::setAnchorPoint(float x, float y) {
    setAnchorPoint(Vec2(x, y));
}

Rect UITransform::getBoundingBox() const {
    const Rect local = UITransformMath::getSelfBoundingBox(_contentSize, _anchorPoint);
    if (_node == nullptr) {
        return local;
    }

    Mat4 localMatrix;
    Mat4::fromRTS(_node->getRotation(), _node->getPosition(), _node->getScale(), &localMatrix);
    return UITransformMath::transformRect(local, localMatrix);
}

Rect UITransform::getBoundingBoxToWorld() const {
    const Rect local = UITransformMath::getSelfBoundingBox(_contentSize, _anchorPoint);
    if (_node == nullptr) {
        return local;
    }
    return UITransformMath::transformRect(local, _node->getWorldMatrix());
}

Vec2 UITransform::convertToNodeSpaceAR(const Vec2 &worldPoint) const {
    if (_node == nullptr) {
        return worldPoint;
    }
    const Vec3 local = UITransformMath::convertToNodeSpaceAR(Vec3(worldPoint.x, worldPoint.y, 0.F), _node->getWorldMatrix());
    return Vec2(local.x, local.y);
}

Vec2 UITransform::convertToWorldSpaceAR(const Vec2 &nodePoint) const {
    if (_node == nullptr) {
        return nodePoint;
    }
    const Vec3 world = UITransformMath::convertToWorldSpaceAR(Vec3(nodePoint.x, nodePoint.y, 0.F), _node->getWorldMatrix());
    return Vec2(world.x, world.y);
}

bool UITransform::containsWorldPoint(const Vec2 &worldPoint) const {
    if (_node == nullptr) {
        return false;
    }
    return UITransformMath::containsWorldPoint(worldPoint, _contentSize, _anchorPoint, _node->getWorldMatrix());
}

} // namespace cc
