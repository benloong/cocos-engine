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
#include "2d/geometry/GraphicsEarcut.h"
#include <algorithm>
#include <deque>

namespace cc {
namespace {
// Port of cocos/2d/assembler/graphics/webgl/earcut.ts's single-ring path,
// including duplicate/collinear filtering, local cures and diagonal splits.
// Node addresses remain stable while splitting rings; all are freed together.
struct Node {
    uint32_t i;
    double x, y;
    Node *prev{nullptr}, *next{nullptr};
    Node *prevZ{nullptr}, *nextZ{nullptr};
    uint32_t z{0};
};
class Earcut {
    std::deque<Node> _nodes;
    std::vector<uint32_t> _triangles;
    double _minX{0}, _minY{0}, _size{0};
    static double area(Node *p, Node *q, Node *r) { return (q->y - p->y) * (r->x - q->x) - (q->x - p->x) * (r->y - q->y); }
    static bool equal(Node *a, Node *b) { return a->x == b->x && a->y == b->y; }
    static void remove(Node *p) {
        p->next->prev = p->prev;
        p->prev->next = p->next;
        if (p->prevZ) p->prevZ->nextZ = p->nextZ;
        if (p->nextZ) p->nextZ->prevZ = p->prevZ;
    }
    uint32_t zOrder(double x, double y) const {
        auto ix = static_cast<uint32_t>(32767 * (x - _minX) / _size), iy = static_cast<uint32_t>(32767 * (y - _minY) / _size);
        auto interleave = [](uint32_t n) {
            n = (n | (n << 8)) & 0x00FF00FF;
            n = (n | (n << 4)) & 0x0F0F0F0F;
            n = (n | (n << 2)) & 0x33333333;
            return (n | (n << 1)) & 0x55555555;
        };
        return interleave(ix) | (interleave(iy) << 1);
    }
    void indexCurve(Node *start) {
        std::vector<Node *> order;
        auto *p = start;
        do {
            p->z = zOrder(p->x, p->y);
            order.push_back(p);
            p = p->next;
        } while (p != start);
        std::stable_sort(order.begin(), order.end(), [](Node *a, Node *b) { return a->z < b->z; });
        for (size_t i = 0; i < order.size(); ++i) {
            order[i]->prevZ = i ? order[i - 1] : nullptr;
            order[i]->nextZ = i + 1 < order.size() ? order[i + 1] : nullptr;
        }
    }
    Node *make(uint32_t i, double x, double y) {
        _nodes.push_back({i, x, y});
        return &_nodes.back();
    }
    static bool insideTriangle(Node *a, Node *b, Node *c, Node *p) {
        return (c->x - p->x) * (a->y - p->y) - (a->x - p->x) * (c->y - p->y) >= 0 &&
               (a->x - p->x) * (b->y - p->y) - (b->x - p->x) * (a->y - p->y) >= 0 &&
               (b->x - p->x) * (c->y - p->y) - (c->x - p->x) * (b->y - p->y) >= 0;
    }
    static Node *filter(Node *start, Node *end = nullptr) {
        if (!start) return start;
        if (!end) end = start;
        auto *p = start;
        bool again;
        do {
            again = false;
            if (equal(p, p->next) || area(p->prev, p, p->next) == 0) {
                remove(p);
                p = end = p->prev;
                if (p == p->next) return nullptr;
                again = true;
            } else
                p = p->next;
        } while (again || p != end);
        return end;
    }
    static bool ear(Node *p) {
        auto *a = p->prev, *b = p, *c = p->next;
        if (area(a, b, c) >= 0) return false;
        for (auto *q = c->next; q != a; q = q->next)
            if (insideTriangle(a, b, c, q) && area(q->prev, q, q->next) >= 0) return false;
        return true;
    }
    bool earHashed(Node *p) const {
        auto *a = p->prev, *c = p->next;
        if (area(a, p, c) >= 0) return false;
        const auto minZ = zOrder(std::min({a->x, p->x, c->x}), std::min({a->y, p->y, c->y}));
        const auto maxZ = zOrder(std::max({a->x, p->x, c->x}), std::max({a->y, p->y, c->y}));
        for (auto *q = p->nextZ; q && q->z <= maxZ; q = q->nextZ)
            if (q != a && q != c && insideTriangle(a, p, c, q) && area(q->prev, q, q->next) >= 0) return false;
        for (auto *q = p->prevZ; q && q->z >= minZ; q = q->prevZ)
            if (q != a && q != c && insideTriangle(a, p, c, q) && area(q->prev, q, q->next) >= 0) return false;
        return true;
    }
    static bool intersects(Node *p1, Node *q1, Node *p2, Node *q2) {
        if ((equal(p1, q1) && equal(p2, q2)) || (equal(p1, q2) && equal(p2, q1))) return true;
        return ((area(p1, q1, p2) > 0) != (area(p1, q1, q2) > 0)) && ((area(p2, q2, p1) > 0) != (area(p2, q2, q1) > 0));
    }
    static bool locallyInside(Node *a, Node *b) {
        return area(a->prev, a, a->next) < 0 ? area(a, b, a->next) >= 0 && area(a, a->prev, b) >= 0 : area(a, b, a->prev) < 0 || area(a, a->next, b) < 0;
    }
    static bool diagonal(Node *a, Node *b) {
        if (a->next->i == b->i || a->prev->i == b->i) return false;
        auto *p = a;
        do {
            if (p->i != a->i && p->next->i != a->i && p->i != b->i && p->next->i != b->i && intersects(p, p->next, a, b)) return false;
            p = p->next;
        } while (p != a);
        if (!locallyInside(a, b) || !locallyInside(b, a)) return false;
        const double x = (a->x + b->x) * .5, y = (a->y + b->y) * .5;
        bool inside = false;
        do {
            if ((p->y > y) != (p->next->y > y) && x < (p->next->x - p->x) * (y - p->y) / (p->next->y - p->y) + p->x) inside = !inside;
            p = p->next;
        } while (p != a);
        return inside;
    }
    Node *split(Node *a, Node *b) {
        auto *a2 = make(a->i, a->x, a->y), *b2 = make(b->i, b->x, b->y), *an = a->next, *bp = b->prev;
        a->next = b;
        b->prev = a;
        a2->next = an;
        an->prev = a2;
        b2->next = a2;
        a2->prev = b2;
        bp->next = b2;
        b2->prev = bp;
        return b2;
    }
    Node *cure(Node *start) {
        auto *p = start;
        do {
            auto *a = p->prev, *b = p->next->next;
            if (!equal(a, b) && intersects(a, p, p->next, b) && locallyInside(a, b) && locallyInside(b, a)) {
                _triangles.insert(_triangles.end(), {a->i, p->i, b->i});
                remove(p);
                remove(p->next);
                p = start = b;
            }
            p = p->next;
        } while (p != start);
        return p;
    }
    void slice(Node *p, int pass = 0) {
        if (!p) return;
        if (!pass && _size) indexCurve(p);
        auto *stop = p;
        while (p->prev != p->next) {
            auto *prev = p->prev, *next = p->next;
            if (_size ? earHashed(p) : ear(p)) {
                _triangles.insert(_triangles.end(), {prev->i, p->i, next->i});
                remove(p);
                p = stop = next->next;
                continue;
            }
            p = next;
            if (p == stop) {
                if (pass == 0)
                    slice(filter(p), 1);
                else if (pass == 1)
                    slice(cure(p), 2);
                else {
                    auto *a = p;
                    do {
                        for (auto *b = a->next->next; b != a->prev; b = b->next)
                            if (a->i != b->i && diagonal(a, b)) {
                                auto *c = split(a, b);
                                a = filter(a, a->next);
                                c = filter(c, c->next);
                                slice(a);
                                slice(c);
                                return;
                            }
                        a = a->next;
                    } while (a != p);
                }
                break;
            }
        }
    }

public:
    std::vector<uint32_t> run(const std::vector<GraphicsGeometry::Vertex> &v, uint32_t first) {
        if (first >= v.size() || v.size() - first < 3) return {};
        if (v.size() - first > 80) {
            _minX = v[first][0];
            _minY = v[first][1];
            double maxX = _minX, maxY = _minY;
            for (size_t i = first + 1; i < v.size(); ++i) {
                _minX = std::min(_minX, static_cast<double>(v[i][0]));
                _minY = std::min(_minY, static_cast<double>(v[i][1]));
                maxX = std::max(maxX, static_cast<double>(v[i][0]));
                maxY = std::max(maxY, static_cast<double>(v[i][1]));
            }
            _size = std::max(maxX - _minX, maxY - _minY);
        }
        double sum = 0;
        for (size_t i = first, j = v.size() - 1; i < v.size(); j = i++) sum += (static_cast<double>(v[j][0]) - v[i][0]) * (static_cast<double>(v[i][1]) + v[j][1]);
        Node *last = nullptr;
        auto insert = [&](uint32_t i) {
            auto *p = make(i, v[i][0], v[i][1]);
            if (!last)
                p->prev = p->next = p;
            else {
                p->next = last->next;
                p->prev = last;
                last->next->prev = p;
                last->next = p;
            }
            last = p;
        };
        if (sum > 0)
            for (uint32_t i = first; i < v.size(); ++i) insert(i);
        else
            for (size_t i = v.size(); i-- > first;) insert(static_cast<uint32_t>(i));
        if (last && equal(last, last->next)) {
            remove(last);
            last = last->next;
        }
        slice(last);
        return std::move(_triangles);
    }
};
} // namespace
std::vector<uint32_t> graphicsEarcut(const std::vector<GraphicsGeometry::Vertex> &v, uint32_t first) { return Earcut().run(v, first); }
} // namespace cc
