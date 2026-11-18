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
#include "2d/framework/UIComponentType.h"

#include <cstdint>
#include <vector>

#include "2d/assets/SpriteFrame.h"
#include "2d/framework/UITransform.h"
#include "2d/framework/UIRenderer.h"
#include "2d/renderer/RenderEntity.h"
#include "base/Ptr.h"
#include "math/Geometry.h"
#include "math/Vec2.h"
#include "math/Mat4.h"

namespace cc {

class Node;
class RenderDrawInfo;
class TextureBase;
class SpriteFrame;
class Label;
struct SpriteQuad;
class UITransform;

/**
 * Native Sprite backend for simple, sliced, tiled and filled geometry.
 *
 * The JS Sprite shell owns Component identity, serialization and lifecycle.
 * UIRenderer owns color/material/priority; this class owns frame data,
 * geometry and the RenderEntity.
 */
class Sprite final : public UIRenderer, public RenderEntity::IPrepareListener {
public:
    static constexpr uint32_t TYPE_ID = static_cast<uint32_t>(UIComponentTypeId::Sprite);

    Sprite();
    ~Sprite() override;

    uint32_t getTypeId() const override { return TYPE_ID; }

    void setNode(Node *node) override;
    void onDetach() override;
    Node *getNode() const { return Component::getNode(); }

    void setUITransform(UITransform *transform);
    UITransform *getUITransform() const { return _transform; }

    void setFrame(TextureBase *texture,
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
                  bool rotated);
    void setFrame(SpriteFrame *frame);
    void clearFrame();

    void setColor(const Color &color);
    void setColorRGBA(float red, float green, float blue, float alpha);
    void setMaterial(Material *material);
    void setPriority(int32_t priority);
    void setSharedMaterial(Material *material, uint32_t index, bool forceUpdate = false) override;
    void setMaterialInstance(Material *material, uint32_t index = 0) override;
    void setGrayscale(bool enabled);
    bool isGrayscale() const { return _grayscale; }
    void refreshMaterial();

    void setEnabled(bool enabled);

    void setTrim(bool trim);
    bool isTrim() const { return _trim; }

    void setType(int32_t type);
    int32_t getType() const { return _type; }

    void setFillType(int32_t fillType);
    int32_t getFillType() const { return _fillType; }
    void setFillStart(float fillStart);
    float getFillStart() const { return _fillStart; }
    void setFillRange(float fillRange);
    float getFillRange() const { return _fillRange; }
    void setFillCenter(float x, float y);
    float getFillCenterX() const { return _fillCenter.x; }
    float getFillCenterY() const { return _fillCenter.y; }

    void setSizeMode(int32_t sizeMode);
    int32_t getSizeMode() const { return _sizeMode; }
    RenderEntity *getRenderEntity() const override { return _entity.get(); }

    void setDirty() { markRenderDirty(); }
    void prepare(float opacity);
    void prepareRenderEntity(float opacity) override;
    void onWorldTransformDirty() override { markRenderDirty(); }

private:
    friend class Label;
    // Label owns layout; Sprite owns copied local quads and all submission buffers.
    void setLabelQuads(SpriteFrame *frame, std::vector<SpriteQuad> quads);
    void prepareLabelQuads(Material *material, float opacity);
    struct LabelMeshChunk {
        std::vector<float> vertices;
        std::vector<uint16_t> indices;
    };
    void bindFrame(SpriteFrame *frame);
    void bindTexture(TextureBase *texture);
    void applyFrame(TextureBase *texture, float rectX, float rectY, float rectWidth, float rectHeight,
                    float originalWidth, float originalHeight, float offsetX, float offsetY,
                    float textureWidth, float textureHeight, bool rotated);
    SpriteFrame::FrameChanged::EventID _frameChanged;
    TextureBase::RenderDataChanged::EventID _textureChanged;
    UITransform::LayoutChanged::EventID _layoutChanged;
    UITransform::LayoutDestroyed::EventID _layoutDestroyed;
    bool _hasLabelQuads{false};
    std::vector<SpriteQuad> _labelQuads;
    std::vector<LabelMeshChunk> _labelChunks;
    void invalidateBuiltinMaterial() { if (!_material) _materialInstance = nullptr; markRenderDirty(); }
    Material *getBuiltinMaterial() const override;
    void updateVertexColors(float opacity);
    void applySizeMode();

    UITransform *_transform{nullptr};
    IntrusivePtr<TextureBase> _texture;

    Rect _frameRect;
    Vec2 _originalSize;
    Vec2 _offset;
    Vec2 _textureSize;
    bool _rotated{false};
    bool _trim{true};
    bool _grayscale{false};
    uint32_t _builtinVariant{0};
    int32_t _type{0};
    int32_t _fillType{0};
    float _fillStart{0.F};
    float _fillRange{0.F};
    Vec2 _fillCenter{0.F, 0.F};
    int32_t _sizeMode{1};
    float _insetLeft{0.F};
    float _insetRight{0.F};
    float _insetTop{0.F};
    float _insetBottom{0.F};
    float _lastOpacity{-1.F};

    IntrusivePtr<RenderEntity> _entity;
    IntrusivePtr<SpriteFrame> _spriteFrame;
    uint32_t _frameRevision{0};
    uint32_t _frameTextureWidth{0};
    uint32_t _frameTextureHeight{0};
    int32_t _frameTextureFormat{-1};
    bool _flipUVX{false};
    bool _flipUVY{false};
    std::vector<float> _vertices;
    std::vector<uint16_t> _indices;
};

} // namespace cc
