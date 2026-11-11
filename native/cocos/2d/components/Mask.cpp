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

#include "2d/components/Mask.h"

#include <cmath>

#include "2d/assets/SpriteFrame.h"
#include "core/assets/AssetEnum.h"
#include "core/assets/Texture2D.h"

namespace cc {

Mask::Mask() {
    _renderer.setSizeMode(0);
    _texture = new Texture2D();
    ITexture2DCreateInfo info;
    info.width = 2;
    info.height = 2;
    info.format = PixelFormat::RGBA8888;
    info.mipmapLevel = 1U;
    _texture->reset(info);
    const uint8_t white[16] = {255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255};
    _texture->uploadData(white);
    _frame = new SpriteFrame();
    _frame->setTexture(_texture);
    _frame->setRect(0.0F, 0.0F, 2.0F, 2.0F);
    _frame->setOriginalSize(2.0F, 2.0F);
    _frame->setOffset(0.0F, 0.0F);
    _frame->setRotated(false);
    applyFrame();
    _renderer.setColorRGBA(255.0F, 255.0F, 255.0F, 255.0F);
    _renderer.getRenderEntity()->setMaskMode(MaskMode::MASK);
}

Mask::~Mask() = default;

void Mask::setNode(Node *node) {
    _renderer.setNode(node);
}

void Mask::setUITransform(UITransform *transform) {
    _renderer.setUITransform(transform);
}

void Mask::applyFrame() {
    SpriteFrame *frame = _frame.get();
    if (_type == 1) {
        if (_ellipseTexture == nullptr) {
            _ellipseTexture = new Texture2D();
            ITexture2DCreateInfo info;
            info.width = 64;
            info.height = 64;
            info.format = PixelFormat::RGBA8888;
            info.mipmapLevel = 1U;
            _ellipseTexture->reset(info);
            std::vector<uint8_t> pixels(64U * 64U * 4U, 0U);
            for (int32_t y = 0; y < 64; ++y) {
                for (int32_t x = 0; x < 64; ++x) {
                    const float nx = (static_cast<float>(x) + 0.5F) / 32.0F - 1.0F;
                    const float ny = (static_cast<float>(y) + 0.5F) / 32.0F - 1.0F;
                    if (nx * nx + ny * ny <= 1.0F) {
                        const size_t i = (static_cast<size_t>(y) * 64U + x) * 4U;
                        pixels[i] = 255U;
                        pixels[i + 1U] = 255U;
                        pixels[i + 2U] = 255U;
                        pixels[i + 3U] = 255U;
                    }
                }
            }
            _ellipseTexture->uploadData(pixels.data());
            _ellipseFrame = new SpriteFrame();
            _ellipseFrame->setTexture(_ellipseTexture);
            _ellipseFrame->setRect(0.0F, 0.0F, 64.0F, 64.0F);
            _ellipseFrame->setOriginalSize(64.0F, 64.0F);
            _ellipseFrame->setOffset(0.0F, 0.0F);
            _ellipseFrame->setRotated(false);
        }
        frame = _ellipseFrame.get();
    } else if ((_type == 2 || _type == 3) && _spriteFrame != nullptr) {
        frame = _spriteFrame.get();
    }
    if (frame != nullptr) {
        _renderer.setFrame(frame);
    }
}
void Mask::setType(int32_t type) {
    _type = type;
    applyFrame();
}

void Mask::setSpriteFrame(SpriteFrame *frame) {
    _spriteFrame = frame;
    if (_type == 2 || _type == 3) {
        applyFrame();
    }
}

void Mask::setAlphaThreshold(float alphaThreshold) {
    _alphaThreshold = alphaThreshold;
    if (_material != nullptr) {
        _material->setPropertyFloat32("alphaThreshold", alphaThreshold);
    }
}

void Mask::setInverted(bool inverted) {
    _inverted = inverted;
    _renderer.getRenderEntity()->setMaskMode(inverted ? MaskMode::MASK_INVERTED : MaskMode::MASK);
}

void Mask::setEnabled(bool enabled) {
    _renderer.setEnabled(enabled);
}

void Mask::setMaterial(Material *material) {
    _material = material;
    if (_material != nullptr) {
        _material->setPropertyFloat32("alphaThreshold", _alphaThreshold);
    }
    _renderer.setMaterial(material);
}

void Mask::setPriority(int32_t priority) {
    _renderer.setPriority(priority);
}

} // namespace cc
