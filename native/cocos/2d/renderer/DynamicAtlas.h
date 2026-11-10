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
#include <vector>

#include "base/Ptr.h"
#include "math/Geometry.h"

namespace cc {

class Texture2D;

/**
 * Shared CPU/GPU atlas used by Label CacheMode.BITMAP.
 *
 * Labels copy their rendered text into this atlas and use a region SpriteFrame,
 * so multiple Label nodes can share one texture. There is no eviction yet; a
 * full page simply falls back to the label's own texture.
 */
class DynamicAtlas final {
public:
    static constexpr int32_t ATLAS_WIDTH = 1024;
    static constexpr int32_t ATLAS_HEIGHT = 1024;

    static DynamicAtlas &get();

    Texture2D *getTexture();
    uint64_t getTextureId() const;
    int32_t getWidth() const { return ATLAS_WIDTH; }
    int32_t getHeight() const { return ATLAS_HEIGHT; }

    bool add(uint32_t width, uint32_t height, const uint8_t *pixels, Rect &outRect);

private:
    DynamicAtlas();

    Texture2D *_texture{nullptr};
    std::vector<uint8_t> _pixels;
    int32_t _cursorX{0};
    int32_t _cursorY{0};
    int32_t _rowHeight{0};
};

} // namespace cc
