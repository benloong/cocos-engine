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
#include <vector>

#include "2d/framework/UIRenderer.h"
#include "2d/renderer/RenderEntity.h"
#include "base/Ptr.h"
#include "math/Geometry.h"
#include "math/Vec2.h"

namespace cc {

class Node;
class RenderDrawInfo;
class TextureBase;
class SpriteFrame;
class UITransform;

/**
 * M0/M2 vertical slice for a native Sprite in SIMPLE mode.
 *
 * The JS Sprite shell owns Component identity, serialization and lifecycle.
 * UIRenderer owns color/material/priority; this class owns frame data,
 * geometry and the RenderEntity.
 */
class Sprite final : public UIRenderer, public RenderEntity::IPrepareListener {
public:
    static constexpr uint32_t TYPE_ID = UIRenderer::TYPE_ID + 1;

    Sprite();
    ~Sprite() override;

    uint32_t getTypeId() const override { return TYPE_ID; }

    void setNode(Node *node);
    Node *getNode() const { return Component::getNode(); }

    void setUITransform(UITransform *transform) { _transform = transform; }
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

    void setEnabled(bool enabled);

    void setTrim(bool trim);
    bool isTrim() const { return _trim; }

    RenderEntity *getRenderEntity() const { return _entity.get(); }

    void setDirty() { _dirty = true; }
    void prepare(float opacity);
    void prepareRenderEntity(float opacity) override { prepare(opacity); }

private:
    void updateVertexColors(float opacity);

    UITransform *_transform{nullptr};
    TextureBase *_texture{nullptr};

    Rect _frameRect;
    Vec2 _originalSize;
    Vec2 _offset;
    Vec2 _textureSize;
    bool _rotated{false};
    bool _trim{true};
    bool _dirty{true};
    float _lastOpacity{-1.F};

    IntrusivePtr<RenderEntity> _entity;
    std::vector<float> _vertices;
    std::vector<uint16_t> _indices;
};

} // namespace cc
