/****************************************************************************
 Copyright (c) 2017-2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do
 so, subject to the following conditions:

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
#include "2d/geometry/GraphicsGeometry.h"
#include <algorithm>
#include <cmath>
#include "2d/geometry/GraphicsEarcut.h"

namespace cc {
namespace {
constexpr double PI = 3.14159265358979323846;
constexpr double KAPPA = 0.5522847493;
constexpr int CORNER = 1, LEFT = 2, BEVEL = 4, INNER = 8;
} // namespace

void GraphicsGeometry::clear() {
    _paths.clear();
    _vertices.clear();
    _indices.clear();
    _pathOffset = 0;
    _updatePathOffset = false;
}
void GraphicsGeometry::moveTo(double x, double y) {
    if (_updatePathOffset) {
        _pathOffset = _paths.size();
        _updatePathOffset = false;
    }
    _paths.emplace_back();
    addPoint(x, y, CORNER);
    _commandX = x;
    _commandY = y;
}
void GraphicsGeometry::addPoint(double x, double y, int flags) {
    if (!_paths.empty()) {
        Point p{x, y};
        p.flags = flags;
        _paths.back().points.push_back(p);
    }
}
void GraphicsGeometry::lineTo(double x, double y) {
    addPoint(x, y, CORNER);
    _commandX = x;
    _commandY = y;
}
void GraphicsGeometry::close() {
    if (!_paths.empty()) _paths.back().closed = true;
}
void GraphicsGeometry::rect(double x, double y, double w, double h) {
    moveTo(x, y);
    lineTo(x + w, y);
    lineTo(x + w, y + h);
    lineTo(x, y + h);
    close();
    _paths.back().complex = false;
}
void GraphicsGeometry::tessellate(double x1, double y1, double x2, double y2, double x3, double y3, double x4, double y4, int level, int flags) {
    if (level > 10) return;
    const double x12 = (x1 + x2) * .5, y12 = (y1 + y2) * .5, x23 = (x2 + x3) * .5, y23 = (y2 + y3) * .5;
    const double x34 = (x3 + x4) * .5, y34 = (y3 + y4) * .5, x123 = (x12 + x23) * .5, y123 = (y12 + y23) * .5;
    const double dx = x4 - x1, dy = y4 - y1;
    const double d2 = std::abs((x2 - x4) * dy - (y2 - y4) * dx), d3 = std::abs((x3 - x4) * dy - (y3 - y4) * dx);
    if ((d2 + d3) * (d2 + d3) < tessTol * (dx * dx + dy * dy)) {
        addPoint(x4, y4, flags == 0 ? BEVEL : flags);
        return;
    }
    const double x234 = (x23 + x34) * .5, y234 = (y23 + y34) * .5, x1234 = (x123 + x234) * .5, y1234 = (y123 + y234) * .5;
    tessellate(x1, y1, x12, y12, x123, y123, x1234, y1234, level + 1, 0);
    tessellate(x1234, y1234, x234, y234, x34, y34, x4, y4, level + 1, flags);
}
void GraphicsGeometry::bezierCurveTo(double c1x, double c1y, double c2x, double c2y, double x, double y) {
    if (_paths.empty() || _paths.back().points.empty()) return;
    const auto p = _paths.back().points.back();
    if (p.x == c1x && p.y == c1y && c2x == x && c2y == y) {
        lineTo(x, y);
        return;
    }
    tessellate(p.x, p.y, c1x, c1y, c2x, c2y, x, y, 0, CORNER);
    _commandX = x;
    _commandY = y;
}
void GraphicsGeometry::quadraticCurveTo(double cx, double cy, double x, double y) {
    bezierCurveTo(_commandX + 2.0 / 3 * (cx - _commandX), _commandY + 2.0 / 3 * (cy - _commandY), x + 2.0 / 3 * (cx - x), y + 2.0 / 3 * (cy - y), x, y);
}
void GraphicsGeometry::ellipse(double x, double y, double rx, double ry) {
    moveTo(x - rx, y);
    bezierCurveTo(x - rx, y + ry * KAPPA, x - rx * KAPPA, y + ry, x, y + ry);
    bezierCurveTo(x + rx * KAPPA, y + ry, x + rx, y + ry * KAPPA, x + rx, y);
    bezierCurveTo(x + rx, y - ry * KAPPA, x + rx * KAPPA, y - ry, x, y - ry);
    bezierCurveTo(x - rx * KAPPA, y - ry, x - rx, y - ry * KAPPA, x - rx, y);
    close();
    _paths.back().complex = false;
}
void GraphicsGeometry::roundRect(double x, double y, double w, double h, double r) {
    if (r < .1) {
        rect(x, y, w, h);
        return;
    }
    const double rx = std::min(r, std::abs(w) * .5) * (w > 0 ? 1 : w < 0 ? -1
                                                                         : 0),
                 ry = std::min(r, std::abs(h) * .5) * (h > 0 ? 1 : h < 0 ? -1
                                                                         : 0);
    moveTo(x, y + ry);
    lineTo(x, y + h - ry);
    bezierCurveTo(x, y + h - ry * (1 - KAPPA), x + rx * (1 - KAPPA), y + h, x + rx, y + h);
    lineTo(x + w - rx, y + h);
    bezierCurveTo(x + w - rx * (1 - KAPPA), y + h, x + w, y + h - ry * (1 - KAPPA), x + w, y + h - ry);
    lineTo(x + w, y + ry);
    bezierCurveTo(x + w, y + ry * (1 - KAPPA), x + w - rx * (1 - KAPPA), y, x + w - rx, y);
    lineTo(x + rx, y);
    bezierCurveTo(x + rx * (1 - KAPPA), y, x, y + ry * (1 - KAPPA), x, y + ry);
    close();
    _paths.back().complex = false;
}
void GraphicsGeometry::arc(double x, double y, double r, double start, double end, bool ccw) {
    double da = end - start;
    if (!std::isfinite(da)) return;
    if (ccw) {
        if (std::abs(da) >= 2 * PI)
            da = 2 * PI;
        else
            while (da < 0) da += 2 * PI;
    } else {
        if (std::abs(da) >= 2 * PI)
            da = -2 * PI;
        else
            while (da > 0) da -= 2 * PI;
    }
    const int n = static_cast<int>(std::max(1.0, std::min(std::abs(da) / (PI * .5) + .5, 5.0)));
    const double half = da / n / 2, kappa = (ccw ? 1 : -1) * std::abs(4.0 / 3 * (1 - std::cos(half)) / std::sin(half));
    double px = 0, py = 0, tx = 0, ty = 0;
    for (int i = 0; i <= n; ++i) {
        const double a = start + da * (static_cast<double>(i) / n), dx = std::cos(a), dy = std::sin(a);
        const double qx = x + dx * r, qy = y + dy * r, ux = -dy * r * kappa, uy = dx * r * kappa;
        if (i == 0)
            moveTo(qx, qy);
        else
            bezierCurveTo(px + tx, py + ty, qx - ux, qy - uy, qx, qy);
        px = qx;
        py = qy;
        tx = ux;
        ty = uy;
    }
}
void GraphicsGeometry::vertex(double x, double y, double distance) {
    _vertices.push_back({static_cast<float>(x), static_cast<float>(y), 0, _color[0], _color[1], _color[2], _color[3], static_cast<float>(distance)});
}
void GraphicsGeometry::fill() {
    _color = fillColor;
    for (size_t i = _pathOffset; i < _paths.size(); ++i) {
        const auto &p = _paths[i];
        const auto offset = static_cast<uint32_t>(_vertices.size());
        for (const auto &v : p.points) vertex(v.x, v.y);
        if (p.complex) {
            auto indices = graphicsEarcut(_vertices, offset);
            _indices.insert(_indices.end(), indices.begin(), indices.end());
        } else
            for (uint32_t j = offset + 2; j < _vertices.size(); ++j) _indices.insert(_indices.end(), {offset, j - 1, j});
    }
    _updatePathOffset = true;
}

void GraphicsGeometry::flattenAndCalculateJoins() {
    const double iw = lineWidth > 0 ? 2 / lineWidth : 0;
    for (size_t k = _pathOffset; k < _paths.size(); ++k) {
        auto &path = _paths[k];
        auto &pts = path.points;
        if (pts.empty()) continue;
        const auto same = [](double a, double b) { return std::abs(a - b) <= .000001 * std::max({1.0, std::abs(a), std::abs(b)}); };
        if (pts.size() > 2 && same(pts.front().x, pts.back().x) && same(pts.front().y, pts.back().y)) {
            path.closed = true;
            pts.pop_back();
        }
        for (size_t j = 0; j < pts.size(); ++j) {
            auto &p0 = pts[(j + pts.size() - 1) % pts.size()];
            const auto &p1 = pts[j];
            p0.dx = p1.x - p0.x;
            p0.dy = p1.y - p0.y;
            p0.len = std::sqrt(p0.dx * p0.dx + p0.dy * p0.dy);
            if (p0.dx || p0.dy) {
                p0.dx /= p0.len;
                p0.dy /= p0.len;
            }
        }
        for (size_t j = 0; j < pts.size(); ++j) {
            const auto &p0 = pts[(j + pts.size() - 1) % pts.size()];
            auto &p1 = pts[j];
            p1.dmx = (p0.dy + p1.dy) * .5;
            p1.dmy = (-p0.dx - p1.dx) * .5;
            const double dmr2 = p1.dmx * p1.dmx + p1.dmy * p1.dmy;
            if (dmr2 > .000001) {
                const double scale = std::min(1 / dmr2, 600.0);
                p1.dmx *= scale;
                p1.dmy *= scale;
            }
            if (p1.dx * p0.dy - p0.dx * p1.dy > 0) p1.flags |= LEFT;
            const double limit = std::max(11.0, std::min(p0.len, p1.len) * iw);
            if (dmr2 * limit * limit < 1) p1.flags |= INNER;
            if ((p1.flags & CORNER) && (dmr2 * miterLimit * miterLimit < 1 || lineJoin == LineJoin::BEVEL || lineJoin == LineJoin::ROUND)) p1.flags |= BEVEL;
        }
    }
}
std::array<double, 4> GraphicsGeometry::chooseBevel(int bevel, const Point &p0, const Point &p1, double w) const {
    if (bevel) return {p1.x + p0.dy * w, p1.y - p0.dx * w, p1.x + p1.dy * w, p1.y - p1.dx * w};
    return {p1.x + p1.dmx * w, p1.y + p1.dmy * w, p1.x + p1.dmx * w, p1.y + p1.dmy * w};
}
void GraphicsGeometry::cap(const Point &p, double dx, double dy, double w, int n, bool start) {
    auto butt = [&](double d) { vertex(p.x+dx*d+dy*w,p.y+dy*d-dx*w,1);vertex(p.x+dx*d-dy*w,p.y+dy*d+dx*w,-1); };
    if (lineCap != LineCap::ROUND) {
        butt(lineCap == LineCap::SQUARE ? (start ? -w : w) : 0);
        return;
    }
    if (!start) butt(0);
    for (int i = 0; i < n; ++i) {
        const double a = static_cast<double>(i) / (n - 1) * PI, ax = std::cos(a) * w, ay = std::sin(a) * w;
        if (start) {
            vertex(p.x - dy * ax - dx * ay, p.y + dx * ax - dy * ay, 1);
            vertex(p.x, p.y, 0);
        } else {
            vertex(p.x, p.y, 0);
            vertex(p.x - dy * ax + dx * ay, p.y + dx * ax + dy * ay, 1);
        }
    }
    if (start) butt(0);
}
void GraphicsGeometry::roundJoin(const Point &p0, const Point &p1, double w, int nCap) {
    const double dx0 = p0.dy, dy0 = -p0.dx, dx1 = p1.dy, dy1 = -p1.dx;
    if (p1.flags & LEFT) {
        const auto b = chooseBevel(p1.flags & INNER, p0, p1, w);
        const double a0 = std::atan2(-dy0, -dx0);
        double a1 = std::atan2(-dy1, -dx1);
        if (a1 > a0) a1 -= 2 * PI;
        vertex(b[0], b[1], 1);
        vertex(p1.x - dx0 * w, p1.y - dy0 * w, -1);
        const int n = std::clamp(static_cast<int>(std::ceil((a0 - a1) / PI)) * nCap, 2, nCap);
        for (int i = 0; i < n; ++i) {
            const double a = a0 + static_cast<double>(i) / (n - 1) * (a1 - a0);
            vertex(p1.x, p1.y, 0);
            vertex(p1.x + std::cos(a) * w, p1.y + std::sin(a) * w, -1);
        }
        vertex(b[2], b[3], 1);
        vertex(p1.x - dx1 * w, p1.y - dy1 * w, -1);
    } else {
        const auto b = chooseBevel(p1.flags & INNER, p0, p1, -w);
        const double a0 = std::atan2(dy0, dx0);
        double a1 = std::atan2(dy1, dx1);
        if (a1 < a0) a1 += 2 * PI;
        vertex(p1.x + dx0 * w, p1.y + dy0 * w, 1);
        vertex(b[0], b[1], -1);
        const int n = std::clamp(static_cast<int>(std::ceil((a1 - a0) / PI)) * nCap, 2, nCap);
        for (int i = 0; i < n; ++i) {
            const double a = a0 + static_cast<double>(i) / (n - 1) * (a1 - a0);
            vertex(p1.x + std::cos(a) * w, p1.y + std::sin(a) * w, 1);
            vertex(p1.x, p1.y, 0);
        }
        vertex(p1.x + dx1 * w, p1.y + dy1 * w, 1);
        vertex(b[2], b[3], -1);
    }
}
void GraphicsGeometry::bevelJoin(const Point &p0, const Point &p1, double w) {
    const bool left = (p1.flags & LEFT) != 0;
    const auto b = chooseBevel(p1.flags & INNER, p0, p1, left ? w : -w);
    if (left) {
        vertex(b[0], b[1], 1);
        vertex(p1.x - p0.dy * w, p1.y + p0.dx * w, -1);
        vertex(b[2], b[3], 1);
        vertex(p1.x - p1.dy * w, p1.y + p1.dx * w, -1);
    } else {
        vertex(p1.x + p0.dy * w, p1.y - p0.dx * w, 1);
        vertex(b[0], b[1], -1);
        vertex(p1.x + p1.dy * w, p1.y - p1.dx * w, 1);
        vertex(b[2], b[3], -1);
    }
}
void GraphicsGeometry::stroke() {
    _color = strokeColor;
    flattenAndCalculateJoins();
    const double w = lineWidth * .5;
    if (!std::isfinite(w) || w < 0) return;
    const double da = std::acos(w / (w + tessTol)) * 2;
    const int n = std::isfinite(da) && da > 0 ? std::max(2, static_cast<int>(std::ceil(PI / da))) : 2;
    for (size_t k = _pathOffset; k < _paths.size(); ++k) {
        const auto &path = _paths[k];
        const auto &pts = path.points;
        if (pts.size() < 2) continue;
        const auto offset = static_cast<uint32_t>(_vertices.size());
        if (!path.closed) cap(pts[0], pts[0].dx, pts[0].dy, w, n, true);
        for (size_t j = path.closed ? 0 : 1; j < (path.closed ? pts.size() : pts.size() - 1); ++j) {
            const auto &p0 = pts[(j + pts.size() - 1) % pts.size()], &p1 = pts[j];
            if (lineJoin == LineJoin::ROUND)
                roundJoin(p0, p1, w, n);
            else if (p1.flags & (BEVEL | INNER))
                bevelJoin(p0, p1, w);
            else {
                vertex(p1.x + p1.dmx * w, p1.y + p1.dmy * w, 1);
                vertex(p1.x - p1.dmx * w, p1.y - p1.dmy * w, -1);
            }
        }
        if (path.closed) {
            const auto a = _vertices[offset], b = _vertices[offset + 1];
            vertex(a[0], a[1], 1);
            vertex(b[0], b[1], -1);
        } else
            cap(pts.back(), pts[pts.size() - 2].dx, pts[pts.size() - 2].dy, w, n, false);
        for (uint32_t j = offset + 2; j < _vertices.size(); ++j) _indices.insert(_indices.end(), {j - 2, j - 1, j});
    }
    _updatePathOffset = true;
}
} // namespace cc
