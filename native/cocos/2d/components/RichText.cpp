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

#include "2d/components/RichText.h"
#include "2d/components/Label.h"
#include "2d/components/Sprite.h"
#include "2d/framework/UITransform.h"
#include "2d/assets/SpriteFrame.h"
#include "core/scene-graph/Node.h"
#include <algorithm>
#include <cmath>
#include <cstdlib>

namespace cc {
namespace {
void (*segmentDisposeCallback)(void *) = nullptr;
Color literalColor(std::string value) {
    for (auto &ch : value) if (ch >= 'a' && ch <= 'z') ch -= 'a' - 'A';
    static const std::map<std::string, Color> names = {
        {"WHITE", Color(255,255,255,255)}, {"GRAY", Color(127,127,127,255)}, {"BLACK", Color(0,0,0,255)},
        {"TRANSPARENT", Color(0,0,0,0)}, {"RED", Color(255,0,0,255)}, {"GREEN", Color(0,255,0,255)},
        {"BLUE", Color(0,0,255,255)}, {"CYAN", Color(0,255,255,255)}, {"MAGENTA", Color(255,0,255,255)}, {"YELLOW", Color(255,255,0,255)}
    };
    const auto named = names.find(value); if (named != names.end()) return named->second;
    if (!value.empty() && value[0] == '#') value.erase(0, 1);
    if (value.size() == 3 || value.size() == 4) {
        std::string expanded; for (char ch : value) { expanded += ch; expanded += ch; } value = expanded;
    }
    if (value.size() == 6) value += "FF";
    if (value.find_first_not_of("0123456789ABCDEF") != std::string::npos) return Color(0,0,0,0);
    char *end = nullptr; const auto parsed = std::strtoull(value.c_str(), &end, 16);
    const auto rgba = end == value.c_str() || *end ? 0U : static_cast<uint32_t>(parsed);
    return Color(static_cast<uint8_t>(rgba >> 24U), static_cast<uint8_t>(rgba >> 16U), static_cast<uint8_t>(rgba >> 8U), static_cast<uint8_t>(rgba));
}
}
struct RichText::Segment {
    IntrusivePtr<Node> node;
    std::unique_ptr<UITransform> transform;
    std::unique_ptr<Label> label;
    std::unique_ptr<Sprite> sprite;
    IntrusivePtr<SpriteFrame> frame;
    SpriteFrame::FrameChanged::EventID frameChanged;
    void bindFrame(SpriteFrame *value, RichText *owner) {
        if (value == frame) return;
        if (frame) frame->off(frameChanged);
        frame = value;
        if (value) frameChanged = value->on<SpriteFrame::FrameChanged>([owner](SpriteFrame *) { owner->markRenderDirty(); });
    }
    uint32_t frameRevision{0};
    std::string handler;
    std::string param;
    explicit Segment(bool image) {
        node = new Node(image ? "RICHTEXT_Image_CHILD" : "RICHTEXT_CHILD");
        node->setHideFlags(CCObject::Flags::DONT_SAVE | CCObject::Flags::HIDE_IN_HIERARCHY);
        transform = std::make_unique<UITransform>(node);
        transform->setAnchorPoint(0.F, 0.F);
        if (image) {
            sprite = std::make_unique<Sprite>(); sprite->setNode(node); sprite->setUITransform(transform.get());
            sprite->setSizeMode(0); sprite->setType(1);
        } else {
            label = std::make_unique<Label>(); label->setNode(node); label->setUITransform(transform.get());
            label->setHorizontalAlign(0); label->setOverflow(0); label->setEnableWrapText(false);
        }
    }
    ~Segment() {
        bindFrame(nullptr, nullptr);
        node->removeFromParent();
        if (segmentDisposeCallback) {
            segmentDisposeCallback(transform.get());
            if (label) segmentDisposeCallback(label.get());
            if (sprite) segmentDisposeCallback(sprite.get());
        }
    }
};
void RichText::setSegmentDisposeCallback(void (*callback)(void *)) {
    segmentDisposeCallback = callback;
}
RichText::RichText() {
    _measureLabel = std::make_unique<Label>();
}
RichText::~RichText() {
    observeTransform(nullptr);
    if (_font) _font->off(_fontChanged);
    if (_atlas) _atlas->off(_atlasChanged);
    Component::setNode(nullptr);
    clearSegments();
}
void RichText::onAttach() {
    _dirty = true;
    _observedNode = _node;
    _layerChanged = _node->on<Node::LayerChanged>([this](Node *, uint32_t) { markRenderDirty(); });
}
void RichText::onDetach() {
    UIRenderer::onDetach();
    if (_observedNode) _observedNode->off(_layerChanged);
    _observedNode = nullptr;
    observeTransform(nullptr);
    clearSegments();
}
void RichText::onEnable() {
    UIRenderer::onEnable();
    for (auto &segment : _segments) { segment->node->setActive(true); segment->node->setActiveInHierarchy(true); }
    updateLayout();
}
void RichText::onDisable() {
    UIRenderer::onDisable();
    for (auto &segment : _segments) { segment->node->setActive(false); segment->node->setActiveInHierarchy(false); }
}
void RichText::observeTransform(UITransform *transform) {
    if (transform == _transform) return;
    if (_transform) { _transform->off(_layoutChanged); _transform->off(_layoutDestroyed); }
    _transform = transform;
    if (!transform) return;
    _layoutChanged = transform->on<UITransform::LayoutChanged>([this](UITransform *layout) {
        if (!_updating && (_options.anchorX != layout->getAnchorX() || _options.anchorY != layout->getAnchorY())) {
            markRenderDirty();
        }
    });
    _layoutDestroyed = transform->on<UITransform::LayoutDestroyed>([this](UITransform *) { _transform = nullptr; _dirty = true; markRenderDirty(); });
}
void RichText::setUITransform(UITransform *transform) { observeTransform(transform); dirty(); }
void RichText::dirty() { _dirty = true; if (_node && _transform && _enabled && !_updating) updateLayout(); }
void RichText::setString(const std::string &value) { if (_string != value) { _string = value; dirty(); } }
void RichText::setFontSize(float value) { if (_options.fontSize != value) { _options.fontSize = value; dirty(); } }
void RichText::setLineHeight(float value) { if (_options.lineHeight != value) { _options.lineHeight = value; dirty(); } }
void RichText::setMaxWidth(float value) { if (_options.maxWidth != value) { _options.maxWidth = value; dirty(); } }
void RichText::setHorizontalAlign(int32_t value) { if (_options.horizontalAlign != value) { _options.horizontalAlign = value; dirty(); } }
void RichText::setVerticalAlign(int32_t value) { if (_verticalAlign != value) { _verticalAlign = value; dirty(); } }
void RichText::setFontFamily(const std::string &value) { if (_family != value) { _family = value; dirty(); } }
void RichText::setFontAsset(FontAsset *font) {
    if (_font == font) return;
    if (_font) _font->off(_fontChanged);
    if (font) _fontChanged = font->on<FontAsset::FontChanged>([this](FontAsset *) { markRenderDirty(); });
    _font = font; _measureLabel->setFontAsset(font);
    for (auto &segment : _segments) if (segment->label) segment->label->setFontAsset(font);
    dirty();
}
void RichText::setImageAtlas(SpriteAtlas *atlas) {
    if (_atlas == atlas) return;
    if (_atlas) _atlas->off(_atlasChanged);
    _atlas = atlas;
    if (atlas) _atlasChanged = atlas->on<SpriteAtlas::AtlasChanged>([this](SpriteAtlas *) { markRenderDirty(); });
    dirty();
}
void RichText::setCacheMode(int32_t value) { if (_cacheMode != value) { _cacheMode = value; dirty(); } }
void RichText::setFontColorRGBA(float r, float g, float b, float a) {
    _fontColor = Color(static_cast<uint8_t>(r), static_cast<uint8_t>(g), static_cast<uint8_t>(b), static_cast<uint8_t>(a));
    for (size_t i = 0; i < _segments.size(); ++i) {
        const auto &style = _spans[_layout.placements[i].spanIndex].style;
        if (_segments[i]->label && (!style || !style->color || style->color->empty())) _segments[i]->label->setColor(_fontColor);
    }
}
void RichText::configureLabel(Label &label, size_t spanIndex) {
    const auto &style = _spans[spanIndex].style;
    const float fontSize = style && style->size && *style->size != 0 && std::isfinite(*style->size) ? static_cast<float>(*style->size) : static_cast<float>(_options.fontSize);
    label.setFont(std::to_string(static_cast<int>(fontSize)) + "px " + _family);
    label.setFontAsset(_font); label.setFontSize(fontSize); label.setLineHeight(static_cast<float>(_options.lineHeight));
    label.setIsBold(style && style->bold); label.setIsItalic(style && style->italic); label.setIsUnderline(style && style->underline);
    label.setUnderlineHeight(2.F); label.setVerticalAlign(_verticalAlign); label.setCacheMode(_cacheMode);
    label.setColor(style && style->color && !style->color->empty() ? literalColor(*style->color) : _fontColor);
    label.setEnableOutline(style && style->outline.has_value());
    label.setOutlineWidth(style && style->outline ? static_cast<float>(style->outline->width) : 0.F);
    if (style && style->outline) label.setOutlineColor(literalColor(style->outline->color));
}
std::unique_ptr<RichText::Segment> RichText::acquire(bool image) {
    auto &pool = image ? _imagePool : _labelPool;
    if (pool.empty()) return std::make_unique<Segment>(image);
    auto segment = std::move(pool.back()); pool.pop_back(); return segment;
}
void RichText::recycle(std::unique_ptr<Segment> segment) {
    segment->node->removeFromParent(); segment->node->setActive(false);
    if (segment->label) {
        segment->label->setString(""); segment->label->setFontAsset(nullptr); segment->label->setCacheMode(0); segment->label->updateRenderData();
    } else segment->sprite->clearFrame();
    segment->bindFrame(nullptr, this); segment->handler.clear(); segment->param.clear();
    auto &pool = segment->sprite ? _imagePool : _labelPool;
    if (pool.size() < (segment->sprite ? 10U : 20U)) pool.push_back(std::move(segment));
}
void RichText::clearSegments() {
    _segments.clear(); _labelPool.clear(); _imagePool.clear();
    _layout = {}; _spans.clear(); _dirty = true;
}
void RichText::synchronizeDependencies() {
    if ((_font && _fontRevision != _font->getRevision()) || (_atlas && _atlasRevision != _atlas->getRevision())) _dirty = true;
    if (_transform && (_options.anchorX != _transform->getAnchorX() || _options.anchorY != _transform->getAnchorY())) _dirty = true;
    if (_node && _layer != _node->getLayer()) _dirty = true;
    for (const auto &segment : _segments) if (segment->frame && segment->frameRevision != segment->frame->getRevision()) _dirty = true;
}
void RichText::updateLayout() {
    if (!_node || !_enabled || _updating) return;
    auto *attached = static_cast<UITransform *>(_node->getUIComponent(UITransform::TYPE_ID));
    if (attached != _transform) { observeTransform(attached); _dirty = true; }
    if (!_transform) { if (!_segments.empty()) clearSegments(); return; }
    synchronizeDependencies(); if (!_dirty) return;
    _updating = true;
    _spans = RichTextParser::parse(_string);
    _options.anchorX = _transform->getAnchorX(); _options.anchorY = _transform->getAnchorY();
    _layer = _node->getLayer();
    _layout = RichTextLayout::build(_spans, _options, [this](size_t index, const std::string &text) {
        configureLabel(*_measureLabel, index);
        const auto size = _measureLabel->measureUnwrappedTextPrecise(text);
        return RichTextExtent{size[0], size[1]};
    }, [this](const std::string &name) -> std::optional<RichTextExtent> {
        auto *frame = _atlas ? _atlas->getSpriteFrame(name) : nullptr;
        return frame ? std::make_optional(RichTextExtent{frame->getRectWidth(), frame->getRectHeight()}) : std::nullopt;
    });
    auto previous = std::move(_segments);
    for (size_t i = 0; i < _layout.placements.size(); ++i) {
        const auto &placement = _layout.placements[i];
        std::unique_ptr<Segment> segment;
        if (i < previous.size() && bool(previous[i]->sprite) == placement.image) segment = std::move(previous[i]);
        else segment = acquire(placement.image);
        const auto &style = _spans[placement.spanIndex].style;
        segment->handler.clear(); segment->param.clear();
        if (style && style->event) {
            const auto handler = style->event->find("click"), param = style->event->find("param");
            if (handler != style->event->end()) segment->handler = handler->second;
            if (param != style->event->end()) segment->param = param->second;
        }
        if (segment->label) {
            configureLabel(*segment->label, placement.spanIndex); segment->label->setString(placement.text);
        } else {
            segment->bindFrame(_atlas && style && style->src ? _atlas->getSpriteFrame(*style->src) : nullptr, this);
            segment->frameRevision = segment->frame ? segment->frame->getRevision() : 0;
            segment->sprite->setFrame(segment->frame);
        }
        segment->transform->setContentSize(static_cast<float>(placement.width), static_cast<float>(placement.height));
        segment->transform->setAnchorPoint(0.F, static_cast<float>(placement.anchorY));
        segment->node->setLayer(_layer); segment->node->setParent(_node);
        segment->node->setSiblingIndex(static_cast<int>(i));
        // Parenting creates a JS wrapper through ChildAdded when needed. Apply
        // position afterwards so its native transform callback updates JS caches.
        segment->node->setPosition(static_cast<float>(placement.x), static_cast<float>(placement.y), 0.F);
        segment->node->setActive(true); segment->node->setActiveInHierarchy(true);
        _segments.push_back(std::move(segment));
    }
    for (auto &segment : previous) if (segment) recycle(std::move(segment));
    _fontRevision = _font ? _font->getRevision() : 0;
    _atlasRevision = _atlas ? _atlas->getRevision() : 0;
    _dirty = false;
    // Publish the completed layout before the size callback runs user code.
    _updating = false;
    _transform->setContentSize(static_cast<float>(_layout.width), static_cast<float>(_layout.height));
}
Label *RichText::getSegmentLabel(uint32_t index) const { return index < _segments.size() ? _segments[index]->label.get() : nullptr; }
Sprite *RichText::getSegmentSprite(uint32_t index) const { return index < _segments.size() ? _segments[index]->sprite.get() : nullptr; }
std::string RichText::getSegmentClickHandler(uint32_t index) const { return index < _segments.size() ? _segments[index]->handler : ""; }
std::string RichText::getSegmentClickParam(uint32_t index) const { return index < _segments.size() ? _segments[index]->param : ""; }
std::vector<uint32_t> RichText::getHitSegments(float worldX, float worldY) {
    std::vector<uint32_t> hits;
    if (!_enabled || !_node) return hits;
    updateLayout();
    for (uint32_t i = 0; i < _segments.size(); ++i) {
        const auto &segment = _segments[i];
        if (!segment->handler.empty() && segment->transform->getBoundingBoxToWorld().containsPoint(Vec2(worldX, worldY))) hits.push_back(i);
    }
    return hits;
}
} // namespace cc
