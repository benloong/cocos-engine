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

namespace cc {

class Node;

/**
 * Minimal native component base for the M1 UI path.
 *
 * It deliberately excludes the JS component registry, scheduler and
 * serialization. The JS shell keeps the Component identity; this object only
 * owns the Node link and lifecycle needed by the native 2D implementation.
 */
class Component {
public:
    Component() = default;
    virtual ~Component();

    Component(const Component &) = delete;
    Component &operator=(const Component &) = delete;

    Node *getNode() const { return _node; }
    virtual void setNode(Node *node);

    bool isEnabled() const { return _enabled; }
    void setEnabled(bool enabled);

    virtual uint32_t getTypeId() const { return 0; }

    virtual void onWorldTransformDirty() {}
    virtual void onAttach() {}
    virtual void onDetach() {}
    virtual void onEnable() {}
    virtual void onDisable() {}

    /**
     * Called by Node before the Node is destroyed. The component must not
     * touch the Node afterwards.
     */
    void onNodeDestroyed();

protected:
    Node *_node{nullptr};
    bool _enabled{true};
};

} // namespace cc
