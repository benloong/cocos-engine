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
#include <unordered_map>
#include <cmath>
#include <cstdio>
#include <vector>

#include "2d/assets/SpriteFrame.h"
#include "2d/renderer/SpriteGeometry.h"
#include "2d/renderer/BitmapFontLayout.h"
#include "2d/assets/TTFFont.h"
#include "2d/framework/UITransform.h"
#include "2d/renderer/DynamicAtlas.h"
#include "2d/renderer/LetterAtlas.h"
#include "core/assets/AssetEnum.h"
#include "core/assets/ImageAsset.h"
#include "core/assets/Texture2D.h"
#include "platform/interfaces/modules/canvas/CanvasRenderingContext2D.h"

namespace cc {

namespace {

struct LetterAtlasEntry {
    std::unique_ptr<LetterAtlas> atlas; // registry owns each live cache
    uint32_t users{0}; // active Label leases; last release erases the owner
};
std::unordered_map<std::string, LetterAtlasEntry> gLetterAtlases;

constexpr float BASELINE_RATIO = 0.26F;

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

} // namespace

Label::Label() {
    _renderer.setSizeMode(0); // Label layout owns dimensions, not the padded texture.
    _renderer.getRenderEntity()->setPrepareListener(this);
}

Label::~Label() {
    releaseLetterAtlas();
    if (_renderer.getRenderEntity() != nullptr) {
        _renderer.getRenderEntity()->setPrepareListener(nullptr);
    }
}
void Label::releaseLetterAtlas() {
    if (!_letterAtlas) return;
    auto found=gLetterAtlases.find(_letterAtlasKey);
    CC_ASSERT(found!=gLetterAtlases.end() && found->second.atlas.get()==_letterAtlas && found->second.users>0);
    _letterAtlas=nullptr;
    if(--found->second.users==0) gLetterAtlases.erase(found);
    _letterAtlasKey.clear();
}

void Label::setNode(Node *node) {
    _renderer.setNode(node);
    if (_renderer.getRenderEntity() != nullptr) {
        _renderer.getRenderEntity()->setPrepareListener(this);
    }
    Component::setNode(node);
    _dirty = true;
}

void Label::setUITransform(UITransform *transform) {
    _transform = transform;
    _renderer.setUITransform(transform);
    _dirty = true;
}

void Label::setString(const std::string &text) {
    if (_string == text) {
        return;
    }
    _string = text;
    _dirty = true;
}

void Label::setFontAsset(FontAsset *font) {
    if (_fontAsset == font) return;
    _fontAsset = font;
    _fontAssetRevision = font ? font->getRevision() : 0;
    _glyphs.clear(); _glyphMap.clear(); _kerning.clear();
    applyFontAsset();
}
void Label::syncFontAsset() {
    if (_fontAsset && _fontAssetRevision != _fontAsset->getRevision()) {
        _fontAssetRevision = _fontAsset->getRevision(); applyFontAsset();
    }
}
void Label::applyFontAsset() {
    _bitmapFont = _fontAsset && !_fontAsset->isReleased() ? dynamic_cast<BitmapFontAsset *>(_fontAsset.get()) : nullptr;
    _bitmapAtlas = _bitmapFont ? _bitmapFont->getSpriteFrame() : nullptr;
    _bitmapLineHeight = _bitmapFont && _bitmapFont->getFontSize() > 0 ? _bitmapFont->getFontSize() : _lineHeight;
    updateFont(); clearRenderedData(); _dirty = true;
}
void Label::clearRenderedData() {
    _renderer.clearFrame();
    _bitmapDiagnosticsDirty = false; _renderedBitmapGlyphs = 0;
    // The entity also drives Label's prepare callback. An empty frame must
    // not disable that callback or later font/config changes cannot rebuild.
    _renderer.setEnabled(isEnabled());
    _frame = nullptr; _texture = nullptr;
    std::vector<uint8_t>().swap(_lastPixels); _lastOpaquePixels = 0; _lastPixelChecksum = 0;
    _lastContentWidth = _lastContentHeight = _lastTextureWidth = _lastTextureHeight = 0;
    _actualFontSize = 0.F;
    _lastLineCount = 0;
    _lastAtlasTextureId = 0;
    _lastAtlasX = _lastAtlasY = _lastAtlasWidth = _lastAtlasHeight = 0;
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
    _dirty = true;
}

void Label::updateFont() {
    std::string font;
    if (_isBold) { font += "bold "; }
    if (_isItalic) { font += "italic "; }
    font += std::to_string(static_cast<int>(_fontSize)) + "px ";
    auto *ttf = dynamic_cast<TTFFont *>(_fontAsset.get());
    if (ttf && !ttf->isReleased() && !ttf->getFontFamily().empty()) {
        font += '\"';
        for (char c : ttf->getRenderFontFamily()) { if (c == '\\' || c == '\"') font += '\\'; font += c; }
        font += '\"';
    } else font += _fontFamily;
    releaseLetterAtlas();
    _font = font;
}

void Label::setFontSize(float size) {
    if (std::fabs(_fontSize - size) < 0.01F) {
        return;
    }
    _fontSize = size;
    updateFont();
    _dirty = true;
}

void Label::setLineHeight(float height) {
    if (std::fabs(_lineHeight - height) < 0.01F) {
        return;
    }
    _lineHeight = height;
    releaseLetterAtlas();
    if (_bitmapFont && _bitmapFont->getFontSize() <= 0) _bitmapLineHeight = height;
    _dirty = true;
}

void Label::setEnableWrapText(bool wrap) {
    if (_wrap == wrap) {
        return;
    }
    _wrap = wrap;
    _dirty = true;
}

void Label::setOverflow(int32_t overflow) {
    if (_overflow == overflow) {
        return;
    }
    _overflow = overflow;
    _dirty = true;
}

void Label::setHorizontalAlign(int32_t align) {
    if (_hAlign == align) {
        return;
    }
    _hAlign = align;
    _dirty = true;
}

void Label::setVerticalAlign(int32_t align) {
    if (_vAlign == align) {
        return;
    }
    _vAlign = align;
    _dirty = true;
}

void Label::setSpacingX(float spacing) {
    if (std::fabs(_spacingX - spacing) < 0.01F) {
        return;
    }
    _spacingX = spacing;
    _dirty = true;
}

void Label::setEnableOutline(bool enable) {
    if (_enableOutline == enable) { return; }
    _enableOutline = enable;
    _dirty = true;
}

void Label::setOutlineColor(const Color &color) {
    _outlineColor = color;
    _dirty = true;
}

void Label::setOutlineWidth(float width) {
    if (std::fabs(_outlineWidth - width) < 0.01F) { return; }
    _outlineWidth = width;
    _dirty = true;
}

void Label::setEnableShadow(bool enable) {
    if (_enableShadow == enable) { return; }
    _enableShadow = enable;
    _dirty = true;
}

void Label::setShadowColor(const Color &color) {
    _shadowColor = color;
    _dirty = true;
}

void Label::setShadowBlur(float blur) {
    if (std::fabs(_shadowBlur - blur) < 0.01F) { return; }
    _shadowBlur = blur;
    _dirty = true;
}

void Label::setShadowOffset(float x, float y) {
    _shadowOffsetX = x;
    _shadowOffsetY = y;
    _dirty = true;
}
void Label::setBitmapAtlas(SpriteFrame *atlas, float lineHeight) {
    if (_fontAsset) setFontAsset(nullptr);
    _bitmapAtlas = atlas;
    _bitmapLineHeight = lineHeight;
    _dirty = true;
}

void Label::clearBitmapFont() {
    if (_bitmapFont) { _fontAsset = nullptr; _bitmapFont = nullptr; }
    _bitmapAtlas = nullptr;
    _bitmapLineHeight = 0.0F;
    _kerning.clear();
    updateFont();
    clearRenderedData();
    _glyphs.clear();
    _glyphMap.clear();
    _dirty = true;
}

void Label::clearKerning() {
    _kerning.clear();
    _dirty = true;
}

void Label::addKerning(int32_t left, int32_t right, float amount) {
    _kerning[(static_cast<uint64_t>(static_cast<uint32_t>(left)) << 32U) | static_cast<uint32_t>(right)] = amount;
    _dirty = true;
}

void Label::clearGlyphs() {
    _glyphs.clear();
    _glyphMap.clear();
    _dirty = true;
}

void Label::addGlyph(int32_t code, float u, float v, float w, float h, float offsetX, float offsetY, float xAdvance) {
    _glyphMap[code] = _glyphs.size();
    _glyphs.push_back(Glyph{code, u, v, w, h, offsetX, offsetY, xAdvance});
    _dirty = true;
}

void Label::setCacheMode(int32_t mode) {
    if (_cacheMode == mode) { return; }
    _cacheMode = mode;
    if (mode != 2) releaseLetterAtlas();
    _dirty = true;
}

void Label::setColor(const Color &color) {
    UIRenderer::setColor(color);
    // Textures contain the text RGB. Component opacity belongs to the render
    // entity/vertices, so it also cascades to children without tinting twice.
    _renderer.setColor(Color(255, 255, 255, color.a));
    _dirty = true;
}

void Label::setColorRGBA(float r, float g, float b, float a) {
    Color color(static_cast<uint8_t>(r), static_cast<uint8_t>(g), static_cast<uint8_t>(b), static_cast<uint8_t>(a));
    setColor(color);
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
}

void Label::prepareRenderEntity(float opacity) {
    syncTransformSize();
    syncFontAsset();
    syncBitmapAtlas();
    if (_dirty) {
        rebuildTexture();
    }
    syncContentSize();
    _renderer.prepare(opacity);
}

void Label::rebuildLetterTexture() {
    if (!_letterAtlas) {
        const std::string key = _font + ":" + std::to_string(_lineHeight) + (_fontAsset ? ":" + std::to_string(_fontAsset->getIdentity()) + ":" + std::to_string(_fontAssetRevision) : "");
        auto &cached = gLetterAtlases[key];
        if (!cached.atlas) cached.atlas=std::make_unique<LetterAtlas>();
        ++cached.users;
        _letterAtlas=cached.atlas.get();
        _letterAtlasKey=key;
    }
    LetterAtlas &atlas = *_letterAtlas;

    const float lineHeight = _lineHeight > 0.0F ? _lineHeight : _fontSize;
    const float maxWidth = _overflow != 0 && _transform != nullptr && _transform->getContentSize().x > 0.0F
        ? _transform->getContentSize().x
        : 100000.0F;

    std::vector<std::vector<LetterAtlas::Glyph>> lines;
    lines.emplace_back();
    float lineWidth = 0.0F;
    float contentWidth = 0.0F;

    for (const std::string &codepoint : splitUtf8(_string)) {
        if (codepoint == "\n") {
            contentWidth = std::max(contentWidth, lineWidth);
            lines.emplace_back();
            lineWidth = 0.0F;
            continue;
        }
        const int32_t code = utf8CodePoint(codepoint);
        if (!atlas.ensureGlyph(code, _font, lineHeight)) { continue; }
        const LetterAtlas::Glyph *glyph = atlas.getGlyph(code);
        if (glyph == nullptr) { continue; }
        if (_wrap && lineWidth + glyph->advance > maxWidth && !lines.back().empty()) {
            contentWidth = std::max(contentWidth, lineWidth);
            lines.emplace_back();
            lineWidth = 0.0F;
        }
        lines.back().push_back(*glyph);
        lineWidth += glyph->advance;
    }
    contentWidth = std::max(contentWidth, lineWidth);

    const float contentHeight = std::max((static_cast<float>(lines.size()) + BASELINE_RATIO) * lineHeight, 1.0F);
    const uint32_t outWidth = static_cast<uint32_t>(std::ceil(std::max(contentWidth, 1.0F))) + 2U;
    const uint32_t outHeight = static_cast<uint32_t>(std::ceil(contentHeight)) + 2U;
    std::vector<uint8_t> pixels(static_cast<size_t>(outWidth) * outHeight * 4U, 0U);
    const uint8_t *atlasPixels = atlas.getData();

    for (size_t lineIndex = 0; lineIndex < lines.size(); ++lineIndex) {
        float cursorX = 1.0F;
        const float lineTop = 1.0F + static_cast<float>(lineIndex) * lineHeight;
        for (const LetterAtlas::Glyph &glyph : lines[lineIndex]) {
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
                        pixels[dst + 3U] = static_cast<uint8_t>(alpha);
                    }
                }
            }
            cursorX += glyph.advance;
        }
    }

    if (_texture == nullptr) { _texture = new Texture2D(); }
    ITexture2DCreateInfo info;
    info.width = outWidth;
    info.height = outHeight;
    info.format = PixelFormat::RGBA8888;
    info.mipmapLevel = 1U;
    _texture->reset(info);
    _lastPixels = pixels;
    _texture->uploadData(pixels.data());

    if (_frame == nullptr) { _frame = new SpriteFrame(); }
    _frame->setTexture(_texture);
    _frame->setRect(0.0F, 0.0F, static_cast<float>(outWidth), static_cast<float>(outHeight));
    _frame->setOriginalSize(static_cast<float>(outWidth), static_cast<float>(outHeight));
    _frame->setOffset(0.0F, 0.0F);
    _frame->setRotated(false);

    _lastTextureWidth = static_cast<float>(outWidth);
    _lastTextureHeight = static_cast<float>(outHeight);
    _lastLineCount = static_cast<int32_t>(lines.size());
    _lastContentWidth = contentWidth;
    _lastContentHeight = contentHeight;
    _lastPixelChecksum = 0U;
    _lastOpaquePixels = 0U;
    for (size_t i = 3; i < pixels.size(); i += 4U) {
        _lastPixelChecksum = _lastPixelChecksum * 31U + pixels[i];
        if (pixels[i] > 0U) { ++_lastOpaquePixels; }
    }

    _renderer.setFrame(_frame);
    applyBitmapAtlas();
}
void Label::syncBitmapAtlas() {
    if (!_bitmapAtlas) return;
    auto *texture = _bitmapAtlas->getTexture();
    const uint32_t width = texture ? texture->getWidth() : 0;
    const uint32_t height = texture ? texture->getHeight() : 0;
    const int32_t format = texture ? static_cast<int32_t>(texture->getPixelFormat()) : -1;
    if (_bitmapAtlasRevision != _bitmapAtlas->getRevision() || _bitmapTextureSeen != texture
        || _bitmapWidthSeen != width || _bitmapHeightSeen != height || _bitmapFormatSeen != format) {
        _bitmapAtlasRevision = _bitmapAtlas->getRevision(); _bitmapTextureSeen = texture;
        _bitmapWidthSeen = width; _bitmapHeightSeen = height; _bitmapFormatSeen = format; _dirty = true;
    }
}
void Label::ensureBitmapDiagnostics() const {
    if (_bitmapDiagnosticsDirty && _bitmapAtlas) const_cast<Label *>(this)->rasterizeBitmapDiagnostics();
}
void Label::rebuildBitmapTexture() {
    const auto &glyphs = _bitmapFont ? _bitmapFont->getGlyphs() : _glyphs;
    const auto &glyphMap = _bitmapFont ? _bitmapFont->getGlyphMap() : _glyphMap;
    const auto &kerningMap = _bitmapFont ? _bitmapFont->getKerningMap() : _kerning;
    auto *texture = _bitmapAtlas->getTexture();
    if (!texture || !texture->getGFXTexture() || !texture->getWidth() || !texture->getHeight()) { clearRenderedData(); return; }
    BitmapLayoutOptions options;
    if (_transform) { options.width = _transform->getContentSize().x; options.height = _transform->getContentSize().y; }
    options.fontSize = _fontSize; options.sourceFontSize = _bitmapLineHeight > 0 ? _bitmapLineHeight : _fontSize;
    options.lineHeight = _lineHeight; options.spacing = _spacingX; options.overflow = _overflow;
    options.horizontal = _hAlign; options.vertical = _vAlign; options.wrap = _wrap;
    std::vector<int32_t> text;
    for (const auto &symbol : splitUtf8(_string)) text.push_back(utf8CodePoint(symbol));
    const auto layout = layoutBitmapFont(text, glyphs, glyphMap, kerningMap, options);
    _actualFontSize = static_cast<float>(layout.actualFontSize);
    std::vector<SpriteQuad> quads; quads.reserve(layout.glyphs.size());
    const float texWidth = static_cast<float>(texture->getWidth()), texHeight = static_cast<float>(texture->getHeight());
    const auto *frame = _bitmapAtlas.get();
    const float trimmedLeft = frame->getOffsetX() + (frame->getOriginalWidth() - frame->getRectWidth()) * .5F;
    const float trimmedTop = frame->getOffsetY() - (frame->getOriginalHeight() - frame->getRectHeight()) * .5F;
    for (const auto &placement : layout.glyphs) {
        SpriteQuad quad; quad.valid = true;
        const float x = static_cast<float>(placement.x), top = static_cast<float>(placement.y);
        const float width = static_cast<float>(placement.width), height = static_cast<float>(placement.height);
        const float scale = static_cast<float>(layout.scale);
        quad.vertices[0].position.set(x, top - height * scale, 0); quad.vertices[1].position.set(x + width * scale, top - height * scale, 0);
        quad.vertices[2].position.set(x, top, 0); quad.vertices[3].position.set(x + width * scale, top, 0);
        float rx = frame->getRectX() + static_cast<float>(placement.u) - trimmedLeft;
        float ry = frame->getRectY() + static_cast<float>(placement.v) + trimmedTop;
        if (frame->isRotated()) {
            rx = frame->getRectX() + frame->getRectHeight() - static_cast<float>(placement.v) - height - trimmedTop;
            ry = static_cast<float>(placement.u) + frame->getRectY() - trimmedLeft;
            const float rotatedHeight = ry < 0 ? height + trimmedTop : height;
            quad.vertices[0].uv.set(rx / texWidth, ry / texHeight);
            quad.vertices[1].uv.set(rx / texWidth, (ry + width) / texHeight);
            quad.vertices[2].uv.set((rx + rotatedHeight) / texWidth, ry / texHeight);
            quad.vertices[3].uv.set((rx + rotatedHeight) / texWidth, (ry + width) / texHeight);
            quad.vertices[0].position.y = quad.vertices[1].position.y = top - rotatedHeight * scale;
        } else {
            quad.vertices[0].uv.set(rx / texWidth, (ry + height) / texHeight);
            quad.vertices[1].uv.set((rx + width) / texWidth, (ry + height) / texHeight);
            quad.vertices[2].uv.set(rx / texWidth, ry / texHeight);
            quad.vertices[3].uv.set((rx + width) / texWidth, ry / texHeight);
        }
        quads.emplace_back(quad);
    }
    _renderedBitmapGlyphs = static_cast<uint32_t>(quads.size());
    _lastContentWidth = static_cast<float>(layout.width); _lastContentHeight = static_cast<float>(layout.height);
    _lastTextureWidth = std::ceil(_lastContentWidth) + 2; _lastTextureHeight = std::ceil(_lastContentHeight) + 2;
    _lastLineCount = static_cast<int32_t>(layout.lineWidths.size());
    _lastAtlasTextureId = reinterpret_cast<uint64_t>(texture);
    _lastAtlasX = frame->getRectX(); _lastAtlasY = frame->getRectY();
    _lastAtlasWidth = frame->getRectWidth(); _lastAtlasHeight = frame->getRectHeight();
    _texture = nullptr;
    std::vector<uint8_t>().swap(_lastPixels); _lastOpaquePixels = 0; _lastPixelChecksum = 0; _bitmapDiagnosticsDirty = true;
    if (!_frame) _frame = new SpriteFrame();
    _frame->copyFrom(frame);
    _renderer.setColor(_color);
    _renderer.setLabelQuads(_frame, std::move(quads));
}
void Label::rasterizeBitmapDiagnostics() {
    _bitmapDiagnosticsDirty = false; ++_bitmapDiagnosticBuilds;
    const auto &glyphs = _bitmapFont ? _bitmapFont->getGlyphs() : _glyphs;
    const auto &glyphMap = _bitmapFont ? _bitmapFont->getGlyphMap() : _glyphMap;
    const auto &kerningMap = _bitmapFont ? _bitmapFont->getKerningMap() : _kerning;
    auto *atlasTexture = dynamic_cast<Texture2D *>(_bitmapAtlas->hasDynamicAtlasFrame()
        ? _bitmapAtlas->getOriginalTexture() : _bitmapAtlas->getTexture());
    ImageAsset *image = atlasTexture != nullptr ? atlasTexture->getImage() : nullptr;
    if (image == nullptr || image->getData() == nullptr || image->getWidth() == 0U || image->getHeight() == 0U) {
        _lastPixels.clear(); _lastOpaquePixels = 0; _lastPixelChecksum = 0;
        return;
    }

    const float lineHeight = _bitmapLineHeight > 0.0F ? _bitmapLineHeight : _fontSize;
    const float maxWidth = _transform != nullptr && _transform->getContentSize().x > 0.0F
        ? _transform->getContentSize().x
        : 100000.0F;
    const float baselineRatio = 0.26F;

    std::vector<std::vector<size_t>> lines;
    lines.emplace_back();
    float lineWidth = 0.0F;
    float contentWidth = 0.0F;

    int32_t previousCode = -1;
    for (const std::string &codepoint : splitUtf8(_string)) {
        if (codepoint == "\n") {
            contentWidth = std::max(contentWidth, lineWidth);
            lines.emplace_back();
            lineWidth = 0.0F;
            previousCode = -1;
            continue;
        }
        const int32_t code = utf8CodePoint(codepoint);
        const auto found = glyphMap.find(code);
        if (found == glyphMap.end()) {
            continue;
        }
        const Glyph &glyph = glyphs[found->second];
        float kerning = 0.0F;
        if (previousCode >= 0) {
            const auto kern = kerningMap.find((static_cast<uint64_t>(static_cast<uint32_t>(previousCode)) << 32U) | static_cast<uint32_t>(code));
            if (kern != kerningMap.end()) { kerning = kern->second; }
        }
        if (_wrap && lineWidth + kerning + glyph.xAdvance > maxWidth && !lines.back().empty()) {
            contentWidth = std::max(contentWidth, lineWidth);
            lines.emplace_back();
            lineWidth = 0.0F;
        }
        lines.back().push_back(found->second);
        lineWidth += kerning + glyph.xAdvance;
        previousCode = code;
    }
    contentWidth = std::max(contentWidth, lineWidth);

    const float contentHeight = std::max((static_cast<float>(lines.size()) + baselineRatio) * lineHeight, 1.0F);
    const uint32_t outWidth = static_cast<uint32_t>(std::ceil(std::max(contentWidth, 1.0F))) + 2U;
    const uint32_t outHeight = static_cast<uint32_t>(std::ceil(contentHeight)) + 2U;
    std::vector<uint8_t> pixels(static_cast<size_t>(outWidth) * outHeight * 4U, 0U);

    const uint32_t atlasWidth = image->getWidth();
    const uint32_t atlasHeight = image->getHeight();
    const uint8_t *atlasData = image->getData();

    for (size_t lineIndex = 0; lineIndex < lines.size(); ++lineIndex) {
        float cursorX = 1.0F;
        int32_t drawPreviousCode = -1;
        const float lineTop = 1.0F + static_cast<float>(lineIndex) * lineHeight;
        for (const size_t glyphIndex : lines[lineIndex]) {
            const Glyph &glyph = glyphs[glyphIndex];
            if (drawPreviousCode >= 0) {
                const auto kern = kerningMap.find((static_cast<uint64_t>(static_cast<uint32_t>(drawPreviousCode)) << 32U) | static_cast<uint32_t>(glyph.code));
                if (kern != kerningMap.end()) { cursorX += kern->second; }
            }
            const int32_t destX = static_cast<int32_t>(std::round(cursorX + glyph.offsetX));
            const int32_t destY = static_cast<int32_t>(std::round(lineTop + glyph.offsetY));
            const int32_t srcX = static_cast<int32_t>(std::round(glyph.u));
            const int32_t srcY = static_cast<int32_t>(std::round(glyph.v));
            const int32_t glyphW = static_cast<int32_t>(std::round(glyph.w));
            const int32_t glyphH = static_cast<int32_t>(std::round(glyph.h));
            for (int32_t y = 0; y < glyphH; ++y) {
                const int32_t sy = srcY + y;
                const int32_t dy = destY + y;
                if (sy < 0 || sy >= static_cast<int32_t>(atlasHeight) || dy < 0 || dy >= static_cast<int32_t>(outHeight)) {
                    continue;
                }
                for (int32_t x = 0; x < glyphW; ++x) {
                    const int32_t sx = srcX + x;
                    const int32_t dx = destX + x;
                    if (sx < 0 || sx >= static_cast<int32_t>(atlasWidth) || dx < 0 || dx >= static_cast<int32_t>(outWidth)) {
                        continue;
                    }
                    const size_t src = (static_cast<size_t>(sy) * atlasWidth + static_cast<size_t>(sx)) * 4U;
                    const size_t dst = (static_cast<size_t>(dy) * outWidth + static_cast<size_t>(dx)) * 4U;
                    const uint32_t alpha = atlasData[src + 3U];
                    pixels[dst] = static_cast<uint8_t>(atlasData[src] * _color.r / 255U);
                    pixels[dst + 1U] = static_cast<uint8_t>(atlasData[src + 1U] * _color.g / 255U);
                    pixels[dst + 2U] = static_cast<uint8_t>(atlasData[src + 2U] * _color.b / 255U);
                    pixels[dst + 3U] = static_cast<uint8_t>(alpha);
                }
            }
            cursorX += glyph.xAdvance;
            drawPreviousCode = glyph.code;
        }
    }

    _lastPixels = pixels;
    _lastPixelChecksum = 0U;
    _lastOpaquePixels = 0U;
    for (size_t i = 3; i < pixels.size(); i += 4U) {
        _lastPixelChecksum = _lastPixelChecksum * 31U + pixels[i];
        if (pixels[i] > 0U) { ++_lastOpaquePixels; }
    }


}
void Label::applyBitmapAtlas() {
    if (_cacheMode != 1 || _lastPixels.empty() || _lastTextureWidth <= 0.0F || _lastTextureHeight <= 0.0F) {
        return;
    }
    Rect region;
    if (!DynamicAtlas::get().add(static_cast<uint32_t>(_lastTextureWidth),
                                 static_cast<uint32_t>(_lastTextureHeight),
                                 _lastPixels.data(), region)) {
        return;
    }
    if (_frame == nullptr) { _frame = new SpriteFrame(); }
    _frame->setTexture(DynamicAtlas::get().getTexture());
    _frame->setRect(region.x, region.y, region.width, region.height);
    _frame->setOriginalSize(region.width, region.height);
    _frame->setOffset(0.0F, 0.0F);
    _frame->setRotated(false);
    _lastAtlasTextureId = DynamicAtlas::get().getTextureId();
    _lastAtlasX = region.x;
    _lastAtlasY = region.y;
    _lastAtlasWidth = region.width;
    _lastAtlasHeight = region.height;
    _renderer.setFrame(_frame);
}
void Label::syncTransformSize() {
    if (!_transform) return;
    const auto size = _transform->getContentSize();
    if (std::fabs(size.x - _layoutWidth) > 0.001F || std::fabs(size.y - _layoutHeight) > 0.001F) _dirty = true;
}
void Label::syncContentSize() {
    if (_transform && _overflow == 0) {
        _transform->setContentSize(_lastContentWidth, _lastContentHeight);
    } else if (_transform && _overflow == 3) {
        const auto size = _transform->getContentSize();
        if (std::fabs(size.y - _lastContentHeight) > 0.001F) _transform->setContentSize(size.x, _lastContentHeight);
    }
    if (_transform) {
        const auto size = _transform->getContentSize();
        _layoutWidth = size.x; _layoutHeight = size.y;
    }
}
void Label::measureContent() {
    if (!_transform) return;
    _transform->setContentSize(0.F, 0.F);
    _dirty = true;
    updateRenderData();
    _transform->setContentSize(_lastContentWidth, _lastContentHeight);
}
Size Label::measureUnwrappedText(const std::string &text) {
    const auto size = measureUnwrappedTextPrecise(text);
    return Size(static_cast<float>(size[0]), static_cast<float>(size[1]));
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
        options.fontSize = _fontSize; options.sourceFontSize = _bitmapLineHeight > 0 ? _bitmapLineHeight : _fontSize;
        options.lineHeight = _lineHeight; options.spacing = _spacingX;
        std::vector<int32_t> symbols;
        for (const auto &symbol : splitUtf8(text)) symbols.push_back(utf8CodePoint(symbol));
        const auto layout = layoutBitmapFont(symbols, _bitmapFont->getGlyphs(), _bitmapFont->getGlyphMap(), _bitmapFont->getKerningMap(), options);
        return {layout.width, layout.height};
    }
    CanvasRenderingContext2D context(1.F, 1.F);
    context.setFont(_font);
    float width = 0.F, line = 0.F; uint32_t lines = 1;
    std::string paragraph;
    for (const auto &symbol : splitUtf8(text)) {
        if (symbol == "\n") {
            width = std::max(width, _cacheMode == 2 ? line : measureText(context, paragraph));
            line = 0.F; paragraph.clear(); ++lines;
        } else if (_cacheMode == 2) line += measureText(context, symbol);
        else paragraph += symbol;
    }
    width = std::max(width, _cacheMode == 2 ? line : measureText(context, paragraph));
    const float lineHeight = _lineHeight > 0.F ? _lineHeight : _fontSize * (_cacheMode == 2 ? 1.F : 1.2F);
    const auto extent = getTextStyleExtent();
    return {std::max(width, _cacheMode == 2 ? 0.F : 1.F) + extent[0], std::max((lines + BASELINE_RATIO) * lineHeight, 1.F) + extent[1]};
}
void Label::updateRenderData() {
    syncTransformSize();
    syncFontAsset();
    syncBitmapAtlas();
    if (_dirty) {
        rebuildTexture();
    }
    syncContentSize();
}

void Label::rebuildTexture() {
    _dirty = false;
    _actualFontSize = _fontSize;
    if (_bitmapFont || (_bitmapAtlas != nullptr && !_glyphs.empty())) {
        const auto &glyphs = _bitmapFont ? _bitmapFont->getGlyphs() : _glyphs;
        if (_bitmapAtlas && !glyphs.empty()) rebuildBitmapTexture(); else clearRenderedData();
        return;
    }
    _renderedBitmapGlyphs = 0;
    _bitmapDiagnosticsDirty = false;
    _renderer.setColor(Color(255, 255, 255, _color.a));
    if (_fontAsset && _fontAsset->isReleased()) { clearRenderedData(); return; }
    if (_cacheMode == 2) { rebuildLetterTexture(); return; }

    if (_string.empty() || _transform == nullptr) {
        clearRenderedData();
        return;
    }

    CanvasRenderingContext2D measureContext(1.0F, 1.0F);
    measureContext.setFont(_font);

    const float lineHeight = _lineHeight > 0.0F ? _lineHeight : _fontSize * 1.2F;
    float maxWidth = _transform->getContentSize().x;
    if (maxWidth <= 0.0F || _overflow == 0) {
        maxWidth = 100000.0F;
    }

    std::vector<std::string> lines;
    size_t start = 0;
    while (start <= _string.size()) {
        const size_t end = _string.find('\n', start);
        const std::string paragraph = _string.substr(start, end == std::string::npos ? std::string::npos : end - start);
        if (paragraph.empty()) {
            lines.emplace_back();
        } else if (!_wrap) {
            lines.push_back(paragraph);
        } else {
            std::string current;
            for (const std::string &codepoint : splitUtf8(paragraph)) {
                const std::string candidate = current + codepoint;
                if (!current.empty() && measureText(measureContext, candidate) > maxWidth) {
                    lines.push_back(current);
                    current = codepoint;
                } else {
                    current = candidate;
                }
            }
            if (!current.empty()) {
                lines.push_back(current);
            }
        }
        if (end == std::string::npos) {
            break;
        }
        start = end + 1;
    }

    if (lines.empty()) {
        clearRenderedData();
        return;
    }

    float contentWidth = 0.0F;
    for (const std::string &line : lines) {
        contentWidth = std::max(contentWidth, measureText(measureContext, line));
    }
    if (_transform->getContentSize().x > 0.0F && _overflow != 0) {
        contentWidth = std::max(contentWidth, _transform->getContentSize().x);
    }
    contentWidth = std::max(contentWidth, 1.0F);

    const auto styleExtent = getTextStyleExtent();
    const float outlineMargin = _enableOutline ? std::max(_outlineWidth, 0.F) : 0.F;
    float contentHeight = std::max((static_cast<float>(lines.size()) + BASELINE_RATIO) * lineHeight, 1.0F);
    if (_overflow == 0) {
        contentWidth = static_cast<float>(contentWidth + styleExtent[0]);
        contentHeight = static_cast<float>(contentHeight + styleExtent[1]);
    }
    if (_overflow == 2 && _transform->getContentSize().y > 0.0F
        && contentHeight > _transform->getContentSize().y + 0.5F && _fontSize > 4.0F) {
        _fontSize *= 0.9F;
        updateFont();
        _dirty = true;
        rebuildTexture();
        return;
    }
    const float canvasWidth = contentWidth;
    float canvasHeight = contentHeight;
    if (_overflow == 1 && _transform->getContentSize().y > 0.0F) {
        canvasHeight = _transform->getContentSize().y;
    }
    const uint32_t textureWidth = std::max(static_cast<uint32_t>(canvasWidth), 1U);
    const uint32_t textureHeight = std::max(static_cast<uint32_t>(canvasHeight), 1U);

    CanvasRenderingContext2D context(static_cast<float>(textureWidth), static_cast<float>(textureHeight));
    context.setFont(_font);
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
    if (_enableShadow) {
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

    float textTop = static_cast<float>(_fontSize * (1.0 - 0.26 / 2.0));
    if (_vAlign != 0) {
        float blank = lineHeight * static_cast<float>(lines.size() - 1) + static_cast<float>(styleExtent[1]) + _fontSize - canvasHeight;
        if (_vAlign == 2) blank += static_cast<float>(_fontSize * 0.26 / 2.0);
        textTop -= _vAlign == 1 ? blank / 2.F : blank;
    }
    textTop += outlineMargin;

    for (size_t i = 0; i < lines.size(); ++i) {
        const std::string &line = lines[i];
        const float lineWidth = measureText(context, line);
        float x = outlineMargin;
        if (_hAlign == 1) {
            x = (canvasWidth - static_cast<float>(styleExtent[0]) - lineWidth) * 0.5F + outlineMargin;
        } else if (_hAlign == 2) {
            x = canvasWidth - lineWidth - static_cast<float>(styleExtent[0]) + outlineMargin;
        }
        const float lineY = textTop + static_cast<float>(i) * lineHeight;
        auto fillWithColor = [&](float dx, float dy, const Color &color) {
            char rgba[64] = {0};
            std::snprintf(rgba, sizeof(rgba), "rgba(%u,%u,%u,%.3f)",
                          static_cast<unsigned>(color.r),
                          static_cast<unsigned>(color.g),
                          static_cast<unsigned>(color.b),
                          static_cast<double>(color.a) / 255.0);
            context.setFillStyle(rgba);
            context.fillText(line, x + dx, lineY + dy, 0.0F);
        };

        if (_enableShadow) {
            const float blur = std::max(_shadowBlur, 1.0F);
            for (int pass = 0; pass < 9; ++pass) {
                const int px = (pass % 3) - 1;
                const int py = (pass / 3) - 1;
                fillWithColor(_shadowOffsetX + static_cast<float>(px) * blur,
                              _shadowOffsetY + static_cast<float>(py) * blur,
                              _shadowColor);
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
        if (_isUnderline) {
            context.fillRect(x, lineY + _fontSize / 8.F, lineWidth, std::max(_underlineHeight, 0.F));
        }
    }
    cc::Data pixels;
    context.setCanvasBufferUpdatedCallback([&pixels](const cc::Data &data) {
        pixels = data;
    });
    context.fetchData();

    if (_texture == nullptr) {
        _texture = new Texture2D();
    }
    ITexture2DCreateInfo info;
    info.width = textureWidth;
    info.height = textureHeight;
    info.format = PixelFormat::RGBA8888;
    info.mipmapLevel = 1U;
    _texture->reset(info);
    _lastPixelChecksum = 0U;
    _texture->setWrapMode(TextureBase::WrapMode::CLAMP_TO_EDGE, TextureBase::WrapMode::CLAMP_TO_EDGE);
    _lastOpaquePixels = 0U;
    const uint8_t *bytes = pixels.getBytes();
    for (uint32_t i = 0; i + 3U < pixels.getSize(); i += 4U) {
        _lastPixelChecksum = _lastPixelChecksum * 31U + bytes[i + 3U];
        if (bytes[i + 3U] > 1U) {
            ++_lastOpaquePixels;
        }
    }
    _lastPixels.assign(bytes, bytes + pixels.getSize());
    _texture->uploadData(bytes);

    _lastTextureWidth = static_cast<float>(textureWidth);
    _lastTextureHeight = static_cast<float>(textureHeight);
    _lastContentWidth = contentWidth;
    _lastContentHeight = contentHeight;
    _lastLineCount = static_cast<int32_t>(lines.size());
    if (_frame == nullptr) {
        _frame = new SpriteFrame();
    }
    _frame->setTexture(_texture);
    _frame->setRect(0.0F, 0.0F, static_cast<float>(textureWidth), static_cast<float>(textureHeight));
    _frame->setOriginalSize(static_cast<float>(textureWidth), static_cast<float>(textureHeight));
    _frame->setOffset(0.0F, 0.0F);
    _frame->setRotated(false);

    _renderer.setFrame(_frame);
    applyBitmapAtlas();
}

} // namespace cc
