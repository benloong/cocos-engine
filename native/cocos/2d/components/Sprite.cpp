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
#include "core/assets/RenderTexture.h"
#include "core/builtin/BuiltinResMgr.h"
#include "core/scene-graph/Node.h"
#include "math/Mat4.h"

#include <cmath>

namespace cc {

namespace {

constexpr uint32_t VERTEX_STRIDE = 9; // position(3) + uv(2) + color(4)
constexpr uint32_t VERTEX_COUNT = 4;
constexpr uint32_t INDEX_COUNT = 6;
uint32_t materialVariant(TextureBase *texture) {
    if (!texture) return 0;
    const auto format = texture->getPixelFormat();
    const bool separate = format == PixelFormat::RGBA_ETC1 || format == PixelFormat::RGB_A_PVRTC_4BPPV1 || format == PixelFormat::RGB_A_PVRTC_2BPPV1;
    return (separate ? 1U : 0U) | (dynamic_cast<RenderTexture *>(texture) ? 2U : 0U);
}

} // namespace

Sprite::Sprite() {
    markRenderDirty();
    _entity = new RenderEntity(RenderEntityType::STATIC);
    _entity->useSpriteVertexOpacity();
    _vertices.reserve(64U * VERTEX_STRIDE);
    _indices.reserve(128U);
}

Sprite::~Sprite() {
    setUITransform(nullptr);
    bindFrame(nullptr);
    bindTexture(nullptr);
    _entity->setStaticDrawInfoSize(0); // Invalidate borrowed chunk pointers before their owner is destroyed.
    setNode(nullptr);
}
void Sprite::onDetach() {
    setUITransform(nullptr);
    _entity->setStaticDrawInfoSize(0);
    markRenderDirty();
    _entity->setNode(nullptr);
    UIRenderer::onDetach();
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
        setUITransform(static_cast<UITransform *>(getNode()->getUIComponent(UITransform::TYPE_ID)));
    }
    markRenderDirty();
}

void Sprite::setUITransform(UITransform *transform) {
    if (_transform == transform && !_sizeModePending) return;
    bindUITransform(transform);
    applySizeMode();
}

void Sprite::onUITransformChanged() {
    auto *transform = static_cast<UITransform *>(_node->getUIComponent(UITransform::TYPE_ID));
    if (_transform == transform) return;
    bindUITransform(transform);
    // Size callbacks may edit the node's component list while it is notifying observers.
    _sizeModePending = transform && _sizeMode != 0;
}

void Sprite::bindUITransform(UITransform *transform) {
    if (_transform == transform) return;
    if (_transform) {
        _transform->off(_layoutChanged);
        _transform->off(_layoutDestroyed);
    }
    _transform = transform;
    if (_transform) {
        _layoutChanged = _transform->on<UITransform::LayoutChanged>([this](UITransform *) { markRenderDirty(); });
        _layoutDestroyed = _transform->on<UITransform::LayoutDestroyed>([this](UITransform *) { _transform = nullptr; markRenderDirty(); });
    }
    markRenderDirty();
}

void Sprite::bindFrame(SpriteFrame *frame) {
    if (_spriteFrame == frame) return;
    if (_spriteFrame) _spriteFrame->off(_frameChanged);
    _spriteFrame = frame;
    if (frame) _frameChanged = frame->on<SpriteFrame::FrameChanged>([this](SpriteFrame *) { markRenderDirty(); });
}

void Sprite::bindTexture(TextureBase *texture) {
    if (_texture == texture) return;
    if (_texture) _texture->off(_textureChanged);
    _texture = texture;
    if (texture) _textureChanged = texture->on<TextureBase::RenderDataChanged>([this](TextureBase *) { markRenderDirty(); });
}

void Sprite::applyFrame(TextureBase *texture,
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
    const auto variant = materialVariant(texture);
    if (_builtinVariant != variant) { _builtinVariant = variant; invalidateBuiltinMaterial(); }
    bindTexture(texture);
    _frameRect.setRect(rectX, rectY, rectWidth, rectHeight);
    _originalSize.set(originalWidth, originalHeight);
    _offset.set(offsetX, offsetY);
    _textureSize.set(textureWidth, textureHeight);
    _rotated = rotated;
    _insetLeft = _insetRight = _insetTop = _insetBottom = 0.F;
    _flipUVX = _flipUVY = false;
    markRenderDirty();
    if (_entity != nullptr) {
        _entity->setEnabled(isEnabled());
    }
}

void Sprite::setFrame(SpriteFrame *frame) {
    if (_hasLabelQuads) {
        _entity->setStaticDrawInfoSize(0);
        _hasLabelQuads = false;
        _labelQuads.clear(); _labelChunks.clear();
    }

    if (frame == nullptr) {
        clearFrame();
        return;
    }
    bindFrame(frame);
    TextureBase *texture = frame->getTexture();
    const float textureWidth = texture == nullptr ? 0.F : static_cast<float>(texture->getWidth());
    const float textureHeight = texture == nullptr ? 0.F : static_cast<float>(texture->getHeight());
    applyFrame(texture,
             frame->getRectX(), frame->getRectY(), frame->getRectWidth(), frame->getRectHeight(),
             frame->getOriginalWidth(), frame->getOriginalHeight(),
             frame->getOffsetX(), frame->getOffsetY(),
             textureWidth, textureHeight,
             frame->isRotated());
    _insetLeft = frame->getInsetLeft();
    _insetRight = frame->getInsetRight();
    _insetTop = frame->getInsetTop();
    _insetBottom = frame->getInsetBottom();
    _frameRevision = frame->getRevision();
    _frameTextureWidth = texture == nullptr ? 0 : texture->getWidth();
    _frameTextureHeight = texture == nullptr ? 0 : texture->getHeight();
    _frameTextureFormat = texture == nullptr ? -1 : static_cast<int32_t>(texture->getPixelFormat());
    _flipUVX = frame->getFlipUVX();
    _flipUVY = frame->getFlipUVY();
    applySizeMode();
    markRenderDirty();
}

void Sprite::setType(int32_t type) {
    if (_type == type) {
        return;
    }
    _type = type;
    markRenderDirty();
}

void Sprite::setFillType(int32_t fillType) {
    if (_fillType == fillType) {
        return;
    }
    _fillType = fillType;
    markRenderDirty();
}

void Sprite::setFillStart(float fillStart) {
    if (_fillStart == fillStart) {
        return;
    }
    _fillStart = std::clamp(fillStart, 0.F, 1.F);
    markRenderDirty();
}

void Sprite::setFillRange(float fillRange) {
    if (_fillRange == fillRange) {
        return;
    }
    _fillRange = std::clamp(fillRange, -1.F, 1.F);
    markRenderDirty();
}

void Sprite::setFillCenter(float x, float y) {
    if (_fillCenter.x == x && _fillCenter.y == y) {
        return;
    }
    _fillCenter.set(x, y);
    markRenderDirty();
}

void Sprite::clearFrame() {
    if (_hasLabelQuads) {
        _entity->setStaticDrawInfoSize(0);
        _hasLabelQuads = false;
        _labelQuads.clear(); _labelChunks.clear();
    }

    bindFrame(nullptr);
    bindTexture(nullptr);
    _frameRect.setRect(0.F, 0.F, 0.F, 0.F);
    if (_entity != nullptr) {
        _entity->setStaticDrawInfoSize(0);
        _entity->setEnabled(false);
    }
    if (_builtinVariant != 0) { _builtinVariant = 0; invalidateBuiltinMaterial(); }
    markRenderDirty();
}

void Sprite::setMaterial(Material *material) {
    UIRenderer::setMaterial(material);
    markRenderDirty();
}

void Sprite::setSharedMaterial(Material *material, uint32_t index, bool forceUpdate) {
    UIRenderer::setSharedMaterial(material, index, forceUpdate);
    markRenderDirty();
}
void Sprite::setMaterialInstance(Material *material, uint32_t index) {
    UIRenderer::setMaterialInstance(material, index); markRenderDirty();
}
void Sprite::setGrayscale(bool enabled) {
    if (_grayscale == enabled) return;
    _grayscale = enabled; invalidateBuiltinMaterial();
}
void Sprite::refreshMaterial() {
    const auto variant = materialVariant(_texture.get());
    if (_builtinVariant != variant) { _builtinVariant = variant; invalidateBuiltinMaterial(); }
    markRenderDirty();
}
Material *Sprite::getBuiltinMaterial() const {
    auto *resources = BuiltinResMgr::getInstance();
    if (!resources) return nullptr;
    bool separateAlpha = false;
    if (_texture) {
        const auto format = _texture->getPixelFormat();
        separateAlpha = format == PixelFormat::RGBA_ETC1 || format == PixelFormat::RGB_A_PVRTC_4BPPV1 || format == PixelFormat::RGB_A_PVRTC_2BPPV1;
    }
    const std::string name = separateAlpha ? (_grayscale ? "ui-sprite-gray-alpha-sep-material" : "ui-sprite-alpha-sep-material")
                                          : (_grayscale ? "ui-sprite-gray-material" : "ui-sprite-material");
    auto *parent = resources->get<Material>(name);
    if (!parent || !dynamic_cast<RenderTexture *>(_texture.get())) return parent;
    const std::string rtName = "rt-" + name;
    auto *material = resources->get<Material>(rtName);
    const bool created = material == nullptr;
    if (created || material->getPasses()->empty()) {
        if (created) material = new Material();
        IMaterialInfo info; info.defines = IMaterialInfo::DefinesType(MacroRecord{{"SAMPLE_FROM_RT", true}});
        material->copy(parent, info);
        if (created) resources->addAsset(rtName, material);
    }
    return material;
}

void Sprite::setColor(const Color &color) {
    if (_color.r == color.r && _color.g == color.g && _color.b == color.b && _color.a == color.a) {
        return;
    }
    UIRenderer::setColor(color);
    if (_entity != nullptr) {
        _entity->setColor(_color);
    }
    // Keep geometry for a tint-only change; prepare still refreshes RGBA.
    markRenderDirty(COLOR);
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
    markRenderDirty();
}

void Sprite::setPriority(int32_t priority) {
    if (_priority == priority) {
        return;
    }
    UIRenderer::setPriority(priority);
    if (_entity != nullptr) {
        _entity->setPriority(static_cast<uint32_t>(_priority));
    }
    markRenderDirty();
}

void Sprite::setSizeMode(int32_t sizeMode) {
    if (_sizeMode == sizeMode) {
        return;
    }
    _sizeMode = sizeMode;
    applySizeMode();
    markRenderDirty();
}

void Sprite::applySizeMode() {
    _sizeModePending = false;
    if (_transform == nullptr) {
        return;
    }
    if (_sizeMode == 1) {
        if (_frameRect.width <= 0.F || _frameRect.height <= 0.F) {
            return;
        }
        _transform->setContentSize(_frameRect.width, _frameRect.height);
    } else if (_sizeMode == 2) {
        if (_originalSize.x <= 0.F || _originalSize.y <= 0.F) {
            return;
        }
        _transform->setContentSize(_originalSize.x, _originalSize.y);
    }
}

void Sprite::setTrim(bool trim) {
    if (_trim == trim) {
        return;
    }
    _trim = trim;
    markRenderDirty();
}

void Sprite::updateRenderer() {
    const auto dirty = renderDirtyFlags();
    if (!dirty) return;
    const float opacity = _entity->getOpacity();
    if (dirty == COLOR) {
        updateVertexColors(opacity, false);
        clearRenderDirty();
        return;
    }
    prepare(opacity);
}

void Sprite::prepare(float opacity) {
    if (_sizeModePending) applySizeMode();
    if (!renderDirtyFlags() && std::fabs(opacity - _lastOpacity) <= 1e-6F) return;
    if (_spriteFrame) {
        const auto *texture = _spriteFrame->getTexture();
        const uint32_t width = texture == nullptr ? 0 : texture->getWidth();
        const uint32_t height = texture == nullptr ? 0 : texture->getHeight();
        if (_frameRevision != _spriteFrame->getRevision() || width != _frameTextureWidth || height != _frameTextureHeight
            || (texture ? static_cast<int32_t>(texture->getPixelFormat()) : -1) != _frameTextureFormat) {
            setFrame(_spriteFrame.get());
        }
    }
    if (_node == nullptr || _transform == nullptr || _texture == nullptr || _entity == nullptr) {
        if (_entity != nullptr) _entity->setStaticDrawInfoSize(0);
        return;
    }
    if (_frameRect.width <= 0.F || _frameRect.height <= 0.F) {
        _entity->setStaticDrawInfoSize(0);
        return;
    }

    Material *material = getRenderMaterial();
    if (material == nullptr) {
        _entity->setStaticDrawInfoSize(0);
        return;
    }

    gfx::Texture *texture = _texture->getGFXTexture();
    if (texture == nullptr) {
        _entity->setStaticDrawInfoSize(0);
        return;
    }

    if (_hasLabelQuads) { prepareLabelQuads(material, opacity); return; }

    auto clearGeometry = [&]() {
        _entity->setStaticDrawInfoSize(0); clearRenderDirty(); _lastOpacity = opacity;
    };
    bool indicesChanged = (renderDirtyFlags() & GEOMETRY) != 0;
    if (indicesChanged) {
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
            params.rotated = _rotated;

            SpriteMesh mesh = buildSlicedSpriteMesh(params);
            if (!mesh.valid) {
                clearGeometry();
                return;
            }
            transformSpriteMesh(mesh, _node->getWorldMatrix());
            vertexCount = static_cast<uint32_t>(mesh.vertices.size());
            indexCount = static_cast<uint32_t>(mesh.indices.size());
            _vertices.resize(static_cast<size_t>(vertexCount) * VERTEX_STRIDE);
            for (uint32_t i = 0; i < vertexCount; ++i) {
                const uint32_t offset = i * VERTEX_STRIDE;
                _vertices[offset + 0] = mesh.vertices[i].position.x;
                _vertices[offset + 1] = mesh.vertices[i].position.y;
                _vertices[offset + 2] = mesh.vertices[i].position.z;
                _vertices[offset + 3] = mesh.vertices[i].uv.x;
                _vertices[offset + 4] = mesh.vertices[i].uv.y;
            }
            _indices = mesh.indices;
        } else if (_type == 2) {
            TiledSpriteGeometryParams params;
            params.contentSize = _transform->getContentSize();
            params.anchorPoint = _transform->getAnchorPoint();
            params.frameRect = _frameRect;
            params.textureSize = _textureSize;
            params.rotated = _rotated;
            params.insetLeft = _insetLeft;
            params.insetRight = _insetRight;
            params.insetTop = _insetTop;
            params.insetBottom = _insetBottom;

            SpriteMesh mesh = buildTiledSpriteMesh(params);
            if (!mesh.valid) {
                clearGeometry();
                return;
            }
            transformSpriteMesh(mesh, _node->getWorldMatrix());
            vertexCount = static_cast<uint32_t>(mesh.vertices.size());
            indexCount = static_cast<uint32_t>(mesh.indices.size());
            _vertices.resize(static_cast<size_t>(vertexCount) * VERTEX_STRIDE);
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
            params.rotated = _rotated;

            SpriteMesh mesh = buildFilledSpriteMesh(params);
            if (!mesh.valid) {
                clearGeometry();
                return;
            }
            transformSpriteMesh(mesh, _node->getWorldMatrix());
            vertexCount = static_cast<uint32_t>(mesh.vertices.size());
            indexCount = static_cast<uint32_t>(mesh.indices.size());
            _vertices.resize(static_cast<size_t>(vertexCount) * VERTEX_STRIDE);
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
                clearGeometry();
                return;
            }
            transformSpriteQuad(quad, _node->getWorldMatrix());
            vertexCount = VERTEX_COUNT;
            indexCount = INDEX_COUNT;
            _vertices.resize(static_cast<size_t>(VERTEX_COUNT) * VERTEX_STRIDE);
            for (uint32_t i = 0; i < VERTEX_COUNT; ++i) {
                const uint32_t offset = i * VERTEX_STRIDE;
                _vertices[offset + 0] = quad.vertices[i].position.x;
                _vertices[offset + 1] = quad.vertices[i].position.y;
                _vertices[offset + 2] = quad.vertices[i].position.z;
                _vertices[offset + 3] = quad.vertices[i].uv.x;
                _vertices[offset + 4] = quad.vertices[i].uv.y;
            }
            // Layout, UV and transform changes keep the topology of an existing quad.
            indicesChanged = _entity->getStaticDrawInfoSize() == 0 || _indices.size() != INDEX_COUNT
                || !std::equal(quad.indices, quad.indices + INDEX_COUNT, _indices.begin());
            if (indicesChanged) _indices.assign(quad.indices, quad.indices + INDEX_COUNT);
        }

        // Web sliced/radial UV paths do not apply quad flip flags. Other modes mirror
        // texture coordinates inside the complete (possibly rotated) frame.
        if (_type != 1 && !(_type == 3 && _fillType == 2) && (_flipUVX || _flipUVY) && _textureSize.x > 0 && _textureSize.y > 0) {
            const float sumU = (2 * _frameRect.x + (_rotated ? _frameRect.height : _frameRect.width)) / _textureSize.x;
            const float sumV = (2 * _frameRect.y + (_rotated ? _frameRect.width : _frameRect.height)) / _textureSize.y;
            for (uint32_t i = 0; i < vertexCount; ++i) {
                if (_flipUVX) _vertices[i * VERTEX_STRIDE + 3] = sumU - _vertices[i * VERTEX_STRIDE + 3];
                if (_flipUVY) _vertices[i * VERTEX_STRIDE + 4] = sumV - _vertices[i * VERTEX_STRIDE + 4];
            }
        }
        _entity->setStaticDrawInfoSize(1);
        RenderDrawInfo *drawInfo = _entity->getStaticRenderDrawInfo(0);
        if (drawInfo == nullptr) {
            return;
        }

        drawInfo->setDrawInfoType(static_cast<uint32_t>(RenderDrawInfoType::COMP));
        drawInfo->_batchableSpriteMesh = !_material && !_materialInstance;
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
        _entity->setEnabled(isEnabled());
        _entity->setFillColorType(FillColorType::VERTEX);

    }

    updateVertexColors(opacity, indicesChanged);
    clearRenderDirty();
}

void Sprite::setLabelQuads(SpriteFrame *frame, std::vector<SpriteQuad> quads) {
    setFrame(frame);
    _labelQuads = std::move(quads);
    _hasLabelQuads = true;
    markRenderDirty();
}

void Sprite::prepareLabelQuads(Material *material, float opacity) {
    constexpr size_t QUADS_PER_CHUNK = 16383; // 65532 vertices, within the 16-bit mesh-buffer limit.
    if (renderDirtyFlags() & GEOMETRY) {
        _entity->setStaticDrawInfoSize(0);
        _labelChunks.resize((_labelQuads.size() + QUADS_PER_CHUNK - 1) / QUADS_PER_CHUNK);
        const auto size = _transform->getContentSize();
        const auto anchor = _transform->getAnchorPoint();
        const Vec3 origin(-anchor.x * size.x, (1.F - anchor.y) * size.y, 0.F);
        for (size_t chunkIndex = 0; chunkIndex < _labelChunks.size(); ++chunkIndex) {
            auto &chunk = _labelChunks[chunkIndex];
            const size_t first = chunkIndex * QUADS_PER_CHUNK;
            const size_t count = std::min(QUADS_PER_CHUNK, _labelQuads.size() - first);
            chunk.vertices.resize(count * 4 * VERTEX_STRIDE);
            chunk.indices.resize(count * 6);
            for (size_t q = 0; q < count; ++q) {
                for (size_t v = 0; v < 4; ++v) {
                    auto position = _labelQuads[first + q].vertices[v].position + origin;
                    Vec3::transformMat4(position, _node->getWorldMatrix(), &position);
                    const size_t at = (q * 4 + v) * VERTEX_STRIDE;
                    chunk.vertices[at] = position.x; chunk.vertices[at + 1] = position.y; chunk.vertices[at + 2] = position.z;
                    chunk.vertices[at + 3] = _labelQuads[first + q].vertices[v].uv.x;
                    chunk.vertices[at + 4] = _labelQuads[first + q].vertices[v].uv.y;
                }
                const auto base = static_cast<uint16_t>(q * 4);
                const uint16_t indices[] = {base, static_cast<uint16_t>(base + 1), static_cast<uint16_t>(base + 2),
                    static_cast<uint16_t>(base + 1), static_cast<uint16_t>(base + 3), static_cast<uint16_t>(base + 2)};
                std::copy(indices, indices + 6, chunk.indices.begin() + q * 6);
            }
        }
        _entity->setStaticDrawInfoSize(static_cast<uint32_t>(_labelChunks.size()));
    }
    for (size_t i = 0; i < _labelChunks.size(); ++i) {
        auto &chunk = _labelChunks[i];
        auto *draw = _entity->getStaticRenderDrawInfo(static_cast<uint32_t>(i));
        draw->setDrawInfoType(static_cast<uint32_t>(RenderDrawInfoType::COMP));
        draw->_batchableSpriteMesh = !_material && !_materialInstance;
        draw->setIsMeshBuffer(true); draw->setStride(static_cast<uint8_t>(VERTEX_STRIDE));
        draw->setVbCount(static_cast<uint32_t>(chunk.vertices.size() / VERTEX_STRIDE));
        draw->setIbCount(static_cast<uint32_t>(chunk.indices.size()));
        draw->setVDataBuffer(chunk.vertices.data()); draw->setIDataBuffer(chunk.indices.data());
        draw->setMaterial(material); draw->setTexture(_texture->getGFXTexture()); draw->setSampler(_texture->getGFXSampler()); draw->setDataHash(0);
    }
    _entity->setPriority(_priority); _entity->setColor(_color); _entity->setEnabled(isEnabled());
    _entity->setFillColorType(FillColorType::VERTEX);
    updateVertexColors(opacity, (renderDirtyFlags() & GEOMETRY) != 0);
    clearRenderDirty();
}

void Sprite::updateVertexColors(float opacity, bool indicesChanged) {
    const float red = _color.r / 255.F;
    const float green = _color.g / 255.F;
    const float blue = _color.b / 255.F;
    const auto count = _entity->getStaticDrawInfoSize();
    for (uint32_t i = 0; i < count; ++i) {
        auto *draw = _entity->getStaticRenderDrawInfo(i);
        auto *vertices = draw->getVDataBuffer();
        const auto vertexCount = draw->getVbCount();
        for (uint32_t v = 0; v < vertexCount; ++v) {
            auto *rgba = vertices + v * VERTEX_STRIDE + 5;
            rgba[0] = red;
            rgba[1] = green;
            rgba[2] = blue;
            rgba[3] = opacity;
        }
        draw->markSpriteVerticesUpdated(indicesChanged);
    }
    _entity->setOpacity(opacity);
    _lastOpacity = opacity;
}

} // namespace cc
