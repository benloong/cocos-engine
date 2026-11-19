/****************************************************************************
 Copyright (c) 2017-2023 Xiamen Yaji Software Co., Ltd.

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

#include "jsb_platform.h"

#include "cocos/bindings/jswrapper/SeApi.h"
#include "cocos/bindings/manual/jsb_conversions.h"
#include "cocos/bindings/manual/jsb_global_init.h"
#include "cocos/platform/FileUtils.h"

#include <regex>

using namespace cc;

static ccstd::unordered_map<ccstd::string, ccstd::string> fontFamilyNameMap;
namespace {
struct FontAliasGroup {
    ccstd::string family;
    ccstd::string source;
    size_t owners{0};
};
struct FontAliasLease {
    uint64_t group;
    ccstd::string renderFamily;
};
// Value-owned records only. IDs never reset, so late releases after runtime
// cleanup cannot affect leases acquired by a subsequent script engine.
uint64_t nextFontAliasId{0};
uint64_t fontAliasRevision{0};
ccstd::unordered_map<uint64_t, FontAliasGroup> fontAliasGroups;
ccstd::unordered_map<uint64_t, FontAliasLease> fontAliasLeases;
ccstd::unordered_map<ccstd::string, uint64_t> currentFontAliasGroups;
ccstd::unordered_map<ccstd::string, ccstd::string> fontAssetFamilyNameMap;
} // namespace

const ccstd::unordered_map<ccstd::string, ccstd::string> &getFontFamilyNameMap() {
    return fontFamilyNameMap;
}

const ccstd::unordered_map<ccstd::string, ccstd::string> &getFontAssetFamilyNameMap() {
    return fontAssetFamilyNameMap;
}
uint64_t getFontAliasRevision() { return fontAliasRevision; }

uint64_t retainFontFamilyAlias(const ccstd::string &family, const ccstd::string &source, const ccstd::string &renderFamily) {
    if (family.empty() || source.empty() || renderFamily.empty()) return 0;
    const auto path = FileUtils::getInstance()->fullPathForFilename(source);
    if (path.empty() || !FileUtils::getInstance()->isFileExist(path)) return 0;
    uint64_t group = 0;
    const auto current = currentFontAliasGroups.find(family);
    if (current != currentFontAliasGroups.end() && fontAliasGroups.at(current->second).source == path) group = current->second;
    if (!group) {
        group = ++nextFontAliasId;
        fontAliasGroups.emplace(group, FontAliasGroup{family, path, 0});
        currentFontAliasGroups.insert_or_assign(family, group);
    }
    ++fontAliasGroups.at(group).owners;
    const uint64_t lease = ++nextFontAliasId;
    fontAliasLeases.emplace(lease, FontAliasLease{group, renderFamily});
    fontFamilyNameMap.insert_or_assign(family, path);
    fontAssetFamilyNameMap.insert_or_assign(renderFamily, path);
    ++fontAliasRevision;
    return lease;
}

void releaseFontFamilyAlias(uint64_t lease) {
    const auto owned = fontAliasLeases.find(lease);
    if (owned == fontAliasLeases.end()) return;
    fontAssetFamilyNameMap.erase(owned->second.renderFamily);
    const auto group = fontAliasGroups.find(owned->second.group);
    if (group != fontAliasGroups.end() && --group->second.owners == 0) {
        const auto current = currentFontAliasGroups.find(group->second.family);
        if (current != currentFontAliasGroups.end() && current->second == group->first) {
            uint64_t previous = 0;
            for (const auto &candidate : fontAliasGroups) {
                if (candidate.second.owners && candidate.second.family == group->second.family && candidate.first > previous)
                    previous = candidate.first;
            }
            if (previous) {
                current->second = previous;
                fontFamilyNameMap.insert_or_assign(group->second.family, fontAliasGroups.at(previous).source);
            } else {
                fontFamilyNameMap.erase(group->second.family);
                currentFontAliasGroups.erase(current);
            }
        }
        fontAliasGroups.erase(group);
    }
    fontAliasLeases.erase(owned);
    ++fontAliasRevision;
}

static bool jsbLoadFont(se::State &s) {
    const auto &args = s.args();
    size_t argc = args.size();
    CC_UNUSED bool ok = true;
    if (argc >= 2) {
        s.rval().setNull();

        ccstd::string originalFamilyName;
        ok &= sevalue_to_native(args[0], &originalFamilyName);
        SE_PRECONDITION2(ok, false, "Error processing argument: originalFamilyName");

        ccstd::string source;
        ok &= sevalue_to_native(args[1], &source);
        SE_PRECONDITION2(ok, false, "Error processing argument: source");

        ccstd::string fontFilePath;
        std::regex re(R"(url\(\s*'\s*(.*?)\s*'\s*\))");
        std::match_results<ccstd::string::const_iterator> results;
        if (std::regex_search(source.cbegin(), source.cend(), results, re)) {
            fontFilePath = results[1].str();
        }

        fontFilePath = FileUtils::getInstance()->fullPathForFilename(fontFilePath);
        if (originalFamilyName.empty() || fontFilePath.empty() || !FileUtils::getInstance()->isFileExist(fontFilePath)) {
            SE_LOGE("Font (%s) doesn't exist!", fontFilePath.c_str());
            return true;
        }

        // just put the path info, used at CanvasRenderingContext2DImpl::updateFont()
        const auto current = fontFamilyNameMap.find(originalFamilyName);
        if (current != fontFamilyNameMap.end() && current->second != fontFilePath) currentFontAliasGroups.erase(originalFamilyName);
        fontFamilyNameMap.insert_or_assign(originalFamilyName, fontFilePath);
        ++fontAliasRevision;

        s.rval().setString(originalFamilyName);

        return true;
    }

    SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d", (int)argc, 2);
    return false;
}
SE_BIND_FUNC(jsbLoadFont)


bool register_platform_bindings(se::Object * /*obj*/) { // NOLINT(readability-identifier-naming)
    __jsbObj->defineFunction("loadFont", _SE(jsbLoadFont));
    se::ScriptEngine::getInstance()->addAfterCleanupHook([]() {
        // Values own paths only; Canvas instances own their selected font faces.
        decltype(fontFamilyNameMap)().swap(fontFamilyNameMap);
        decltype(fontAssetFamilyNameMap)().swap(fontAssetFamilyNameMap);
        decltype(fontAliasGroups)().swap(fontAliasGroups);
        decltype(fontAliasLeases)().swap(fontAliasLeases);
        decltype(currentFontAliasGroups)().swap(currentFontAliasGroups);
        ++fontAliasRevision;
    });
    return true;
}
