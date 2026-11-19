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
#include "2d/framework/UIRenderer.h"
#include "2d/framework/UITransform.h"
#include "core/scene-graph/Node.h"
#include "2d/renderer/RichTextLayout.h"
#include "2d/assets/Font.h"
#include "2d/assets/SpriteAtlas.h"
#include "math/Color.h"
#include <memory>

namespace cc {
class Label;
class Sprite;
class UITransform;

/** Native parser, layout and Label/Sprite segment ownership for RichText. */
class RichText final : public UIRenderer {
public:
    static constexpr uint32_t TYPE_ID = static_cast<uint32_t>(UIComponentTypeId::RichText);
    RichText();
    ~RichText() override;
#ifndef SWIG
    // Called for components owned exclusively by a segment, just before their destruction.
    static void setSegmentDisposeCallback(void (*callback)(void *));
#endif
    uint32_t getTypeId() const override { return TYPE_ID; }
    void onAttach() override;
    void onDetach() override;
    void onEnable() override;
    void onDisable() override;
    void setUITransform(UITransform *transform);
    void setString(const std::string &value);
    const std::string &getString() const { return _string; }
    void setFontSize(float value);
    void setLineHeight(float value);
    void setMaxWidth(float value);
    void setHorizontalAlign(int32_t value);
    void setVerticalAlign(int32_t value);
    void setFontFamily(const std::string &value);
    void setFontAsset(FontAsset *font);
    void setImageAtlas(SpriteAtlas *atlas);
    void setCacheMode(int32_t value);
    void setFontColorRGBA(float r, float g, float b, float a);
    void updateLayout();
    uint32_t getSegmentCount() const;
    Node *getSegmentNode(uint32_t index) const;
    Label *getSegmentLabel(uint32_t index) const;
    Sprite *getSegmentSprite(uint32_t index) const;
    std::string getSegmentClickHandler(uint32_t index) const;
    std::string getSegmentClickParam(uint32_t index) const;
    std::vector<uint32_t> getHitSegments(float worldX, float worldY);
    const RichTextLayoutResult &getLayout() const { return _layout; }
private:
    struct Segment;
    void dirty();
    void updateRenderer() override { clearRenderDirty(); updateLayout(); }
    void onUITransformChanged() override { markRenderDirty(); }
    void observeTransform(UITransform *transform);
    UITransform::LayoutChanged::EventID _layoutChanged;
    UITransform::LayoutDestroyed::EventID _layoutDestroyed;
    Node::LayerChanged::EventID _layerChanged;
    Node *_observedNode{nullptr};
    FontAsset::FontChanged::EventID _fontChanged;
    SpriteAtlas::AtlasChanged::EventID _atlasChanged;
    void clearSegments();
    void configureLabel(Label &label, size_t spanIndex);
    void synchronizeDependencies();
    std::unique_ptr<Segment> acquire(bool image);
    void recycle(std::unique_ptr<Segment> segment);
    UITransform *_transform{nullptr};
    IntrusivePtr<FontAsset> _font;
    IntrusivePtr<SpriteAtlas> _atlas;
    std::unique_ptr<Label> _measureLabel;
    std::vector<std::unique_ptr<Segment>> _segments;
    std::vector<std::unique_ptr<Segment>> _labelPool;
    std::vector<std::unique_ptr<Segment>> _imagePool;
    std::vector<RichTextSpan> _spans;
    RichTextLayoutResult _layout;
    RichTextLayoutOptions _options;
    std::string _string;
    std::string _family{"Arial"};
    Color _fontColor{255, 255, 255, 255};
    int32_t _verticalAlign{0};
    int32_t _cacheMode{0};
    uint32_t _fontRevision{0};
    uint32_t _atlasRevision{0};
    uint32_t _layer{0};
    bool _dirty{true};
    bool _updating{false};
};
} // namespace cc
