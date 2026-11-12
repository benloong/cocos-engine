/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com
****************************************************************************/

#pragma once

#include "base/Macros.h"

namespace cc {

class Node;

/**
 * Native RenderRoot2D registration. Owns the node -> Batcher2d root list
 * membership; Canvas extends the same JS component hierarchy.
 */
class RenderRoot2D final {
public:
    RenderRoot2D() = default;
    ~RenderRoot2D();

    void setNode(Node *node);
    void setEnabled(bool enabled);

private:
    void registerNode();
    void unregisterNode();

    Node *_node{nullptr};
    bool _enabled{false};
    bool _registered{false};
};

} // namespace cc
