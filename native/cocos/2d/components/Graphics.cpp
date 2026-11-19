/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.
 http://www.cocos.com
****************************************************************************/
#include "2d/components/Graphics.h"
#include <algorithm>
#include "core/assets/Material.h"
#include "core/builtin/BuiltinResMgr.h"

namespace cc {
Graphics::Graphics() : _entity(new RenderEntity(RenderEntityType::DYNAMIC)) {
    markRenderDirty();
    _entity->setUseLocal(true);
    _entity->setFillColorType(FillColorType::VERTEX);
}
Graphics::~Graphics() {
    setGeometrySource(nullptr);
    auto consumers = std::move(_consumers);
    for (auto *consumer : consumers) consumer->setGeometrySource(nullptr);
    setNode(nullptr);
    _entity->clearDynamicRenderDrawInfos();
}
void Graphics::onDetach() {
    _entity->setNode(nullptr);
    _entity->setRenderTransform(nullptr);
    UIRenderer::onDetach();
}
void Graphics::setNode(Node *node) {
    if (getNode() == node) return;
    _entity->setNode(nullptr);
    Component::setNode(node);
    _entity->setNode(node);
    _entity->setRenderTransform(node);
    _entity->setEnabled(isEnabled());
}
void Graphics::setPriority(int32_t priority) {
    UIRenderer::setPriority(priority);
    _entity->setPriority(priority);
}
void Graphics::setEnabled(bool enabled) {
    Component::setEnabled(enabled);
    _entity->setEnabled(enabled);
}
void Graphics::setColor(const Color &color) {
    UIRenderer::setColor(color);
    _entity->setColor(color);
}
void Graphics::setColorRGBA(float r, float g, float b, float a) {
    UIRenderer::setColorRGBA(r, g, b, a);
    _entity->setColor(_color);
}
Material *Graphics::getBuiltinMaterial() const {
    auto *resources = BuiltinResMgr::getInstance();
    return resources ? resources->get<Material>(ccstd::string("ui-graphics-material")) : nullptr;
}
void Graphics::setFillColor(const Color &color) { _geometry.fillColor = {color.r / 255.F, color.g / 255.F, color.b / 255.F, color.a / 255.F}; }
void Graphics::setStrokeColor(const Color &color) { _geometry.strokeColor = {color.r / 255.F, color.g / 255.F, color.b / 255.F, color.a / 255.F}; }
void Graphics::geometryChanged() {
    ++_revision;
    if (!_useSource) markRenderDirty();
    for (auto *consumer : _consumers) {
        if (consumer->_useSource) consumer->markRenderDirty();
    }
}
void Graphics::clear() {
    _geometry.clear();
    geometryChanged();
    _entity->clearDynamicRenderDrawInfos();
    _chunks.clear();
    markRenderDirty();
}
void Graphics::setGeometrySource(Graphics *source) {
    if (source == this || source == _source) return;
    if (_source) {
        auto &list = _source->_consumers;
        list.erase(std::remove(list.begin(), list.end(), this), list.end());
    }
    _source = source;
    if (_source) _source->_consumers.push_back(this);
    markRenderDirty();
    _entity->clearDynamicRenderDrawInfos();
}
void Graphics::setUseGeometrySource(bool value) {
    _useSource = value;
    markRenderDirty();
}
const GraphicsGeometry &Graphics::getGeometry() const {
    static const GraphicsGeometry empty;
    return _useSource ? (_source ? _source->_geometry : empty) : _geometry;
}
void Graphics::rebuildChunks() {
    _entity->clearDynamicRenderDrawInfos();
    const auto &g = getGeometry();
    const auto &vertices = g.getVertices();
    const auto &indices = g.getIndices();
    std::vector<uint32_t> slots(vertices.size()), generation(vertices.size(), 0);
    uint32_t stamp = 0;
    size_t used = 0;
    Chunk *chunk = nullptr;
    auto next = [&]() {
        if (used == _chunks.size()) _chunks.push_back(std::make_unique<Chunk>());
        chunk = _chunks[used++].get();
        chunk->vertices.clear();
        chunk->indices.clear();
        ++stamp;
    };
    for (size_t i = 0; i + 2 < indices.size(); i += 3) {
        if (!chunk || chunk->vertices.size() / 8 + 3 > 65535) next();
        for (size_t j = i; j < i + 3; ++j) {
            const auto index = indices[j];
            if (generation[index] != stamp) {
                generation[index] = stamp;
                slots[index] = static_cast<uint32_t>(chunk->vertices.size() / 8);
                const auto &v = vertices[index];
                chunk->vertices.insert(chunk->vertices.end(), v.begin(), v.end());
            }
            chunk->indices.push_back(static_cast<uint16_t>(slots[index]));
        }
    }
    _chunks.resize(used);
}
void Graphics::updateRenderer() {
    if (!renderDirtyFlags()) return;
    if (renderDirtyFlags() & GEOMETRY) rebuildChunks();
    clearRenderDirty();
    _entity->clearDynamicRenderDrawInfos();
    auto *material = getRenderMaterial();
    for (auto &item : _chunks) {
        auto &c = *item;
        // Match Web's VERTEX fill-color mode: geometry owns its alpha.
        // Cascaded opacity still propagates through the entity to children.
        auto &draw = c.draw;
        draw.setDrawInfoType(static_cast<uint32_t>(RenderDrawInfoType::COMP));
        draw.setIsMeshBuffer(true);
        draw.setStride(8);
        draw.setVbCount(static_cast<uint32_t>(c.vertices.size() / 8));
        draw.setIbCount(static_cast<uint32_t>(c.indices.size()));
        draw.setVDataBuffer(c.vertices.data());
        draw.setIDataBuffer(c.indices.data());
        draw.setMaterial(material);
        draw.setDataHash(0);
        if (material) _entity->addDynamicRenderDrawInfo(&draw);
    }
}
} // namespace cc
