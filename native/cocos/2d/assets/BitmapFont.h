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

#pragma once
#include <cmath>
#include <string>
#include <vector>
#include <unordered_map>
#include "2d/assets/Font.h"
#include "2d/assets/SpriteFrame.h"
namespace cc {
struct BitmapFontGlyph {
    int32_t code{0};
    float u{0};
    float v{0};
    float w{0};
    float h{0};
    float offsetX{0};
    float offsetY{0};
    float xAdvance{0};
};
class BitmapFontAsset : public FontAsset {
public:
    void setSpriteFrame(SpriteFrame *value) { if (!_released) { _spriteFrame = value; notifyFontChanged(); } }
    SpriteFrame *getSpriteFrame() const { return _spriteFrame.get(); }
    void setFontSize(float value) { if (!_released && std::isfinite(value) && value != _fontSize) { _fontSize = value; notifyFontChanged(); } }
    float getFontSize() const { return _fontSize; }
    // Config source size drives glyph scale; public fontSize remains serialized metadata.
    bool hasSourceFontSize() const { return _hasSourceFontSize; }
    float getSourceFontSize() const { return _hasSourceFontSize ? _sourceFontSize : _fontSize; }
    void setFntDataStr(const std::string &value) { if (!_released) _fntDataStr = value; }
    const std::string &getFntDataStr() const { return _fntDataStr; }
    bool setConfigJson(const std::string &json);
    const std::string &getConfigJson() const { return _configJson; }
    uint32_t getConfigRevision() const { return _configRevision; }
    std::vector<float> getGlyphData() const;
    float getKerning(int32_t left, int32_t right) const;
    const std::vector<BitmapFontGlyph> &getGlyphs() const { return _glyphs; }
    const std::unordered_map<int32_t, size_t> &getGlyphMap() const { return _glyphMap; }
    const std::unordered_map<uint64_t, float> &getKerningMap() const { return _kerning; }
    void clearNativeData() override;
private:
    IntrusivePtr<SpriteFrame> _spriteFrame;
    float _fontSize{-1};
    float _sourceFontSize{0};
    bool _hasSourceFontSize{false};
    std::string _fntDataStr;
    std::string _configJson{"null"};
    uint32_t _configRevision{0};
    std::vector<BitmapFontGlyph> _glyphs;
    std::unordered_map<int32_t, size_t> _glyphMap;
    std::unordered_map<uint64_t, float> _kerning;
};
} // namespace cc
