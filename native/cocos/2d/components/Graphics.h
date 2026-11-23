/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.
 http://www.cocos.com
****************************************************************************/
#pragma once
#include "2d/framework/UIComponentType.h"
#include <memory>
#include "2d/framework/UIRenderer.h"
#include "2d/geometry/GraphicsGeometry.h"
#include "2d/renderer/RenderEntity.h"

namespace cc {
class UITransform;

// Native path/mesh owner. Local vertices use the graphics shader and Node UBO.
class Graphics final : public UIRenderer {
public:
    static constexpr uint32_t TYPE_ID = static_cast<uint32_t>(UIComponentTypeId::Graphics);
    Graphics();
    ~Graphics() override;
    uint32_t getTypeId() const override { return TYPE_ID; }
    void setNode(Node *node) override;
    void onDetach() override;
    void setPriority(int32_t priority);
    void setEnabled(bool enabled);
    void setColor(const Color &color);
    void setColorRGBA(float r, float g, float b, float a);
    void flushRenderData() { updateRenderer(); }
    void clear();
    void moveTo(double x, double y) { _geometry.moveTo(x, y); }
    void lineTo(double x, double y) { _geometry.lineTo(x, y); }
    void close() { _geometry.close(); }
    void rect(double x, double y, double w, double h) { _geometry.rect(x, y, w, h); }
    void fillRect(double x, double y, double w, double h) { rect(x,y,w,h);fill(); }
    void circle(double x, double y, double r) { _geometry.circle(x, y, r); }
    void ellipse(double x, double y, double rx, double ry) { _geometry.ellipse(x, y, rx, ry); }
    void arc(double x, double y, double r, double start, double end, bool ccw) { _geometry.arc(x, y, r, start, end, ccw); }
    void roundRect(double x, double y, double w, double h, double r) { _geometry.roundRect(x, y, w, h, r); }
    void bezierCurveTo(double a, double b, double c, double d, double x, double y) { _geometry.bezierCurveTo(a, b, c, d, x, y); }
    void quadraticCurveTo(double a, double b, double x, double y) { _geometry.quadraticCurveTo(a, b, x, y); }
    void fill() {
        _geometry.fill();
        geometryChanged();
    }
    void stroke() {
        _geometry.stroke();
        geometryChanged();
    }
    void setLineWidth(double width) { _geometry.lineWidth = width; }
    void setLineJoin(int value) { _geometry.lineJoin = static_cast<GraphicsGeometry::LineJoin>(value); }
    void setLineCap(int value) { _geometry.lineCap = static_cast<GraphicsGeometry::LineCap>(value); }
    void setMiterLimit(double value) { _geometry.miterLimit = value; }
    void setFillColor(const Color &color);
    void setStrokeColor(const Color &color);
    RenderEntity *getRenderEntity() const override { return _entity.get(); }
    // Stencil consumers use the source material and can also borrow its geometry.
    void setGeometrySource(Graphics *source);
    void setUseGeometrySource(bool useSource);
    const GraphicsGeometry &getGeometry() const;

protected:
    Material *getBuiltinMaterial() const override;

private:
    friend class Mask;
    void updateRenderer() override;
    struct Chunk {
        std::vector<float> vertices;
        std::vector<uint16_t> indices;
        RenderDrawInfo draw;
    };
    void rebuildChunks();
    void geometryChanged();
    void onMaterialChanged() override;
    GraphicsGeometry _geometry;
    Graphics *_source{nullptr};         // borrowed; registered in source->_consumers
    std::vector<Graphics *> _consumers; // borrowed observers; never deleted here
    bool _useSource{false};
    IntrusivePtr<RenderEntity> _entity; // owning reference; Node::UserData also retains it while attached
    std::vector<std::unique_ptr<Chunk>> _chunks;
};
} // namespace cc
