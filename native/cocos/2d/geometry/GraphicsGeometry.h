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
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <vector>

namespace cc {

// The Web Graphics vertex layout: position.xyz, color.rgba, stroke distance.
// Paths use double precision, then vertices round to float at emission, just
// as the Web implementation writes into MeshRenderData's Float32Array.
class GraphicsGeometry {
public:
    using Vertex = std::array<float, 8>;
    enum class LineCap {
        BUTT,
        ROUND,
        SQUARE
    };
    enum class LineJoin {
        BEVEL,
        ROUND,
        MITER
    };
    double lineWidth{1.0};
    double miterLimit{10.0};
    double tessTol{0.25};
    LineCap lineCap{LineCap::BUTT};
    LineJoin lineJoin{LineJoin::MITER};
    std::array<float, 4> fillColor{1, 1, 1, 1};
    std::array<float, 4> strokeColor{0, 0, 0, 1};

    void clear();
    void moveTo(double x, double y);
    void lineTo(double x, double y);
    void close();
    void rect(double x, double y, double w, double h);
    void circle(double x, double y, double r) { ellipse(x, y, r, r); }
    void ellipse(double x, double y, double rx, double ry);
    void roundRect(double x, double y, double w, double h, double r);
    void arc(double x, double y, double r, double start, double end, bool counterclockwise);
    void bezierCurveTo(double c1x, double c1y, double c2x, double c2y, double x, double y);
    void quadraticCurveTo(double cx, double cy, double x, double y);
    void fill();
    void stroke();
    const std::vector<Vertex> &getVertices() const { return _vertices; }
    const std::vector<uint32_t> &getIndices() const { return _indices; }

private:
    struct Point {
        double x, y;
        double dx{0}, dy{0}, dmx{0}, dmy{0}, len{0};
        int flags{1};
    };
    struct Path {
        std::vector<Point> points;
        bool closed{false}, complex{true};
    };
    void addPoint(double x, double y, int flags);
    void tessellate(double x1, double y1, double x2, double y2, double x3, double y3, double x4, double y4, int level, int flags);
    void vertex(double x, double y, double distance = 0);
    void flattenAndCalculateJoins();
    std::array<double, 4> chooseBevel(int bevel, const Point &p0, const Point &p1, double w) const;
    void cap(const Point &p, double dx, double dy, double w, int n, bool start);
    void roundJoin(const Point &p0, const Point &p1, double w, int n);
    void bevelJoin(const Point &p0, const Point &p1, double w);
    std::vector<Path> _paths;
    size_t _pathOffset{0};
    bool _updatePathOffset{false};
    double _commandX{0}, _commandY{0};
    std::array<float, 4> _color{1, 1, 1, 1};
    std::vector<Vertex> _vertices;
    std::vector<uint32_t> _indices;
};
} // namespace cc
