/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.
 http://www.cocos.com
****************************************************************************/
#include "2d/components/Mask.h"
#include <algorithm>
#include <cmath>
#include "2d/assets/SpriteFrame.h"
#include "2d/framework/UITransform.h"
#include "core/assets/Material.h"

namespace cc {
Mask::Mask() { _sprite.setSizeMode(0); }
Mask::~Mask() { setNode(nullptr); }
RenderEntity *Mask::getRenderEntity() const { return _type == 3 ? _sprite.getRenderEntity() : _graphics.getRenderEntity(); }
void Mask::attach() {
    _sprite.setNode(nullptr);
    _graphics.setNode(nullptr);
    if (_type == 3)
        _sprite.setNode(_node);
    else
        _graphics.setNode(_node);
    auto *entity = getRenderEntity();
    entity->setPrepareListener(this);
    entity->setMaskMode(_inverted ? MaskMode::MASK_INVERTED : MaskMode::MASK);
    entity->setPriority(_priority);
    entity->setEnabled(_enabled);
}
void Mask::setNode(Node *node) {
    Component::setNode(node);
    _shapeDirty = true;
    attach();
}
void Mask::onDetach() {
    _sprite.setNode(nullptr);
    _graphics.setNode(nullptr);
    _transform=nullptr;
    _sprite.setUITransform(nullptr);
    _shapeDirty=true;
}
void Mask::setUITransform(UITransform *transform) {
    _transform = transform;
    _sprite.setUITransform(transform);
    _shapeDirty = true;
    if(!transform && _type!=2) _graphics.clear();
}
void Mask::setType(int32_t type) {
    if (_type == type) return;
    _type = type;
    _shapeDirty = true;
    _graphics.clear();
    _graphics.setUseGeometrySource(_type == 2);
    attach();
}
void Mask::setSpriteFrame(SpriteFrame *frame) {
    _frame = frame;
    _sprite.setFrame(frame);
    _sprite.setEnabled(_enabled);
}
void Mask::setGraphics(Graphics *graphics) {
    _graphics.setGeometrySource(graphics);
}
void Mask::setSegments(uint32_t segments) {
    _segments = std::clamp(segments, 3U, 10000U);
    _shapeDirty = true;
}
void Mask::setRadius(float radius) {
    radius = std::max(0.F, radius);
    if (_radius == radius) return;
    _radius = radius;
    _shapeDirty = true;
}
bool Mask::isHitWorldPointXY(float x, float y) const {
    auto *transform = _node ? static_cast<UITransform *>(_node->getUIComponent(UITransform::TYPE_ID)) : nullptr;
    if (!transform) return false;
    Mat4 inverse = _node->getWorldMatrix();
    if (!inverse.inverse()) return false;
    Vec3 local;
    Vec3::transformMat4(Vec3(x, y, 0.F), inverse, &local);
    const auto size = transform->getContentSize();
    const auto anchor = transform->getAnchorPoint();
    const float px = local.x + anchor.x * size.x, py = local.y + anchor.y * size.y;
    bool hit = false;
    if (_type == 1) {
        const float rx = size.x * .5F, ry = size.y * .5F;
        if (rx > 0 && ry > 0) {
            const float dx = (px - rx) / rx, dy = (py - ry) / ry;
            hit = dx * dx + dy * dy < 1.F;
        }
    } else if (_type == 0 || _type == 2 || _type == 3) {
        // Match Web input semantics: custom/Sprite stencils use UI bounds,
        // rather than sampling path triangles or texture alpha during input.
        hit = px >= 0 && py >= 0 && px <= size.x && py <= size.y;
        const float radius = std::min({_radius, size.x * .5F, size.y * .5F});
        if (hit && _type == 0 && radius > 0) {
            const float dx = px < radius ? px - radius : (px > size.x - radius ? px - (size.x - radius) : 0.F);
            const float dy = py < radius ? py - radius : (py > size.y - radius ? py - (size.y - radius) : 0.F);
            hit = dx * dx + dy * dy <= radius * radius;
        }
    }
    return _inverted ? !hit : hit;
}
void Mask::setAlphaThreshold(float value) {
    _alphaThreshold = value;
    if (_material) _material->setPropertyFloat32("alphaThreshold", value);
}
void Mask::setInverted(bool value) {
    _inverted = value;
    getRenderEntity()->setMaskMode(value ? MaskMode::MASK_INVERTED : MaskMode::MASK);
}
void Mask::setEnabled(bool value) {
    Component::setEnabled(value);
    _sprite.setEnabled(value);
    _graphics.setEnabled(value);
}
void Mask::setMaterial(Material *material) {
    _sprite.setMaterial(material);
    _material = _sprite.getMaterialInstance(); // per-Mask threshold must not mutate the shared parent
    setAlphaThreshold(_alphaThreshold);
}
void Mask::setPriority(int32_t value) {
    _priority = value;
    _sprite.setPriority(value);
    _graphics.setPriority(value);
}
void Mask::prepareRenderEntity(float opacity) {
    _node = getRenderEntity()->getNode();
    // Reacquire the non-owning slot before dereferencing, including after a
    // UITransform is replaced/destroyed or added later.
    auto *transform = _node ? static_cast<UITransform *>(_node->getUIComponent(UITransform::TYPE_ID)) : nullptr;
    if (transform != _transform) setUITransform(transform);
    if (_type == 3) {
        _sprite.prepare(opacity);
        return;
    }
    if (_type != 2 && transform) {
        const auto size = transform->getContentSize();
        const auto anchor = transform->getAnchorPoint();
        if (_shapeDirty || size.x != _width || size.y != _height || anchor.x != _anchorX || anchor.y != _anchorY) {
            _width = size.x;
            _height = size.y;
            _anchorX = anchor.x;
            _anchorY = anchor.y;
            _graphics.clear();
            const float x = -_width * _anchorX, y = -_height * _anchorY;
            if (_type == 1) {
                for (uint32_t i = 0; i < _segments; ++i) {
                    const double a = i * 6.283185307179586 / _segments;
                    const double px = x + _width * .5 + std::cos(a) * _width * .5, py = y + _height * .5 + std::sin(a) * _height * .5;
                    if (i == 0)
                        _graphics.moveTo(px, py);
                    else
                        _graphics.lineTo(px, py);
                }
                _graphics.close();
            } else {
                const float radius = std::min({_radius, _width * .5F, _height * .5F});
                if (radius > 0) _graphics.roundRect(x, y, _width, _height, radius);
                else _graphics.rect(x, y, _width, _height);
            }
            _graphics.fill();
            _shapeDirty = false;
        }
    }
    _graphics.prepareRenderEntity(opacity);
}
} // namespace cc
