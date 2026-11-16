/****************************************************************************
 Copyright (c) 2013-2016 Chukong Technologies Inc.
 Copyright (c) 2017-2023 Xiamen Yaji Software Co., Ltd.
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

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

#include "2d/renderer/RichTextParser.h"
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <limits>
#include <regex>

namespace cc {
namespace {
// ECMAScript WhiteSpace/LineTerminator in UTF-8. std::regex \s alone only
// recognizes ASCII in the default C++ locale.
const std::string WS = R"((?:[\t\n\v\f\r ]|\xC2\xA0|\xE1\x9A\x80|\xE2\x80[\x80-\x8A\xA8\xA9\xAF]|\xE2\x81\x9F|\xE3\x80\x80|\xEF\xBB\xBF))";
const std::regex TRIM_START("^" + WS + "+"), TRIM_END(WS + "+$");
const std::regex COLOR_SIZE("^(color|size)" + WS + "*=");
const std::regex BREAK("^br" + WS + "*/");
const std::regex IMAGE("^img" + WS + "*src" + WS + "*=[^>]+/");
const std::regex OUTLINE("^outline" + WS + "*[^>]*");
const std::regex BOOLEAN("^(on|u|b|i)" + WS + "*");
const std::regex EVENT("^click" + WS + "*=|param" + WS + "*=");
const std::regex IMAGE_ATTR(WS + "*(src|height|width|align|offset|click|param)" + WS + "*=");
const std::regex OUTLINE_ATTR(WS + "*(color|width|click|param)" + WS + "*=");
const std::regex NON_SPACE("(?:(?!" + WS + ")[\\s\\S])+");

std::string trim(std::string value) {
    value = std::regex_replace(value, TRIM_START, "");
    return std::regex_replace(value, TRIM_END, "");
}
int64_t indexOf(const std::string &text, const std::string &part, int64_t from = 0) {
    const auto index = text.find(part, static_cast<size_t>(std::max<int64_t>(0, from)));
    return index == std::string::npos ? -1 : static_cast<int64_t>(index);
}
// JS substring clamps negative positions and swaps reversed bounds.
std::string substring(const std::string &text, int64_t first, int64_t last = std::numeric_limits<int64_t>::max()) {
    first = std::clamp<int64_t>(first, 0, text.size());
    last = std::clamp<int64_t>(last, 0, text.size());
    if (first > last) std::swap(first, last);
    return text.substr(static_cast<size_t>(first), static_cast<size_t>(last - first));
}
double parseInteger(std::string value) {
    value = trim(value);
    size_t index = 0;
    if (!value.empty() && (value[0] == '+' || value[0] == '-')) {
        ++index;
    }
    int base = 10;
    if (value.size() >= index + 2 && value[index] == '0' && (value[index + 1] == 'x' || value[index + 1] == 'X')) {
        base = 16; index += 2;
    }
    const size_t begin = index;
    for (; index < value.size(); ++index) {
        const char ch = value[index];
        const int digit = ch >= '0' && ch <= '9' ? ch - '0' : ch >= 'a' && ch <= 'f' ? ch - 'a' + 10 : ch >= 'A' && ch <= 'F' ? ch - 'A' + 10 : -1;
        if (digit < 0 || digit >= base) break;
    }
    // Convert the complete integer prefix once, preserving JS double rounding
    // for values beyond 2^53 rather than rounding each multiply/add.
    return begin == index ? std::numeric_limits<double>::quiet_NaN() : std::strtod(value.substr(0, index).c_str(), nullptr);
}
std::string stripDoubleQuotes(std::string value) {
    if (!value.empty() && value.front() == '"') value.erase(0, 1);
    if (!value.empty() && value.back() == '"') value.pop_back();
    return value;
}
std::map<std::string, std::string> parseEvent(std::string value) {
    std::map<std::string, std::string> event;
    std::smatch match;
    while (std::regex_search(value, match, EVENT)) {
        const auto name = trim(match.str().substr(0, match.length() - 1));
        value = trim(substring(value, match.length()));
        int64_t end = 0;
        if (!value.empty() && (value[0] == '"' || value[0] == '\'')) {
            end = indexOf(value, value.substr(0, 1), 1);
            if (end >= 0) event[name] = trim(substring(value, 1, end));
            ++end;
        } else {
            // Invalid unquoted values are skipped, as in HtmlTextParser.
            std::smatch token;
            if (std::regex_search(value, token, NON_SPACE)) end = token.length();
        }
        value = trim(substring(value, end));
    }
    return event;
}

template <class T> bool truthy(const std::optional<T> &value) { return value.has_value(); }
template <> bool truthy(const std::optional<std::string> &value) { return value && !value->empty(); }
template <> bool truthy(const std::optional<double> &value) { return value && *value != 0 && !std::isnan(*value); }

void inherit(RichTextStyle &style, const RichTextStyle &parent) {
#define INHERIT(name) if (parent.name && !truthy(style.name)) style.name = parent.name
    INHERIT(color); INHERIT(size); INHERIT(event); INHERIT(src);
    INHERIT(imageWidth); INHERIT(imageHeight); INHERIT(imageOffset); INHERIT(imageAlign); INHERIT(outline);
#undef INHERIT
    style.isNewLine |= parent.isNewLine; style.isImage |= parent.isImage;
    style.underline |= parent.underline; style.italic |= parent.italic; style.bold |= parent.bold;
}

class Parser {
public:
    std::vector<RichTextSpan> parse(const std::string &html) {
        int64_t start = 0;
        while (start < static_cast<int64_t>(html.size())) {
            auto end = indexOf(html, ">", start);
            int64_t begin = -1;
            if (end >= 0) {
                const auto found = html.rfind('<', static_cast<size_t>(end));
                begin = found == std::string::npos ? -1 : static_cast<int64_t>(found);
                if (begin < start - 1) { begin = indexOf(html, "<", end + 1); end = indexOf(html, ">", begin + 1); }
            }
            if (begin < 0) {
                if (!_stack.empty()) _stack.pop_back();
                emit(substring(html, start)); break;
            }
            const auto tag = substring(html, begin + 1, end);
            emit(substring(html, start, tag.empty() ? end + 1 : begin));
            if (end < 0) end = begin;
            else if (html[static_cast<size_t>(begin + 1)] == '/') { if (!_stack.empty()) _stack.pop_back(); }
            else {
                auto style = attributes(tag);
                if (_stack.empty()) _stack.push_back(std::move(style));
                else if (!style.isNewLine && !style.isImage) {
                    inherit(style, _stack.back()); _stack.push_back(std::move(style));
                }
            }
            start = end + 1;
        }
        return std::move(_spans);
    }
private:
    void emit(std::string value) {
        if (value.empty()) return;
        // Replacement order is observable: &amp;lt; must remain &lt;.
        for (const auto &entity : {std::pair<const char *, const char *>{"&lt;", "<"}, {"&gt;", ">"}, {"&amp;", "&"}, {"&quot;", "\""}, {"&apos;", "'"}}) {
            size_t at = 0;
            while ((at = value.find(entity.first, at)) != std::string::npos) {
                value.replace(at, std::char_traits<char>::length(entity.first), entity.second);
                at += std::char_traits<char>::length(entity.second);
            }
        }
        _spans.push_back({std::move(value), _stack.empty() ? std::nullopt : std::make_optional(_stack.back())});
    }

    RichTextStyle attributes(std::string value) {
        value = trim(value);
        RichTextStyle style;
        std::smatch header;
        if (std::regex_search(value, header, COLOR_SIZE)) {
            const bool isColor = header.str()[0] == 'c';
            value = trim(substring(value, header.length()));
            if (value.empty()) return style;
            const auto space = indexOf(value, " ");
            if (isColor) style.color = space >= 0 ? trim(substring(value, 0, space)) : value;
            else style.size = parseInteger(value);
            if (space >= 0) style.event = parseEvent(trim(substring(value, space + 1)));
            return style;
        }
        if (std::regex_search(value, BREAK)) {
            style.isNewLine = true; _spans.push_back({"", style}); return style;
        }
        if (std::regex_search(value, IMAGE)) {
            bool valid = false;
            parseAttributes(value, IMAGE_ATTR, true, style, valid);
            if (valid && style.isImage) _spans.push_back({"", style});
            return {};
        }
        if (std::regex_search(value, header, OUTLINE)) {
            value = trim(header.str().substr(7));
            style.outline = RichTextOutline{};
            bool unused = false;
            parseAttributes(value, OUTLINE_ATTR, false, style, unused);
        }
        if (std::regex_search(value, header, BOOLEAN)) {
            const char name = header.str()[0];
            value = trim(substring(value, header.length()));
            style.underline = name == 'u'; style.bold = name == 'b'; style.italic = name == 'i';
            if (!value.empty()) style.event = parseEvent(value);
        }
        return style;
    }

    void parseAttributes(std::string &value, const std::regex &pattern, bool image, RichTextStyle &style, bool &valid) {
        std::smatch header;
        while (std::regex_search(value, header, pattern)) {
            const auto before = value;
            const auto name = trim(header[1].str());
            const auto remaining = trim(substring(value, header.position() + header.length()));
            int64_t rightQuote = -1;
            if (image && name == "src") {
                auto single = indexOf(remaining, "'"), dual = indexOf(remaining, "\"");
                const auto left = single >= 0 && (dual < 0 || single < dual) ? single : dual;
                if (left >= 0) rightQuote = indexOf(remaining, remaining.substr(static_cast<size_t>(left), 1), left + 1 >= static_cast<int64_t>(remaining.size()) ? -1 : left + 1);
            }
            const auto space = indexOf(remaining, " ", rightQuote + 1 >= static_cast<int64_t>(remaining.size()) ? -1 : rightQuote + 1);
            auto tagValue = space >= 0 ? substring(remaining, 0, space) : remaining;
            value = trim(substring(remaining, space));
            if (image && !tagValue.empty() && tagValue.back() == '/') tagValue.pop_back();
            if (name == "src") {
                if (!tagValue.empty() && (tagValue[0] == '"' || tagValue[0] == '\'')) {
                    valid = true; tagValue = tagValue.size() > 1 ? tagValue.substr(1, tagValue.size() - 2) : "";
                }
                style.isImage = true; style.src = tagValue;
            } else if (name == "height") style.imageHeight = parseInteger(tagValue);
            else if (name == "width") {
                if (image) style.imageWidth = parseInteger(tagValue);
                else style.outline->width = parseInteger(tagValue);
            } else if (name == "align") {
                if (!tagValue.empty() && (tagValue[0] == '"' || tagValue[0] == '\'')) tagValue = tagValue.size() > 1 ? tagValue.substr(1, tagValue.size() - 2) : "";
                for (auto &ch : tagValue) if (ch >= 'A' && ch <= 'Z') ch += 'a' - 'A';
                style.imageAlign = tagValue;
            } else if (name == "offset") style.imageOffset = tagValue;
            else if (name == "color") style.outline->color = tagValue;
            else if (name == "click") style.event = parseEvent(name + "=" + tagValue);
            if (style.event && name == "param") (*style.event)[name] = stripDoubleQuotes(tagValue);
            // Malformed attributes must not cause an unbounded native loop.
            if (value == before) break;
        }
    }
    std::vector<RichTextStyle> _stack;
    std::vector<RichTextSpan> _spans;
};
} // namespace

std::vector<RichTextSpan> RichTextParser::parse(const std::string &html) {
    return Parser{}.parse(html);
}
} // namespace cc
