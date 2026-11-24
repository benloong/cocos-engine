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

#include "2d/components/Label.h"

#include <algorithm>
#include <memory>
#include <cmath>
#include <cstdio>
#include <vector>

#include "2d/assets/SpriteFrame.h"
#include "2d/renderer/SpriteGeometry.h"
#include "2d/renderer/BitmapFontLayout.h"
#include "2d/assets/TTFFont.h"
#include "2d/framework/UITransform.h"
#include "2d/renderer/LetterAtlas.h"
#include "2d/renderer/RichTextLayout.h"
#include "core/assets/AssetEnum.h"
#include "core/assets/Texture2D.h"
#include "core/scene-graph/Node.h"
#include "platform/interfaces/modules/canvas/CanvasRenderingContext2D.h"
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
#include <charconv>
#include "application/ApplicationManager.h"
#include "bindings/manual/jsb_platform.h"
#include "platform/interfaces/modules/canvas/CanvasFont.h"
#endif

namespace cc {

namespace {

#if CC_PLATFORM == CC_PLATFORM_WINDOWS
// Each entry belongs to one system-font DC. Nested measurements own separate
// contexts and cannot replace the pixels during a texture upload.
struct LineRaster {
    struct Placement {
        uint32_t frame;
        uint64_t fontRevision;
        std::array<uint32_t, 2> size;
        std::array<float, 2> origin;
        std::array<uint8_t, 3> rgb;

        bool operator==(const Placement &other) const {
            return frame == other.frame && fontRevision == other.fontRevision &&
                   size == other.size && origin == other.origin && rgb == other.rgb;
        }
    };

    Placement placement{};
    std::string text;
    Data pixels;
};

class TextMeasurement {
public:
    explicit TextMeasurement(const std::string &font) : _slot(std::move(idle())) {
        if (!_slot.context || _slot.font != font) {
            _slot.font = font;
            _slot.family = detail::parseCanvasFont(font).family;
            _slot.context.reset();
            _slot.raster = {};
        }
        _reusable = !getFontAssetFamilyNameMap().count(_slot.family) && !getFontFamilyNameMap().count(_slot.family);
        if (!_reusable || !_slot.context) {
            _slot.context = std::make_unique<CanvasRenderingContext2D>(1.F, 1.F);
            _slot.context->setFont(font);
        }
    }
    ~TextMeasurement() {
        if (_reusable) {
            if (_usedForDrawing) {
                _slot.context->setCanvasBufferUpdatedCallback(nullptr);
                _slot.context->resetBuffer(1.F, 1.F);
            }
            idle() = std::move(_slot);
        }
    }
    CanvasRenderingContext2D &context() { return *_slot.context; }
    LineRaster *systemRaster() { return _reusable ? &_slot.raster : nullptr; }
    CanvasRenderingContext2D &drawingContext(uint32_t width, uint32_t height) {
        _usedForDrawing = true;
        _slot.context->resetBuffer(static_cast<float>(width), static_cast<float>(height));
        return *_slot.context;
    }

private:
    struct Slot {
        std::unique_ptr<CanvasRenderingContext2D> context;
        std::string font;
        std::string family;
        LineRaster raster;
    };
    static Slot &idle() {
        static thread_local Slot slot;
        return slot;
    }
    Slot _slot;
    bool _reusable;
    bool _usedForDrawing{false};
};
#endif

void ensureRasterTexture(IntrusivePtr<Texture2D> &texture, uint32_t width, uint32_t height) {
    if (!texture) {
        texture = new Texture2D();
    }
    if (!texture->getGFXTexture() || texture->getWidth() != width || texture->getHeight() != height) {
        ITexture2DCreateInfo info;
        info.width = width;
        info.height = height;
        info.format = PixelFormat::RGBA8888;
        info.mipmapLevel = 1U;
        texture->reset(info);
    }
}

constexpr float BASELINE_RATIO = 0.26F;
double roundLetterMetric(double value) {
    return std::round(value * 100.0) / 100.0;
}

std::vector<std::string> splitUtf8(const std::string &text) {
    std::vector<std::string> out;
    for (size_t i = 0; i < text.size();) {
        unsigned char c = static_cast<unsigned char>(text[i]);
        size_t len = 1;
        if ((c & 0x80U) == 0U) {
            len = 1;
        } else if ((c & 0xE0U) == 0xC0U) {
            len = 2;
        } else if ((c & 0xF0U) == 0xE0U) {
            len = 3;
        } else if ((c & 0xF8U) == 0xF0U) {
            len = 4;
        }
        if (i + len > text.size()) {
            len = 1;
        }
        out.push_back(text.substr(i, len));
        i += len;
    }
    return out;
}

int32_t utf8CodePoint(const std::string &text) {
    if (text.empty()) { return 0; }
    const unsigned char c = static_cast<unsigned char>(text[0]);
    if ((c & 0x80U) == 0U) { return c; }
    if ((c & 0xE0U) == 0xC0U && text.size() >= 2U) {
        return ((c & 0x1FU) << 6) | (static_cast<unsigned char>(text[1]) & 0x3FU);
    }
    if ((c & 0xF0U) == 0xE0U && text.size() >= 3U) {
        return ((c & 0x0FU) << 12) | ((static_cast<unsigned char>(text[1]) & 0x3FU) << 6) | (static_cast<unsigned char>(text[2]) & 0x3FU);
    }
    if ((c & 0xF8U) == 0xF0U && text.size() >= 4U) {
        return ((c & 0x07U) << 18) | ((static_cast<unsigned char>(text[1]) & 0x3FU) << 12)
             | ((static_cast<unsigned char>(text[2]) & 0x3FU) << 6) | (static_cast<unsigned char>(text[3]) & 0x3FU);
    }
    return c;
}

float measureText(CanvasRenderingContext2D &context, const std::string &text) {
    return context.measureText(text).width;
}

std::vector<std::string> layoutLines(CanvasRenderingContext2D &context, const std::string &text, bool wrap, float maxWidth) {
    std::vector<std::string> lines;
    size_t start = 0;
    while (start <= text.size()) {
        const size_t end = text.find('\n', start);
        const std::string paragraph = text.substr(start, end == std::string::npos ? std::string::npos : end - start);
        if (!wrap) {
            lines.push_back(paragraph);
        } else {
            auto fragments = fragmentTextForWidth(paragraph, maxWidth, [&](const std::string &text) {
                return measureText(context, text);
            });
            for (auto &fragment : fragments) lines.push_back(std::move(fragment));
        }
        if (end == std::string::npos) {
            break;
        }
        start = end + 1;
    }
    return lines;
}

} // namespace

Label::Label() {
    markRenderDirty();
    _renderer.setSizeMode(0); // Label layout owns dimensions, not the padded texture.
}

Label::~Label() {
    setUITransform(nullptr);
    bindBitmapAtlas(nullptr);
    if (_fontAsset) _fontAsset->off(_fontChanged);
}

LetterAtlas &Label::acquireLetterAtlas() {
    if (!_letterAtlas) {
        _letterAtlas = LetterAtlas::acquire();
    }
    return *_letterAtlas;
}

Texture2D *Label::getLetterTexture() {
    return _cacheMode == 2 ? acquireLetterAtlas().getTexture() : nullptr;
}

void Label::setLetterTexture(Texture2D *texture) {
    if (_cacheMode == 2) acquireLetterAtlas().setTexture(texture);
}

void Label::setNode(Node *node) {
    // A detached Label may have acquired an atlas through getLetterTexture().
    if (!node && !_node) _letterAtlas.reset();
    _renderer.setNode(node);
    Component::setNode(node);
    setUITransform(node ? static_cast<UITransform *>(node->getUIComponent(UITransform::TYPE_ID)) : nullptr);
    markRenderDirty();
}

void Label::onUITransformChanged() {
    if (_node) setUITransform(static_cast<UITransform *>(_node->getUIComponent(UITransform::TYPE_ID)));
}

void Label::onDetach() {
    UIRenderer::onDetach();
    setUITransform(nullptr);
    if (!_node) _letterAtlas.reset();
}

void Label::setUITransform(UITransform *transform) {
    if (_transform == transform) return;
    if (_transform) {
        _transform->off(_layoutChanged);
        _transform->off(_layoutDestroyed);
    }
    _transform = transform;
    if (transform) {
        _layoutChanged = transform->on<UITransform::LayoutChanged>([this](UITransform *) { if (!_syncingContentSize) syncTransformSize(); });
        _layoutDestroyed = transform->on<UITransform::LayoutDestroyed>([this](UITransform *) { _transform = nullptr; markRenderDirty(); });
    }
    _renderer.setUITransform(transform);
    markRenderDirty();
}

void Label::setString(const std::string &text) {
    if (_string == text) {
        return;
    }
    _string = text;
    markRenderDirty();
}

void Label::setFontAsset(FontAsset *font) {
    if (_fontAsset == font) return;
    if (_fontAsset) _fontAsset->off(_fontChanged);
    _fontAsset = font;
    if (font) _fontChanged = font->on<FontAsset::FontChanged>([this](FontAsset *) { markRenderDirty(); });
    _fontAssetRevision = font ? font->getRevision() : 0;
    applyFontAsset();
}
void Label::syncFontAsset() {
    if (_fontAsset && _fontAssetRevision != _fontAsset->getRevision()) {
        _fontAssetRevision = _fontAsset->getRevision(); applyFontAsset();
    }
}
void Label::applyFontAsset() {
    _bitmapFont = _fontAsset && !_fontAsset->isReleased() ? dynamic_cast<BitmapFontAsset *>(_fontAsset.get()) : nullptr;
    bindBitmapAtlas(_bitmapFont ? _bitmapFont->getSpriteFrame() : nullptr);
    const float sourceSize = _bitmapFont ? _bitmapFont->getSourceFontSize() : -1.F;
    _bitmapLineHeight = _bitmapFont && (_bitmapFont->hasSourceFontSize() || sourceSize > 0) ? sourceSize : _lineHeight;
    updateFont(); clearRenderedData(); markRenderDirty();
}
void Label::clearRenderedData() {
    _renderer.clearFrame();
    _renderer.setEnabled(isEnabled());
    _frame = nullptr; _texture = nullptr;
    _lastContentWidth = _lastContentHeight = 0;
    _actualFontSize = 0.F;
}

void Label::setFont(const std::string &font) {
    if (_font == font) {
        return;
    }
    const size_t px = font.find("px ");
    if (px != std::string::npos) {
        _fontFamily = font.substr(px + 3U);
        const std::string size = font.substr(0, px);
        try { _fontSize = std::stof(size); } catch (...) {}
    }
    updateFont();
    markRenderDirty();
}

std::string Label::fontDescription(float size) const {
    std::string font;
    if (_isBold) { font += "bold "; }
    if (_isItalic) { font += "italic "; }
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    // The Canvas parser accepts decimal sizes without exponent notation.
    char sizeText[64]; // Fixed notation for every Windows float fits.
    const auto formatted = std::to_chars(sizeText, sizeText + sizeof(sizeText), size, std::chars_format::fixed);
    font.append(sizeText, formatted.ptr);
#else
    font += std::to_string(static_cast<int>(size));
#endif
    font += "px ";
    auto *ttf = dynamic_cast<TTFFont *>(_fontAsset.get());
    if (ttf && !ttf->isReleased() && !ttf->getFontFamily().empty()) {
        font += '\"';
        for (char c : ttf->getRenderFontFamily()) { if (c == '\\' || c == '\"') font += '\\'; font += c; }
        font += '\"';
    } else font += _fontFamily;
    return font;
}

void Label::updateFont() {
    _font = fontDescription(_fontSize);
}

void Label::setFontSize(float size) {
    if (_fontSize == size) {
        return;
    }
    _fontSize = size;
    updateFont();
    markRenderDirty();
}

void Label::setLineHeight(float height) {
    if (_lineHeight == height) {
        return;
    }
    _lineHeight = height;
    if (_bitmapFont && _bitmapFont->getFontSize() <= 0) _bitmapLineHeight = height;
    markRenderDirty();
}

void Label::setEnableWrapText(bool wrap) {
    if (_wrap == wrap) {
        return;
    }
    _wrap = wrap;
    markRenderDirty();
}

void Label::setOverflow(int32_t overflow) {
    if (_overflow == overflow) {
        return;
    }
    _overflow = overflow;
    markRenderDirty();
}

void Label::setHorizontalAlign(int32_t align) {
    if (_hAlign == align) {
        return;
    }
    _hAlign = align;
    markRenderDirty();
}

void Label::setVerticalAlign(int32_t align) {
    if (_vAlign == align) {
        return;
    }
    _vAlign = align;
    markRenderDirty();
}

void Label::setSpacingX(float spacing) {
    if (_spacingX == spacing) {
        return;
    }
    _spacingX = spacing;
    markRenderDirty();
}

void Label::setEnableOutline(bool enable) {
    if (_enableOutline == enable) { return; }
    _enableOutline = enable;
    markRenderDirty();
}

void Label::setOutlineColor(const Color &color) {
    _outlineColor = color;
    markRenderDirty();
}

void Label::setOutlineWidth(float width) {
    if (_outlineWidth == width) { return; }
    _outlineWidth = width;
    markRenderDirty();
}

void Label::setEnableShadow(bool enable) {
    if (_enableShadow == enable) { return; }
    _enableShadow = enable;
    markRenderDirty();
}

void Label::setShadowColor(const Color &color) {
    _shadowColor = color;
    markRenderDirty();
}

void Label::setShadowBlur(float blur) {
    if (_shadowBlur == blur) { return; }
    _shadowBlur = blur;
    markRenderDirty();
}

void Label::setShadowOffset(float x, float y) {
    _shadowOffsetX = x;
    _shadowOffsetY = y;
    markRenderDirty();
}
void Label::setCacheMode(int32_t mode) {
    if (_cacheMode == mode) { return; }
    if (_cacheMode == 2) {
        _ttfFrame = nullptr;
        _ttfTexture = nullptr;
    }
    if (mode == 2 && _ttfFrame && _frame == _ttfFrame) {
        _frame = nullptr;
        _texture = nullptr;
    }
    _cacheMode = mode;
    if (mode != 2) _letterAtlas.reset();
    markRenderDirty();
}

void Label::setColor(const Color &color) {
    UIRenderer::setColor(color);
    // Textures contain the text RGB. Component opacity belongs to the render
    // entity/vertices, so it also cascades to children without tinting twice.
    _renderer.setColor(Color(255, 255, 255, color.a));
    markRenderDirty();
}

void Label::setColorRGBA(float r, float g, float b, float a) {
    Color color(static_cast<uint8_t>(r), static_cast<uint8_t>(g), static_cast<uint8_t>(b), static_cast<uint8_t>(a));
    setColor(color);
}

void Label::setEntityColorRGBA(float r, float g, float b, float a) {
    // Legacy entity tint does not change the Label color used to rasterize text.
    // Bitmap assets use the full tint; TTF textures already contain their RGB.
    if (dynamic_cast<BitmapFontAsset *>(_fontAsset.get())) _renderer.setColorRGBA(r, g, b, a);
    else _renderer.setColorRGBA(255.F, 255.F, 255.F, a);
}

void Label::setMaterial(Material *material) {
    UIRenderer::setMaterial(material);
}

void Label::onMaterialChanged() {
    _renderer.setSharedMaterial(getRenderMaterial(), 0);
}

void Label::setPriority(int32_t priority) {
    UIRenderer::setPriority(priority);
    _renderer.setPriority(priority);
}

void Label::setEnabled(bool enabled) {
    Component::setEnabled(enabled);
    _renderer.setEnabled(enabled);
    if (enabled && !_bitmapFont && !_bitmapAtlas && _cacheMode != 2) ensureTTFFrame();
}

void Label::ensureTTFFrame() {
    if (_ttfFrame) return;
    _ttfTexture = new Texture2D();
    _ttfFrame = new SpriteFrame();
    _ttfFrame->setTexture(_ttfTexture);
}

void Label::destroyTTFSpriteFrame() {
    if (!_ttfFrame) return;
    _ttfFrame->destroy();
    _ttfTexture->destroy();
    _ttfFrame = nullptr;
    _ttfTexture = nullptr;
}

void Label::updateRenderer() {
    if (!renderDirtyFlags()) return;
    updateRenderData();
    _renderer.updateRenderer();
}

double Label::letterLayoutHeight(size_t lineCount) const {
    const double height = static_cast<double>(lineCount) * _lineHeight;
    const double margin = _enableOutline ? std::max(0.F, _outlineWidth) : 0.F;
    return roundLetterMetric(height) + 2.0 * margin;
}

void Label::rebuildLetterTexture() {
    LetterAtlas &atlas = acquireLetterAtlas();
    const uint32_t rgb = (static_cast<uint32_t>(_color.r) << 16U) | (_color.g << 8U) | _color.b;
    const auto key = _font + ":" + std::to_string(_lineHeight) + ":" + std::to_string(rgb)
        + (_fontAsset ? ":" + std::to_string(_fontAsset->getIdentity()) + ":" + std::to_string(_fontAssetRevision) : "");
    auto &glyphs = atlas.getStyle(key);

    const float lineHeight = _lineHeight > 0.0F ? _lineHeight : _fontSize;
    const bool wrap = _overflow == 3 || (_overflow != 0 && _wrap);
    const float maxWidth = wrap && _transform ? _transform->getContentSize().x : 0.F;

    std::vector<std::vector<const LetterAtlas::Glyph *>> lines;
    lines.emplace_back();
    double nextX = 0.0;
    double contentWidth = 0.0;
    std::vector<const LetterAtlas::Glyph *> word;
    double wordAdvance = 0.0;
    double wordRight = 0.0;
    auto finishWord = [&](bool canWrap) {
        if (word.empty()) return;
        if (canWrap && maxWidth > 0.F && nextX > 0.0 && nextX + wordRight > maxWidth) {
            lines.emplace_back();
            nextX = 0.0;
        }
        lines.back().insert(lines.back().end(), word.begin(), word.end());
        contentWidth = std::max(contentWidth, nextX + wordRight);
        nextX += wordAdvance;
        word.clear();
        wordAdvance = wordRight = 0.0;
    };

    for (const std::string &codepoint : splitUtf8(_string)) {
        if (codepoint == "\n") {
            finishWord(true);
            lines.emplace_back();
            nextX = 0.0;
            continue;
        }
        const int32_t code = utf8CodePoint(codepoint);
        if (code == '\r') { finishWord(true); continue; }
        const auto &glyph = atlas.getOrCreateGlyph(glyphs, code, _font, lineHeight, _color);
        if (!glyph.valid) { finishWord(true); continue; }
        const double advance = roundLetterMetric(glyph.advance);
        const bool space = bitmapUnicodeSpace(code);
        const bool separate = space || bitmapUnicodeCJK(code) || maxWidth <= 0.F;
        if (separate || (maxWidth > 0.F && wordAdvance + advance > maxWidth)) finishWord(true);
        word.push_back(&glyph);
        const double right = wordAdvance + advance;
        wordRight = std::max(wordRight, right);
        wordAdvance = right + _spacingX;
        if (separate) finishWord(!space);
    }
    finishWord(true);
    contentWidth = roundLetterMetric(contentWidth);

    const float contentHeight = static_cast<float>(letterLayoutHeight(lines.size()));
    const uint32_t outWidth = static_cast<uint32_t>(std::ceil(std::max(contentWidth, 1.0))) + 2U;
    const uint32_t outHeight = static_cast<uint32_t>(std::ceil(std::max(contentHeight, 1.0F))) + 2U;
    std::vector<uint8_t> pixels(static_cast<size_t>(outWidth) * outHeight * 4U, 0U);
    const uint8_t *atlasPixels = atlas.getData();

    for (size_t lineIndex = 0; lineIndex < lines.size(); ++lineIndex) {
        double cursorX = 1.0;
        const float lineTop = 1.0F + static_cast<float>(lineIndex) * lineHeight;
        for (const auto *letter : lines[lineIndex]) {
            const auto &glyph = *letter;
            if (glyph.width > 1 && glyph.height > 1) {
                const int32_t destX = static_cast<int32_t>(std::round(cursorX + glyph.offsetX));
                const int32_t destY = static_cast<int32_t>(std::round(lineTop + glyph.offsetY));
                for (int32_t y = 0; y < glyph.height; ++y) {
                    const int32_t dy = destY + y;
                    if (dy < 0 || dy >= static_cast<int32_t>(outHeight) || glyph.y + y >= LetterAtlas::ATLAS_HEIGHT) { continue; }
                    for (int32_t x = 0; x < glyph.width; ++x) {
                        const int32_t dx = destX + x;
                        if (dx < 0 || dx >= static_cast<int32_t>(outWidth) || glyph.x + x >= LetterAtlas::ATLAS_WIDTH) { continue; }
                        const size_t src = (static_cast<size_t>(glyph.y + y) * LetterAtlas::ATLAS_WIDTH + (glyph.x + x)) * 4U;
                        const size_t dst = (static_cast<size_t>(dy) * outWidth + static_cast<size_t>(dx)) * 4U;
                        const uint32_t alpha = atlasPixels[src + 3U];
                        pixels[dst] = static_cast<uint8_t>(255U * _color.r / 255U);
                        pixels[dst + 1U] = static_cast<uint8_t>(255U * _color.g / 255U);
                        pixels[dst + 2U] = static_cast<uint8_t>(255U * _color.b / 255U);
                        pixels[dst + 3U] = static_cast<uint8_t>(alpha + ((255U - alpha) * pixels[dst + 3U] + 127U) / 255U);
                    }
                }
            }
            cursorX += roundLetterMetric(glyph.advance) + _spacingX;
        }
    }

    ensureRasterTexture(_texture, outWidth, outHeight);
    _texture->uploadData(pixels.data());

    if (_frame == nullptr) { _frame = new SpriteFrame(); }
    _frame->setTexture(_texture);
    _frame->setRect(0.0F, 0.0F, static_cast<float>(outWidth), static_cast<float>(outHeight));
    _frame->setOriginalSize(static_cast<float>(outWidth), static_cast<float>(outHeight));
    _frame->setOffset(0.0F, 0.0F);
    _frame->setRotated(false);

    _lastContentWidth = static_cast<float>(contentWidth);
    _lastContentHeight = contentHeight;

    _renderer.setFrame(_frame);
}
void Label::bindBitmapTexture(TextureBase *texture) {
    if (texture == _observedAtlasTexture) return;
    if (_observedAtlasTexture) _observedAtlasTexture->off(_atlasTextureChanged);
    _observedAtlasTexture = texture;
    if (texture) _atlasTextureChanged = texture->on<TextureBase::RenderDataChanged>([this](TextureBase *) { markRenderDirty(); });
}

void Label::bindBitmapAtlas(SpriteFrame *atlas) {
    if (atlas == _bitmapAtlas) return;
    if (_bitmapAtlas) _bitmapAtlas->off(_atlasChanged);
    _bitmapAtlas = atlas;
    if (atlas) _atlasChanged = atlas->on<SpriteFrame::FrameChanged>([this](SpriteFrame *) { markRenderDirty(); });
    bindBitmapTexture(atlas ? atlas->getTexture() : nullptr);
}

void Label::syncBitmapAtlas() {
    if (!_bitmapAtlas) return;
    auto *texture = _bitmapAtlas->getTexture();
    bindBitmapTexture(texture);
    const uint32_t width = texture ? texture->getWidth() : 0;
    const uint32_t height = texture ? texture->getHeight() : 0;
    const int32_t format = texture ? static_cast<int32_t>(texture->getPixelFormat()) : -1;
    if (_bitmapAtlasRevision != _bitmapAtlas->getRevision() || _bitmapTextureSeen != texture
        || _bitmapWidthSeen != width || _bitmapHeightSeen != height || _bitmapFormatSeen != format) {
        _bitmapAtlasRevision = _bitmapAtlas->getRevision(); _bitmapTextureSeen = texture;
        _bitmapWidthSeen = width; _bitmapHeightSeen = height; _bitmapFormatSeen = format; markRenderDirty();
    }
}
void Label::rebuildBitmapTexture() {
    const auto &glyphs = _bitmapFont->getGlyphs();
    const auto &glyphMap = _bitmapFont->getGlyphMap();
    const auto &kerningMap = _bitmapFont->getKerningMap();
    auto *texture = _bitmapAtlas->getTexture();
    if (!texture || !texture->getGFXTexture() || !texture->getWidth() || !texture->getHeight()) { clearRenderedData(); return; }
    BitmapLayoutOptions options;
    if (_transform) { options.width = _transform->getContentSize().x; options.height = _transform->getContentSize().y; }
    options.fontSize = _fontSize; options.sourceFontSize = _bitmapLineHeight;
    options.lineHeight = _lineHeight; options.spacing = _spacingX; options.overflow = _overflow;
    options.horizontal = _hAlign; options.vertical = _vAlign; options.wrap = _wrap;
    std::vector<int32_t> text;
    for (const auto &symbol : splitUtf8(_string)) text.push_back(utf8CodePoint(symbol));
    const auto layout = layoutBitmapFont(text, glyphs, glyphMap, kerningMap, options);
    _actualFontSize = layout.actualFontSize;
    std::vector<SpriteQuad> quads; quads.reserve(layout.glyphs.size());
    const auto *frame = _bitmapAtlas.get();
    const BitmapFrameRect frameRect{frame->getRectX(), frame->getRectY(), frame->getRectWidth(), frame->getRectHeight(),
        frame->getOriginalWidth(), frame->getOriginalHeight(), frame->getOffsetX(), frame->getOffsetY(),
        static_cast<double>(texture->getWidth()), static_cast<double>(texture->getHeight()), frame->isRotated()};
    for (const auto &placement : layout.glyphs) {
        SpriteQuad quad; quad.valid = true;
        const auto glyphQuad = buildBitmapGlyphQuad(placement, layout.scale, frameRect);
        for (size_t i = 0; i < glyphQuad.vertices.size(); ++i) {
            const auto &vertex = glyphQuad.vertices[i];
            quad.vertices[i].position.set(static_cast<float>(vertex.x), static_cast<float>(vertex.y), 0);
            quad.vertices[i].uv.set(static_cast<float>(vertex.u), static_cast<float>(vertex.v));
        }
        quads.emplace_back(quad);
    }
    _lastContentWidth = static_cast<float>(layout.width); _lastContentHeight = static_cast<float>(layout.height);
    _texture = nullptr;
    if (!_frame || _frame == _ttfFrame) _frame = new SpriteFrame();
    _frame->copyFrom(frame);
    _renderer.setColor(_color);
    _renderer.setLabelQuads(_frame, std::move(quads));
}
void Label::syncTransformSize() {
    if (!_transform) return;
    const auto size = _transform->getContentSize();
    if (size.x != _layoutWidth || size.y != _layoutHeight) markRenderDirty();
}
void Label::syncContentSize() {
    _syncingContentSize = true;
    if (_transform && _overflow == 0) {
        _transform->setContentSize(_lastContentWidth, _lastContentHeight);
    } else if (_transform && _overflow == 3) {
        _transform->setHeight(_lastContentHeight);
    }
    if (_transform) {
        const auto size = _transform->getContentSize();
        _layoutWidth = size.x; _layoutHeight = size.y;
    }
    _syncingContentSize = false;
}
Size Label::measureUnwrappedText(const std::string &text) {
    const auto size = measureUnwrappedTextPrecise(text);
    return Size(static_cast<float>(size[0]), static_cast<float>(size[1]));
}
bool Label::hasTextShadow() const {
    return _enableShadow && (_shadowBlur > 0.F || std::fabs(_shadowOffsetX) > 0.000001F || std::fabs(_shadowOffsetY) > 0.000001F);
}

std::array<double, 2> Label::getTextStyleExtent() const {
    if (_cacheMode == 2) return {};
    const double outline = _enableOutline ? std::max(_outlineWidth, 0.F) * 2.0 : 0.0;
    const double italic = _isItalic ? _fontSize * std::tan(12 * 0.0174532925) : 0.0;
    return {outline + italic, outline};
}
std::array<double, 2> Label::measureUnwrappedTextPrecise(const std::string &text) {
    syncFontAsset();
    if (text.empty() || (_fontAsset && _fontAsset->isReleased())) return {};
    if (_bitmapFont) {
        if (!_bitmapAtlas || _bitmapFont->getGlyphs().empty()) return {};
        BitmapLayoutOptions options;
        options.fontSize = _fontSize; options.sourceFontSize = _bitmapLineHeight;
        options.lineHeight = _lineHeight; options.spacing = _spacingX;
        std::vector<int32_t> symbols;
        for (const auto &symbol : splitUtf8(text)) symbols.push_back(utf8CodePoint(symbol));
        const auto layout = layoutBitmapFont(symbols, _bitmapFont->getGlyphs(), _bitmapFont->getGlyphMap(), _bitmapFont->getKerningMap(), options);
        return {layout.width, layout.height};
    }
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    TextMeasurement measurement(_font);
    auto &context = measurement.context();
#else
    CanvasRenderingContext2D context(1.F, 1.F);
    context.setFont(_font);
#endif
    if (_cacheMode == 2) {
        double width = 0.0, nextX = 0.0;
        uint32_t lines = 1;
        for (const auto &symbol : splitUtf8(text)) {
            if (symbol == "\n") { nextX = 0.0; ++lines; }
            else if (symbol != "\r") {
                const double right = nextX + roundLetterMetric(measureText(context, symbol));
                width = std::max(width, right);
                nextX = right + _spacingX;
            }
        }
        return {roundLetterMetric(width), letterLayoutHeight(lines)};
    }
    float width = 0.F;
    uint32_t lines = 1;
    std::string paragraph;
    for (const auto &symbol : splitUtf8(text)) {
        if (symbol == "\n") {
            width = std::max(width, measureText(context, paragraph));
            paragraph.clear(); ++lines;
        } else paragraph += symbol;
    }
    width = std::max(width, measureText(context, paragraph));
    const float lineHeight = _lineHeight > 0.F ? _lineHeight : _fontSize * 1.2F;
    const auto extent = getTextStyleExtent();
    return {std::max(width, 1.F) + extent[0], std::max((lines + BASELINE_RATIO) * lineHeight, 1.F) + extent[1]};
}
void Label::updateRenderData() {
    updateRenderData(false);
}

void Label::updateRenderData(bool force) {
    if (force) markRenderDirty();
    syncTransformSize();
    syncFontAsset();
    syncBitmapAtlas();
    if (renderDirtyFlags() & GEOMETRY) {
        rebuildTexture();
    }
    syncContentSize();
}

float Label::shrinkFontSize(float width, float height) const {
    if (width < 0.F || height < 0.F) return _fontSize;
    const float lineHeight = _lineHeight > 0.F ? _lineHeight : _fontSize;
    CanvasRenderingContext2D measure(1.F, 1.F);
    if (_wrap) {
        int low = 0;
        int high = static_cast<int>(_fontSize + 1.F);
        while (low < high) {
            const int size = low + (high - low + 1) / 2;
            measure.setFont(fontDescription(static_cast<float>(size)));
            const auto lines = layoutLines(measure, _string, true, width);
            if (lines.size() * lineHeight * size / _fontSize > height) high = size - 1;
            else low = size;
        }
        return static_cast<float>(std::max(1, low));
    }
    measure.setFont(_font);
    const auto paragraphs = layoutLines(measure, _string, false, width);
    float longest = 0.F;
    for (const auto &line : paragraphs) longest = std::max(longest, measureText(measure, line));
    float padding = static_cast<float>(getTextStyleExtent()[0]);
    if (hasTextShadow()) {
        padding += std::max(0.F, _shadowBlur - _shadowOffsetX) + std::max(0.F, _shadowBlur + _shadowOffsetX);
    }
    const float scaleX = longest > 0.F ? (width - padding) / longest : 1.F;
    const float scaleY = height / (paragraphs.size() * lineHeight);
    return std::floor(_fontSize * std::clamp(std::min(scaleX, scaleY), 0.F, 1.F));
}

void Label::rebuildTexture() {
    clearRenderDirty();
    _actualFontSize = _fontSize;
    if (_bitmapFont) {
        if (_bitmapAtlas && !_bitmapFont->getGlyphs().empty()) rebuildBitmapTexture(); else clearRenderedData();
        return;
    }
    _renderer.setColor(Color(255, 255, 255, _color.a));
    if (_fontAsset && _fontAsset->isReleased()) { clearRenderedData(); return; }
    if (_cacheMode == 2) { rebuildLetterTexture(); return; }
    ensureTTFFrame();

    if (_string.empty() || _transform == nullptr) {
        if (_transform) _ttfContentWidth = _overflow == 0 ? getTextStyleExtent()[0] : _transform->getContentSize().x;
        clearRenderedData();
        return;
    }

    const auto box = _transform->getContentSize();
    const bool shrink = _overflow == 2;
    const float rasterFontSize = shrink && _fontSize > 0.F ? shrinkFontSize(box.x, box.y) : _fontSize;
    _actualFontSize = rasterFontSize;
    std::string resizedFont;
    if (rasterFontSize != _fontSize) resizedFont = fontDescription(rasterFontSize);
    const auto &renderFont = resizedFont.empty() ? _font : resizedFont;
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    TextMeasurement measurement(renderFont);
    auto &measureContext = measurement.context();
#else
    CanvasRenderingContext2D measureContext(1.F, 1.F);
    measureContext.setFont(renderFont);
#endif
    const float lineHeight = shrink && _fontSize > 0.F
        ? (_lineHeight > 0.F ? _lineHeight : _fontSize) * rasterFontSize / _fontSize
        : (_lineHeight > 0.F ? _lineHeight : _fontSize * 1.2F);
    const bool wrap = _overflow == 3 || (_overflow != 0 && _wrap);
    const auto lines = layoutLines(measureContext, _string, wrap, box.x);

    if (lines.empty()) {
        clearRenderedData();
        return;
    }

    float contentWidth = 0.0F;
    std::vector<float> lineWidths;
    lineWidths.reserve(lines.size());
    for (const std::string &line : lines) {
        lineWidths.push_back(measureText(measureContext, line));
        contentWidth = std::max(contentWidth, lineWidths.back());
    }
    if (_transform->getContentSize().x > 0.0F && _overflow != 0) {
        contentWidth = std::max(contentWidth, _transform->getContentSize().x);
    }
    contentWidth = std::max(contentWidth, 1.0F);

    const auto styleExtent = getTextStyleExtent();
    const double naturalWidth = contentWidth + styleExtent[0];
    const float outlineMargin = _enableOutline ? std::max(_outlineWidth, 0.F) : 0.F;
    const bool drawShadow = hasTextShadow();
    // The canvas reserves room for the shadow; the node keeps its text bounds.
    const float shadowLeft = drawShadow ? std::max(0.F, _shadowBlur - _shadowOffsetX) : 0.F;
    const float shadowRight = drawShadow ? std::max(0.F, _shadowBlur + _shadowOffsetX) : 0.F;
    const float shadowTop = drawShadow ? std::max(0.F, _shadowBlur + _shadowOffsetY) : 0.F;
    const float shadowBottom = drawShadow ? std::max(0.F, _shadowBlur - _shadowOffsetY) : 0.F;
    const float paddingWidth = static_cast<float>(styleExtent[0]) + shadowLeft + shadowRight;
    const float paddingHeight = static_cast<float>(styleExtent[1]) + shadowTop + shadowBottom;
    float contentHeight = std::max((static_cast<float>(lines.size()) + BASELINE_RATIO) * lineHeight, 1.0F);
    if (_overflow == 0) contentWidth = static_cast<float>(naturalWidth);
    const bool autoHeight = _overflow == 0 || _overflow == 3;
    if (autoHeight) contentHeight = static_cast<float>(contentHeight + styleExtent[1]);
    const float canvasWidth = _overflow == 0 ? contentWidth + shadowLeft + shadowRight : std::max(0.F, box.x);
    const float canvasHeight = autoHeight ? contentHeight + shadowTop + shadowBottom : std::max(0.F, box.y);
    const uint32_t textureWidth = std::max(static_cast<uint32_t>(canvasWidth), 1U);
    const uint32_t textureHeight = std::max(static_cast<uint32_t>(canvasHeight), 1U);

    float textTop = static_cast<float>(rasterFontSize * (1.0 - 0.26 / 2.0));
    if (_vAlign != 0) {
        float blank = lineHeight * static_cast<float>(lines.size() - 1) + paddingHeight + rasterFontSize - canvasHeight;
        if (_vAlign == 2) blank += static_cast<float>(rasterFontSize * 0.26 / 2.0);
        textTop -= _vAlign == 1 ? blank / 2.F : blank;
    }
    textTop += outlineMargin + shadowTop;

    const auto lineX = [&](float lineWidth) {
        float x = outlineMargin + shadowLeft;
        if (_hAlign == 1) {
            x = (canvasWidth - paddingWidth - lineWidth) * 0.5F + outlineMargin + shadowLeft;
        } else if (_hAlign == 2) {
            x = canvasWidth - lineWidth - paddingWidth + outlineMargin + shadowLeft;
        }
        return x;
    };
    const auto uploadRaster = [&](const Data &data) {
        _texture = _ttfTexture;
        _frame = _ttfFrame;
        ensureRasterTexture(_texture, textureWidth, textureHeight);
        _texture->setWrapMode(TextureBase::WrapMode::CLAMP_TO_EDGE, TextureBase::WrapMode::CLAMP_TO_EDGE);
        _texture->uploadData(data.getBytes());

        _lastContentWidth = contentWidth;
        _ttfContentWidth = _overflow == 0 ? naturalWidth : box.x;
        _lastContentHeight = contentHeight;
        _frame->setTexture(_texture);
        _frame->setRect(0.0F, 0.0F, static_cast<float>(textureWidth), static_cast<float>(textureHeight));
        _frame->setOriginalSize(static_cast<float>(textureWidth), static_cast<float>(textureHeight));
        _frame->setOffset(0.0F, 0.0F);
        _frame->setRotated(false);

        _renderer.setFrame(_frame);
    };

#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    LineRaster *cache = nullptr;
    LineRaster::Placement placement{};
    if (!_fontAsset && !_enableOutline && !drawShadow && !_isUnderline && lines.size() == 1 &&
        _string.size() <= 256 && static_cast<uint64_t>(textureWidth) * textureHeight <= 16384) {
        const auto app = CC_CURRENT_APPLICATION();
        const auto engine = app ? app->getEngine() : nullptr;
        if (engine) cache = measurement.systemRaster();
        if (cache) {
            placement = {engine->getTotalFrames(), getFontAliasRevision(), {textureWidth, textureHeight},
                         {lineX(lineWidths.front()), textTop}, {_color.r, _color.g, _color.b}};
            if (!cache->pixels.isNull() && cache->placement == placement && cache->text == lines.front()) {
                uploadRaster(cache->pixels);
                return;
            }
        }
    }
    auto &context = measurement.drawingContext(textureWidth, textureHeight);
#else
    CanvasRenderingContext2D context(static_cast<float>(textureWidth), static_cast<float>(textureHeight));
    context.setFont(renderFont);
#endif
    context.setTextBaseline("alphabetic");
    context.setTextAlign("left");

    const Color &edgeColor = _enableOutline && _outlineWidth > 0.F ? _outlineColor : _color;
    char fill[64] = {0};
    std::snprintf(fill, sizeof(fill), "rgba(%u,%u,%u,0.004)",
                  static_cast<unsigned>(edgeColor.r),
                  static_cast<unsigned>(edgeColor.g),
                  static_cast<unsigned>(edgeColor.b));
    context.setFillStyle(fill);
    context.fillRect(0, 0, static_cast<float>(textureWidth), static_cast<float>(textureHeight));
#if CC_PLATFORM != CC_PLATFORM_WINDOWS
    if (drawShadow) {
        char shadow[64] = {0};
        std::snprintf(shadow, sizeof(shadow), "rgba(%u,%u,%u,%.3f)",
                      static_cast<unsigned>(_shadowColor.r),
                      static_cast<unsigned>(_shadowColor.g),
                      static_cast<unsigned>(_shadowColor.b),
                      static_cast<double>(_shadowColor.a) / 255.0);
        context.setShadowColor(shadow);
        context.setShadowBlur(_shadowBlur);
        context.setShadowOffsetX(_shadowOffsetX);
        context.setShadowOffsetY(_shadowOffsetY);
    }
#endif

    auto drawLine = [&](size_t i, bool underline) {
        const std::string &line = lines[i];
        const float lineWidth = lineWidths[i];
        const float x = lineX(lineWidth);
        const float lineY = textTop + static_cast<float>(i) * lineHeight;
        auto selectColor = [&](const Color &color) {
            char rgba[64] = {0};
            std::snprintf(rgba, sizeof(rgba), "rgba(%u,%u,%u,%.3f)",
                          static_cast<unsigned>(color.r),
                          static_cast<unsigned>(color.g),
                          static_cast<unsigned>(color.b),
                          static_cast<double>(color.a) / 255.0);
            context.setFillStyle(rgba);
        };
        auto fillWithColor = [&](float dx, float dy, const Color &color) {
            selectColor(color);
            context.fillText(line, x + dx, lineY + dy, 0.0F);
        };

        if (drawShadow) {
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
            const float shadowY = -_shadowOffsetY;
            // The foreground and shadow share the selected font and glyph origins.
            selectColor(_shadowColor);
            bool rendered = false;
            if (_shadowBlur == 0.F) {
                context.fillText(line, x + _shadowOffsetX, lineY + shadowY, 0.F);
                rendered = true;
            } else {
                rendered = context.fillTextShadow(line, x + _shadowOffsetX, lineY + shadowY, _shadowBlur);
            }
            if (!rendered)
#else
            const float shadowY = _shadowOffsetY;
#endif
            {
                const float blur = std::max(_shadowBlur, 1.0F);
                for (int pass = 0; pass < 9; ++pass) {
                    const int px = (pass % 3) - 1;
                    const int py = (pass / 3) - 1;
                    fillWithColor(_shadowOffsetX + static_cast<float>(px) * blur,
                                  shadowY + static_cast<float>(py) * blur,
                                  _shadowColor);
                }
            }
        }

        if (_enableOutline && _outlineWidth > 0.0F) {
            if (context.supportsTextStroke()) {
                char strokeColor[64] = {};
                std::snprintf(strokeColor, sizeof(strokeColor), "rgba(%u,%u,%u,%.3f)",
                              static_cast<unsigned>(_outlineColor.r), static_cast<unsigned>(_outlineColor.g),
                              static_cast<unsigned>(_outlineColor.b), static_cast<double>(_outlineColor.a) / 255.0);
                context.setStrokeStyle(strokeColor);
                context.setLineWidth(_outlineWidth * 2.F);
                context.setLineJoin("round");
                context.strokeText(line, x, lineY, 0.F);
            } else {
                for (int pass = 0; pass < 8; ++pass) {
                    const float angle = static_cast<float>(pass) * 0.7853981634F;
                    fillWithColor(std::cos(angle) * _outlineWidth,
                                  std::sin(angle) * _outlineWidth,
                                  _outlineColor);
                }
            }
        }

        char fillColor[64] = {0};
        std::snprintf(fillColor, sizeof(fillColor), "rgba(%u,%u,%u,%.3f)",
                      static_cast<unsigned>(_color.r),
                      static_cast<unsigned>(_color.g),
                      static_cast<unsigned>(_color.b),
                      1.0);
        context.setFillStyle(fillColor);
        context.fillText(line, x, lineY, 0.0F);
        if (underline) {
            context.fillRect(x, lineY + rasterFontSize / 8.F, lineWidth, std::max(_underlineHeight, 0.F));
        }
    };
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    // Web paints all shadowed lines during its effect pass, then paints the text pass.
    if (drawShadow && lines.size() > 1) {
        for (size_t i = 0; i < lines.size(); ++i) drawLine(i, _isUnderline);
        for (size_t i = 0; i < lines.size(); ++i) drawLine(i, false);
    } else
#endif
    {
        for (size_t i = 0; i < lines.size(); ++i) drawLine(i, _isUnderline);
    }
    cc::Data pixels;
    context.setCanvasBufferUpdatedCallback([&pixels](const cc::Data &data) {
        pixels = data;
    });
    context.fetchData();

    uploadRaster(pixels);
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    if (cache && !pixels.isNull()) {
        cache->placement = placement;
        cache->text = lines[0];
        cache->pixels = std::move(pixels);
    }
#endif
}

} // namespace cc
