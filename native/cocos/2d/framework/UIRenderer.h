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
#include "2d/framework/UIRendererManager.h"

#include <cstdint>
#include <vector>

#include "base/Ptr.h"
#include "core/component/Component.h"
#include "math/Color.h"

namespace cc {

class Material;
class RenderEntity;

/**
 * Native base for the 2D UI rendering components.
 *
 * This is the M2 foundation: it owns the state shared by Sprite/Label/Mask
 * (color, material, priority, blend factors) and participates in the native
 * Node UI component slots. Geometry, assembler and draw-info generation stay
 * in the concrete component.
 */
class UIRenderer : public Component {
public:
    static constexpr uint32_t TYPE_ID = static_cast<uint32_t>(UIComponentTypeId::UIRenderer);

    UIRenderer() = default;
    ~UIRenderer() override;

    void onEnable() override;
    void onDisable() override;
    void onDetach() override;

    uint32_t getTypeId() const override { return TYPE_ID; }

    void setColor(const Color &color);
    void setColorRGBA(float red, float green, float blue, float alpha);
    const Color &getColor() const { return _color; }

    void setMaterial(Material *material);
    Material *getMaterial() const { return _material.get(); }
    Material *getRenderMaterial(uint32_t index = 0) const;
    Material *getMaterialInstance(uint32_t index = 0) const;
    virtual void setMaterialInstance(Material *material, uint32_t index = 0);

    virtual void setSharedMaterial(Material *material, uint32_t index, bool forceUpdate = false);
    Material *getSharedMaterial(uint32_t index = 0) const;
    uint32_t getSharedMaterialCount() const { return static_cast<uint32_t>(_materials.size()); }
    void resizeMaterials(uint32_t size);
    // Array edits affect only the selected backing array, unlike explicit setters.
    void writeMaterialSlot(bool shared, uint32_t index, Material *material);
    void resizeMaterialArray(bool shared, uint32_t size);
    Material *getMaterialInstanceSlot(uint32_t index) const;
    uint32_t getMaterialInstanceCount() const { return static_cast<uint32_t>(_extraMaterialInstances.size()); }

    void setPriority(int32_t priority);
    int32_t getPriority() const { return _priority; }

    void setSrcBlendFactor(uint32_t factor) { _srcBlendFactor = factor; }
    uint32_t getSrcBlendFactor() const { return _srcBlendFactor; }
    void setDstBlendFactor(uint32_t factor) { _dstBlendFactor = factor; }
    uint32_t getDstBlendFactor() const { return _dstBlendFactor; }

protected:
    virtual RenderEntity *getRenderEntity() const { return nullptr; }
    virtual void updateRenderer() {}
    enum DirtyFlag : uint32_t { GEOMETRY = 1, COLOR = 2 };
    void markRenderDirty(uint32_t flags = GEOMETRY) {
        _pendingFlags |= flags;
        UIRendererManager::getInstance().markDirtyRenderer(this);
    }
    uint32_t renderDirtyFlags() const { return _pendingFlags; }
    void clearRenderDirty() { _pendingFlags = 0; }
    virtual void onMaterialChanged() {}
    virtual Material *getBuiltinMaterial() const;
    Color _color{255, 255, 255, 255};
    IntrusivePtr<Material> _material;
    mutable IntrusivePtr<Material> _materialInstance;
    mutable std::vector<IntrusivePtr<Material>> _extraMaterialInstances;
    std::vector<IntrusivePtr<Material>> _materials;
    bool _useBuiltinMaterial{true};
    int32_t _priority{0};
    uint32_t _srcBlendFactor{2}; // gfx::BlendFactor::SRC_ALPHA
    uint32_t _dstBlendFactor{4}; // gfx::BlendFactor::ONE_MINUS_SRC_ALPHA

private:
    friend class UIRendererManager;
    int32_t _internalId{-1};
    int64_t _dirtyVersion{-1};
    uint32_t _pendingFlags{0}; // Detached components can still be measured synchronously.
};

} // namespace cc
