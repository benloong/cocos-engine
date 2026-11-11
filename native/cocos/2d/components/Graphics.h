/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com
****************************************************************************/

#pragma once

#include <cstdint>
#include <vector>

#include "2d/components/Sprite.h"
#include "base/Ptr.h"
#include "math/Color.h"
#include "math/Vec2.h"

namespace cc {

class Texture2D;
class SpriteFrame;
class UITransform;
class Material;

/**
 * M4.2 Graphics compatibility slice.
 *
 * The path API rasterizes directly into a 256x256 CPU texture (no Canvas path
 * dependency); the internal Sprite submits it. Native triangulation can replace
 * the rasterizer later.
 */
class Graphics final : public UIRenderer {
public:
    Graphics();
    ~Graphics() override;

    void setNode(Node *node);
    void setUITransform(UITransform *transform);
    void setMaterial(Material *material);
    void setPriority(int32_t priority);
    void setEnabled(bool enabled);

    void clear();
    void moveTo(float x, float y);
    void lineTo(float x, float y);
    void close();
    void rect(float x, float y, float w, float h);
    void circle(float x, float y, float radius);
    void bezierCurveTo(float c1x, float c1y, float c2x, float c2y, float x, float y);
    void quadraticCurveTo(float cx, float cy, float x, float y);
    void fill();
    void stroke();

    void setLineWidth(float width);
    void setFillColor(const Color &color);
    void setStrokeColor(const Color &color);

    float getTextureWidth() const { return _lastWidth; }
    float getTextureHeight() const { return _lastHeight; }
    uint32_t getOpaquePixels() const { return _lastOpaque; }

private:
    void flush();

    Sprite _renderer;
    IntrusivePtr<Texture2D> _texture;
    IntrusivePtr<SpriteFrame> _frame;
    std::vector<uint8_t> _pixels;
    std::vector<Vec2> _path;
    float _lineWidth{1.0F};
    Color _fillColor{255, 255, 255, 255};
    Color _strokeColor{0, 0, 0, 255};
    float _lastWidth{0.0F};
    float _lastHeight{0.0F};
    uint32_t _lastOpaque{0};
};

} // namespace cc
