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
#include <string>
#include <vector>
#include "2d/assets/Font.h"
namespace cc {
class TTFFont final : public FontAsset {
public:
    const std::string &getFontFamily() const { return _family; }
    void setFontFamily(const std::string &value) { if (!_released && value != _family) { _family = value; ++_revision; } }
    bool loadFontData(const std::string &path);
    void setFontData(const std::vector<uint8_t> &bytes) { if (!_released) { _bytes = bytes; _source.clear(); ++_revision; } }
    const std::vector<uint8_t> &getFontData() const { return _bytes; }
    uint32_t getFontDataSize() const { return static_cast<uint32_t>(_bytes.size()); }
    const std::string &getSourcePath() const { return _source; }
    void clearNativeData() override;
    void initDefault() override { initDefault(ccstd::nullopt); }
    void initDefault(const ccstd::optional<ccstd::string> &uuid) override { clearNativeData(); setFontFamily("Arial"); Asset::initDefault(uuid); }
private:
    std::string _family;
    std::string _source;
    std::vector<uint8_t> _bytes;
};
} // namespace cc
