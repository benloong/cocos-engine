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
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
#include "bindings/manual/jsb_platform.h"
#endif
#include "rapidjson/document.h"
#include <atomic>
#include <cerrno>
#include <cmath>
#include <cstdlib>
#include <limits>
namespace cc {
namespace {
std::atomic<uint64_t> nextFontIdentity{0};
uint64_t kerningKey(int32_t left, int32_t right) {
    return (static_cast<uint64_t>(static_cast<uint32_t>(left)) << 32U) | static_cast<uint32_t>(right);
}
bool finiteNumber(const rapidjson::Value &value, float &result) {
    if (!value.IsNumber()) return false;
    const double number = value.GetDouble();
    if (!std::isfinite(number) || std::abs(number) > std::numeric_limits<float>::max()) return false;
    result = static_cast<float>(number);
    return true;
}
bool number(const rapidjson::Value &object, const char *key, float &result) {
    if (!object.HasMember(key)) { result = 0.F; return true; }
    return finiteNumber(object[key], result);
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
TTFFont::~TTFFont() { clearNativeData(); }
void TTFFont::refreshFontAlias() {
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    releaseFontFamilyAlias(_fontAliasLease);
    _fontAliasLease = 0;
    _renderFamily.clear();
    if (!_released && !_family.empty() && !_source.empty()) {
        const auto family = "__cc2d_ttf_" + std::to_string(getIdentity());
        _fontAliasLease = retainFontFamilyAlias(_family, _source, family);
        if (_fontAliasLease) _renderFamily = family;
    }
#endif
}
void TTFFont::setFontFamily(const std::string &value) {
    if (_released || value == _family) return;
    _family = value; refreshFontAlias(); notifyFontChanged();
}
void TTFFont::setFontData(const std::vector<uint8_t> &bytes) {
    if (_released) return;
    _bytes = bytes; _source.clear(); refreshFontAlias(); notifyFontChanged();
}
bool TTFFont::loadFontData(const std::string &path) {
    auto *files = FileUtils::getInstance();
    if (_released || path.empty() || !files || !files->isFileExist(path)) return false;
    const auto data = files->getDataFromFile(path);
    if (data.isNull() || data.getSize() == 0) return false;
    _bytes.assign(data.getBytes(), data.getBytes() + data.getSize());
    _source = path; refreshFontAlias(); notifyFontChanged();
    return true;
}
void TTFFont::clearNativeData() {
    std::vector<uint8_t>().swap(_bytes);
    _family.clear(); _source.clear(); refreshFontAlias(); FontAsset::clearNativeData();
}
bool BitmapFontAsset::setConfigJson(const std::string &json) {
    if (_released) return false;
    rapidjson::Document doc;
    doc.Parse(json.c_str());
    if (doc.HasParseError() || (!doc.IsObject() && !doc.IsNull())) return false;
    const bool hasSourceSize = doc.IsObject() && doc.HasMember("fontSize");
    float sourceSize = 0.F;
    if (hasSourceSize && !finiteNumber(doc["fontSize"], sourceSize)) return false;
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
            BitmapFontGlyph glyph;
            glyph.code = code;
            if (!number(rect, "x", glyph.u) || !number(rect, "y", glyph.v)
                || !number(rect, "width", glyph.w) || !number(rect, "height", glyph.h)
                || !number(entry, "xOffset", glyph.offsetX) || !number(entry, "yOffset", glyph.offsetY)
                || !number(entry, "xAdvance", glyph.xAdvance) || glyph.w < 0.F || glyph.h < 0.F) return false;
            if (!indices.emplace(code, glyphs.size()).second) return false;
            glyphs.push_back(glyph);
        }
    }
    if (doc.IsObject() && doc.HasMember("kerningDict")) {
        const auto &dictionary = doc["kerningDict"];
        if (!dictionary.IsObject()) return false;
        for (auto it = dictionary.MemberBegin(); it != dictionary.MemberEnd(); ++it) {
            if (it->value.IsNumber()) {
                // Web parser stores signed 32-bit (left << 16) | right keys.
                char *end = nullptr;
                errno = 0;
                const auto key = std::strtoll(it->name.GetString(), &end, 10);
                float amount = 0.F;
                if (errno == ERANGE || end == it->name.GetString() || *end != 0
                    || key < std::numeric_limits<int32_t>::min() || key > std::numeric_limits<uint32_t>::max()
                    || !finiteNumber(it->value, amount)) return false;
                const auto packed = static_cast<uint32_t>(key);
                kerning[kerningKey(static_cast<int32_t>(packed >> 16U), static_cast<int32_t>(packed & 0xFFFFU))] = amount;
            } else if (it->value.IsObject()) {
                int32_t left = 0;
                if (!codePoint(it->name.GetString(), left)) return false;
                for (auto right = it->value.MemberBegin(); right != it->value.MemberEnd(); ++right) {
                    int32_t code = 0;
                    float amount = 0.F;
                    if (!codePoint(right->name.GetString(), code) || !finiteNumber(right->value, amount)) return false;
                    kerning[kerningKey(left, code)] = amount;
                }
            } else return false;
        }
    }
    _glyphs.swap(glyphs); _glyphMap.swap(indices); _kerning.swap(kerning);
    _sourceFontSize = sourceSize; _hasSourceFontSize = hasSourceSize;
    _configJson = json; ++_configRevision; notifyFontChanged();
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
    ++_configRevision;
    _spriteFrame = nullptr; _fontSize = -1; _sourceFontSize = 0; _hasSourceFontSize = false;
    std::string().swap(_fntDataStr); std::string("null").swap(_configJson);
    std::vector<BitmapFontGlyph>().swap(_glyphs);
    decltype(_glyphMap)().swap(_glyphMap); decltype(_kerning)().swap(_kerning); FontAsset::clearNativeData();
}
} // namespace cc
