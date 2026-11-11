/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com
****************************************************************************/

#include "2d/components/Graphics.h"

#include <algorithm>
#include <cmath>
#include <cstring>

#include "2d/assets/SpriteFrame.h"
#include "2d/framework/UITransform.h"
#include "core/assets/AssetEnum.h"
#include "core/assets/Texture2D.h"

namespace cc {

namespace {
constexpr int32_t CANVAS_SIZE = 256;
constexpr float CANVAS_CENTER = 128.0F;
}

Graphics::Graphics() : _pixels(static_cast<size_t>(CANVAS_SIZE) * CANVAS_SIZE * 4U, 0U) {
    _renderer.setSizeMode(0);
    _renderer.setColorRGBA(255.0F, 255.0F, 255.0F, 255.0F);
}

Graphics::~Graphics() = default;

void Graphics::setNode(Node *node) { _renderer.setNode(node); }
void Graphics::setUITransform(UITransform *transform) { _renderer.setUITransform(transform); }
void Graphics::setMaterial(Material *material) { _renderer.setMaterial(material); }
void Graphics::setPriority(int32_t priority) { _renderer.setPriority(priority); }
void Graphics::setEnabled(bool enabled) { _renderer.setEnabled(enabled); }

void Graphics::clear() {
    std::fill(_pixels.begin(), _pixels.end(), 0U);
    _path.clear();
    _renderer.clearFrame();
    _lastWidth = 0.0F;
    _lastHeight = 0.0F;
    _lastOpaque = 0U;
}

void Graphics::moveTo(float x, float y) {
    _path.clear();
    _path.emplace_back(x + CANVAS_CENTER, y + CANVAS_CENTER);
}

void Graphics::lineTo(float x, float y) {
    _path.emplace_back(x + CANVAS_CENTER, y + CANVAS_CENTER);
}

void Graphics::close() {}

void Graphics::rect(float x, float y, float w, float h) {
    _path.clear();
    _path.emplace_back(x + CANVAS_CENTER, y + CANVAS_CENTER);
    _path.emplace_back(x + CANVAS_CENTER + w, y + CANVAS_CENTER);
    _path.emplace_back(x + CANVAS_CENTER + w, y + CANVAS_CENTER + h);
    _path.emplace_back(x + CANVAS_CENTER, y + CANVAS_CENTER + h);
}

void Graphics::circle(float x, float y, float radius) {
    _path.clear();
    constexpr int32_t SEGMENTS = 48;
    for (int32_t i = 0; i < SEGMENTS; ++i) {
        const float angle = 6.283185307F * static_cast<float>(i) / SEGMENTS;
        _path.emplace_back(x + CANVAS_CENTER + std::cos(angle) * radius,
                           y + CANVAS_CENTER + std::sin(angle) * radius);
    }
}

void Graphics::ellipse(float x, float y, float radiusX, float radiusY) {
    _path.clear();
    constexpr int32_t SEGMENTS = 48;
    for (int32_t i = 0; i < SEGMENTS; ++i) {
        const float angle = 6.283185307F * static_cast<float>(i) / SEGMENTS;
        _path.emplace_back(x + CANVAS_CENTER + std::cos(angle) * radiusX,
                           y + CANVAS_CENTER + std::sin(angle) * radiusY);
    }
}

void Graphics::arc(float x, float y, float radius, float startAngle, float endAngle, bool counterclockwise) {
    _path.clear();
    constexpr int32_t SEGMENTS = 32;
    const float sweep = endAngle - startAngle;
    for (int32_t i = 0; i <= SEGMENTS; ++i) {
        const float t = static_cast<float>(i) / SEGMENTS;
        const float angle = counterclockwise ? startAngle - sweep * t : startAngle + sweep * t;
        _path.emplace_back(x + CANVAS_CENTER + std::cos(angle) * radius,
                           y + CANVAS_CENTER + std::sin(angle) * radius);
    }
}

void Graphics::roundRect(float x, float y, float w, float h, float radius) {
    const float r = std::min(std::max(radius, 0.0F), std::min(w, h) * 0.5F);
    if (r <= 0.0F) { rect(x, y, w, h); return; }
    _path.clear();
    constexpr int32_t SEGMENTS = 8;
    auto addArc = [this, r](float cx, float cy, float start, float end) {
        constexpr int32_t ARC_SEGMENTS = 8;
        for (int32_t i = 0; i <= ARC_SEGMENTS; ++i) {
            const float a = start + (end - start) * static_cast<float>(i) / ARC_SEGMENTS;
            _path.emplace_back(cx + CANVAS_CENTER + std::cos(a) * r,
                               cy + CANVAS_CENTER + std::sin(a) * r);
        }
    };
    addArc(x + r, y + r, 3.14159265F, 4.71238898F);
    addArc(x + w - r, y + r, 4.71238898F, 6.28318531F);
    addArc(x + w - r, y + h - r, 0.0F, 1.57079633F);
    addArc(x + r, y + h - r, 1.57079633F, 3.14159265F);
}
void Graphics::bezierCurveTo(float c1x, float c1y, float c2x, float c2y, float x, float y) {
    if (_path.empty()) { return; }
    const Vec2 start = _path.back();
    constexpr int32_t SEGMENTS = 24;
    for (int32_t i = 1; i <= SEGMENTS; ++i) {
        const float t = static_cast<float>(i) / SEGMENTS;
        const float u = 1.0F - t;
        const float px = u * u * u * start.x + 3.0F * u * u * t * (c1x + CANVAS_CENTER)
                       + 3.0F * u * t * t * (c2x + CANVAS_CENTER) + t * t * t * (x + CANVAS_CENTER);
        const float py = u * u * u * start.y + 3.0F * u * u * t * (c1y + CANVAS_CENTER)
                       + 3.0F * u * t * t * (c2y + CANVAS_CENTER) + t * t * t * (y + CANVAS_CENTER);
        _path.emplace_back(px, py);
    }
}

void Graphics::quadraticCurveTo(float cx, float cy, float x, float y) {
    if (_path.empty()) { return; }
    const Vec2 start = _path.back();
    constexpr int32_t SEGMENTS = 20;
    for (int32_t i = 1; i <= SEGMENTS; ++i) {
        const float t = static_cast<float>(i) / SEGMENTS;
        const float u = 1.0F - t;
        const float px = u * u * start.x + 2.0F * u * t * (cx + CANVAS_CENTER) + t * t * (x + CANVAS_CENTER);
        const float py = u * u * start.y + 2.0F * u * t * (cy + CANVAS_CENTER) + t * t * (y + CANVAS_CENTER);
        _path.emplace_back(px, py);
    }
}

void Graphics::fill() {
    if (_path.size() < 3) { return; }
    for (int32_t y = 0; y < CANVAS_SIZE; ++y) {
        for (int32_t x = 0; x < CANVAS_SIZE; ++x) {
            bool inside = false;
            for (size_t i = 0, j = _path.size() - 1; i < _path.size(); j = i++) {
                const Vec2 &a = _path[i];
                const Vec2 &b = _path[j];
                if (((a.y > y) != (b.y > y)) && (x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x)) {
                    inside = !inside;
                }
            }
            if (inside) {
                const size_t idx = (static_cast<size_t>(y) * CANVAS_SIZE + x) * 4U;
                _pixels[idx] = _fillColor.r;
                _pixels[idx + 1U] = _fillColor.g;
                _pixels[idx + 2U] = _fillColor.b;
                _pixels[idx + 3U] = _fillColor.a;
            }
        }
    }
    flush();
}

void Graphics::stroke() {
    if (_path.size() < 2) { return; }
    const float half = std::max(_lineWidth, 1.0F) * 0.5F;
    for (size_t i = 1; i < _path.size(); ++i) {
        const Vec2 a = _path[i - 1];
        const Vec2 b = _path[i];
        const float minX = std::max(0.0F, std::min(a.x, b.x) - half);
        const float maxX = std::min(static_cast<float>(CANVAS_SIZE - 1), std::max(a.x, b.x) + half);
        const float minY = std::max(0.0F, std::min(a.y, b.y) - half);
        const float maxY = std::min(static_cast<float>(CANVAS_SIZE - 1), std::max(a.y, b.y) + half);
        for (int32_t y = static_cast<int32_t>(minY); y <= static_cast<int32_t>(maxY); ++y) {
            for (int32_t x = static_cast<int32_t>(minX); x <= static_cast<int32_t>(maxX); ++x) {
                const float dx = b.x - a.x;
                const float dy = b.y - a.y;
                const float lengthSq = dx * dx + dy * dy;
                float t = lengthSq > 0.0F ? ((x - a.x) * dx + (y - a.y) * dy) / lengthSq : 0.0F;
                t = std::clamp(t, 0.0F, 1.0F);
                const float px = a.x + t * dx;
                const float py = a.y + t * dy;
                const float distSq = (x - px) * (x - px) + (y - py) * (y - py);
                if (distSq <= half * half) {
                    const size_t idx = (static_cast<size_t>(y) * CANVAS_SIZE + x) * 4U;
                    _pixels[idx] = _strokeColor.r;
                    _pixels[idx + 1U] = _strokeColor.g;
                    _pixels[idx + 2U] = _strokeColor.b;
                    _pixels[idx + 3U] = _strokeColor.a;
                }
            }
        }
    }
    flush();
}

void Graphics::setLineWidth(float width) { _lineWidth = width; }
void Graphics::setFillColor(const Color &color) { _fillColor = color; }
void Graphics::setStrokeColor(const Color &color) { _strokeColor = color; }

void Graphics::flush() {
    if (_texture == nullptr) { _texture = new Texture2D(); }
    ITexture2DCreateInfo info;
    info.width = CANVAS_SIZE;
    info.height = CANVAS_SIZE;
    info.format = PixelFormat::RGBA8888;
    info.mipmapLevel = 1U;
    _texture->reset(info);
    _texture->uploadData(_pixels.data());

    if (_frame == nullptr) { _frame = new SpriteFrame(); }
    _frame->setTexture(_texture);
    _frame->setRect(0.0F, 0.0F, CANVAS_SIZE, CANVAS_SIZE);
    _frame->setOriginalSize(CANVAS_SIZE, CANVAS_SIZE);
    _frame->setOffset(0.0F, 0.0F);
    _frame->setRotated(false);
    _renderer.setFrame(_frame);

    _lastWidth = CANVAS_SIZE;
    _lastHeight = CANVAS_SIZE;
    _lastOpaque = 0U;
    for (size_t i = 3; i < _pixels.size(); i += 4U) {
        if (_pixels[i] > 0U) { ++_lastOpaque; }
    }
}

} // namespace cc
