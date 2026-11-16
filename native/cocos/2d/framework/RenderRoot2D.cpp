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
    Component::setNode(node);
}

void RenderRoot2D::setEnabled(bool enabled) {
    Component::setEnabled(enabled);
    // Repeated enable is harmless and retries registration if the engine's
    // batcher was initialized after this component's first enable.
    if (_enabled) { registerNode(); } else { unregisterNode(); }
}

void RenderRoot2D::registerNode() {
    if (_node == nullptr) { return; }
    auto *root = Root::getInstance();
    Batcher2d *batcher = root ? root->getBatcher2D() : nullptr;
    if (batcher != nullptr) {
        batcher->addRootNode(_node);
    }
}

void RenderRoot2D::unregisterNode() {
    if (_node == nullptr) { return; }
    auto *root = Root::getInstance();
    Batcher2d *batcher = root ? root->getBatcher2D() : nullptr;
    if (batcher != nullptr) {
        batcher->removeRootNode(_node);
    }
}

} // namespace cc
