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

#include "core/component/Component.h"

#include "core/scene-graph/Node.h"

namespace cc {

Component::~Component() {
    if (_node != nullptr && _node->getUIComponent() == this) {
        _node->setUIComponent(nullptr);
    }
}

void Component::setNode(Node *node) {
    if (_node == node) {
        return;
    }

    Node *oldNode = _node;
    if (oldNode != nullptr && oldNode->getUIComponent() == this) {
        oldNode->setUIComponent(nullptr);
    }
    _node = node;
    if (_node != nullptr) {
        _node->setUIComponent(this);
    }

    if (oldNode != nullptr) {
        onDetach();
    }
    if (_node != nullptr) {
        onAttach();
        if (_enabled) {
            onEnable();
        }
    }
}

void Component::setEnabled(bool enabled) {
    if (_enabled == enabled) {
        return;
    }
    _enabled = enabled;
    if (_node == nullptr) {
        return;
    }
    if (enabled) {
        onEnable();
    } else {
        onDisable();
    }
}

void Component::onNodeDestroyed() {
    _node = nullptr;
    onDetach();
}

} // namespace cc
