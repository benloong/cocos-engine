/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com
****************************************************************************/

#pragma once
#include "2d/framework/UIComponentType.h"

#include "core/component/Component.h"

namespace cc {

class Node;

/**
 * Native RenderRoot2D registration. Owns the node -> Batcher2d root list
 * membership; Canvas extends the same JS component hierarchy.
 */
class RenderRoot2D final : public Component {
public:
    static constexpr uint32_t TYPE_ID = static_cast<uint32_t>(UIComponentTypeId::RenderRoot2D);
    RenderRoot2D() { _enabled = false; }
    ~RenderRoot2D() override;

    uint32_t getTypeId() const override { return TYPE_ID; }
    void setNode(Node *node) override;
    void setEnabled(bool enabled);
    void onEnable() override { registerNode(); }
    void onDisable() override { unregisterNode(); }

private:
    void registerNode();
    void unregisterNode();

};

} // namespace cc
