// Included only by the generated DirectWrite stroke comparison executable.
#pragma once
#include <d2d1.h>
#include <cstdlib>
#include <fstream>
#include <iomanip>
#include <limits>
#include <string>
#include <vector>

namespace stroke_replay {
class PathWriter final : public ID2D1SimplifiedGeometrySink {
public:
    explicit PathWriter(std::ostream &out) : _out(out) {}
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID id, void **ptr) override {
        if (!ptr) return E_POINTER;
        *ptr = nullptr;
        if (id != __uuidof(IUnknown) && id != __uuidof(ID2D1SimplifiedGeometrySink)) return E_NOINTERFACE;
        *ptr = static_cast<ID2D1SimplifiedGeometrySink *>(this);
        AddRef();
        return S_OK;
    }
    // Simplify borrows this stack object for a single synchronous call.
    ULONG STDMETHODCALLTYPE AddRef() override { return ++_refs; }
    ULONG STDMETHODCALLTYPE Release() override { return --_refs; }
    void STDMETHODCALLTYPE SetFillMode(D2D1_FILL_MODE mode) override { _out << "F " << mode << '\n'; }
    void STDMETHODCALLTYPE SetSegmentFlags(D2D1_PATH_SEGMENT) override {}
    void STDMETHODCALLTYPE BeginFigure(D2D1_POINT_2F p, D2D1_FIGURE_BEGIN) override { point('M', p); }
    void STDMETHODCALLTYPE EndFigure(D2D1_FIGURE_END end) override { _out << "E " << end << '\n'; }
    void STDMETHODCALLTYPE AddLines(const D2D1_POINT_2F *points, UINT count) override {
        for (UINT i = 0; i < count; ++i) point('L', points[i]);
    }
    void STDMETHODCALLTYPE AddBeziers(const D2D1_BEZIER_SEGMENT *curves, UINT count) override {
        for (UINT i = 0; i < count; ++i) {
            const auto &c = curves[i];
            _out << "C " << c.point1.x << ' ' << c.point1.y << ' ' << c.point2.x << ' ' << c.point2.y
                 << ' ' << c.point3.x << ' ' << c.point3.y << '\n';
        }
    }
    HRESULT STDMETHODCALLTYPE Close() override { return _out ? S_OK : E_FAIL; }
private:
    void point(char op, D2D1_POINT_2F p) { _out << op << ' ' << p.x << ' ' << p.y << '\n'; }
    std::ostream &_out;
    ULONG _refs{1};
};

inline HRESULT capture(const std::string &name, ID2D1Geometry *geometry, const D2D1_MATRIX_3X2_F &transform,
                       D2D1_GEOMETRY_SIMPLIFICATION_OPTION option, float pen, UINT width, UINT height) {
    std::ofstream out(name);
    out << std::setprecision(std::numeric_limits<float>::max_digits10);
    out << "S " << width << ' ' << height << '\n';
    if (pen > 0) out << "T " << transform._11 << ' ' << transform._12 << ' ' << transform._21 << ' '
                     << transform._22 << ' ' << transform._31 << ' ' << transform._32 << ' ' << pen << '\n';
    PathWriter writer(out);
    const auto hr = geometry->Simplify(option, pen > 0 ? nullptr : &transform, .01F, &writer);
    out.close();
    return FAILED(hr) ? hr : out ? S_OK : E_FAIL;
}

inline HRESULT replaceAlpha(const std::string &name, std::vector<uint8_t> &rgba) {
    std::ifstream input(name, std::ios::binary);
    for (size_t i = 3; i < rgba.size(); i += 4) {
        char value;
        if (!input.get(value)) return E_FAIL;
        rgba[i] = static_cast<uint8_t>(value);
    }
    return input.peek() == EOF && !input.bad() ? S_OK : E_FAIL;
}
} // namespace stroke_replay
