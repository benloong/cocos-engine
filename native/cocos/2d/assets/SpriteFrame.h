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

#include "base/Ptr.h"
#include "base/RefCounted.h"
#include "core/assets/TextureBase.h"

namespace cc {

/**
 * Native SpriteFrame asset. It keeps the texture alive and carries the frame
 * fields the Sprite assembler needs; the JS SpriteFrame remains the serialized
 * asset and forwards these fields through a cached native frame.
 */
class SpriteFrame final : public RefCounted {
public:
    SpriteFrame() = default;
    ~SpriteFrame() override = default;

    void setTexture(TextureBase *texture) { _texture = texture; }
    TextureBase *getTexture() const { return _texture.get(); }

    void setRect(float x, float y, float width, float height) {
        _x = x;
        _y = y;
        _width = width;
        _height = height;
    }
    float getRectX() const { return _x; }
    float getRectY() const { return _y; }
    float getRectWidth() const { return _width; }
    float getRectHeight() const { return _height; }

    void setOriginalSize(float width, float height) {
        _originalWidth = width;
        _originalHeight = height;
    }
    float getOriginalWidth() const { return _originalWidth; }
    float getOriginalHeight() const { return _originalHeight; }

    void setOffset(float x, float y) {
        _offsetX = x;
        _offsetY = y;
    }
    float getOffsetX() const { return _offsetX; }
    float getOffsetY() const { return _offsetY; }

    void setRotated(bool rotated) { _rotated = rotated; }
    bool isRotated() const { return _rotated; }

    void setInsets(float left, float right, float top, float bottom) {
        _insetLeft = left;
        _insetRight = right;
        _insetTop = top;
        _insetBottom = bottom;
    }
    float getInsetLeft() const { return _insetLeft; }
    float getInsetRight() const { return _insetRight; }
    float getInsetTop() const { return _insetTop; }
    float getInsetBottom() const { return _insetBottom; }

    void setUuid(const std::string &uuid) { _uuid = uuid; }
    const std::string &getUuid() const { return _uuid; }
    void setName(const std::string &name) { _name = name; }
    const std::string &getName() const { return _name; }

private:
    IntrusivePtr<TextureBase> _texture;
    std::string _uuid;
    std::string _name;
    float _x{0.F};
    float _y{0.F};
    float _width{0.F};
    float _height{0.F};
    float _originalWidth{0.F};
    float _originalHeight{0.F};
    float _offsetX{0.F};
    float _offsetY{0.F};
    float _insetLeft{0.F};
    float _insetRight{0.F};
    float _insetTop{0.F};
    float _insetBottom{0.F};
    bool _rotated{false};
};

} // namespace cc
