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

#include "2d/assets/SpriteFrame.h"
#include "core/assets/AssetEnum.h"
#include "core/assets/Texture2D.h"

namespace cc {

Mask::Mask() {
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
    _renderer.setFrame(_frame);
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

void Mask::setType(int32_t type) {
    // M4.0: RECT only; other types remain a no-op.
    (void)type;
}

void Mask::setInverted(bool inverted) {
    _inverted = inverted;
    _renderer.getRenderEntity()->setMaskMode(inverted ? MaskMode::MASK_INVERTED : MaskMode::MASK);
}

void Mask::setEnabled(bool enabled) {
    _renderer.setEnabled(enabled);
}

void Mask::setMaterial(Material *material) {
    _renderer.setMaterial(material);
}

void Mask::setPriority(int32_t priority) {
    _renderer.setPriority(priority);
}

} // namespace cc
