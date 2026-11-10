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

#include <string>

#include "2d/components/Sprite.h"
#include "2d/framework/UIRenderer.h"
#include "2d/renderer/RenderEntity.h"
#include "base/Ptr.h"
#include "math/Color.h"

namespace cc {

class Texture2D;
class SpriteFrame;
class UITransform;

/**
 * M3 native Label vertical slice.
 *
 * TTF text is measured/laid out by the platform Canvas delegate, uploaded to a
 * Texture2D, and submitted through an internal Sprite. The JS Label shell owns
 * serialization and forwards the public API.
 */
class Label final : public UIRenderer, public RenderEntity::IPrepareListener {
public:
    static constexpr uint32_t TYPE_ID = UIRenderer::TYPE_ID + 2;

    Label();
    ~Label() override;

    uint32_t getTypeId() const override { return TYPE_ID; }

    void setNode(Node *node);
    void setUITransform(UITransform *transform);

    void setString(const std::string &text);
    const std::string &getString() const { return _string; }

    void setFont(const std::string &font);
    void setFontSize(float size);
    void setLineHeight(float height);
    void setEnableWrapText(bool wrap);
    void setOverflow(int32_t overflow);
    void setHorizontalAlign(int32_t align);
    void setVerticalAlign(int32_t align);
    void setSpacingX(float spacing);
    void setEnableOutline(bool enable);
    void setOutlineColor(const Color &color);
    void setOutlineWidth(float width);
    void setEnableShadow(bool enable);
    void setShadowColor(const Color &color);
    void setShadowBlur(float blur);
    void setShadowOffset(float x, float y);
    float getTextureWidth() const { return _lastTextureWidth; }
    float getTextureHeight() const { return _lastTextureHeight; }
    int32_t getLineCount() const { return _lastLineCount; }
    float getContentWidth() const { return _lastContentWidth; }
    float getContentHeight() const { return _lastContentHeight; }
    uint32_t getPixelChecksum() const { return _lastPixelChecksum; }
    uint32_t getOpaquePixels() const { return _lastOpaquePixels; }

    void setColor(const Color &color);
    void setColorRGBA(float r, float g, float b, float a);
    void setMaterial(Material *material);
    void setPriority(int32_t priority);
    void setEnabled(bool enabled);

    void prepareRenderEntity(float opacity) override;

private:
    void rebuildTexture();

    Sprite _renderer;
    UITransform *_transform{nullptr};

    std::string _string;
    std::string _font{"32px Arial"};
    std::string _fontFamily{"Arial"};
    float _fontSize{32.0F};
    float _lineHeight{0.0F};
    float _spacingX{0.0F};
    bool _wrap{false};
    int32_t _overflow{0};
    int32_t _hAlign{0};
    int32_t _vAlign{0};
    bool _enableOutline{false};
    Color _outlineColor{0, 0, 0, 255};
    float _outlineWidth{0.0F};
    bool _enableShadow{false};
    Color _shadowColor{0, 0, 0, 255};
    float _shadowBlur{0.0F};
    float _shadowOffsetX{0.0F};
    float _shadowOffsetY{0.0F};
    bool _dirty{true};
    float _lastTextureWidth{0.0F};
    float _lastTextureHeight{0.0F};
    int32_t _lastLineCount{0};
    float _lastContentWidth{0.0F};
    float _lastContentHeight{0.0F};
    uint32_t _lastPixelChecksum{0};
    uint32_t _lastOpaquePixels{0};

    IntrusivePtr<Texture2D> _texture;
    IntrusivePtr<SpriteFrame> _frame;
};

} // namespace cc
