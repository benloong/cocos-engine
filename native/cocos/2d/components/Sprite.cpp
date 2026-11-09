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

#include "2d/components/Sprite.h"

#include "2d/assets/SpriteFrame.h"
#include "2d/framework/UITransform.h"
#include "2d/renderer/RenderDrawInfo.h"
#include "2d/renderer/RenderEntity.h"
#include "2d/renderer/SpriteGeometry.h"
#include "core/assets/Material.h"
#include "core/assets/TextureBase.h"
#include "core/scene-graph/Node.h"
#include "math/Mat4.h"

#include <cmath>

namespace cc {

namespace {

constexpr uint32_t VERTEX_STRIDE = 9; // position(3) + uv(2) + color(4)
constexpr uint32_t VERTEX_COUNT = 4;
constexpr uint32_t INDEX_COUNT = 6;

} // namespace

Sprite::Sprite() {
    _entity = new RenderEntity(RenderEntityType::STATIC);
    _entity->setPrepareListener(this);
}

Sprite::~Sprite() {
    _entity->setPrepareListener(nullptr);
    setNode(nullptr);
}

void Sprite::setNode(Node *node) {
    if (getNode() == node) {
        return;
    }

    if (getNode() != nullptr && _entity != nullptr) {
        _entity->setNode(nullptr);
    }

    Component::setNode(node);

    if (getNode() != nullptr && _entity != nullptr) {
        _entity->setNode(getNode());
        _entity->setEnabled(isEnabled());
    }
    _dirty = true;
}

void Sprite::setFrame(TextureBase *texture,
                      float rectX,
                      float rectY,
                      float rectWidth,
                      float rectHeight,
                      float originalWidth,
                      float originalHeight,
                      float offsetX,
                      float offsetY,
                      float textureWidth,
                      float textureHeight,
                      bool rotated) {
    _texture = texture;
    _frameRect.setRect(rectX, rectY, rectWidth, rectHeight);
    _originalSize.set(originalWidth, originalHeight);
    _offset.set(offsetX, offsetY);
    _textureSize.set(textureWidth, textureHeight);
    _rotated = rotated;
    _dirty = true;
    if (_entity != nullptr) {
        _entity->setEnabled(true);
    }
}

void Sprite::setFrame(SpriteFrame *frame) {
    if (frame == nullptr) {
        clearFrame();
        return;
    }
    TextureBase *texture = frame->getTexture();
    const float textureWidth = texture == nullptr ? 0.F : static_cast<float>(texture->getWidth());
    const float textureHeight = texture == nullptr ? 0.F : static_cast<float>(texture->getHeight());
    setFrame(texture,
             frame->getRectX(), frame->getRectY(), frame->getRectWidth(), frame->getRectHeight(),
             frame->getOriginalWidth(), frame->getOriginalHeight(),
             frame->getOffsetX(), frame->getOffsetY(),
             textureWidth, textureHeight,
             frame->isRotated());
    _insetLeft = frame->getInsetLeft();
    _insetRight = frame->getInsetRight();
    _insetTop = frame->getInsetTop();
    _insetBottom = frame->getInsetBottom();
    _dirty = true;
}

void Sprite::setType(int32_t type) {
    if (_type == type) {
        return;
    }
    _type = type;
    _dirty = true;
}

void Sprite::setFillType(int32_t fillType) {
    if (_fillType == fillType) {
        return;
    }
    _fillType = fillType;
    _dirty = true;
}

void Sprite::setFillStart(float fillStart) {
    if (_fillStart == fillStart) {
        return;
    }
    _fillStart = fillStart;
    _dirty = true;
}

void Sprite::setFillRange(float fillRange) {
    if (_fillRange == fillRange) {
        return;
    }
    _fillRange = fillRange;
    _dirty = true;
}

void Sprite::setFillCenter(float x, float y) {
    if (_fillCenter.x == x && _fillCenter.y == y) {
        return;
    }
    _fillCenter.set(x, y);
    _dirty = true;
}

void Sprite::clearFrame() {
    _texture = nullptr;
    _frameRect.setRect(0.F, 0.F, 0.F, 0.F);
    if (_entity != nullptr) {
        _entity->setStaticDrawInfoSize(0);
        _entity->setEnabled(false);
    }
    _dirty = true;
}

void Sprite::setMaterial(Material *material) {
    UIRenderer::setMaterial(material);
    _dirty = true;
}

void Sprite::setColor(const Color &color) {
    if (_color.r == color.r && _color.g == color.g && _color.b == color.b && _color.a == color.a) {
        return;
    }
    UIRenderer::setColor(color);
    if (_entity != nullptr) {
        _entity->setColor(_color);
    }
    _dirty = true;
}

void Sprite::setColorRGBA(float red, float green, float blue, float alpha) {
    const auto toByte = [](float value) -> uint8_t {
        return static_cast<uint8_t>(value < 0.F ? 0.F : (value > 255.F ? 255.F : value));
    };
    setColor(Color(toByte(red), toByte(green), toByte(blue), toByte(alpha)));
}

void Sprite::setEnabled(bool enabled) {
    Component::setEnabled(enabled);
    if (_entity != nullptr) {
        _entity->setEnabled(enabled);
    }
    _dirty = true;
}

void Sprite::setPriority(int32_t priority) {
    if (_priority == priority) {
        return;
    }
    UIRenderer::setPriority(priority);
    if (_entity != nullptr) {
        _entity->setPriority(static_cast<uint32_t>(_priority));
    }
    _dirty = true;
}

void Sprite::setTrim(bool trim) {
    if (_trim == trim) {
        return;
    }
    _trim = trim;
    _dirty = true;
}

void Sprite::prepare(float opacity) {
    if (!_dirty && _lastOpacity >= 0.F && std::fabs(opacity - _lastOpacity) <= 1e-6F) {
        return;
    }
    if (_node == nullptr || _transform == nullptr || _texture == nullptr || _entity == nullptr) {
        return;
    }
    if (_frameRect.width <= 0.F || _frameRect.height <= 0.F) {
        return;
    }

    Material *material = getRenderMaterial();
    if (material == nullptr) {
        return;
    }

    gfx::Texture *texture = _texture->getGFXTexture();
    if (texture == nullptr) {
        return;
    }

    if (_dirty) {
        uint32_t vertexCount = 0;
        uint32_t indexCount = 0;

        if (_type == 1) {
            SlicedSpriteGeometryParams params;
            params.contentSize = _transform->getContentSize();
            params.anchorPoint = _transform->getAnchorPoint();
            params.frameRect = _frameRect;
            params.textureSize = _textureSize;
            params.insetLeft = _insetLeft;
            params.insetRight = _insetRight;
            params.insetTop = _insetTop;
            params.insetBottom = _insetBottom;

            SpriteMesh mesh = buildSlicedSpriteMesh(params);
            if (!mesh.valid) {
                return;
            }
            transformSpriteMesh(mesh, _node->getWorldMatrix());
            vertexCount = static_cast<uint32_t>(mesh.vertices.size());
            indexCount = static_cast<uint32_t>(mesh.indices.size());
            _vertices.assign(vertexCount * VERTEX_STRIDE, 0.F);
            for (uint32_t i = 0; i < vertexCount; ++i) {
                const uint32_t offset = i * VERTEX_STRIDE;
                _vertices[offset + 0] = mesh.vertices[i].position.x;
                _vertices[offset + 1] = mesh.vertices[i].position.y;
                _vertices[offset + 2] = mesh.vertices[i].position.z;
                _vertices[offset + 3] = mesh.vertices[i].uv.x;
                _vertices[offset + 4] = mesh.vertices[i].uv.y;
            }
            _indices = mesh.indices;
        } else if (_type == 3) {
            FilledSpriteGeometryParams params;
            params.contentSize = _transform->getContentSize();
            params.anchorPoint = _transform->getAnchorPoint();
            params.frameRect = _frameRect;
            params.textureSize = _textureSize;
            params.fillType = _fillType;
            params.fillStart = _fillStart;
            params.fillRange = _fillRange;
            params.fillCenter = _fillCenter;

            SpriteMesh mesh = buildFilledSpriteMesh(params);
            if (!mesh.valid) {
                return;
            }
            transformSpriteMesh(mesh, _node->getWorldMatrix());
            vertexCount = static_cast<uint32_t>(mesh.vertices.size());
            indexCount = static_cast<uint32_t>(mesh.indices.size());
            _vertices.assign(vertexCount * VERTEX_STRIDE, 0.F);
            for (uint32_t i = 0; i < vertexCount; ++i) {
                const uint32_t offset = i * VERTEX_STRIDE;
                _vertices[offset + 0] = mesh.vertices[i].position.x;
                _vertices[offset + 1] = mesh.vertices[i].position.y;
                _vertices[offset + 2] = mesh.vertices[i].position.z;
                _vertices[offset + 3] = mesh.vertices[i].uv.x;
                _vertices[offset + 4] = mesh.vertices[i].uv.y;
            }
            _indices = mesh.indices;
        } else {
            SimpleSpriteGeometryParams params;
            params.contentSize = _transform->getContentSize();
            params.anchorPoint = _transform->getAnchorPoint();
            params.frameRect = _frameRect;
            params.originalSize = _originalSize;
            params.offset = _offset;
            params.textureSize = _textureSize;
            params.trim = _trim;
            params.rotated = _rotated;

            SpriteQuad quad = buildSimpleSpriteQuad(params);
            if (!quad.valid) {
                return;
            }
            transformSpriteQuad(quad, _node->getWorldMatrix());
            vertexCount = VERTEX_COUNT;
            indexCount = INDEX_COUNT;
            _vertices.assign(VERTEX_COUNT * VERTEX_STRIDE, 0.F);
            for (uint32_t i = 0; i < VERTEX_COUNT; ++i) {
                const uint32_t offset = i * VERTEX_STRIDE;
                _vertices[offset + 0] = quad.vertices[i].position.x;
                _vertices[offset + 1] = quad.vertices[i].position.y;
                _vertices[offset + 2] = quad.vertices[i].position.z;
                _vertices[offset + 3] = quad.vertices[i].uv.x;
                _vertices[offset + 4] = quad.vertices[i].uv.y;
            }
            _indices.assign(quad.indices, quad.indices + INDEX_COUNT);
        }

        _entity->setStaticDrawInfoSize(1);
        RenderDrawInfo *drawInfo = _entity->getStaticRenderDrawInfo(0);
        if (drawInfo == nullptr) {
            return;
        }

        drawInfo->setDrawInfoType(static_cast<uint32_t>(RenderDrawInfoType::COMP));
        drawInfo->setIsMeshBuffer(true);
        drawInfo->setStride(static_cast<uint8_t>(VERTEX_STRIDE));
        drawInfo->setVbCount(vertexCount);
        drawInfo->setIbCount(indexCount);
        drawInfo->setVDataBuffer(_vertices.data());
        drawInfo->setIDataBuffer(_indices.data());
        drawInfo->setMaterial(material);
        drawInfo->setTexture(texture);
        drawInfo->setSampler(_texture->getGFXSampler());
        drawInfo->setDataHash(0);

        _entity->setPriority(static_cast<uint32_t>(_priority));
        _entity->setColor(_color);
        _entity->setEnabled(true);
        _entity->setFillColorType(FillColorType::VERTEX);

        _dirty = false;
    }

    updateVertexColors(opacity);
    _entity->setOpacity(opacity);
    _lastOpacity = opacity;
}

void Sprite::updateVertexColors(float opacity) {
    if (_vertices.empty()) {
        return;
    }

    const float red = static_cast<float>(_color.r) / 255.F;
    const float green = static_cast<float>(_color.g) / 255.F;
    const float blue = static_cast<float>(_color.b) / 255.F;

    const uint32_t vertexCount = static_cast<uint32_t>(_vertices.size() / VERTEX_STRIDE);
    for (uint32_t i = 0; i < vertexCount; ++i) {
        const uint32_t offset = i * VERTEX_STRIDE + 5;
        _vertices[offset + 0] = red;
        _vertices[offset + 1] = green;
        _vertices[offset + 2] = blue;
        _vertices[offset + 3] = opacity;
    }
}

} // namespace cc
