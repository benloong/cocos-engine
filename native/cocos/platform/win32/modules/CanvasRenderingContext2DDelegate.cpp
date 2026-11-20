/****************************************************************************
 Copyright (c) 2018-2023 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

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

#include "platform/win32/modules/CanvasRenderingContext2DDelegate.h"
#include "platform/win32/modules/DirectWriteFont.h"
#include "base/memory/Memory.h"
#include <algorithm>
#include <cmath>

namespace {
const ccstd::string &canvasLine(const ccstd::string &text, ccstd::string &storage) {
    // Canvas measures and draws one line. Preserve each whitespace position.
    const auto needsSpace = [](char ch) { return ch == '\t' || ch == '\n' || ch == '\f' || ch == '\r'; };
    const auto first = std::find_if(text.begin(), text.end(), needsSpace);
    if (first == text.end()) return text;
    storage = text;
    std::replace_if(storage.begin() + (first - text.begin()), storage.end(), needsSpace, ' ');
    return storage;
}

void fillRectWithColor(uint8_t *buf, uint32_t totalWidth, uint32_t totalHeight, float x, float y, float width, float height, uint8_t r, uint8_t g, uint8_t b, uint8_t a) {
    if (!std::isfinite(x) || !std::isfinite(y) || !std::isfinite(width) || !std::isfinite(height) || !a) return;
    if (width < 0) { x += width; width = -width; }
    if (height < 0) { y += height; height = -height; }
    const float left = std::max(x, 0.F), top = std::max(y, 0.F);
    const float right = std::min(x + width, static_cast<float>(totalWidth));
    const float bottom = std::min(y + height, static_cast<float>(totalHeight));
    if (!(right > left && bottom > top)) return;
    const uint8_t color[]{r, g, b, a};
    for (uint32_t row = static_cast<uint32_t>(top); row < static_cast<uint32_t>(std::ceil(bottom)); ++row) {
        for (uint32_t column = static_cast<uint32_t>(left); column < static_cast<uint32_t>(std::ceil(right)); ++column) {
            const float coverX = std::min(right, column + 1.F) - std::max(left, static_cast<float>(column));
            const float coverY = std::min(bottom, row + 1.F) - std::max(top, static_cast<float>(row));
            auto *pixel = buf + (static_cast<size_t>(row) * totalWidth + column) * 4;
            if (coverX == 1.F && coverY == 1.F && (pixel[3] == 0 || a == 255)) {
                std::copy_n(color, 4, pixel);
                continue;
            }
            const float sourceAlpha = a / 255.F * coverX * coverY;
            if (sourceAlpha <= 0) continue;
            const float destAlpha = pixel[3] / 255.F;
            const float outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha);
            for (size_t channel = 0; channel < 3; ++channel) {
                const float value = (color[channel] / 255.F * sourceAlpha + pixel[channel] / 255.F * destAlpha * (1 - sourceAlpha)) / outAlpha;
                pixel[channel] = static_cast<uint8_t>(std::clamp(std::lround(value * 255), 0L, 255L));
            }
            pixel[3] = static_cast<uint8_t>(std::clamp(std::lround(outAlpha * 255), 0L, 255L));
        }
    }
}
} // namespace

namespace cc {
CanvasRenderingContext2DDelegate::CanvasRenderingContext2DDelegate() {
    HDC hdc = GetDC(_wnd);
    _DC = CreateCompatibleDC(hdc);
    ReleaseDC(_wnd, hdc);
}

CanvasRenderingContext2DDelegate::~CanvasRenderingContext2DDelegate() {
    deleteBitmap();
    removeCustomFont();
    if (_DC)
        DeleteDC(_DC);
}

void CanvasRenderingContext2DDelegate::recreateBuffer(float w, float h) {
    _bufferWidth = w;
    _bufferHeight = h;
    if (_bufferWidth < 1.0F || _bufferHeight < 1.0F) {
        deleteBitmap();
        return;
    }

    auto textureSize = static_cast<int>(_bufferWidth * _bufferHeight * 4);
    auto *data = static_cast<uint8_t *>(malloc(sizeof(uint8_t) * textureSize));
    memset(data, 0x00, textureSize);
    _imageData.fastSet(data, textureSize);

    prepareBitmap(static_cast<int>(_bufferWidth), static_cast<int>(_bufferHeight));
}

void CanvasRenderingContext2DDelegate::beginPath() {
    // called: set_lineWidth() -> beginPath() -> moveTo() -> lineTo() -> stroke(), when draw line
    _hpen = CreatePen(PS_SOLID, static_cast<int>(_lineWidth), RGB(255, 255, 255));
    // the return value of SelectObject is a handle to the object being replaced, so we should delete them to avoid memory leak
    HGDIOBJ hOldPen = SelectObject(_DC, _hpen);
    HGDIOBJ hOldBmp = SelectObject(_DC, _bmp);
    DeleteObject(hOldPen);
    DeleteObject(hOldBmp);

    SetBkMode(_DC, TRANSPARENT);
}

void CanvasRenderingContext2DDelegate::closePath() {
}

void CanvasRenderingContext2DDelegate::moveTo(float x, float y) {
    MoveToEx(_DC, static_cast<int>(x), static_cast<int>(-(y - _bufferHeight - _fontSize)), nullptr);
}

void CanvasRenderingContext2DDelegate::lineTo(float x, float y) {
    LineTo(_DC, static_cast<int>(x), static_cast<int>(-(y - _bufferHeight - _fontSize)));
}

void CanvasRenderingContext2DDelegate::stroke() {
    DeleteObject(_hpen);
    if (_bufferWidth < 1.0F || _bufferHeight < 1.0F) {
        return;
    }

    fillTextureData();
}

void CanvasRenderingContext2DDelegate::saveContext() {
    if (const int dc = SaveDC(_DC)) {
        _savedContexts.push_back({dc, _directWrite, _fontSize, _textShadow});
    }
}

void CanvasRenderingContext2DDelegate::restoreContext() {
    if (_savedContexts.empty()) return;
    auto saved = std::move(_savedContexts.back());
    _savedContexts.pop_back();
    _directWrite = std::move(saved.directWrite);
    _fontSize = saved.fontSize;
    _textShadow = saved.textShadow;
    _measuredText.clear();
    BOOL ret = RestoreDC(_DC, saved.dc);
    if (0 == ret) {
        SE_LOGD("CanvasRenderingContext2DImpl restore context failed.\n");
    }
}

void CanvasRenderingContext2DDelegate::clearRect(float /*x*/, float /*y*/, float w, float h) {
    if (_bufferWidth < 1.0F || _bufferHeight < 1.0F) {
        return;
    }

    if (_imageData.isNull()) {
        return;
    }

    recreateBuffer(w, h);
}

void CanvasRenderingContext2DDelegate::fillRect(float x, float y, float w, float h) {
    if (_bufferWidth < 1.0F || _bufferHeight < 1.0F) {
        return;
    }

    //not filled all Bits in buffer? the buffer length is _bufferWidth * _bufferHeight * 4, but it filled _bufferWidth * _bufferHeight * 3?
    uint8_t *buffer = _imageData.getBytes();
    if (buffer) {
        uint8_t r = static_cast<uint8_t>(_fillStyle[0] * 255.0f);
        uint8_t g = static_cast<uint8_t>(_fillStyle[1] * 255.0f);
        uint8_t b = static_cast<uint8_t>(_fillStyle[2] * 255.0f);
        uint8_t a = static_cast<uint8_t>(_fillStyle[3] * 255.0f);
        fillRectWithColor(buffer,
                          static_cast<uint32_t>(_bufferWidth),
                          static_cast<uint32_t>(_bufferHeight),
                          x, y, w, h, r, g, b, a);
    }
}

void CanvasRenderingContext2DDelegate::fillText(const ccstd::string &text, float x, float y, float /*maxWidth*/) {
    if (text.empty() || _bufferWidth < 1.0F || _bufferHeight < 1.0F) {
        return;
    }

    ccstd::string storage;
    const auto &line = canvasLine(text, storage);
    if (_directWrite) {
        x = alignDirectWriteX(line, x);
        const auto width = static_cast<uint32_t>(_bufferWidth);
        const auto height = static_cast<uint32_t>(_bufferHeight);
        const auto baseline = static_cast<int>(_textBaseLine);
        auto *pixels = _imageData.getBytes();
        if (_textShadow.color[3] > 0.F && _fillStyle[3] > 0.F
            && (_textShadow.blur > 0.F || _textShadow.offsetX != 0.F || _textShadow.offsetY != 0.F)) {
            const float shadowX = x + _textShadow.offsetX;
            const float shadowY = y + _textShadow.offsetY;
            auto color = _textShadow.color;
            color[3] *= _fillStyle[3];
            if (_textShadow.blur > 0.F) {
                _directWrite->drawShadow(line, shadowX, shadowY, baseline, pixels, width, height, color, _textShadow.blur);
            } else {
                _directWrite->draw(line, shadowX, shadowY, baseline, pixels, width, height, color);
            }
        }
        _directWrite->draw(line, x, y, baseline, pixels, width, height, _fillStyle);
        return;
    }
    int length = 0;
    wchar_t *wide = utf8ToUtf16(line, &length);
    if (!wide || !length) {
        CC_SAFE_DELETE_ARRAY(wide);
        return;
    }
    const Size size = sizeWithText(wide, length);
    const Point origin = convertDrawPoint(Point{x, y}, size);
    RECT rect{0, 0, static_cast<LONG>(size[0]), static_cast<LONG>(size[1])};
    OffsetRect(&rect, static_cast<LONG>(origin[0]), static_cast<LONG>(origin[1]));
    SetBkMode(_DC, TRANSPARENT);
    SetTextColor(_DC, RGB(255, 255, 255));
    DrawTextW(_DC, wide, length, &rect, DT_SINGLELINE | DT_NOPREFIX);
    CC_SAFE_DELETE_ARRAY(wide);
    fillTextureData();
}

bool CanvasRenderingContext2DDelegate::supportsTextStroke() const {
    return _directWrite != nullptr;
}

bool CanvasRenderingContext2DDelegate::fillTextShadow(const ccstd::string &text, float x, float y, float blur) {
    if (!_directWrite || _bufferWidth < 1 || _bufferHeight < 1) return false;
    if (text.empty() || _fillStyle[3] == 0) return true;
    ccstd::string storage;
    const auto &line = canvasLine(text, storage);
    return _directWrite->drawShadow(line, alignDirectWriteX(line, x), y, static_cast<int>(_textBaseLine),
                                    _imageData.getBytes(), static_cast<uint32_t>(_bufferWidth),
                                    static_cast<uint32_t>(_bufferHeight), _fillStyle, blur);
}

CanvasRenderingContext2DDelegate::Size CanvasRenderingContext2DDelegate::measureText(const ccstd::string &text) {
    if (text.empty())
        return ccstd::array<float, 2>{0.0f, 0.0f};
    ccstd::string storage;
    const auto &line = canvasLine(text, storage);
    if (_directWrite) return _directWrite->measure(line);

    int bufferLen = 0;
    wchar_t *pwszBuffer = CanvasRenderingContext2DDelegate::utf8ToUtf16(line, &bufferLen);
    Size size = sizeWithText(pwszBuffer, bufferLen);
    //SE_LOGD("CanvasRenderingContext2DImpl::measureText: %s, %d, %d\n", text.c_str(), size.cx, size.cy);
    CC_SAFE_DELETE_ARRAY(pwszBuffer);
    return size;
}

void CanvasRenderingContext2DDelegate::updateFont(const ccstd::string &fontName,
                                                  float fontSize,
                                                  bool bold,
                                                  bool italic,
                                                  bool /* oblique */,
                                                  bool /* smallCaps */) {
    do {
        _measuredText.clear();
        _directWrite.reset();
        _fontName = fontName;
        _fontSize = static_cast<int>(fontSize);
        ccstd::string fontPath;
        LOGFONTW tFont = {};
        if (!_fontName.empty()) {
            // firstly, try to create font from ttf file
            const auto &assetFonts = getFontAssetFamilyNameMap();
            const auto &fontInfoMap = assetFonts.find(_fontName) != assetFonts.end() ? assetFonts : getFontFamilyNameMap();
            auto iter = fontInfoMap.find(_fontName);
            if (iter != fontInfoMap.end()) {
                fontPath = iter->second;
                ccstd::string tmpFontPath = fontPath;
                size_t nFindPos = tmpFontPath.rfind("/");
                tmpFontPath = &tmpFontPath[nFindPos + 1];
                nFindPos = tmpFontPath.rfind(".");
                // IDEA: draw ttf failed if font file name not equal font face name
                // for example: "DejaVuSansMono-Oblique" not equal "DejaVu Sans Mono"  when using DejaVuSansMono-Oblique.ttf
                _fontName = tmpFontPath.substr(0, nFindPos);
            } else {
                auto nFindPos = fontName.rfind("/");
                if (nFindPos != fontName.npos) {
                    if (fontName.length() == nFindPos + 1) {
                        _fontName = "";
                    } else {
                        _fontName = &_fontName[nFindPos + 1];
                    }
                }
            }
            if (!fontPath.empty()) {
                removeCustomFont();
                _directWrite = DirectWriteFont::create(fontPath, fontSize, bold, italic).release();
                if (_directWrite) return;
            } else {
                _directWrite = DirectWriteFont::createSystem(_fontName, fontSize, bold, italic).release();
                if (_directWrite) {
                    removeCustomFont();
                    return;
                }
            }
            tFont.lfCharSet = DEFAULT_CHARSET;
            // A CSS family can exceed LOGFONT's limit. Let GDI select its
            // fallback instead of matching a truncated name.
            if (!MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, _fontName.c_str(), -1,
                                     tFont.lfFaceName, LF_FACESIZE)) {
                tFont.lfFaceName[0] = L'\0';
            }
        }

        if (_fontSize) {
            tFont.lfHeight = -_fontSize;
        }

        if (bold) {
            tFont.lfWeight = FW_BOLD;
        } else {
            tFont.lfWeight = FW_NORMAL;
        }

        tFont.lfItalic = italic;

        // disable Cleartype
        tFont.lfQuality = ANTIALIASED_QUALITY;

        // delete old font
        removeCustomFont();

        if (!fontPath.empty()) {
            wchar_t *pwszBuffer = utf8ToUtf16(fontPath);
            if (pwszBuffer) {
                if (AddFontResourceExW(pwszBuffer, FR_PRIVATE, nullptr)) {
                    _curFontPath = fontPath;
                }
                delete[] pwszBuffer;
                pwszBuffer = nullptr;
            }
        }

        // create new font
        HFONT created = CreateFontIndirectW(&tFont);
        if (!created || !SelectObject(_DC, created)) {
            if (created) DeleteObject(created);
            // create failed, use default font
            SE_LOGE("Failed to create custom font(font name: %s, font size: %f), use default font.\n",
                    _fontName.c_str(), fontSize);
        } else {
            _font = created;
        }
    } while (false);
}

void CanvasRenderingContext2DDelegate::setTextAlign(TextAlign align) {
    _textAlign = align;
}

void CanvasRenderingContext2DDelegate::setTextBaseline(TextBaseline baseline) {
    _textBaseLine = baseline;
}

void CanvasRenderingContext2DDelegate::setFillStyle(uint8_t r, uint8_t g, uint8_t b, uint8_t a) {
    _fillStyle = {r / 255.0F, g / 255.0F, b / 255.0F, a / 255.0F};
}

void CanvasRenderingContext2DDelegate::setStrokeStyle(uint8_t r, uint8_t g, uint8_t b, uint8_t a) {
    _strokeStyle = {r / 255.0F, g / 255.0F, b / 255.0F, a / 255.0F};
}

void CanvasRenderingContext2DDelegate::setShadowBlur(float blur) {
    if (std::isfinite(blur) && blur >= 0.F) _textShadow.blur = blur;
}

void CanvasRenderingContext2DDelegate::setShadowColor(uint8_t r, uint8_t g, uint8_t b, uint8_t a) {
    _textShadow.color = {r / 255.0F, g / 255.0F, b / 255.0F, a / 255.0F};
}

void CanvasRenderingContext2DDelegate::setShadowOffsetX(float offsetX) {
    if (std::isfinite(offsetX)) _textShadow.offsetX = offsetX;
}

void CanvasRenderingContext2DDelegate::setShadowOffsetY(float offsetY) {
    if (std::isfinite(offsetY)) _textShadow.offsetY = offsetY;
}

void CanvasRenderingContext2DDelegate::setLineWidth(float lineWidth) {
    if (!(lineWidth > 0) || !std::isfinite(lineWidth)) return;
    _lineWidth = lineWidth;
}

const cc::Data &CanvasRenderingContext2DDelegate::getDataRef() const {
    return _imageData;
}

// change utf-8 string to utf-16, pRetLen is the string length after changing
wchar_t *CanvasRenderingContext2DDelegate::utf8ToUtf16(const ccstd::string &str, int *pRetLen /* = nullptr*/) {
    wchar_t *pwszBuffer = nullptr;
    do {
        if (str.empty()) {
            break;
        }
        int nLen = static_cast<int>(str.size());
        int nBufLen = nLen + 1;
        pwszBuffer = ccnew wchar_t[nBufLen];
        CC_BREAK_IF(!pwszBuffer);
        memset(pwszBuffer, 0, sizeof(wchar_t) * nBufLen);
        // str.size() not equal actuallyLen for Chinese char
        int actuallyLen = MultiByteToWideChar(CP_UTF8, 0, str.c_str(), nLen, pwszBuffer, nBufLen);
        // SE_LOGE("_utf8ToUtf16, str:%s, strLen:%d, retLen:%d\n", str.c_str(), str.size(), actuallyLen);
        if (pRetLen != nullptr) {
            *pRetLen = actuallyLen;
        }
    } while (false);
    return pwszBuffer;
}

void CanvasRenderingContext2DDelegate::removeCustomFont() {
    HFONT hDefFont = (HFONT)GetStockObject(DEFAULT_GUI_FONT);
    if (hDefFont != _font) {
        SelectObject(_DC, hDefFont);
        DeleteObject(_font);
        _font = hDefFont;
    }
    // release temp font resource
    if (!_curFontPath.empty()) {
        wchar_t *pwszBuffer = utf8ToUtf16(_curFontPath);
        if (pwszBuffer) {
            RemoveFontResourceExW(pwszBuffer, FR_PRIVATE, nullptr);
            delete[] pwszBuffer;
            pwszBuffer = nullptr;
        }
        _curFontPath.clear();
    }
}

CanvasRenderingContext2DDelegate::Size CanvasRenderingContext2DDelegate::sizeWithText(const wchar_t *pszText, int nLen) {
    if (!pszText || nLen <= 0) return {0, 0};
    // Layout and drawing often measure the same run. Keep one short run per DC.
    constexpr int MAX_CACHED_LENGTH = 256;
    const bool cacheable = nLen <= MAX_CACHED_LENGTH;
    if (cacheable && _measuredText.size() == static_cast<size_t>(nLen)
        && _measuredText.compare(0, _measuredText.size(), pszText, nLen) == 0) {
        return _measuredSize;
    }

    RECT rect{};
    const int height = DrawTextW(_DC, pszText, nLen, &rect, DT_CALCRECT | DT_NOPREFIX);
    const Size size{static_cast<float>(rect.right), static_cast<float>(rect.bottom)};
    if (cacheable && height != 0) {
        _measuredText.assign(pszText, nLen);
        _measuredSize = size;
    }
    return size;
}

void CanvasRenderingContext2DDelegate::prepareBitmap(int nWidth, int nHeight) {
    // release bitmap
    deleteBitmap();

    if (nWidth > 0 && nHeight > 0) {
        _bmp = CreateBitmap(nWidth, nHeight, 1, 32, nullptr);
        SelectObject(_DC, _bmp);
    }
}

void CanvasRenderingContext2DDelegate::deleteBitmap() {
    if (_bmp) {
        DeleteObject(_bmp);
        _bmp = nullptr;
    }
}

void CanvasRenderingContext2DDelegate::fillTextureData() {
    do {
        auto dataLen = static_cast<int>(_bufferWidth * _bufferHeight * 4);
        auto *dataBuf = static_cast<unsigned char *>(malloc(sizeof(unsigned char) * dataLen));
        CC_BREAK_IF(!dataBuf);
        unsigned char *imageBuf = _imageData.getBytes();
        CC_BREAK_IF(!imageBuf);

        struct
        {
            BITMAPINFOHEADER bmiHeader;
            int mask[4];
        } bi = {0};
        bi.bmiHeader.biSize = sizeof(bi.bmiHeader);
        CC_BREAK_IF(!GetDIBits(_DC, _bmp, 0, 0,
                               nullptr, (LPBITMAPINFO)&bi, DIB_RGB_COLORS));

        // copy pixel data
        bi.bmiHeader.biHeight = (bi.bmiHeader.biHeight > 0) ? -bi.bmiHeader.biHeight : bi.bmiHeader.biHeight;
        GetDIBits(_DC, _bmp, 0, static_cast<UINT>(_bufferHeight), dataBuf,
                  (LPBITMAPINFO)&bi, DIB_RGB_COLORS);

        uint8_t r = static_cast<uint8_t>(round(_fillStyle[0] * 255));
        uint8_t g = static_cast<uint8_t>(round(_fillStyle[1] * 255));
        uint8_t b = static_cast<uint8_t>(round(_fillStyle[2] * 255));
        COLORREF textColor = (b << 16 | g << 8 | r) & 0x00ffffff;
        COLORREF *pPixel = nullptr;
        COLORREF *pImage = nullptr;
        int bufferHeight = static_cast<int>(_bufferHeight);
        int bufferWidth = static_cast<int>(_bufferWidth);
        for (int y = 0; y < bufferHeight; ++y) {
            pPixel = (COLORREF *)dataBuf + y * bufferWidth;
            pImage = (COLORREF *)imageBuf + y * bufferWidth;
            for (int x = 0; x < bufferWidth; ++x) {
                COLORREF &clr = *pPixel;
                COLORREF &val = *pImage;
                // Because text is drawn in white color, and background color is black,
                // so the red value is equal to alpha value. And we should keep this value
                // as it includes anti-atlas information.
                uint8_t alpha = GetRValue(clr);
                if (alpha > 0) {
                    val = (alpha << 24) | textColor;
                }
                ++pPixel;
                ++pImage;
            }
        }
        free(dataBuf);
    } while (false);
}

float CanvasRenderingContext2DDelegate::alignDirectWriteX(const ccstd::string &text, float x) {
    if (_textAlign == TextAlign::CENTER) return x - _directWrite->measure(text)[0] / 2;
    if (_textAlign == TextAlign::RIGHT) return x - _directWrite->measure(text)[0];
    return x;
}

ccstd::array<float, 2> CanvasRenderingContext2DDelegate::convertDrawPoint(Point point, const Size &textSize) {
    if (_textAlign == TextAlign::CENTER) {
        point[0] -= textSize[0] / 2.0f;
    } else if (_textAlign == TextAlign::RIGHT) {
        point[0] -= textSize[0];
    }

    if (_textBaseLine == TextBaseline::TOP) {
        // DrawText default
        GetTextMetrics(_DC, &_tm);
        point[1] += -_tm.tmInternalLeading;
    } else if (_textBaseLine == TextBaseline::MIDDLE) {
        point[1] += -textSize[1] / 2.0f;
    } else if (_textBaseLine == TextBaseline::BOTTOM) {
        point[1] += -textSize[1];
    } else if (_textBaseLine == TextBaseline::ALPHABETIC) {
        GetTextMetrics(_DC, &_tm);
        point[1] -= _tm.tmAscent;
    }

    return point;
}

void CanvasRenderingContext2DDelegate::fill() {
}

void CanvasRenderingContext2DDelegate::setLineCap(const ccstd::string & /* lineCap */) {
}

void CanvasRenderingContext2DDelegate::setLineJoin(const ccstd::string &lineJoin) {
    if (lineJoin == "round" || lineJoin == "miter" || lineJoin == "bevel") _lineJoin = lineJoin;
}

void CanvasRenderingContext2DDelegate::fillImageData(const Data & /* imageData */,
                                                     float /* imageWidth */,
                                                     float /* imageHeight */,
                                                     float /* offsetX */,
                                                     float /* offsetY */) {
}

void CanvasRenderingContext2DDelegate::strokeText(const ccstd::string &text,
                                                  float x,
                                                  float y,
                                                  float /* maxWidth */) {
    if (text.empty() || !_directWrite || _bufferWidth < 1 || _bufferHeight < 1) return;
    ccstd::string storage;
    const auto &line = canvasLine(text, storage);
    x = alignDirectWriteX(line, x);
    const auto join = _lineJoin == "round" ? DirectWriteFont::StrokeJoin::ROUND
        : _lineJoin == "bevel" ? DirectWriteFont::StrokeJoin::BEVEL : DirectWriteFont::StrokeJoin::MITER;
    _directWrite->stroke(line, x, y, static_cast<int>(_textBaseLine), _imageData.getBytes(),
                        static_cast<uint32_t>(_bufferWidth), static_cast<uint32_t>(_bufferHeight), _strokeStyle, _lineWidth, join);
}

void CanvasRenderingContext2DDelegate::rect(float /* x */,
                                            float /* y */,
                                            float /* w */,
                                            float /* h */) {
}

} // namespace cc
