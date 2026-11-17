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

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <dwrite.h>
#include <cstdio>
#include <string>
#include <fstream>
#include <filesystem>
#include <iterator>
#include <vector>

namespace {
template<class T> struct ComOwner {
    T *value{nullptr};
    ~ComOwner() { if (value) value->Release(); }
    ComOwner() = default;
    ComOwner(const ComOwner &) = delete;
    ComOwner &operator=(const ComOwner &) = delete;
};
std::string utf8(const wchar_t *text) {
    const int length = WideCharToMultiByte(CP_UTF8, 0, text, -1, nullptr, 0, nullptr, nullptr);
    std::string result(length, 0);
    WideCharToMultiByte(CP_UTF8, 0, text, -1, result.data(), length, nullptr, nullptr);
    result.pop_back();
    return result;
}
}

// Isolated Windows diagnostic: balances every successful process/session font
// registration, selected GDI object and DC before trying the next mode.
int wmain(int argc, wchar_t **argv) {
    if (argc != 3) { std::fprintf(stderr, "usage: font-probe font-path family\n"); return 2; }
    std::ifstream input(std::filesystem::path(argv[1]), std::ios::binary);
    std::vector<char> bytes{std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>()};
    for (DWORD flags : {DWORD(0), DWORD(FR_PRIVATE), DWORD(0xFFFFFFFF)}) {
        SetLastError(0);
        DWORD memoryCount = 0;
        HANDLE memoryFont = flags == 0xFFFFFFFF ? AddFontMemResourceEx(bytes.data(), static_cast<DWORD>(bytes.size()), nullptr, &memoryCount) : nullptr;
        const int added = flags == 0xFFFFFFFF ? static_cast<int>(memoryCount) : flags ? AddFontResourceExW(argv[1], flags, nullptr) : AddFontResourceW(argv[1]);
        const DWORD error = GetLastError();
        std::printf("registration flags=%lu count=%d error=%lu\n", flags, added, error);
        HDC dc = CreateCompatibleDC(nullptr);
        if (!dc) {
            if (memoryFont) RemoveFontMemResourceEx(memoryFont);
            else if (added && flags) RemoveFontResourceExW(argv[1], flags, nullptr);
            else if (added) RemoveFontResourceW(argv[1]);
            return 3;
        }
        for (BYTE charset : {BYTE(DEFAULT_CHARSET), BYTE(THAI_CHARSET)}) {
            LOGFONTW description{};
            description.lfHeight = -24;
            description.lfCharSet = charset;
            description.lfWeight = FW_NORMAL;
            description.lfQuality = ANTIALIASED_QUALITY;
            wcsncpy_s(description.lfFaceName, argv[2], _TRUNCATE);
            HFONT font = CreateFontIndirectW(&description);
            if (!font) { std::printf("CreateFontIndirect failed\n"); continue; }
            HGDIOBJ previous = SelectObject(dc, font);
            if (!previous || previous == HGDI_ERROR) { DeleteObject(font); continue; }
            wchar_t selected[LF_FACESIZE]{};
            GetTextFaceW(dc, LF_FACESIZE, selected);
            SIZE extent{};
            GetTextExtentPoint32W(dc, L"Atlas 123", 9, &extent);
            std::printf("charset=%u selected=%s width=%ld height=%ld\n", charset, utf8(selected).c_str(), extent.cx, extent.cy);
            SelectObject(dc, previous);
            DeleteObject(font);
        }
        DeleteDC(dc);
        if (added || memoryFont) {
            const BOOL removed = memoryFont ? RemoveFontMemResourceEx(memoryFont) : flags ? RemoveFontResourceExW(argv[1], flags, nullptr) : RemoveFontResourceW(argv[1]);
            std::printf("removed=%d\n", removed);
        }
    }
    ComOwner<IDWriteFactory> factory;
    HRESULT hr = DWriteCreateFactory(DWRITE_FACTORY_TYPE_ISOLATED, __uuidof(IDWriteFactory), reinterpret_cast<IUnknown **>(&factory.value));
    ComOwner<IDWriteFontFile> file;
    if (SUCCEEDED(hr)) hr = factory.value->CreateFontFileReference(argv[1], nullptr, &file.value);
    BOOL supported = FALSE;
    DWRITE_FONT_FILE_TYPE fileType{};
    DWRITE_FONT_FACE_TYPE faceType{};
    UINT32 count = 0;
    if (SUCCEEDED(hr)) hr = file.value->Analyze(&supported, &fileType, &faceType, &count);
    std::printf("DirectWrite analyze hr=%08lx supported=%d faces=%u\n", hr, supported, count);
    ComOwner<IDWriteFontFace> face;
    if (SUCCEEDED(hr) && supported) hr = factory.value->CreateFontFace(faceType, 1, &file.value, 0, DWRITE_FONT_SIMULATIONS_NONE, &face.value);
    if (SUCCEEDED(hr) && face.value) {
        const UINT32 codes[]{'A','t','l','a','s',' ','1','2','3'};
        UINT16 glyphs[9]{};
        DWRITE_GLYPH_METRICS metrics[9]{};
        face.value->GetGlyphIndices(codes, 9, glyphs);
        face.value->GetDesignGlyphMetrics(glyphs, 9, metrics);
        DWRITE_FONT_METRICS fontMetrics{};
        face.value->GetMetrics(&fontMetrics);
        double width = 0;
        for (const auto &glyph : metrics) width += glyph.advanceWidth * 24.0 / fontMetrics.designUnitsPerEm;
        std::printf("DirectWrite face hr=%08lx width=%.9f units=%u\n", hr, width, fontMetrics.designUnitsPerEm);
    }
    return 0;
}
