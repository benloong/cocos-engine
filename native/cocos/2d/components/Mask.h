/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.
 http://www.cocos.com
****************************************************************************/
#pragma once
#include "2d/framework/UIComponentType.h"
#include "2d/framework/UITransform.h"
#include "2d/components/Graphics.h"
namespace cc {
class Sprite;

class Mask final : public UIRenderer {
public:
    static constexpr uint32_t TYPE_ID = static_cast<uint32_t>(UIComponentTypeId::Mask);
    ~Mask() override;
    void setNode(Node *node) override;
    uint32_t getTypeId() const override { return TYPE_ID; }
    void onDetach() override;
    void setType(int32_t type);
    void setGraphics(Graphics *graphics);
    void invalidateStencil();
    void setSegments(uint32_t segments);
    void setRadius(float radius);
    bool isHitWorldPointXY(float x, float y) const;
    void setAlphaThreshold(float threshold);
    void setInverted(bool inverted);
    void setEnabled(bool enabled);
    void setPriority(int32_t priority);
    RenderEntity *getRenderEntity() const override;

private:
    void setUITransform(UITransform *transform);
    void updateRenderer() override;
    void onUITransformChanged() override { markRenderDirty(); }
    void attach();
    Sprite *getStencilSprite() const;
    void clearSpriteStencil();
    Graphics _graphics;
    UITransform *_transform{nullptr};
    UITransform::LayoutChanged::EventID _layoutChanged;
    UITransform::LayoutDestroyed::EventID _layoutDestroyed;
    int32_t _type{0};
    int32_t _priority{0};
    uint32_t _segments{64};
    float _alphaThreshold{0.1F};
    float _radius{0.F};
    bool _inverted{false};
    bool _shapeDirty{true};
    float _width{0};
    float _height{0};
    float _anchorX{0};
    float _anchorY{0};
};
} // namespace cc
