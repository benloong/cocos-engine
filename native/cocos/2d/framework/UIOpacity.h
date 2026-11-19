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
#include "2d/framework/UIComponentType.h"

#include "core/component/Component.h"

namespace cc {

/**
 * Native UIOpacity data. The JS shell keeps serialization and editor metadata;
 * this object only owns the 0..255 value and writes Node::_localOpacity.
 */
class UIOpacity final : public Component {
public:
    static constexpr uint32_t TYPE_ID = static_cast<uint32_t>(UIComponentTypeId::UIOpacity);

    UIOpacity() = default;
    explicit UIOpacity(Node *node);
    ~UIOpacity() override;
    void setNode(Node *node) override;

    uint32_t getTypeId() const override { return TYPE_ID; }

    float getOpacity() const { return _opacity; }
    void setOpacity(float opacity);
    void setActive(bool enabled) { setEnabled(enabled); }
    void detach() { setNode(nullptr); }

    void onEnable() override;
    void onDisable() override;

private:
    void applyToNode();

    float _opacity{255.F};
};

} // namespace cc
