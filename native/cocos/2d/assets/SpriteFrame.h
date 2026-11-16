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
#include <vector>
#include "2d/assets/SpriteFrameData.h"
#include "base/Ptr.h"
#include "core/assets/Asset.h"
#include "core/assets/TextureBase.h"

namespace cc {

// Native owns frame data. JS exposes serialization and live math views only.
class SpriteFrame final : public Asset {
public:
    using Super = Asset;
    SpriteFrame() = default;
    ~SpriteFrame() override = default;

    void setTexture(TextureBase *texture) { _texture = texture; ++_revision; }
    TextureBase *getTexture() const { return _texture.get(); }
    uint32_t getRevision() const { return _revision; }

    void setRect(float x, float y, float width, float height) {
        _data.x = x; _data.y = y; _data.width = width; _data.height = height; ++_revision;
    }
    void setOriginalSize(float width, float height) {
        _data.originalWidth = width; _data.originalHeight = height; ++_revision;
    }
    void setOffset(float x, float y) { _data.offsetX = x; _data.offsetY = y; ++_revision; }
    void setInsets(float left, float right, float top, float bottom) {
        _data.insetLeft = left; _data.insetRight = right; _data.insetTop = top; _data.insetBottom = bottom; ++_revision;
    }
    float getRectX() const { return _data.x; }
    void setRectX(float value) { _data.x = value; ++_revision; }
    float getRectY() const { return _data.y; }
    void setRectY(float value) { _data.y = value; ++_revision; }
    float getRectWidth() const { return _data.width; }
    void setRectWidth(float value) { _data.width = value; ++_revision; }
    float getRectHeight() const { return _data.height; }
    void setRectHeight(float value) { _data.height = value; ++_revision; }
    float getOriginalWidth() const { return _data.originalWidth; }
    void setOriginalWidth(float value) { _data.originalWidth = value; ++_revision; }
    float getOriginalHeight() const { return _data.originalHeight; }
    void setOriginalHeight(float value) { _data.originalHeight = value; ++_revision; }
    float getOffsetX() const { return _data.offsetX; }
    void setOffsetX(float value) { _data.offsetX = value; ++_revision; }
    float getOffsetY() const { return _data.offsetY; }
    void setOffsetY(float value) { _data.offsetY = value; ++_revision; }
    float getInsetLeft() const { return _data.insetLeft; }
    void setInsetLeft(float value) { _data.insetLeft = value; ++_revision; }
    float getInsetRight() const { return _data.insetRight; }
    void setInsetRight(float value) { _data.insetRight = value; ++_revision; }
    float getInsetTop() const { return _data.insetTop; }
    void setInsetTop(float value) { _data.insetTop = value; ++_revision; }
    float getInsetBottom() const { return _data.insetBottom; }
    void setInsetBottom(float value) { _data.insetBottom = value; ++_revision; }
    float getPixelsToUnit() const { return _data.pixelsToUnit; }
    void setPixelsToUnit(float value) { _data.pixelsToUnit = value; ++_revision; }
    float getPivotX() const { return _data.pivotX; }
    void setPivotX(float value) { _data.pivotX = value; ++_revision; }
    float getPivotY() const { return _data.pivotY; }
    void setPivotY(float value) { _data.pivotY = value; ++_revision; }
    int32_t getMeshType() const { return _data.meshType; }
    void setMeshType(int32_t value) { _data.meshType = value; ++_revision; }
    bool isRotated() const { return _data.rotated; }
    void setRotated(bool value) { _data.rotated = value; ++_revision; }
    bool getFlipUVX() const { return _data.flipUVX; }
    void setFlipUVX(bool value) { _data.flipUVX = value; ++_revision; }
    bool getFlipUVY() const { return _data.flipUVY; }
    void setFlipUVY(bool value) { _data.flipUVY = value; ++_revision; }
    bool getPackable() const { return _data.packable; }
    void setPackable(bool value) { _data.packable = value; ++_revision; }

    const std::string &getAtlasUuid() const { return _atlasUuid; }
    void setAtlasUuid(const std::string &value) { _atlasUuid = value; }
    void resetFrame(bool clearData) { if (clearData) { _data.resetGeometry(); ++_revision; } }
    void resetWithTexture(TextureBase *texture) {
        _data.resetGeometry();
        resetTexture(texture);
    }
    void resetTexture(TextureBase *texture) {
        setTexture(texture);
        if (texture) {
            _data.width = static_cast<float>(texture->getWidth());
            _data.height = static_cast<float>(texture->getHeight());
            if (_data.originalWidth == 0 || _data.originalHeight == 0) {
                _data.originalWidth = _data.width;
                _data.originalHeight = _data.height;
            }
        }
    }
    // Dependency resolution must preserve serialized geometry.
    void loadTexture(TextureBase *texture) {
        setTexture(texture);
        if (!texture) return;
        const bool resetRect = _data.width == 0 || _data.height == 0 || !checkRect(texture);
        if (resetRect) {
            setRect(0, 0, static_cast<float>(texture->getWidth()), static_cast<float>(texture->getHeight()));
        }
        if (resetRect || _data.originalWidth == 0 || _data.originalHeight == 0) {
            setOriginalSize(static_cast<float>(texture->getWidth()), static_cast<float>(texture->getHeight()));
        }
    }
    bool checkRect(TextureBase *texture) const {
        return texture && _data.x + (_data.rotated ? _data.height : _data.width) <= texture->getWidth()
            && _data.y + (_data.rotated ? _data.width : _data.height) <= texture->getHeight();
    }
    void copyFrom(const SpriteFrame *other) {
        if (!other || other == this) return;
        _data = other->_data; _texture = other->_texture; _atlasUuid = other->_atlasUuid; ++_revision;
    }
    std::vector<float> getUV() const {
        if (!_texture) return {};
        const auto uv = _data.calculateUV(static_cast<float>(_texture->getWidth()), static_cast<float>(_texture->getHeight()));
        return {uv.begin(), uv.end()};
    }
    std::vector<float> getTrimmedBorder() const {
        const float halfWidth = (_data.originalWidth - _data.width) * 0.5F;
        const float halfHeight = (_data.originalHeight - _data.height) * 0.5F;
        return {_data.offsetX + halfWidth, _data.offsetX - halfWidth,
                _data.offsetY + halfHeight, _data.offsetY - halfHeight};
    }
    std::vector<float> getSlicedUV() const {
        if (!_texture) return {};
        const auto uv = _data.calculateSlicedUV(static_cast<float>(_texture->getWidth()), static_cast<float>(_texture->getHeight()));
        return {uv.begin(), uv.end()};
    }

private:
    SpriteFrameData _data;
    IntrusivePtr<TextureBase> _texture;
    std::string _atlasUuid;
    uint32_t _revision{0};
};

} // namespace cc
