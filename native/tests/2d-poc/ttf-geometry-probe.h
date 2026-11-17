// Isolated diagnostic only; COM owners and coverage tables come from the generated host.
#include <d2d1.h>
#include <wincodec.h>

HRESULT geometryProbe(const DWRITE_GLYPH_RUN *run, float x, float y, bool italic,
                      uint32_t width, uint32_t height, std::vector<uint8_t> &rgba) {
    if (!width || !height || width > UINT_MAX / 16 || height > UINT_MAX / (width * 16)) return E_INVALIDARG;
    const auto initialized = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    struct Apartment { bool owns; ~Apartment() { if (owns) CoUninitialize(); } } apartment{SUCCEEDED(initialized)};
    if (FAILED(initialized) && initialized != RPC_E_CHANGED_MODE) return initialized;
    ComOwner<ID2D1Factory> factory;
    HRESULT hr = D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED, factory.out());
    if (FAILED(hr)) return hr;
    ComOwner<ID2D1PathGeometry> path, expanded, united;
    ComOwner<ID2D1GeometrySink> sink;
    hr = factory->CreatePathGeometry(path.out());
    if (SUCCEEDED(hr)) hr = path->Open(sink.out());
    if (SUCCEEDED(hr)) hr = run->fontFace->GetGlyphRunOutline(run->fontEmSize, run->glyphIndices,
        run->glyphAdvances, run->glyphOffsets, run->glyphCount, run->isSideways, run->bidiLevel & 1, sink.get());
    if (SUCCEEDED(hr)) hr = sink->Close();
    sink.reset();
    if (FAILED(hr)) return hr;
    const float t = std::clamp((run->fontEmSize - 9.F) / 27.F, 0.F, 1.F);
    const float boldWidth = run->fontEmSize * ((1.F - t) / 24.F + t / 32.F);
    hr = factory->CreatePathGeometry(expanded.out());
    if (SUCCEEDED(hr)) hr = expanded->Open(sink.out());
    ComOwner<ID2D1StrokeStyle> stroke;
    auto properties = D2D1::StrokeStyleProperties(); properties.miterLimit = 4;
    if (SUCCEEDED(hr)) hr = factory->CreateStrokeStyle(properties, nullptr, 0, stroke.out());
    if (SUCCEEDED(hr)) hr = path->Widen(boldWidth, stroke.get(), nullptr, .01F, sink.get());
    if (SUCCEEDED(hr)) hr = sink->Close();
    sink.reset();
    if (FAILED(hr)) return hr;
    hr = factory->CreatePathGeometry(united.out());
    if (SUCCEEDED(hr)) hr = united->Open(sink.out());
    if (SUCCEEDED(hr)) hr = path->CombineWithGeometry(expanded.get(), D2D1_COMBINE_MODE_UNION, nullptr, .01F, sink.get());
    if (SUCCEEDED(hr)) hr = sink->Close();
    sink.reset();
    if (FAILED(hr)) return hr;
    constexpr uint32_t scale = CC2D_TTF_GEOMETRY_FILTERED ? 4U : 1U;
    ComOwner<IWICImagingFactory> wic;
    hr = CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(wic.out()));
    ComOwner<IWICBitmap> bitmap;
    if (SUCCEEDED(hr)) hr = wic->CreateBitmap(width * scale, height, GUID_WICPixelFormat32bppPBGRA, WICBitmapCacheOnLoad, bitmap.out());
    ComOwner<ID2D1RenderTarget> target;
    const auto props = D2D1::RenderTargetProperties(D2D1_RENDER_TARGET_TYPE_SOFTWARE,
        D2D1::PixelFormat(DXGI_FORMAT_B8G8R8A8_UNORM, D2D1_ALPHA_MODE_PREMULTIPLIED));
    if (SUCCEEDED(hr)) hr = factory->CreateWicBitmapRenderTarget(bitmap.get(), props, target.out());
    if (FAILED(hr)) return hr;
    ComOwner<ID2D1SolidColorBrush> brush;
    hr = target->CreateSolidColorBrush(D2D1::ColorF(1, 1, 1, 1), brush.out());
    if (FAILED(hr)) return hr;
    target->BeginDraw(); target->Clear(D2D1::ColorF(0, 0, 0, 0));
    target->SetTransform(D2D1::Matrix3x2F(static_cast<float>(scale), 0, italic ? -.25F * scale : 0, 1, x * scale, y));
    target->FillGeometry(united.get(), brush.get());
    hr = target->EndDraw();
    if (FAILED(hr)) return hr;
    if constexpr (scale == 1) {
        rgba.resize(static_cast<size_t>(width) * height * 4);
        return bitmap->CopyPixels(nullptr, width * 4, static_cast<UINT>(rgba.size()), rgba.data());
    }
    std::vector<uint8_t> high(static_cast<size_t>(width) * 4 * height * 4);
    hr = bitmap->CopyPixels(nullptr, width * 16, static_cast<UINT>(high.size()), high.data());
    if (FAILED(hr)) return hr;
    // Numerical FIR coefficients from Skia's pack4xHToMask, not fitted to
    // these captures: https://github.com/google/skia/blob/main/src/core/SkScalerContext.cpp
    const unsigned coefficients[3][12] = {
        {3, 11, 28, 51, 64, 57, 36, 16, 5, 1, 0, 0},
        {0, 2, 8, 22, 43, 61, 61, 43, 22, 8, 2, 0},
        {0, 0, 1, 5, 16, 36, 57, 64, 51, 28, 11, 3},
    };
    rgba.resize(static_cast<size_t>(width) * height * 4);
    for (uint32_t row = 0; row < height; ++row) for (uint32_t column = 0; column < width; ++column) {
        unsigned channels[3] = {};
        for (int tap = 0; tap < 12; ++tap) {
            const int sample = static_cast<int>(column * 4) + tap - 4;
            if (sample < 0 || sample >= static_cast<int>(width * 4)) continue;
            const auto coverage = high[(static_cast<size_t>(row) * width * 4 + sample) * 4 + 3];
            for (int channel = 0; channel < 3; ++channel) channels[channel] += coefficients[channel][tap] * coverage;
        }
        unsigned sum = 0;
        for (int channel = 0; channel < 3; ++channel) sum += std::min(channels[channel] / 256, 255U);
        rgba[(static_cast<size_t>(row) * width + column) * 4 + 3] = static_cast<uint8_t>(sum / 3);
    }
    return S_OK;
}
