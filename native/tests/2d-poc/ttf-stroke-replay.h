// Included only by the generated DirectWrite stroke comparison executable.
#pragma once
#include <d2d1.h>
#include <wrl/client.h>
#include <cstdlib>
#include <fstream>
#include <iomanip>
#include <limits>
#include <string>
#include <vector>

namespace stroke_replay {
inline float tolerance(const char *name) {
    const char *value = std::getenv(name);
    return value ? std::stof(value) : .01F;
}
inline HRESULT widen(ID2D1Factory *factory, ID2D1Geometry *path, float width, ID2D1StrokeStyle *style, ID2D1GeometrySink *sink) {
    const float accuracy = tolerance("CC2D_WIDEN_TOLERANCE");
    const char *setting = std::getenv("CC2D_PEN_SCALE");
    const float scale = setting ? std::stof(setting) : 1.F;
    if (scale == 1.F) return path->Widen(width, style, nullptr, accuracy, sink);
    if (!(scale > 0.F)) return E_INVALIDARG;
    Microsoft::WRL::ComPtr<ID2D1TransformedGeometry> enlarged;
    Microsoft::WRL::ComPtr<ID2D1PathGeometry> pen;
    Microsoft::WRL::ComPtr<ID2D1GeometrySink> writer;
    HRESULT hr = factory->CreateTransformedGeometry(path, D2D1::Matrix3x2F::Scale(scale, scale), enlarged.GetAddressOf());
    if (SUCCEEDED(hr)) hr = factory->CreatePathGeometry(pen.GetAddressOf());
    if (SUCCEEDED(hr)) hr = pen->Open(writer.GetAddressOf());
    if (SUCCEEDED(hr)) hr = enlarged->Widen(width * scale, style, nullptr, accuracy * scale, writer.Get());
    if (SUCCEEDED(hr)) hr = writer->Close();
    if (FAILED(hr)) return hr;
    const auto restore = D2D1::Matrix3x2F::Scale(1.F / scale, 1.F / scale);
    return pen->Simplify(D2D1_GEOMETRY_SIMPLIFICATION_OPTION_CUBICS_AND_LINES, &restore, accuracy, sink);
}
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

inline HRESULT readStroke(const std::string &name, ID2D1GeometrySink *sink) {
    std::ifstream input(name);
    auto readPoint = [&](D2D1_POINT_2F &point) -> bool { return static_cast<bool>(input >> point.x >> point.y); };
    char command;
    bool open = false;
    while (input >> command) {
        D2D1_POINT_2F point{};
        switch (command) {
        case 'F': {
            unsigned winding;
            if (open || !(input >> winding) || winding > 1) return E_FAIL;
            sink->SetFillMode(winding ? D2D1_FILL_MODE_WINDING : D2D1_FILL_MODE_ALTERNATE);
            break;
        }
        case 'M':
            if (open || !readPoint(point)) return E_FAIL;
            sink->BeginFigure(point, D2D1_FIGURE_BEGIN_FILLED);
            open = true;
            break;
        case 'E':
            if (!open) return E_FAIL;
            sink->EndFigure(D2D1_FIGURE_END_CLOSED);
            open = false;
            break;
        case 'L':
            if (!open || !readPoint(point)) return E_FAIL;
            sink->AddLine(point);
            break;
        case 'Q': {
            D2D1_QUADRATIC_BEZIER_SEGMENT curve{};
            if (!open || !readPoint(curve.point1) || !readPoint(curve.point2)) return E_FAIL;
            sink->AddQuadraticBezier(curve);
            break;
        }
        case 'C': {
            D2D1_BEZIER_SEGMENT curve{};
            if (!open || !readPoint(curve.point1) || !readPoint(curve.point2) || !readPoint(curve.point3)) return E_FAIL;
            sink->AddBezier(curve);
            break;
        }
        case 'A': {
            float radius;
            unsigned clockwise;
            if (!open || !readPoint(point) || !(input >> radius >> clockwise) || !(radius > 0) || clockwise > 1) return E_FAIL;
            const auto sweep = clockwise ? D2D1_SWEEP_DIRECTION_CLOCKWISE : D2D1_SWEEP_DIRECTION_COUNTER_CLOCKWISE;
            sink->AddArc(D2D1::ArcSegment(point, D2D1::SizeF(radius, radius), 0, sweep, D2D1_ARC_SIZE_SMALL));
            break;
        }
        default: return E_FAIL;
        }
    }
    return input.eof() && !open ? S_OK : E_FAIL;
}

inline HRESULT writeAlpha(const std::string &name, const std::vector<uint8_t> &rgba) {
    std::ofstream output(name, std::ios::binary);
    for (size_t i = 3; i < rgba.size(); i += 4) output.put(static_cast<char>(rgba[i]));
    output.close();
    return output ? S_OK : E_FAIL;
}
} // namespace stroke_replay
