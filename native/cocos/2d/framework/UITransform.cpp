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
#include "2d/components/Mask.h"
#include "core/scene-graph/Node.h"
#include "core/scene-graph/Scene.h"
#include "math/Mat4.h"
#include "math/Vec3.h"
#include "scene/Camera.h"
#include "scene/RenderScene.h"
#include "scene/RenderWindow.h"
#include <limits>

namespace cc {

UITransform::UITransform(Node *node) {
    setNode(node);
}

void UITransform::setContentSize(const Vec2 &size) {
    if (_contentSize.equals(size)) {
        return;
    }
    _contentSize.set(size);
    emit<LayoutChanged>();
    // Changes are published only on the main-thread mutation path, never polled.
    const auto callback = _sizeChangedCallback;
    if (callback) callback(size.x, size.y);
}

void UITransform::setContentSize(float width, float height) {
    setContentSize(Vec2(width, height));
}

void UITransform::setAnchorPoint(const Vec2 &anchor) {
    if (_anchorPoint.equals(anchor)) {
        return;
    }
    _anchorPoint.set(anchor);
    emit<LayoutChanged>();
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

Rect UITransform::getSelfBoundingBoxToWorld() const {
    const Rect local = UITransformMath::getSelfBoundingBox(_contentSize, _anchorPoint);
    return _node ? UITransformMath::transformRect(local, _node->getWorldMatrix()) : local;
}

Rect UITransform::getBoundingBoxToWorld() const {
    Rect result;
    bool initialized = false;

    if (_node != nullptr) {
        for (const auto &child : _node->getChildren()) {
            if (!child || !child->isActive()) {
                continue;
            }
            auto *childTransform = static_cast<UITransform *>(child->getUIComponent(TYPE_ID));
            if (childTransform == nullptr || childTransform->_contentSize.x <= 0.F || childTransform->_contentSize.y <= 0.F) {
                continue;
            }
            const Rect childLocal = UITransformMath::getSelfBoundingBox(childTransform->_contentSize, childTransform->_anchorPoint);
            const Rect childWorld = UITransformMath::transformRect(childLocal, child->getWorldMatrix());
            result = initialized ? result.unionWithRect(childWorld) : childWorld;
            initialized = true;
        }
    }

    if (_contentSize.x > 0.F && _contentSize.y > 0.F) {
        const Rect selfWorld = getSelfBoundingBoxToWorld();
        result = initialized ? result.unionWithRect(selfWorld) : selfWorld;
    }
    return result;
}

Rect UITransform::getBoundingBoxTo(const Mat4 &targetMat) const {
    Rect result;
    bool initialized = false;
    const Mat4 inverseTarget = targetMat.getInversed();

    if (_node != nullptr) {
        for (const auto &child : _node->getChildren()) {
            if (!child || !child->isActive()) {
                continue;
            }
            auto *childTransform = static_cast<UITransform *>(child->getUIComponent(TYPE_ID));
            if (childTransform == nullptr || childTransform->_contentSize.x <= 0.F || childTransform->_contentSize.y <= 0.F) {
                continue;
            }
            Mat4 matrix;
            Mat4::multiply(child->getWorldMatrix(), inverseTarget, &matrix);
            const Rect childLocal = UITransformMath::getSelfBoundingBox(childTransform->_contentSize, childTransform->_anchorPoint);
            const Rect childRect = UITransformMath::transformRect(childLocal, matrix);
            result = initialized ? result.unionWithRect(childRect) : childRect;
            initialized = true;
        }
    }

    if (_contentSize.x > 0.F && _contentSize.y > 0.F) {
        const Rect local = UITransformMath::getSelfBoundingBox(_contentSize, _anchorPoint);
        Mat4 matrix = inverseTarget;
        if (_node != nullptr) {
            Mat4::multiply(_node->getWorldMatrix(), inverseTarget, &matrix);
        }
        const Rect selfRect = UITransformMath::transformRect(local, matrix);
        result = initialized ? result.unionWithRect(selfRect) : selfRect;
    }
    return result;
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

Vec3 UITransform::convertToNodeSpaceARXYZ(float x, float y, float z) const {
    const Vec3 point(x, y, z);
    return _node ? UITransformMath::convertToNodeSpaceAR(point, _node->getWorldMatrix()) : point;
}

Vec3 UITransform::convertToWorldSpaceARXYZ(float x, float y, float z) const {
    const Vec3 point(x, y, z);
    return _node ? UITransformMath::convertToWorldSpaceAR(point, _node->getWorldMatrix()) : point;
}

bool UITransform::containsWorldPoint(const Vec2 &worldPoint) const {
    if (_node == nullptr) {
        return false;
    }
    return UITransformMath::containsWorldPoint(worldPoint, _contentSize, _anchorPoint, _node->getWorldMatrix());
}

bool UITransform::hitTestWorldXY(float worldX, float worldY) const {
    if (!containsWorldPoint(Vec2(worldX, worldY))) return false;
    // Query live Component slots instead of retaining ancestor/component
    // pointers across reparenting, detach, or destruction.
    for (auto *node = _node; node; node = node->getParent()) {
        auto *mask = static_cast<Mask *>(node->getUIComponent(Mask::TYPE_ID));
        if (mask && mask->isEnabled() && !mask->isHitWorldPointXY(worldX, worldY)) return false;
    }
    return true;
}

bool UITransform::hitTestXY(float screenX, float screenY, uint32_t windowId) const {
    return tryHitTestXY(screenX, screenY, windowId, nullptr);
}

Vec2 UITransform::getHitTestWorldPointXY(float screenX, float screenY, uint32_t windowId) const {
    const float noHit = std::numeric_limits<float>::quiet_NaN();
    Vec2 worldPoint(noHit, noHit);
    tryHitTestXY(screenX, screenY, windowId, &worldPoint);
    return worldPoint;
}

bool UITransform::tryHitTestXY(float screenX, float screenY, uint32_t windowId, Vec2 *worldPoint) const {
    if (_node == nullptr || _contentSize.x <= 0.F || _contentSize.y <= 0.F) {
        return false;
    }
    auto *scene = _node->getScene();
    if (scene == nullptr) {
        return false;
    }
    auto *renderScene = scene->getRenderScene();
    if (renderScene == nullptr) {
        return false;
    }

    for (const auto &camera : renderScene->getCameras()) {
        if (camera == nullptr || (camera->getVisibility() & _node->getLayer()) == 0
            || camera->getSystemWindowId() != windowId
            || (camera->getWindow() && !camera->getWindow()->getSwapchain())) {
            continue;
        }
        const Vec3 world = camera->screenToWorld(Vec3(screenX, screenY, 0.F));
        if (hitTestWorldXY(world.x, world.y)) {
            if (worldPoint) worldPoint->set(world.x, world.y);
            return true;
        }
    }
    return false;
}

} // namespace cc
