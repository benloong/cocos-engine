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

#include "2d/components/Sprite.h"
#include "base/Ptr.h"

namespace cc {

class Texture2D;
class SpriteFrame;
class UITransform;
class Material;

/**
 * Native M4.0 Mask, RECT path.
 *
 * A transparent white Sprite supplies the rectangle geometry; RenderEntity's
 * MaskMode drives the existing Batcher2d/StencilManager path.
 */
class Mask final {
public:
    Mask();
    ~Mask();

    void setNode(Node *node);
    void setUITransform(UITransform *transform);
    void setType(int32_t type);
    void setInverted(bool inverted);
    void setEnabled(bool enabled);
    void setMaterial(Material *material);
    void setPriority(int32_t priority);

private:
    Sprite _renderer;
    IntrusivePtr<Texture2D> _texture;
    IntrusivePtr<SpriteFrame> _frame;
    bool _inverted{false};
};

} // namespace cc
