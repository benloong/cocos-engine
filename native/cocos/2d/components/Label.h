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
#include <array>
#include "2d/framework/UIComponentType.h"

#include <string>

#include "2d/components/Sprite.h"
#include "2d/assets/BitmapFont.h"
#include "2d/framework/UIRenderer.h"
#include "2d/renderer/RenderEntity.h"
#include "base/Ptr.h"
#include "math/Color.h"

namespace cc {

class Texture2D;
class LetterAtlas;
class SpriteFrame;
class UITransform;

/**
 * M3 native Label vertical slice.
 *
 * TTF text is measured/laid out by the platform Canvas delegate, uploaded to a
 * Texture2D, and submitted through an internal Sprite. The JS Label shell owns
 * serialization and forwards the public API.
 */
class Label final : public UIRenderer {
public:
    static constexpr uint32_t TYPE_ID = static_cast<uint32_t>(UIComponentTypeId::Label);

    Label();
    ~Label() override;

    uint32_t getTypeId() const override { return TYPE_ID; }

    void setNode(Node *node) override;
    void setUITransform(UITransform *transform);

    void setString(const std::string &text);
    const std::string &getString() const { return _string; }

    void setFont(const std::string &font);
    void setFontAsset(FontAsset *font);
    FontAsset *getFontAsset() const { return _fontAsset.get(); }
    void setFontSize(float size);
    double getActualFontSize() const { return _actualFontSize; }
    void setActualFontSize(double size) { _actualFontSize = size; }
    void setUnderlineHeight(float height) { if (_underlineHeight != height) { _underlineHeight = height; markRenderDirty(); } }
    float getUnderlineHeight() const { return _underlineHeight; }
    void setIsBold(bool bold) { if (_isBold != bold) { _isBold = bold; updateFont(); markRenderDirty(); } }
    void setIsItalic(bool italic) { if (_isItalic != italic) { _isItalic = italic; updateFont(); markRenderDirty(); } }
    void setIsUnderline(bool underline) { if (_isUnderline != underline) { _isUnderline = underline; markRenderDirty(); } }
    bool isBold() const { return _isBold; }
    bool isItalic() const { return _isItalic; }
    bool isUnderline() const { return _isUnderline; }
    void updateFont();
    void setLineHeight(float height);
    void setEnableWrapText(bool wrap);
    void setOverflow(int32_t overflow);
    void setHorizontalAlign(int32_t align);
    void setVerticalAlign(int32_t align);
    void setSpacingX(float spacing);
    void setCacheMode(int32_t mode);
    int32_t getCacheMode() const { return _cacheMode; }
    void setEnableOutline(bool enable);
    void setOutlineColor(const Color &color);
    void setOutlineWidth(float width);
    void setEnableShadow(bool enable);
    void setShadowColor(const Color &color);
    void setShadowBlur(float blur);
    void setShadowOffset(float x, float y);
    SpriteFrame *getTTFSpriteFrame() const { return _ttfFrame.get(); }
    Texture2D *getLetterTexture();
    void setLetterTexture(Texture2D *texture);
    void destroyTTFSpriteFrame();
    void updateRenderData();
    void updateRenderData(bool force);
    void measureContent();
    Size measureUnwrappedText(const std::string &text);
    float getContentWidth() const { return _lastContentWidth; }
    double getTTFContentWidth() const { return _ttfContentWidth; }
    void setTTFContentWidth(double width) { _ttfContentWidth = width; }
    float getContentHeight() const { return _lastContentHeight; }
    RenderEntity *getRenderEntity() const override { return _renderer.getRenderEntity(); } // borrowed while this Label is alive

    void setColor(const Color &color);
    void setColorRGBA(float r, float g, float b, float a);
    void setMaterial(Material *material);
    void setPriority(int32_t priority);
    void setEnabled(bool enabled);


private:
    void updateRenderer() override;
    friend class RichText;
    std::array<double, 2> measureUnwrappedTextPrecise(const std::string &text);
    std::array<double, 2> getTextStyleExtent() const;
    void onMaterialChanged() override;
    void rebuildTexture();
    void ensureTTFFrame();
    std::string fontDescription(float size) const;
    float shrinkFontSize(float width, float height) const;
    void onUITransformChanged() override;
    void onDetach() override;
    void syncFontAsset();
    void bindBitmapAtlas(SpriteFrame *atlas);
    void bindBitmapTexture(TextureBase *texture);
    FontAsset::FontChanged::EventID _fontChanged;
    SpriteFrame::FrameChanged::EventID _atlasChanged;
    TextureBase::RenderDataChanged::EventID _atlasTextureChanged;
    IntrusivePtr<TextureBase> _observedAtlasTexture;
    void syncContentSize();
    void syncTransformSize();
    void applyFontAsset();
    void clearRenderedData();
    void rebuildBitmapTexture();
    void syncBitmapAtlas();
    void rebuildLetterTexture();

    Sprite _renderer;
    bool _syncingContentSize{false};
    UITransform *_transform{nullptr};
    UITransform::LayoutChanged::EventID _layoutChanged;
    UITransform::LayoutDestroyed::EventID _layoutDestroyed;

    std::string _string;
    std::string _font{"32px Arial"};
    std::string _fontFamily{"Arial"};
    bool _isBold{false};
    bool _isItalic{false};
    bool _isUnderline{false};
    float _fontSize{32.0F};
    double _actualFontSize{0.0};
    float _underlineHeight{2.F};
    float _lineHeight{0.0F};
    float _spacingX{0.0F};
    bool _wrap{false};
    int32_t _overflow{0};
    int32_t _cacheMode{0};
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
    float _layoutWidth{-1.F};
    float _layoutHeight{-1.F};
    float _lastContentWidth{0.0F};
    double _ttfContentWidth{0.0};
    float _lastContentHeight{0.0F};

    IntrusivePtr<FontAsset> _fontAsset;
    BitmapFontAsset *_bitmapFont{nullptr}; // owned by _fontAsset
    uint32_t _fontAssetRevision{0};
    LetterAtlas &acquireLetterAtlas();
    IntrusivePtr<LetterAtlas> _letterAtlas;

    IntrusivePtr<SpriteFrame> _bitmapAtlas;
    uint32_t _bitmapAtlasRevision{0};
    TextureBase *_bitmapTextureSeen{nullptr}; // comparison only; never dereferenced, owned through _bitmapAtlas
    uint32_t _bitmapWidthSeen{0};
    uint32_t _bitmapHeightSeen{0};
    int32_t _bitmapFormatSeen{-1};
    float _bitmapLineHeight{0.0F};

    IntrusivePtr<Texture2D> _texture;
    IntrusivePtr<Texture2D> _ttfTexture;
    IntrusivePtr<SpriteFrame> _ttfFrame;
    IntrusivePtr<SpriteFrame> _frame;
};

} // namespace cc
