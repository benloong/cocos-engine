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

#include "2d/assets/Font.h"
#include "2d/assets/TTFFont.h"
#include "2d/assets/BitmapFont.h"
#include "platform/FileUtils.h"
#include "rapidjson/document.h"
#include <atomic>
#include <cstdlib>
#include <limits>
namespace cc {
namespace {
std::atomic<uint64_t> nextFontIdentity{0};
uint64_t kerningKey(int32_t left, int32_t right) {
    return (static_cast<uint64_t>(static_cast<uint32_t>(left)) << 32U) | static_cast<uint32_t>(right);
}
float number(const rapidjson::Value &object, const char *key) {
    return object.HasMember(key) && object[key].IsNumber() ? object[key].GetFloat() : 0.F;
}
bool codePoint(const char *text, int32_t &result) {
    char *end = nullptr;
    const long value = std::strtol(text, &end, 10);
    if (end == text || *end != 0 || value < 0 || value > 0x10FFFF) return false;
    result = static_cast<int32_t>(value); return true;
}
}
FontAsset::FontAsset() : _identity(++nextFontIdentity) {}
bool FontAsset::destroy() {
    const bool result = Asset::destroy();
    if (result && !_released) { _released = true; clearNativeData(); }
    return result;
}
void FontAsset::destruct() { _released = true; clearNativeData(); Asset::destruct(); }
bool TTFFont::loadFontData(const std::string &path) {
    auto *files = FileUtils::getInstance();
    if (_released || path.empty() || !files || !files->isFileExist(path)) return false;
    const auto data = files->getDataFromFile(path);
    if (data.isNull() || data.getSize() == 0) return false;
    _bytes.assign(data.getBytes(), data.getBytes() + data.getSize());
    _source = path; ++_revision;
    return true;
}
void TTFFont::clearNativeData() {
    std::vector<uint8_t>().swap(_bytes);
    _family.clear(); _source.clear(); FontAsset::clearNativeData();
}
bool BitmapFontAsset::setConfigJson(const std::string &json) {
    if (_released) return false;
    rapidjson::Document doc;
    doc.Parse(json.c_str());
    if (doc.HasParseError() || (!doc.IsObject() && !doc.IsNull())) return false;
    std::vector<BitmapFontGlyph> glyphs;
    std::unordered_map<int32_t, size_t> indices;
    std::unordered_map<uint64_t, float> kerning;
    if (doc.IsObject() && doc.HasMember("fontDefDictionary")) {
        const auto &definitions = doc["fontDefDictionary"];
        if (!definitions.IsObject()) return false;
        for (auto it = definitions.MemberBegin(); it != definitions.MemberEnd(); ++it) {
            int32_t code = 0;
            if (!codePoint(it->name.GetString(), code) || !it->value.IsObject()) return false;
            const auto &entry = it->value;
            if (!entry.HasMember("rect") || !entry["rect"].IsObject()) return false;
            const auto &rect = entry["rect"];
            indices[code] = glyphs.size();
            glyphs.push_back({code, number(rect, "x"), number(rect, "y"), number(rect, "width"), number(rect, "height"),
                              number(entry, "xOffset"), number(entry, "yOffset"), number(entry, "xAdvance")});
        }
    }
    if (doc.IsObject() && doc.HasMember("kerningDict")) {
        const auto &dictionary = doc["kerningDict"];
        if (!dictionary.IsObject()) return false;
        for (auto it = dictionary.MemberBegin(); it != dictionary.MemberEnd(); ++it) {
            if (it->value.IsNumber()) {
                // Web parser stores signed 32-bit (left << 16) | right keys.
                char *end = nullptr;
                const auto packed = static_cast<uint32_t>(std::strtoll(it->name.GetString(), &end, 10));
                if (end == it->name.GetString() || *end != 0) return false;
                kerning[kerningKey(static_cast<int32_t>(packed >> 16U), static_cast<int32_t>(packed & 0xFFFFU))] = it->value.GetFloat();
            } else if (it->value.IsObject()) {
                int32_t left = 0;
                if (!codePoint(it->name.GetString(), left)) return false;
                for (auto right = it->value.MemberBegin(); right != it->value.MemberEnd(); ++right) {
                    int32_t code = 0;
                    if (!codePoint(right->name.GetString(), code) || !right->value.IsNumber()) return false;
                    kerning[kerningKey(left, code)] = right->value.GetFloat();
                }
            } else return false;
        }
    }
    _glyphs.swap(glyphs); _glyphMap.swap(indices); _kerning.swap(kerning);
    _configJson = json; ++_revision;
    return true;
}
std::vector<float> BitmapFontAsset::getGlyphData() const {
    std::vector<float> data;
    data.reserve(_glyphs.size() * 8);
    for (const auto &g : _glyphs) data.insert(data.end(), {static_cast<float>(g.code), g.u, g.v, g.w, g.h, g.offsetX, g.offsetY, g.xAdvance});
    return data;
}
float BitmapFontAsset::getKerning(int32_t left, int32_t right) const {
    const auto found = _kerning.find(kerningKey(left, right));
    return found == _kerning.end() ? 0.F : found->second;
}
void BitmapFontAsset::clearNativeData() {
    _spriteFrame = nullptr; _fontSize = -1;
    std::string().swap(_fntDataStr); std::string("null").swap(_configJson);
    std::vector<BitmapFontGlyph>().swap(_glyphs);
    decltype(_glyphMap)().swap(_glyphMap); decltype(_kerning)().swap(_kerning); FontAsset::clearNativeData();
}
} // namespace cc
