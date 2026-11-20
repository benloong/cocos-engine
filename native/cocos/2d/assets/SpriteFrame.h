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
    IMPL_EVENT_TARGET(SpriteFrame)
    DECLARE_TARGET_EVENT_BEGIN(SpriteFrame)
    TARGET_EVENT_ARG0(FrameChanged)
    DECLARE_TARGET_EVENT_END()
public:
    using Super = Asset;
    SpriteFrame() = default;
    ~SpriteFrame() override = default;

    void setTexture(TextureBase *texture) { assignTexture(texture); }
    void clearTextureReferences() {
        if (!_texture && !_originalTexture && !_hasOriginal) return;
        _texture = nullptr;
        _originalTexture = nullptr;
        _originalX = _originalY = 0.F;
        _hasOriginal = false;
        frameChanged();
    }
    TextureBase *getTexture() const { return _texture.get(); }
    uint32_t getRevision() const { return _revision; }

    // The frame owns both textures while packed. Consumers borrow the active
    // texture through this frame and observe the revision on either transition.
    void setDynamicAtlasFrame(TextureBase *texture, float x, float y) {
        if (!texture || !isObjectValid(this, true)) return;
        _originalTexture = _texture;
        _originalX = _data.x;
        _originalY = _data.y;
        _hasOriginal = true;
        _texture = texture;
        _data.x = x;
        _data.y = y;
        frameChanged();
    }
    void resetDynamicAtlasFrame() {
        if (!_hasOriginal) return;
        _texture = _originalTexture;
        _data.x = _originalX;
        _data.y = _originalY;
        _originalTexture = nullptr;
        _hasOriginal = false;
        frameChanged();
    }
    bool hasDynamicAtlasFrame() const { return _hasOriginal; }
    TextureBase *getOriginalTexture() const { return _originalTexture.get(); }
    float getOriginalX() const { return _originalX; }
    float getOriginalY() const { return _originalY; }

    void setRect(float x, float y, float width, float height) {
        _data.x = x; _data.y = y; _data.width = width; _data.height = height; frameChanged();
    }
    void setOriginalSize(float width, float height) {
        _data.originalWidth = width; _data.originalHeight = height; frameChanged();
    }
    void setOffset(float x, float y) { _data.offsetX = x; _data.offsetY = y; frameChanged(); }
    void setInsets(float left, float right, float top, float bottom) {
        _data.insetLeft = left; _data.insetRight = right; _data.insetTop = top; _data.insetBottom = bottom; frameChanged();
    }
    float getRectX() const { return _data.x; }
    void setRectX(float value) { _data.x = value; frameChanged(); }
    float getRectY() const { return _data.y; }
    void setRectY(float value) { _data.y = value; frameChanged(); }
    float getRectWidth() const { return _data.width; }
    void setRectWidth(float value) { _data.width = value; frameChanged(); }
    float getRectHeight() const { return _data.height; }
    void setRectHeight(float value) { _data.height = value; frameChanged(); }
    float getOriginalWidth() const { return _data.originalWidth; }
    void setOriginalWidth(float value) { _data.originalWidth = value; frameChanged(); }
    float getOriginalHeight() const { return _data.originalHeight; }
    void setOriginalHeight(float value) { _data.originalHeight = value; frameChanged(); }
    float getOffsetX() const { return _data.offsetX; }
    void setOffsetX(float value) { _data.offsetX = value; frameChanged(); }
    float getOffsetY() const { return _data.offsetY; }
    void setOffsetY(float value) { _data.offsetY = value; frameChanged(); }
    float getInsetLeft() const { return _data.insetLeft; }
    void setInsetLeft(float value) { _data.insetLeft = value; frameChanged(); }
    float getInsetRight() const { return _data.insetRight; }
    void setInsetRight(float value) { _data.insetRight = value; frameChanged(); }
    float getInsetTop() const { return _data.insetTop; }
    void setInsetTop(float value) { _data.insetTop = value; frameChanged(); }
    float getInsetBottom() const { return _data.insetBottom; }
    void setInsetBottom(float value) { _data.insetBottom = value; frameChanged(); }
    float getPixelsToUnit() const { return _data.pixelsToUnit; }
    void setPixelsToUnit(float value) { _data.pixelsToUnit = value; frameChanged(); }
    float getPivotX() const { return _data.pivotX; }
    void setPivotX(float value) { _data.pivotX = value; frameChanged(); }
    float getPivotY() const { return _data.pivotY; }
    void setPivotY(float value) { _data.pivotY = value; frameChanged(); }
    int32_t getMeshType() const { return _data.meshType; }
    void setMeshType(int32_t value) { _data.meshType = value; frameChanged(); }
    bool isRotated() const { return _data.rotated; }
    void setRotated(bool value) { _data.rotated = value; frameChanged(); }
    bool getFlipUVX() const { return _data.flipUVX; }
    void setFlipUVX(bool value) { _data.flipUVX = value; frameChanged(); }
    bool getFlipUVY() const { return _data.flipUVY; }
    void setFlipUVY(bool value) { _data.flipUVY = value; frameChanged(); }
    bool getPackable() const { return _data.packable; }
    void setPackable(bool value) { _data.packable = value; frameChanged(); }

    const std::string &getAtlasUuid() const { return _atlasUuid; }
    void setAtlasUuid(const std::string &value) { _atlasUuid = value; }
    void resetFrame(bool clearData) { if (clearData) { _data.resetGeometry(); frameChanged(); } }
    void resetWithTexture(TextureBase *texture) {
        if (!isObjectValid(this, true)) return;
        _data.resetGeometry();
        resetTexture(texture);
    }
    void resetTexture(TextureBase *texture) {
        if (assignTexture(texture) && texture) {
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
        if (!assignTexture(texture) || !texture) return;
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
        if (!other || other == this || !isObjectValid(this, true)) return;
        _data = other->_data; _texture = other->_texture; _atlasUuid = other->_atlasUuid; frameChanged();
        _originalTexture = other->_originalTexture;
        _originalX = other->_originalX; _originalY = other->_originalY;
        _hasOriginal = other->_hasOriginal;
    }
    std::vector<float> getUV() const {
        if (!_texture) return {};
        const auto uv = _data.calculateUV(static_cast<float>(_texture->getWidth()), static_cast<float>(_texture->getHeight()));
        return {uv.begin(), uv.end()};
    }
    std::vector<double> getMeshRawPositions() const {
        if (_data.meshType == 1) return {}; // Polygon generation is also empty on Web.
        const double w = _data.width * 0.5;
        const double h = _data.height * 0.5;
        return {-w, -h, 0, w, -h, 0, -w, h, 0, w, h, 0};
    }
    std::vector<double> getMeshUVs(bool normalized) const {
        const auto *source = _originalTexture ? _originalTexture.get() : _texture.get();
        if (_data.meshType == 1 || !source) return {};
        const double width = source->getWidth();
        const double height = source->getHeight();
        const double left = _originalTexture ? _originalX : _data.x;
        const double right = left + _data.width;
        const double top = height - (_originalTexture ? _originalY : _data.y);
        const double bottom = top - _data.height;
        if (!normalized) return {left, top, right, top, left, bottom, right, bottom};
        const double l = width ? left / width : 0;
        const double r = width ? right / width : 1;
        const double t = height ? top / height : 1;
        const double b = height ? bottom / height : 0;
        return {l, b, r, b, l, t, r, t};
    }
    // Authored coordinates are in pixels. Pivot and pixelsToUnit affect XY only.
    std::vector<double> transformMeshPositions(const std::vector<double> &raw) const {
        std::vector<double> positions(raw);
        const double units = 1.0 / _data.pixelsToUnit;
        const double tx = (0.5 - _data.pivotX) * _data.width * units;
        const double ty = (0.5 - _data.pivotY) * _data.height * units;
        for (size_t i = 0; i + 2 < positions.size(); i += 3) {
            positions[i] = raw[i] * units + tx;
            positions[i + 1] = raw[i + 1] * units + ty;
        }
        return positions;
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

protected:
    bool onPreDestroy() override {
        clearTextureReferences();
        return Super::onPreDestroy();
    }

private:
    void frameChanged() { ++_revision; emit<FrameChanged>(); }
    bool assignTexture(TextureBase *texture) {
        if (!isObjectValid(this, true)) return false;
        _texture = texture;
        frameChanged();
        return true;
    }

    SpriteFrameData _data;
    // Active and original textures are owned independently while packed.
    IntrusivePtr<TextureBase> _texture;
    IntrusivePtr<TextureBase> _originalTexture;
    float _originalX{0.F};
    float _originalY{0.F};
    bool _hasOriginal{false};
    std::string _atlasUuid;
    uint32_t _revision{0};
};

} // namespace cc
