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
#include "core/assets/Texture2D.h"
#include "platform/interfaces/modules/canvas/CanvasRenderingContext2D.h"

namespace cc {

namespace {

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

void Label::rebuildTexture() {
    _dirty = false;

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

    const float contentHeight = std::max(lineHeight * static_cast<float>(lines.size()), 1.0F);
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
        if (_enableOutline && _outlineWidth > 0.0F) {
            char outline[64] = {0};
            std::snprintf(outline, sizeof(outline), "rgba(%u,%u,%u,%.3f)",
                          static_cast<unsigned>(_outlineColor.r),
                          static_cast<unsigned>(_outlineColor.g),
                          static_cast<unsigned>(_outlineColor.b),
                          static_cast<double>(_outlineColor.a) / 255.0);
            context.setLineWidth(_outlineWidth);
            context.setStrokeStyle(outline);
            context.strokeText(line, x, textTop + static_cast<float>(i) * lineHeight, 0.0F);
        }
        context.fillText(line, x, textTop + static_cast<float>(i) * lineHeight, 0.0F);
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
