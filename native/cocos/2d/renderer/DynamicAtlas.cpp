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

#include "2d/renderer/DynamicAtlas.h"

#include <algorithm>
#include <cstring>

#include "core/assets/AssetEnum.h"
#include "core/assets/Texture2D.h"

namespace cc {

DynamicAtlas &DynamicAtlas::get() {
    static DynamicAtlas atlas;
    return atlas;
}

DynamicAtlas::DynamicAtlas() : _pixels(static_cast<size_t>(ATLAS_WIDTH) * ATLAS_HEIGHT * 4U, 0U) {}

Texture2D *DynamicAtlas::getTexture() {
    if (_texture == nullptr) {
        _texture = new Texture2D();
        ITexture2DCreateInfo info;
        info.width = ATLAS_WIDTH;
        info.height = ATLAS_HEIGHT;
        info.format = PixelFormat::RGBA8888;
        info.mipmapLevel = 1U;
        _texture->reset(info);
        _texture->uploadData(_pixels.data());
    }
    return _texture;
}

uint64_t DynamicAtlas::getTextureId() const {
    return reinterpret_cast<uint64_t>(_texture);
}

bool DynamicAtlas::add(uint32_t width, uint32_t height, const uint8_t *pixels, Rect &outRect) {
    if (width == 0U || height == 0U || pixels == nullptr) {
        return false;
    }
    if (width > static_cast<uint32_t>(ATLAS_WIDTH) || height > static_cast<uint32_t>(ATLAS_HEIGHT)) {
        return false;
    }
    if (_cursorX + static_cast<int32_t>(width) >= ATLAS_WIDTH) {
        _cursorX = 0;
        _cursorY += _rowHeight + 1;
        _rowHeight = 0;
    }
    if (_cursorY + static_cast<int32_t>(height) >= ATLAS_HEIGHT) {
        return false;
    }

    const int32_t x = _cursorX;
    const int32_t y = _cursorY;
    for (uint32_t row = 0; row < height; ++row) {
        const size_t dst = (static_cast<size_t>(y + static_cast<int32_t>(row)) * ATLAS_WIDTH + x) * 4U;
        const size_t src = static_cast<size_t>(row) * width * 4U;
        std::memcpy(_pixels.data() + dst, pixels + src, static_cast<size_t>(width) * 4U);
    }
    _cursorX += static_cast<int32_t>(width) + 1;
    _rowHeight = std::max(_rowHeight, static_cast<int32_t>(height));

    if (_texture == nullptr) {
        getTexture();
    }
    _texture->uploadData(_pixels.data());
    outRect = Rect(static_cast<float>(x), static_cast<float>(y), static_cast<float>(width), static_cast<float>(height));
    return true;
}

} // namespace cc
