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
    _entity->setPrepareListener(this);
    _entity->setUseLocal(true);
    _entity->setFillColorType(FillColorType::VERTEX);
}
Graphics::~Graphics() {
    setGeometrySource(nullptr);
    auto consumers = std::move(_consumers);
    for (auto *consumer : consumers) consumer->setGeometrySource(nullptr);
    _entity->setPrepareListener(nullptr);
    setNode(nullptr);
    _entity->clearDynamicRenderDrawInfos();
}
void Graphics::onDetach() {
    _entity->setNode(nullptr);
    _entity->setRenderTransform(nullptr);
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
void Graphics::clear() {
    _geometry.clear();
    ++_revision;
    _entity->clearDynamicRenderDrawInfos();
    _chunks.clear();
    _preparedRevision = UINT64_MAX;
}
void Graphics::setGeometrySource(Graphics *source) {
    if (source == this || source == _source) return;
    if (_source) {
        auto &list = _source->_consumers;
        list.erase(std::remove(list.begin(), list.end(), this), list.end());
    }
    _source = source;
    if (_source) _source->_consumers.push_back(this);
    _preparedRevision = UINT64_MAX;
    _entity->clearDynamicRenderDrawInfos();
}
void Graphics::setUseGeometrySource(bool value) {
    _useSource = value;
    _preparedRevision = UINT64_MAX;
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
        chunk->alpha.clear();
        ++stamp;
    };
    for (size_t i = 0; i + 2 < indices.size(); i += 3) {
        if (!chunk || chunk->alpha.size() + 3 > 65535) next();
        for (size_t j = i; j < i + 3; ++j) {
            const auto index = indices[j];
            if (generation[index] != stamp) {
                generation[index] = stamp;
                slots[index] = static_cast<uint32_t>(chunk->alpha.size());
                const auto &v = vertices[index];
                chunk->vertices.insert(chunk->vertices.end(), v.begin(), v.end());
                chunk->alpha.push_back(v[6]);
            }
            chunk->indices.push_back(static_cast<uint16_t>(slots[index]));
        }
    }
    _chunks.resize(used);
    _lastOpacity = -1;
}
void Graphics::prepareRenderEntity(float opacity) {
    const auto revision = _useSource ? (_source ? _source->_revision : 0) : _revision;
    if (_preparedRevision != revision) {
        rebuildChunks();
        _preparedRevision = revision;
    }
    _entity->clearDynamicRenderDrawInfos();
    auto *material = getRenderMaterial();
    for (auto &item : _chunks) {
        auto &c = *item;
        if (_lastOpacity != opacity)
            for (size_t i = 0; i < c.alpha.size(); ++i) c.vertices[i * 8 + 6] = c.alpha[i] * opacity;
        auto &draw = c.draw;
        draw.setDrawInfoType(static_cast<uint32_t>(RenderDrawInfoType::COMP));
        draw.setIsMeshBuffer(true);
        draw.setStride(8);
        draw.setVbCount(static_cast<uint32_t>(c.alpha.size()));
        draw.setIbCount(static_cast<uint32_t>(c.indices.size()));
        draw.setVDataBuffer(c.vertices.data());
        draw.setIDataBuffer(c.indices.data());
        draw.setMaterial(material);
        draw.setDataHash(0);
        if (material) _entity->addDynamicRenderDrawInfo(&draw);
    }
    _lastOpacity = opacity;
    _entity->setOpacity(opacity);
}
} // namespace cc
