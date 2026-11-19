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

#include "2d/renderer/LetterAtlas.h"

#include <algorithm>
#include <cmath>

#include "base/Data.h"
#include "core/assets/Texture2D.h"
#include "renderer/gfx-base/GFXDevice.h"
#include "platform/interfaces/modules/canvas/CanvasRenderingContext2D.h"

namespace cc {

namespace {

std::string codepointToUtf8(int32_t code) {
    std::string out;
    if (code < 0x80) {
        out.push_back(static_cast<char>(code));
    } else if (code < 0x800) {
        out.push_back(static_cast<char>(0xC0 | (code >> 6)));
        out.push_back(static_cast<char>(0x80 | (code & 0x3F)));
    } else if (code < 0x10000) {
        out.push_back(static_cast<char>(0xE0 | (code >> 12)));
        out.push_back(static_cast<char>(0x80 | ((code >> 6) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | (code & 0x3F)));
    } else {
        out.push_back(static_cast<char>(0xF0 | (code >> 18)));
        out.push_back(static_cast<char>(0x80 | ((code >> 12) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | ((code >> 6) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | (code & 0x3F)));
    }
    return out;
}

} // namespace

LetterAtlas::LetterAtlas() : _pixels(static_cast<size_t>(ATLAS_WIDTH) * ATLAS_HEIGHT * 4U, 0U) {}

LetterAtlas::~LetterAtlas() = default;

Texture2D *LetterAtlas::getTexture() const {
    return _texture && _texture->getGFXTexture() ? _texture.get() : nullptr;
}

void LetterAtlas::setTexture(Texture2D *texture) {
    if (getTexture() || !texture) return;
    _texture = texture;
    ITexture2DCreateInfo info;
    info.width = ATLAS_WIDTH;
    info.height = ATLAS_HEIGHT;
    info.format = PixelFormat::RGBA8888;
    info.mipmapLevel = 1U;
    _texture->reset(info);
    _texture->uploadData(_pixels.data());
}

const LetterAtlas::Glyph &LetterAtlas::getOrCreateGlyph(GlyphMap &glyphs, int32_t code, const std::string &font, float lineHeight, const Color &color) {
    const auto entry = glyphs.try_emplace(code);
    Glyph &glyph = entry.first->second;
    if (!entry.second) return glyph;

    CanvasRenderingContext2D measureContext(1.0F, 1.0F);
    measureContext.setFont(font);
    const std::string glyphText = codepointToUtf8(code);
    const float advance = measureContext.measureText(glyphText).width;

    glyph.code = code;
    glyph.advance = advance;
    glyph.valid = true;

    if (code == ' ' || code == '\t') {
        glyph.width = 1;
        glyph.height = 1;
        return glyph;
    }

    const int32_t glyphWidth = std::max(2, static_cast<int32_t>(std::ceil(advance)) + 2);
    const int32_t glyphHeight = std::max(2, static_cast<int32_t>(std::ceil(lineHeight)) + 2);
    if (_cursorX + glyphWidth >= ATLAS_WIDTH) {
        _cursorX = 0;
        _cursorY += _rowHeight + 1;
        _rowHeight = 0;
    }
    if (glyphWidth >= ATLAS_WIDTH || _cursorY + glyphHeight >= ATLAS_HEIGHT) {
        glyph.valid = false;
        return glyph;
    }
    glyph.x = _cursorX;
    glyph.y = _cursorY;
    glyph.width = glyphWidth;
    glyph.height = glyphHeight;
    _cursorX += glyphWidth + 1;
    _rowHeight = std::max(_rowHeight, glyphHeight);

    CanvasRenderingContext2D context(static_cast<float>(glyphWidth), static_cast<float>(glyphHeight));
    context.setFont(font);
    context.setTextBaseline("top");
    context.setTextAlign("left");
    context.setFillStyle("rgba(255,255,255,1)");
    context.fillText(glyphText, 1.0F, 1.0F, 0.0F);

    Data pixels;
    context.setCanvasBufferUpdatedCallback([&pixels](const Data &data) { pixels = data; });
    context.fetchData();
    if (pixels.getBytes() == nullptr || pixels.getSize() < static_cast<uint32_t>(glyphWidth * glyphHeight * 4)) {
        glyph.valid = false;
        return glyph;
    }

    const uint8_t *source = pixels.getBytes();
    for (int32_t y = 0; y < glyphHeight; ++y) {
        for (int32_t x = 0; x < glyphWidth; ++x) {
            const size_t src = (static_cast<size_t>(y) * glyphWidth + x) * 4U;
            const size_t dst = (static_cast<size_t>(glyph.y + y) * ATLAS_WIDTH + (glyph.x + x)) * 4U;
            _pixels[dst] = color.r;
            _pixels[dst + 1U] = color.g;
            _pixels[dst + 2U] = color.b;
            _pixels[dst + 3U] = source[src + 3U];
        }
    }

    if (_texture && _texture->getGFXTexture()) {
        gfx::BufferTextureCopy region;
        region.buffStride = ATLAS_WIDTH;
        region.texOffset.x = glyph.x;
        region.texOffset.y = glyph.y;
        region.texExtent.width = glyphWidth;
        region.texExtent.height = glyphHeight;
        const uint8_t *buffers[]{_pixels.data() + (glyph.y * ATLAS_WIDTH + glyph.x) * 4};
        gfx::Device::getInstance()->copyBuffersToTexture(buffers, _texture->getGFXTexture(), &region, 1);
    }
    return glyph;
}

} // namespace cc
