/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com
****************************************************************************/
#pragma once
#include <cstdint>

namespace cc {
// Node's non-owning native UI slots share one namespace. Keep the existing
// IDs stable; append new component kinds here instead of choosing local IDs.
// Zero is reserved for untyped Component/registration-link instances.
enum class UIComponentTypeId : uint32_t {
    UITransform = 1,
    UIOpacity,
    UIRenderer,
    Sprite,
    Label,
    Graphics,
    Mask,
    RichText,
    RenderRoot2D,
};
} // namespace cc
