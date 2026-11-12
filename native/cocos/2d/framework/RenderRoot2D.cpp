/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com
****************************************************************************/

#include "2d/framework/RenderRoot2D.h"

#include "2d/renderer/Batcher2d.h"
#include "core/Root.h"
#include "core/scene-graph/Node.h"

namespace cc {

RenderRoot2D::~RenderRoot2D() {
    unregisterNode();
}

void RenderRoot2D::setNode(Node *node) {
    if (_node == node) { return; }
    unregisterNode();
    _node = node;
    if (_enabled) { registerNode(); }
}

void RenderRoot2D::setEnabled(bool enabled) {
    if (_enabled == enabled) { return; }
    _enabled = enabled;
    if (_enabled) { registerNode(); } else { unregisterNode(); }
}

void RenderRoot2D::registerNode() {
    if (_registered || _node == nullptr) { return; }
    Batcher2d *batcher = Root::getInstance()->getBatcher2D();
    if (batcher != nullptr) {
        batcher->addRootNode(_node);
        _registered = true;
    }
}

void RenderRoot2D::unregisterNode() {
    if (!_registered) { return; }
    Batcher2d *batcher = Root::getInstance()->getBatcher2D();
    if (batcher != nullptr) {
        batcher->removeRootNode(_node);
    }
    _registered = false;
}

} // namespace cc
