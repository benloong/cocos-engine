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
#include <cmath>
#include <cstdio>
#include <vector>

#include "2d/assets/SpriteFrame.h"
#include "2d/framework/UITransform.h"
#include "core/assets/AssetEnum.h"
#include "core/assets/ImageAsset.h"
#include "core/assets/Texture2D.h"
#include "platform/interfaces/modules/canvas/CanvasRenderingContext2D.h"

namespace cc {

namespace {

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
    _renderer.getRenderEntity()->setPrepareListener(this);
}

Label::~Label() {
    if (_renderer.getRenderEntity() != nullptr) {
        _renderer.getRenderEntity()->setPrepareListener(nullptr);
    }
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

void Label::setFont(const std::string &font) {
    if (_font == font) {
        return;
    }
    _font = font;
    const size_t px = font.find("px ");
    if (px != std::string::npos) {
        _fontFamily = font.substr(px + 3U);
    }
    _dirty = true;
}

void Label::setFontSize(float size) {
    if (std::fabs(_fontSize - size) < 0.01F) {
        return;
    }
    _fontSize = size;
    _dirty = true;
}

void Label::setLineHeight(float height) {
    if (std::fabs(_lineHeight - height) < 0.01F) {
        return;
    }
    _lineHeight = height;
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
    _bitmapAtlas = atlas;
    _bitmapLineHeight = lineHeight;
    _dirty = true;
}

void Label::clearBitmapFont() {
    _bitmapAtlas = nullptr;
    _bitmapLineHeight = 0.0F;
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

void Label::setColor(const Color &color) {
    UIRenderer::setColor(color);
    _renderer.setColor(color);
    _dirty = true;
}

void Label::setColorRGBA(float r, float g, float b, float a) {
    Color color(static_cast<uint8_t>(r), static_cast<uint8_t>(g), static_cast<uint8_t>(b), static_cast<uint8_t>(a));
    setColor(color);
}

void Label::setMaterial(Material *material) {
    UIRenderer::setMaterial(material);
    _renderer.setMaterial(material);
}

void Label::setPriority(int32_t priority) {
    UIRenderer::setPriority(priority);
    _renderer.setPriority(priority);
}

void Label::setEnabled(bool enabled) {
    _renderer.setEnabled(enabled);
}

void Label::prepareRenderEntity(float opacity) {
    if (_dirty) {
        rebuildTexture();
    }
    _renderer.prepare(opacity);
}

void Label::rebuildBitmapTexture() {
    auto *atlasTexture = dynamic_cast<Texture2D *>(_bitmapAtlas->getTexture());
    ImageAsset *image = atlasTexture != nullptr ? atlasTexture->getImage() : nullptr;
    if (image == nullptr || image->getData() == nullptr || image->getWidth() == 0U || image->getHeight() == 0U) {
        _renderer.clearFrame();
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
        const auto found = _glyphMap.find(code);
        if (found == _glyphMap.end()) {
            continue;
        }
        const Glyph &glyph = _glyphs[found->second];
        float kerning = 0.0F;
        if (previousCode >= 0) {
            const auto kern = _kerning.find((static_cast<uint64_t>(static_cast<uint32_t>(previousCode)) << 32U) | static_cast<uint32_t>(code));
            if (kern != _kerning.end()) { kerning = kern->second; }
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
            const Glyph &glyph = _glyphs[glyphIndex];
            if (drawPreviousCode >= 0) {
                const auto kern = _kerning.find((static_cast<uint64_t>(static_cast<uint32_t>(drawPreviousCode)) << 32U) | static_cast<uint32_t>(glyph.code));
                if (kern != _kerning.end()) { cursorX += kern->second; }
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
                    const uint32_t alpha = atlasData[src + 3U] * _color.a / 255U;
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

    if (_texture == nullptr) {
        _texture = new Texture2D();
    }
    ITexture2DCreateInfo info;
    info.width = outWidth;
    info.height = outHeight;
    info.format = PixelFormat::RGBA8888;
    info.mipmapLevel = 1U;
    _texture->reset(info);
    _texture->uploadData(pixels.data());

    if (_frame == nullptr) {
        _frame = new SpriteFrame();
    }
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

    const float finalWidth = _transform != nullptr && _transform->getContentSize().x > 0.0F
        ? _transform->getContentSize().x
        : contentWidth;
    if (_overflow == 3 && _transform != nullptr) {
        _transform->setContentSize(finalWidth, contentHeight);
    }
    _renderer.setFrame(_frame);
}
void Label::rebuildTexture() {
    _dirty = false;
    if (_bitmapAtlas != nullptr && !_glyphs.empty()) {
        rebuildBitmapTexture();
        return;
    }

    if (_string.empty() || _transform == nullptr) {
        _renderer.clearFrame();
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
        _renderer.clearFrame();
        return;
    }

    float contentWidth = 0.0F;
    for (const std::string &line : lines) {
        contentWidth = std::max(contentWidth, measureText(measureContext, line));
    }
    if (_transform->getContentSize().x > 0.0F && (_wrap || _overflow != 0)) {
        contentWidth = std::max(contentWidth, _transform->getContentSize().x);
    }
    contentWidth = std::max(contentWidth, 1.0F);

    const float contentHeight = std::max((static_cast<float>(lines.size()) + BASELINE_RATIO) * lineHeight, 1.0F);
    if (_overflow == 2 && _transform->getContentSize().y > 0.0F
        && contentHeight > _transform->getContentSize().y + 0.5F && _fontSize > 4.0F) {
        _fontSize *= 0.9F;
        _font = std::to_string(static_cast<int>(_fontSize)) + "px " + _fontFamily;
        _dirty = true;
        rebuildTexture();
        return;
    }
    const uint32_t textureWidth = static_cast<uint32_t>(std::ceil(contentWidth)) + 2U;
    uint32_t textureHeight = static_cast<uint32_t>(std::ceil(contentHeight)) + 2U;
    if (_overflow == 1 && _transform->getContentSize().y > 0.0F) {
        textureHeight = static_cast<uint32_t>(std::ceil(_transform->getContentSize().y)) + 2U;
    }

    CanvasRenderingContext2D context(static_cast<float>(textureWidth), static_cast<float>(textureHeight));
    context.setFont(_font);
    context.setTextBaseline("top");
    context.setTextAlign("left");

    char fill[64] = {0};
    std::snprintf(fill, sizeof(fill), "rgba(%u,%u,%u,%.3f)",
                  static_cast<unsigned>(_color.r),
                  static_cast<unsigned>(_color.g),
                  static_cast<unsigned>(_color.b),
                  static_cast<double>(_color.a) / 255.0);
    context.setFillStyle(fill);
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

    float textTop = 1.0F;
    if (_vAlign == 1) {
        textTop = (static_cast<float>(textureHeight) - contentHeight) * 0.5F;
    } else if (_vAlign == 2) {
        textTop = static_cast<float>(textureHeight) - contentHeight - 1.0F;
    }

    for (size_t i = 0; i < lines.size(); ++i) {
        const std::string &line = lines[i];
        const float lineWidth = measureText(context, line);
        float x = 1.0F;
        if (_hAlign == 1) {
            x = (static_cast<float>(textureWidth) - lineWidth) * 0.5F;
        } else if (_hAlign == 2) {
            x = static_cast<float>(textureWidth) - lineWidth - 1.0F;
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
            for (int pass = 0; pass < 8; ++pass) {
                const float angle = static_cast<float>(pass) * 0.7853981634F;
                fillWithColor(std::cos(angle) * _outlineWidth,
                              std::sin(angle) * _outlineWidth,
                              _outlineColor);
            }
        }

        char fillColor[64] = {0};
        std::snprintf(fillColor, sizeof(fillColor), "rgba(%u,%u,%u,%.3f)",
                      static_cast<unsigned>(_color.r),
                      static_cast<unsigned>(_color.g),
                      static_cast<unsigned>(_color.b),
                      static_cast<double>(_color.a) / 255.0);
        context.setFillStyle(fillColor);
        context.fillText(line, x, lineY, 0.0F);
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
    _lastOpaquePixels = 0U;
    const uint8_t *bytes = pixels.getBytes();
    for (uint32_t i = 0; i + 3U < pixels.getSize(); i += 4U) {
        _lastPixelChecksum = _lastPixelChecksum * 31U + bytes[i + 3U];
        if (bytes[i + 3U] > 0U) {
            ++_lastOpaquePixels;
        }
    }
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

    const float finalWidth = _transform->getContentSize().x > 0.0F ? _transform->getContentSize().x : contentWidth;
    if (_overflow == 3) {
        _transform->setContentSize(finalWidth, contentHeight);
    }
    _renderer.setFrame(_frame);
}

} // namespace cc
