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

#include "2d/framework/UIOpacity.h"

#include "core/scene-graph/Node.h"

namespace cc {

UIOpacity::UIOpacity(Node *node) {
    setNode(node);
}

UIOpacity::~UIOpacity() {
    setNode(nullptr);
}

void UIOpacity::setNode(Node *node) {
    if (_node == node) return;
    if (_node) _node->_setLocalOpacity(1.F);
    Component::setNode(node);
}

void UIOpacity::setOpacity(float opacity) {
    if (opacity < 0.F) {
        opacity = 0.F;
    } else if (opacity > 255.F) {
        opacity = 255.F;
    }
    if (_opacity == opacity) {
        return;
    }
    _opacity = opacity;
    applyToNode();
}

void UIOpacity::onEnable() {
    applyToNode();
}

void UIOpacity::onDisable() {
    if (_node != nullptr) {
        _node->_setLocalOpacity(1.F);
    }
}

void UIOpacity::applyToNode() {
    if (_node != nullptr && isEnabled()) {
        _node->_setLocalOpacity(_opacity / 255.F);
    }
}

} // namespace cc
