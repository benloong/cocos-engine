/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

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

#include "platform/win32/modules/DirectWriteFont.h"
#include <windows.h>
#include <dwrite.h>
#include <algorithm>
#include <atomic>
#include <cmath>
#include <limits>
#include <vector>

namespace cc {
namespace {
template<class T> class ComOwner {
public:
    ~ComOwner() { reset(); }
    ComOwner() = default;
    ComOwner(const ComOwner &) = delete;
    ComOwner &operator=(const ComOwner &) = delete;
    T *get() const { return _value; }
    T *operator->() const { return _value; }
    T **out() { reset(); return &_value; }
    void reset(T *value = nullptr) { if (_value) _value->Release(); _value = value; }
private:
    T *_value{nullptr}; // owns exactly one COM reference
};
std::wstring wide(const std::string &text) {
    if (text.size() > static_cast<size_t>(std::numeric_limits<int>::max())) return {};
    const int count = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, text.data(), static_cast<int>(text.size()), nullptr, 0);
    std::wstring result(count, 0);
    if (count) MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, text.data(), static_cast<int>(text.size()), result.data(), count);
    return result;
}
float linearSrgb(float value) {
    return value <= .04045F ? value / 12.92F : std::pow((value + .055F) / 1.055F, 2.4F);
}
float encodedSrgb(float value) {
    return value <= .0031308F ? value * 12.92F : 1.055F * std::pow(value, 1.F / 2.4F) - .055F;
}
uint32_t canonicalChannel(uint32_t value) {
    const auto bits = value >> 5U;
    return (bits << 5U) | (bits << 2U) | (bits >> 1U);
}
const std::array<uint8_t, 256> &coverageTable(const std::array<float, 4> &color) {
    // Windows Canvas uses an sRGB, contrast=1 mask preblend. The eight
    // immutable luminance tables are value-owned; no per-font shared owner.
    static const auto tables = [] {
        std::array<std::array<uint8_t, 256>, 8> result{};
        for (uint32_t index = 0; index < result.size(); ++index) {
            const float source = canonicalChannel(index << 5U) / 255.F;
            const float destination = 1.F - source;
            const float linearSource = linearSrgb(source), linearDestination = linearSrgb(destination);
            for (uint32_t mask = 0; mask < 256; ++mask) {
                const float coverage = mask / 255.F;
                const float enhanced = coverage + (1.F - coverage) * linearDestination * coverage;
                const float output = encodedSrgb(linearSource * enhanced + linearDestination * (1.F - enhanced));
                const float alpha = (output - destination) / (source - destination);
                result[index][mask] = static_cast<uint8_t>(std::clamp(std::lround(alpha * 255.F), 0L, 255L));
            }
        }
        return result;
    }();
    uint32_t rgb[3];
    for (size_t channel = 0; channel < 3; ++channel) rgb[channel] = canonicalChannel(static_cast<uint32_t>(std::clamp(std::lround(color[channel] * 255.F), 0L, 255L)));
    const auto luminance = (rgb[0] * 54U + rgb[1] * 183U + rgb[2] * 19U) >> 8U;
    return tables[luminance >> 5U];
}
class FileEnumerator final : public IDWriteFontFileEnumerator {
public:
    HRESULT init(IDWriteFactory *factory, const wchar_t *path) { return factory->CreateFontFileReference(path, nullptr, _file.out()); }
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID id, void **out) override {
        if (!out) return E_POINTER;
        *out = nullptr;
        if (id != __uuidof(IUnknown) && id != __uuidof(IDWriteFontFileEnumerator)) return E_NOINTERFACE;
        *out = static_cast<IDWriteFontFileEnumerator *>(this); AddRef(); return S_OK;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++_refs; }
    ULONG STDMETHODCALLTYPE Release() override { const auto value = --_refs; if (!value) delete this; return value; }
    HRESULT STDMETHODCALLTYPE MoveNext(BOOL *current) override { if (!current) return E_POINTER; _current = !_done; *current = _current; _done = true; return S_OK; }
    HRESULT STDMETHODCALLTYPE GetCurrentFontFile(IDWriteFontFile **file) override {
        if (!file) return E_POINTER;
        *file = nullptr;
        if (!_current || !_file.get()) return E_FAIL;
        *file = _file.get(); (*file)->AddRef(); return S_OK;
    }
private:
    std::atomic<ULONG> _refs{1};
    ComOwner<IDWriteFontFile> _file;
    bool _done{false};
    bool _current{false};
};
class CollectionLoader final : public IDWriteFontCollectionLoader {
public:
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID id, void **out) override {
        if (!out) return E_POINTER;
        *out = nullptr;
        if (id != __uuidof(IUnknown) && id != __uuidof(IDWriteFontCollectionLoader)) return E_NOINTERFACE;
        *out = static_cast<IDWriteFontCollectionLoader *>(this); AddRef(); return S_OK;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++_refs; }
    ULONG STDMETHODCALLTYPE Release() override { const auto value = --_refs; if (!value) delete this; return value; }
    HRESULT STDMETHODCALLTYPE CreateEnumeratorFromKey(IDWriteFactory *factory, const void *key, UINT32 size, IDWriteFontFileEnumerator **out) override {
        if (!out || !key || size < sizeof(wchar_t) || size % sizeof(wchar_t)) return E_INVALIDARG;
        *out = nullptr;
        // Copy the opaque key; no enumerator borrows the caller's path buffer.
        std::wstring path(static_cast<const wchar_t *>(key), size / sizeof(wchar_t));
        if (path.back() != 0) return E_INVALIDARG;
        auto *enumerator = new FileEnumerator();
        const HRESULT hr = enumerator->init(factory, path.c_str());
        if (FAILED(hr)) { enumerator->Release(); return hr; }
        *out = enumerator; return S_OK;
    }
private:
    std::atomic<ULONG> _refs{1};
};

class TextRenderer final : public IDWriteTextRenderer {
public:
    // These buffers/factory are synchronous borrows for IDWriteTextLayout::Draw.
    TextRenderer(IDWriteFactory *factory, uint8_t *pixels, uint32_t width, uint32_t height, const std::array<float, 4> &color, bool bold, bool italic)
    : _factory(factory), _pixels(pixels), _width(width), _height(height), _color(color), _bold(bold), _italic(italic) {}
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID id, void **out) override {
        if (!out) return E_POINTER;
        *out = nullptr;
        if (id != __uuidof(IUnknown) && id != __uuidof(IDWritePixelSnapping) && id != __uuidof(IDWriteTextRenderer)) return E_NOINTERFACE;
        *out = static_cast<IDWriteTextRenderer *>(this); AddRef(); return S_OK;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++_refs; }
    ULONG STDMETHODCALLTYPE Release() override { const auto value = --_refs; if (!value) delete this; return value; }
    HRESULT STDMETHODCALLTYPE IsPixelSnappingDisabled(void *, BOOL *disabled) override { *disabled = TRUE; return S_OK; }
    HRESULT STDMETHODCALLTYPE GetCurrentTransform(void *, DWRITE_MATRIX *matrix) override { *matrix = {1, 0, 0, 1, 0, 0}; return S_OK; }
    HRESULT STDMETHODCALLTYPE GetPixelsPerDip(void *, FLOAT *scale) override { *scale = 1; return S_OK; }
    HRESULT STDMETHODCALLTYPE DrawGlyphRun(void *, FLOAT x, FLOAT y, DWRITE_MEASURING_MODE mode, const DWRITE_GLYPH_RUN *run, const DWRITE_GLYPH_RUN_DESCRIPTION *, IUnknown *) override {
        // Canvas synthetic bold changes outlines, not the shaped advances.
        // DWrite's bold text-format simulation also widens advances, so shape
        // with the original face and substitute only the rasterization face.
        ComOwner<IDWriteFontFace> boldFace;
        DWRITE_GLYPH_RUN boldRun{};
        if (_bold) {
            UINT32 count = 0;
            HRESULT hr = run->fontFace->GetFiles(&count, nullptr);
            if (FAILED(hr)) return hr;
            std::vector<IDWriteFontFile *> files(count, nullptr); // owns GetFiles references until CreateFontFace returns
            hr = run->fontFace->GetFiles(&count, files.data());
            if (SUCCEEDED(hr)) hr = _factory->CreateFontFace(run->fontFace->GetType(), count, files.data(), run->fontFace->GetIndex(),
                static_cast<DWRITE_FONT_SIMULATIONS>(run->fontFace->GetSimulations() | DWRITE_FONT_SIMULATIONS_BOLD), boldFace.out());
            for (auto *file : files) if (file) file->Release();
            if (FAILED(hr)) return hr;
            boldRun = *run; boldRun.fontFace = boldFace.get(); run = &boldRun;
        }
        // Preserve the shaped advances and offsets. Quantize only raster
        // origins, as the horizontal Canvas glyph cache does. RTL/sideways
        // runs retain DWrite's full-run positioning until separately verified.
        if (run->bidiLevel & 1U || run->isSideways) return drawMask(x, y, mode, run);
        float origin = x;
        for (UINT32 index = 0; index < run->glyphCount; ++index) {
            DWRITE_GLYPH_RUN glyph = *run;
            glyph.glyphCount = 1;
            glyph.glyphIndices = run->glyphIndices + index;
            glyph.glyphAdvances = run->glyphAdvances + index;
            glyph.glyphOffsets = nullptr;
            const auto offset = run->glyphOffsets ? run->glyphOffsets[index] : DWRITE_GLYPH_OFFSET{};
            const auto hr = drawMask(std::floor((origin + offset.advanceOffset) * 4.F + .5F) / 4.F,
                                     std::floor(y - offset.ascenderOffset + .5F), mode, &glyph);
            if (FAILED(hr)) return hr;
            origin += run->glyphAdvances[index];
        }
        return S_OK;
    }
    HRESULT drawMask(float x, float y, DWRITE_MEASURING_MODE mode, const DWRITE_GLYPH_RUN *run) {
        ComOwner<IDWriteGlyphRunAnalysis> analysis;
        constexpr auto texture = DWRITE_TEXTURE_CLEARTYPE_3x1;
        // Canvas synthesizes italic by shearing the regular outline around
        // each glyph origin, preserving the regular shaped advances.
        const DWRITE_MATRIX transform{1, 0, -.25F, 1, x, y};
        HRESULT hr = _factory->CreateGlyphRunAnalysis(run, 1, _italic ? &transform : nullptr,
            DWRITE_RENDERING_MODE_NATURAL_SYMMETRIC, mode, _italic ? 0.F : x, _italic ? 0.F : y, analysis.out());
        if (FAILED(hr)) return hr;
        RECT bounds{};
        hr = analysis->GetAlphaTextureBounds(texture, &bounds);
        if (FAILED(hr) || bounds.right <= bounds.left || bounds.bottom <= bounds.top) return hr;
        // DirectWrite accepts a subset of the run's bounds. Allocate only the
        // destination clip, including when a long run is mostly off screen.
        bounds.left = std::max<LONG>(0, bounds.left);
        bounds.top = std::max<LONG>(0, bounds.top);
        bounds.right = std::min<LONG>(_width, bounds.right);
        bounds.bottom = std::min<LONG>(_height, bounds.bottom);
        if (bounds.right <= bounds.left || bounds.bottom <= bounds.top) return S_OK;
        constexpr size_t stride = 3;
        const size_t rowWidth = static_cast<size_t>(bounds.right - bounds.left);
        const size_t rows = static_cast<size_t>(bounds.bottom - bounds.top);
        if (rows > UINT32_MAX / stride / rowWidth) return E_OUTOFMEMORY;
        const size_t count = rowWidth * rows * stride;
        std::vector<uint8_t> alpha(count);
        hr = analysis->CreateAlphaTexture(texture, &bounds, alpha.data(), static_cast<UINT32>(count));
        if (FAILED(hr)) return hr;
        const auto &preblend = coverageTable(_color);
        for (LONG row = std::max<LONG>(0, bounds.top); row < std::min<LONG>(_height, bounds.bottom); ++row) {
            for (LONG column = std::max<LONG>(0, bounds.left); column < std::min<LONG>(_width, bounds.right); ++column) {
                const auto offset = ((row - bounds.top) * rowWidth + column - bounds.left) * stride;
                const auto mask = (static_cast<uint32_t>(alpha[offset]) + alpha[offset + 1] + alpha[offset + 2]) / 3U;
                const float coverage = preblend[mask];
                const float sourceAlpha = coverage / 255.F * _color[3];
                if (sourceAlpha <= 0) continue;
                auto *pixel = _pixels + (static_cast<size_t>(row) * _width + column) * 4;
                const float destAlpha = pixel[3] / 255.F;
                const float outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha);
                const auto alphaByte = std::clamp(std::lround(outAlpha * 255), 0L, 255L);
                for (size_t channel = 0; channel < 3; ++channel) {
                    // Canvas stores premultiplied bytes. Quantize before
                    // exposing straight RGBA, especially at alpha 1 or 2.
                    const float destination = std::round(pixel[channel] * destAlpha);
                    const auto premultiplied = std::lround(_color[channel] * sourceAlpha * 255 + destination * (1 - sourceAlpha));
                    pixel[channel] = alphaByte ? static_cast<uint8_t>(std::clamp(std::lround(premultiplied * 255.F / alphaByte), 0L, 255L)) : 0;
                }
                pixel[3] = static_cast<uint8_t>(alphaByte);
            }
        }
        return S_OK;
    }
    HRESULT STDMETHODCALLTYPE DrawUnderline(void *, FLOAT, FLOAT, const DWRITE_UNDERLINE *, IUnknown *) override { return S_OK; }
    HRESULT STDMETHODCALLTYPE DrawStrikethrough(void *, FLOAT, FLOAT, const DWRITE_STRIKETHROUGH *, IUnknown *) override { return S_OK; }
    HRESULT STDMETHODCALLTYPE DrawInlineObject(void *, FLOAT, FLOAT, IDWriteInlineObject *, BOOL, BOOL, IUnknown *) override { return E_NOTIMPL; }
private:
    std::atomic<ULONG> _refs{1};
    IDWriteFactory *_factory;
    uint8_t *_pixels;
    uint32_t _width;
    uint32_t _height;
    std::array<float, 4> _color;
    bool _bold;
    bool _italic;
};
}

struct DirectWriteFont::Impl {
    ComOwner<IDWriteFactory> factory;
    ComOwner<CollectionLoader> loader;
    ComOwner<IDWriteFontCollection> collection;
    ComOwner<IDWriteTextFormat> format;
    std::wstring key;
    bool registered{false};
    bool bold{false};
    bool italic{false};
    ~Impl() {
        format.reset(); collection.reset();
        if (registered) factory->UnregisterFontCollectionLoader(loader.get());
        loader.reset(); factory.reset(); // key remains alive through factory/cache destruction
    }
    bool init(const std::string &path, float size, bool useBold, bool useItalic) {
        bold = useBold;
        italic = useItalic;
        if (!(size > 0) || !std::isfinite(size)) return false;
        key = wide(path);
        if (key.empty()) return false;
        HRESULT hr = DWriteCreateFactory(DWRITE_FACTORY_TYPE_ISOLATED, __uuidof(IDWriteFactory), reinterpret_cast<IUnknown **>(factory.out()));
        if (FAILED(hr)) return false;
        loader.reset(new CollectionLoader());
        hr = factory->RegisterFontCollectionLoader(loader.get());
        if (FAILED(hr)) return false;
        registered = true;
        hr = factory->CreateCustomFontCollection(loader.get(), key.c_str(), static_cast<UINT32>((key.size() + 1) * sizeof(wchar_t)), collection.out());
        if (FAILED(hr) || !collection->GetFontFamilyCount()) return false;
        ComOwner<IDWriteFontFamily> family;
        ComOwner<IDWriteLocalizedStrings> names;
        hr = collection->GetFontFamily(0, family.out());
        if (SUCCEEDED(hr)) hr = family->GetFamilyNames(names.out());
        UINT32 length = 0;
        if (SUCCEEDED(hr)) hr = names->GetStringLength(0, &length);
        if (FAILED(hr)) return false;
        std::wstring name(length + 1, 0);
        hr = names->GetString(0, name.data(), length + 1);
        if (SUCCEEDED(hr)) hr = factory->CreateTextFormat(name.c_str(), collection.get(), DWRITE_FONT_WEIGHT_NORMAL,
            DWRITE_FONT_STYLE_NORMAL, DWRITE_FONT_STRETCH_NORMAL, size, L"en-us", format.out());
        if (FAILED(hr)) return false;
        return SUCCEEDED(format->SetWordWrapping(DWRITE_WORD_WRAPPING_NO_WRAP));
    }
    HRESULT layout(const std::wstring &text, IDWriteTextLayout **out) const {
        return factory->CreateTextLayout(text.data(), static_cast<UINT32>(text.size()), format.get(), 1000000, 1000000, out);
    }
};
DirectWriteFont::DirectWriteFont() : _impl(std::make_unique<Impl>()) {}
DirectWriteFont::~DirectWriteFont() = default;
std::unique_ptr<DirectWriteFont> DirectWriteFont::create(const std::string &path, float size, bool bold, bool italic) {
    std::unique_ptr<DirectWriteFont> result(new DirectWriteFont());
    return result->_impl->init(path, size, bold, italic) ? std::move(result) : nullptr;
}
std::array<float, 2> DirectWriteFont::measure(const std::string &text) const {
    ComOwner<IDWriteTextLayout> layout;
    if (FAILED(_impl->layout(wide(text), layout.out()))) return {};
    DWRITE_TEXT_METRICS metrics{};
    if (FAILED(layout->GetMetrics(&metrics))) return {};
    return {metrics.widthIncludingTrailingWhitespace, metrics.height};
}
bool DirectWriteFont::draw(const std::string &text, float x, float y, int baseline, uint8_t *pixels, uint32_t width, uint32_t height, const std::array<float, 4> &color) const {
    if (!pixels || !width || !height || width > LONG_MAX || height > LONG_MAX) return false;
    ComOwner<IDWriteTextLayout> layout;
    if (FAILED(_impl->layout(wide(text), layout.out()))) return false;
    DWRITE_TEXT_METRICS metrics{};
    if (FAILED(layout->GetMetrics(&metrics))) return false;
    if (baseline == 1) y -= metrics.height / 2;
    else if (baseline == 2) y -= metrics.height;
    else if (baseline == 3) {
        DWRITE_LINE_METRICS line{}; UINT32 count = 0;
        layout->GetLineMetrics(&line, 1, &count);
        y -= line.baseline;
    }
    ComOwner<TextRenderer> renderer;
    renderer.reset(new TextRenderer(_impl->factory.get(), pixels, width, height, color, _impl->bold, _impl->italic));
    return SUCCEEDED(layout->Draw(nullptr, renderer.get(), x, y));
}
} // namespace cc
