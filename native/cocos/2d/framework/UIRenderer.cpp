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

#include "2d/framework/UIRenderer.h"

#include "core/assets/Material.h"
#include "core/builtin/BuiltinResMgr.h"
#include "renderer/core/MaterialInstance.h"

namespace cc {

UIRenderer::UIRenderer() = default;
UIRenderer::~UIRenderer() = default;

void UIRenderer::setColor(const Color &color) {
    _color = color;
}

void UIRenderer::setColorRGBA(float red, float green, float blue, float alpha) {
    const auto toByte = [](float value) -> uint8_t {
        return static_cast<uint8_t>(value < 0.F ? 0.F : (value > 255.F ? 255.F : value));
    };
    setColor(Color(toByte(red), toByte(green), toByte(blue), toByte(alpha)));
}

void UIRenderer::setMaterial(Material *material) {
    setSharedMaterial(material, 0);
    _useBuiltinMaterial = !material;
    onMaterialChanged();
}

void UIRenderer::setSharedMaterial(Material *material, uint32_t index, bool forceUpdate) {
    if (_materials.size() <= index) {
        _materials.resize(index + 1, nullptr);
    }
    const bool wasBuiltin = index == 0 && _useBuiltinMaterial;
    if (index == 0) _useBuiltinMaterial = false;
    if (!forceUpdate && !wasBuiltin && _materials[index] == material) return;
    IntrusivePtr<Material> retained(material);
    if (index == 0) _materialInstance = nullptr;
    else if (index < _extraMaterialInstances.size()) _extraMaterialInstances[index] = nullptr;
    _materials[index] = retained;
    if (index == 0) {
        _material = retained;
    }
    onMaterialChanged();
}

Material *UIRenderer::getSharedMaterial(uint32_t index) const {
    if (index == 0 && _useBuiltinMaterial) return getBuiltinMaterial();
    return index < _materials.size() ? _materials[index].get() : nullptr;
}

void UIRenderer::resizeMaterials(uint32_t size) {
    _materials.resize(size);
    _extraMaterialInstances.resize(size);
    if (size == 0) {
        _materialInstance = nullptr;
        _material = nullptr;
        _useBuiltinMaterial = false;
    }
    onMaterialChanged();
}

void UIRenderer::setPriority(int32_t priority) {
    _priority = priority;
}

Material *UIRenderer::getMaterialInstance(uint32_t index) const {
    if (index == 0 && _materialInstance) return _materialInstance.get();
    if (index > 0 && index < _extraMaterialInstances.size() && _extraMaterialInstances[index]) return _extraMaterialInstances[index].get();
    auto *parent = getSharedMaterial(index);
    if (!parent) return nullptr;
    if (index >= _extraMaterialInstances.size()) _extraMaterialInstances.resize(index + 1);
    auto &instance = index == 0 ? _materialInstance : _extraMaterialInstances[index];
    IMaterialInstanceInfo info; info.parent = parent; info.subModelIdx = index;
    instance = new MaterialInstance(info);
    const_cast<UIRenderer *>(this)->onMaterialChanged();
    return instance.get();
}
void UIRenderer::setMaterialInstance(Material *material, uint32_t index) {
    if (index >= _extraMaterialInstances.size()) _extraMaterialInstances.resize(index + 1);
    auto &instance = index == 0 ? _materialInstance : _extraMaterialInstances[index];
    if (material && material->getParent()) {
        if (_materials.size() <= index) _materials.resize(index + 1);
        instance = material;
    } else {
        IntrusivePtr<Material> retained(material);
        instance = nullptr;
        setSharedMaterial(retained, index);
    }
    onMaterialChanged();
}

Material *UIRenderer::getBuiltinMaterial() const {
    auto *resources = BuiltinResMgr::getInstance();
    return resources ? resources->get<Material>("ui-sprite-material") : nullptr;
}

Material *UIRenderer::getRenderMaterial(uint32_t index) const {
    if (index == 0 && _materialInstance) return _materialInstance.get();
    if (index > 0 && index < _extraMaterialInstances.size() && _extraMaterialInstances[index]) return _extraMaterialInstances[index].get();
    return getSharedMaterial(index);
}

} // namespace cc
