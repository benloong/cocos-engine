/****************************************************************************
 Copyright (c) 2019-2023 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

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

#include "2d/renderer/RenderEntity.h"
#include "2d/renderer/Batcher2d.h"
#include "bindings/utils/BindingUtils.h"

namespace cc {
RenderEntity::RenderEntity(RenderEntityType type) : _renderEntityType(type) {
    if (type == RenderEntityType::STATIC) {
        ccnew_placement(&_staticDrawInfos) std::array<RenderDrawInfo, RenderEntity::STATIC_DRAW_INFO_CAPACITY>();
    } else {
        ccnew_placement(&_dynamicDrawInfos) ccstd::vector<RenderDrawInfo*>();
    }

    _entityAttrLayout.enabledIndex = 0;
    _entityAttrLayout.useLocal = 0;
    _entityAttrLayout.paddings = 0;

}

se::Object* RenderEntity::getEntitySharedBufferForJS() const {
    if (!_entitySharedBufferActor.getSharedArrayBufferObject()) {
        _entitySharedBufferActor.initialize(&_entityAttrLayout, sizeof(_entityAttrLayout));
    }
    return _entitySharedBufferActor.getSharedArrayBufferObject();
}

RenderEntity::~RenderEntity() {
    if (_renderEntityType == RenderEntityType::STATIC) {
        _staticDrawInfos.~array();
    } else {
        _dynamicDrawInfos.~vector();
    }
};

void RenderEntity::addDynamicRenderDrawInfo(RenderDrawInfo* drawInfo) {
    CC_ASSERT_NE(_renderEntityType, RenderEntityType::STATIC);
    _dynamicDrawInfos.push_back(drawInfo);
}
void RenderEntity::setDynamicRenderDrawInfo(RenderDrawInfo* drawInfo, uint32_t index) {
    CC_ASSERT_NE(_renderEntityType, RenderEntityType::STATIC);
    if (index < _dynamicDrawInfos.size()) {
        _dynamicDrawInfos[index] = drawInfo;
    }
}
void RenderEntity::removeDynamicRenderDrawInfo() {
    CC_ASSERT_NE(_renderEntityType, RenderEntityType::STATIC);
    if (_dynamicDrawInfos.empty()) return;
    _dynamicDrawInfos.pop_back(); // warning: memory leaking & crash
}

void RenderEntity::clearDynamicRenderDrawInfos() {
    CC_ASSERT_NE(_renderEntityType, RenderEntityType::STATIC);
    _dynamicDrawInfos.clear();
}

void RenderEntity::clearStaticRenderDrawInfos() {
    CC_ASSERT_EQ(_renderEntityType, RenderEntityType::STATIC);

    for (uint32_t i = 0; i < _staticDrawInfoSize; i++) {
        RenderDrawInfo& drawInfo = *getRenderDrawInfoAt(i);
        drawInfo.resetDrawInfo();
    }
    _staticDrawInfoSize = 0;
}

void RenderEntity::updateInheritedOpacity(float opacity) {
    _opacity = opacity;
    if (!_spriteVertexOpacity) return;
    // Sprite and bitmap Label chunks own float XYZ/UV/RGBA vertices.
    for (uint32_t i = 0; i < getStaticDrawInfoSize(); ++i) {
        auto *draw = getStaticRenderDrawInfo(i);
        draw->markSpriteVerticesUpdated(false);
        auto *vertices = draw->getVDataBuffer();
        for (uint32_t v = 0; v < draw->getVbCount(); ++v) {
            vertices[v * draw->getStride() + 8] = opacity;
        }
    }
}

void RenderEntity::setNode(Node* node) {
    if (_node && _node->getUserData() == this) {
        _node->setUserData(nullptr);
    }
    _node = node;
    if (_node) {
        _node->setUserData(this);
    }
}

void RenderEntity::setRenderTransform(Node* renderTransform) {
    _renderTransform = renderTransform;
}

RenderDrawInfo* RenderEntity::getDynamicRenderDrawInfo(uint32_t index) {
    CC_ASSERT_NE(_renderEntityType, RenderEntityType::STATIC);
    if (index >= _dynamicDrawInfos.size()) {
        return nullptr;
    }
    return _dynamicDrawInfos[index];
}
ccstd::vector<RenderDrawInfo*>& RenderEntity::getDynamicRenderDrawInfos() {
    CC_ASSERT_NE(_renderEntityType, RenderEntityType::STATIC);
    return _dynamicDrawInfos;
}
void RenderEntity::setStaticDrawInfoSize(uint32_t size) {
    CC_ASSERT(_renderEntityType == RenderEntityType::STATIC);
    for (uint32_t i = size; i < _staticDrawInfoSize; ++i) getRenderDrawInfoAt(i)->resetDrawInfo();
    if (size > STATIC_DRAW_INFO_CAPACITY) {
        const auto needed = size - STATIC_DRAW_INFO_CAPACITY;
        while (_staticOverflow.size() < needed) _staticOverflow.emplace_back(std::make_unique<RenderDrawInfo>());
    }
    _staticDrawInfoSize = size;
}
RenderDrawInfo* RenderEntity::getStaticRenderDrawInfo(uint32_t index) {
    CC_ASSERT(_renderEntityType == RenderEntityType::STATIC && index < _staticDrawInfoSize);
    return getRenderDrawInfoAt(index);
}
std::array<RenderDrawInfo, RenderEntity::STATIC_DRAW_INFO_CAPACITY>& RenderEntity::getStaticRenderDrawInfos() {
    CC_ASSERT_EQ(_renderEntityType, RenderEntityType::STATIC);
    return _staticDrawInfos;
}
} // namespace cc
