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
#include "core/builtin/BuiltinResMgr.h"

namespace cc {
namespace {
Material *getStencilMaterial() {
    auto *resources = BuiltinResMgr::getInstance();
    return resources ? resources->get<Material>("ui-alpha-test-material") : nullptr;
}
} // namespace

Mask::Mask() { _sprite.setSizeMode(0); }
Mask::~Mask() { setUITransform(nullptr); setNode(nullptr); }
Sprite *Mask::getSprite() const {
    if (!_useSpriteComponent) return const_cast<Sprite *>(&_sprite);
    return _node ? static_cast<Sprite *>(_node->getUIComponent(Sprite::TYPE_ID)) : nullptr;
}
RenderEntity *Mask::getRenderEntity() const {
    if (_type != 3) return _graphics.getRenderEntity();
    auto *sprite = getSprite();
    return sprite ? sprite->getRenderEntity() : nullptr;
}
void Mask::clearSpriteStencil() {
    if (!_useSpriteComponent) return;
    if (auto *sprite = getSprite()) {
        sprite->getRenderEntity()->setMaskMode(MaskMode::NONE);
        if (auto *stencil = getStencilMaterial(); stencil && sprite->getMaterial() == stencil) {
            sprite->setMaterial(nullptr);
        }
    }
}
void Mask::attach() {
    _sprite.setNode(nullptr);
    _graphics.setNode(nullptr);
    if (_type == 3) {
        if (!_useSpriteComponent) {
            _sprite.setNode(_node);
        }
        if (auto *sprite = getSprite(); sprite && (!_useSpriteComponent || _enabled)) {
            if (_node && !sprite->getMaterial()) {
                if (auto *stencil = getStencilMaterial()) sprite->setMaterial(stencil);
            }
            setAlphaThreshold(_alphaThreshold);
            sprite->getRenderEntity()->setNode(_node);
        }
    } else {
        _graphics.setNode(_node);
    }
    auto *entity = getRenderEntity();
    if (entity) {
        if (!_useSpriteComponent || _enabled) {
            entity->setMaskMode(_inverted ? MaskMode::MASK_INVERTED : MaskMode::MASK);
        }
        if (!_useSpriteComponent) {
            entity->setPriority(_priority);
            entity->setEnabled(_enabled);
        }
    }
}
void Mask::setNode(Node *node) {
    if (node != _node) clearSpriteStencil();
    Component::setNode(node);
    _shapeDirty = true;
    markRenderDirty();
    attach();
}
void Mask::onDetach() {
    UIRenderer::onDetach();
    _sprite.setNode(nullptr);
    _graphics.setNode(nullptr);
    setUITransform(nullptr);
    _shapeDirty = true;
    markRenderDirty();
}
void Mask::setUITransform(UITransform *transform) {
    if (_transform == transform) return;
    if (_transform) {
        _transform->off(_layoutChanged);
        _transform->off(_layoutDestroyed);
    }
    _transform = transform;
    if (transform) {
        _layoutChanged = transform->on<UITransform::LayoutChanged>([this](UITransform *) { markRenderDirty(); });
        _layoutDestroyed = transform->on<UITransform::LayoutDestroyed>([this](UITransform *) {
            _transform = nullptr;
            _shapeDirty = true;
            if (_type != 2) _graphics.clear();
            markRenderDirty();
        });
    }
    _shapeDirty = true;
    markRenderDirty();
    if(!transform && _type!=2) _graphics.clear();
}
void Mask::setType(int32_t type, bool useSpriteComponent) {
    useSpriteComponent = type == 3 && useSpriteComponent;
    if (_type == type && _useSpriteComponent == useSpriteComponent) {
        // The Sprite shell can finish loading after the Mask shell.
        if (useSpriteComponent) attach();
        return;
    }
    clearSpriteStencil();
    _type = type;
    _useSpriteComponent = useSpriteComponent;
    _shapeDirty = true;
    markRenderDirty();
    _graphics.clear();
    _graphics.setUseGeometrySource(_type == 2);
    attach();
}
void Mask::setSpriteFrame(SpriteFrame *frame) {
    if (auto *sprite = getSprite()) sprite->setFrame(frame);
}
void Mask::setGraphics(Graphics *graphics) {
    _graphics.setGeometrySource(graphics);
}
void Mask::setSegments(uint32_t segments) {
    _segments = std::clamp(segments, 3U, 10000U);
    _shapeDirty = true;
    markRenderDirty();
}
void Mask::setRadius(float radius) {
    radius = std::max(0.F, radius);
    if (_radius == radius) return;
    _radius = radius;
    _shapeDirty = true;
    markRenderDirty();
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
    if (_type == 3 && (!_useSpriteComponent || _enabled)) {
        if (auto *sprite = getSprite()) {
            // The shared parent may be used by other masks with different thresholds.
            if (auto *material = sprite->getMaterialInstance()) material->setPropertyFloat32("alphaThreshold", value);
        }
    }
}
void Mask::setInverted(bool value) {
    _inverted = value;
    if (_useSpriteComponent && !_enabled) return;
    if (auto *entity = getRenderEntity()) entity->setMaskMode(value ? MaskMode::MASK_INVERTED : MaskMode::MASK);
}
void Mask::setEnabled(bool value) {
    if (_useSpriteComponent && _enabled != value && !value) clearSpriteStencil();
    const bool enableSpriteStencil = _useSpriteComponent && !_enabled && value;
    Component::setEnabled(value);
    if (enableSpriteStencil) attach();
    _sprite.setEnabled(value);
    _graphics.setEnabled(value);
}
void Mask::setMaterial(Material *material) {
    if (auto *sprite = getSprite()) sprite->setMaterial(material);
    setAlphaThreshold(_alphaThreshold);
}
void Mask::setPriority(int32_t value) {
    _priority = value;
    _sprite.setPriority(value);
    if (_useSpriteComponent) {
        if (auto *sprite = getSprite()) sprite->setPriority(value);
    }
    _graphics.setPriority(value);
}
void Mask::updateRenderer() {
    if (!renderDirtyFlags()) return;
    clearRenderDirty();
    // Reacquire the non-owning slot before dereferencing, including after a
    // UITransform is replaced/destroyed or added later.
    auto *transform = _node ? static_cast<UITransform *>(_node->getUIComponent(UITransform::TYPE_ID)) : nullptr;
    if (transform != _transform) setUITransform(transform);
    if (_type == 3) {
        if (!_useSpriteComponent) _sprite.updateRenderer();
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
    _graphics.updateRenderer();
}
} // namespace cc
