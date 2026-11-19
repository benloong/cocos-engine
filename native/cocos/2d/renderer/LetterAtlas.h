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
#include <string>
#include <unordered_map>
#include <vector>
#include "base/Ptr.h"
#include "base/RefCounted.h"
#include "math/Color.h"

namespace cc {
class Texture2D;

/**
 * Native CHAR-cache glyph atlas.
 *
 * Glyphs are rasterized once through the platform Canvas delegate and packed
 * into a CPU RGBA atlas. Label consumes the alpha channel and applies its own
 * color while composing the final text texture.
 */
class LetterAtlas final : public RefCounted {
public:
    struct Glyph {
        int32_t code{0};
        int32_t x{0};
        int32_t y{0};
        int32_t width{0};
        int32_t height{0};
        float advance{0.0F};
        float offsetX{0.0F};
        float offsetY{0.0F};
        bool valid{false};
    };

    static constexpr int32_t ATLAS_WIDTH = 1024;
    static constexpr int32_t ATLAS_HEIGHT = 1024;

    static IntrusivePtr<LetterAtlas> acquire();
    ~LetterAtlas() override;

    using GlyphMap = std::unordered_map<int32_t, Glyph>;
    GlyphMap &getStyle(const std::string &key) { return _styles[key]; }
    const Glyph &getOrCreateGlyph(GlyphMap &glyphs, int32_t code, const std::string &font, float lineHeight, const Color &color);
    Texture2D *getTexture() const;
    void setTexture(Texture2D *texture);
    const uint8_t *getData() const { return _pixels.data(); }
    int32_t getWidth() const { return ATLAS_WIDTH; }
    int32_t getHeight() const { return ATLAS_HEIGHT; }

private:
    LetterAtlas();
    std::vector<uint8_t> _pixels;
    std::unordered_map<std::string, GlyphMap> _styles;
    IntrusivePtr<Texture2D> _texture;
    int32_t _cursorX{0};
    int32_t _cursorY{0};
    int32_t _rowHeight{0};
};

} // namespace cc
