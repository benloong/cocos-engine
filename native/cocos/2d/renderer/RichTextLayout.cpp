/*
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
*/
#include "2d/renderer/RichTextLayout.h"
#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <map>

namespace cc {
namespace {
using Text = std::u16string;
Text utf16(const std::string &value) {
    Text result;
    for (size_t i = 0; i < value.size();) {
        const auto first = static_cast<unsigned char>(value[i++]);
        uint32_t code = first;
        int remaining = 0;
        if (first >= 0xF0) { code &= 7; remaining = 3; }
        else if (first >= 0xE0) { code &= 15; remaining = 2; }
        else if (first >= 0xC0) { code &= 31; remaining = 1; }
        while (remaining-- > 0 && i < value.size()) code = (code << 6U) | (static_cast<unsigned char>(value[i++]) & 63U);
        if (code > 0xFFFF) { code -= 0x10000; result += static_cast<char16_t>(0xD800 + (code >> 10U)); result += static_cast<char16_t>(0xDC00 + (code & 1023U)); }
        else result += static_cast<char16_t>(code);
    }
    return result;
}
bool high(char16_t ch) { return ch >= 0xD800 && ch <= 0xDBFF; }
bool low(char16_t ch) { return ch >= 0xDC00 && ch <= 0xDFFF; }
std::string utf8(const Text &value) {
    std::string result;
    for (size_t i = 0; i < value.size(); ++i) {
        uint32_t code = value[i];
        if (high(value[i]) && i + 1 < value.size() && low(value[i + 1])) {
            code = 0x10000 + ((code - 0xD800) << 10U) + value[++i] - 0xDC00;
        } else if (high(value[i]) || low(value[i])) code = 0xFFFD;
        if (code < 0x80) result += static_cast<char>(code);
        else if (code < 0x800) { result += static_cast<char>(0xC0 | (code >> 6U)); result += static_cast<char>(0x80 | (code & 63U)); }
        else if (code < 0x10000) {
            result += static_cast<char>(0xE0 | (code >> 12U)); result += static_cast<char>(0x80 | ((code >> 6U) & 63U)); result += static_cast<char>(0x80 | (code & 63U));
        } else {
            result += static_cast<char>(0xF0 | (code >> 18U)); result += static_cast<char>(0x80 | ((code >> 12U) & 63U));
            result += static_cast<char>(0x80 | ((code >> 6U) & 63U)); result += static_cast<char>(0x80 | (code & 63U));
        }
    }
    return result;
}
char16_t at(const Text &text, int64_t index) { return index >= 0 && index < static_cast<int64_t>(text.size()) ? text[static_cast<size_t>(index)] : 0; }
Text sub(const Text &text, int64_t start, int64_t end = INT64_MAX) {
    // JS substring clamps/swaps bounds. Callers truncate fractional cursors.
    start = std::clamp<int64_t>(start, 0, text.size()); end = std::clamp<int64_t>(end, 0, text.size());
    if (end < start) std::swap(start, end);
    return text.substr(static_cast<size_t>(start), static_cast<size_t>(end - start));
}
int64_t symbolStart(const Text &text, int64_t index) {
    if (index >= static_cast<int64_t>(text.size())) return text.size();
    while (index >= 0) {
        if (at(text, index) == 0x200D) --index;
        if (low(at(text, index)) && index > 0) --index;
        if (high(at(text, index)) && index > 0 && at(text, index - 1) == 0x200D) --index;
        else break;
    }
    return index;
}
int64_t symbolEnd(const Text &text, int64_t index) {
    int64_t result = index;
    while (index < static_cast<int64_t>(text.size())) {
        if (at(text, index) == 0x200D) { ++index; ++result; if (high(at(text, index))) { ++index; ++result; } }
        if (high(at(text, index))) { ++index; ++result; }
        else if (low(at(text, index))) {
            ++index;
            if (index < static_cast<int64_t>(text.size()) && at(text, index) == 0x200D) ++result;
            else break;
        } else break;
    }
    return result;
}
Text safeSub(const Text &text, int64_t start, int64_t end = INT64_MAX) {
    auto first = symbolStart(text, start);
    if (first < start) first = symbolEnd(text, start) + 1;
    if (end == INT64_MAX) return sub(text, first);
    const auto lastIndex = std::max<int64_t>(0, end - 1);
    const auto lastStart = symbolStart(text, lastIndex);
    const auto last = lastStart < first || (lastStart == first && start > first) ? first : symbolEnd(text, lastIndex) + 1;
    return sub(text, first, last);
}
bool unicodeSpace(char16_t ch) {
    return (ch >= 9 && ch <= 13) || ch == 32 || ch == 133 || ch == 160 || ch == 5760 || (ch >= 8192 && ch <= 8202)
        || ch == 8232 || ch == 8233 || ch == 8239 || ch == 8287 || ch == 12288;
}
bool trimSpace(char16_t ch) { return ch == 0xFEFF || (ch != 133 && unicodeSpace(ch)); }
Text trim(Text value) {
    size_t start = 0, end = value.size();
    while (start < end && trimSpace(value[start])) ++start;
    while (end > start && trimSpace(value[end - 1])) --end;
    return value.substr(start, end - start);
}
bool cjk(char16_t ch) {
    return (ch >= 0x4E00 && ch <= 0x9FFF) || (ch >= 0x3400 && ch <= 0x4DFF) || (ch >= 0x3000 && ch <= 0x30FF)
        || (ch >= 0xFF00 && ch <= 0xFFEF) || (ch >= 0x2605 && ch <= 0x2606) || (ch >= 0x2190 && ch <= 0x2195)
        || ch == 0x203B || (ch >= 0x1100 && ch <= 0x11FF) || (ch >= 0x3130 && ch <= 0x318F)
        || (ch >= 0xA960 && ch <= 0xA97F) || (ch >= 0xAC00 && ch <= 0xD7FF);
}
bool english(char16_t ch) {
    // Escaped copies of text-utils.ts character classes also compile correctly
    // with MSVC projects whose default source code page is not UTF-8.
    static const Text extra = u"\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df\u00e9\u00e8\u00e7\u00e0\u00f9\u00ea\u00e2\u00ee\u00f4\u00fb\u0430\u00ed\u00ec\u00cd\u00cc\u00ef\u00c1\u00c0\u00e1\u00e0\u00c9\u00c8\u00d2\u00d3\u00f2\u00f3\u0150\u0151\u00d9\u00da\u0170\u00fa\u0171\u00f1\u00d1\u00e6\u00c6\u0153\u0152\u00c3\u00c2\u00e3\u00d4\u00f5\u011b\u0161\u010d\u0159\u017e\u00fd\u00e1\u00ed\u00e9\u00f3\u00fa\u016f\u0165\u010f\u0148\u011a\u0160\u010c\u0158\u017d\u00c1\u00cd\u00c9\u00d3\u00da\u0164\u017c\u017a\u015b\u00f3\u0144\u0142\u0119\u0107\u0105\u017b\u0179\u015a\u00d3\u0143\u0141\u0118\u0106\u0104\u0401\u0451\u00e1\u00e0\u1ea3\u1ea1\u00e3\u0103\u1eaf\u1eb1\u1eb3\u1eb5\u1eb7\u00e2\u1ea5\u1ea7\u1ea9\u1eab\u1ead\u00e9\u00e8\u1ebb\u1ebd\u1eb9\u00ea\u1ebf\u1ec1\u1ec3\u1ec5\u1ec7I\u00cd\u00cc\u1ec8\u0128\u1eca\u00d3\u00d2\u1ece\u00d5\u1ecc\u00d4\u1ed0\u1ed2\u1ed4\u1ed6\u1ed8\u01a0\u1eda\u1edc\u1ede\u1ee0\u1ee2\u00da\u00d9\u1ee6\u0168\u1ee4\u01af\u1ee8\u1eea\u1eec\u1eee\u1ef0\u00dd\u1ef2\u1ef6\u1ef8\u1ef4\u0110i\u00ed\u00ec\u1ec9\u0129\u1ecb\u00f3\u00f2\u1ecf\u00f5\u1ecd\u00f4\u1ed1\u1ed3\u1ed5\u1ed7\u1ed9\u01a1\u1edb\u1edd\u1edf\u1ee1\u1ee3\u00fa\u00f9\u1ee7\u0169\u1ee5\u01b0\u1ee9\u1eeb\u1eed\u1eef\u1ef1\u00fd\u1ef3\u1ef7\u1ef9\u1ef5\u0111\u00c1\u00c0\u1ea2\u1ea0\u00c3\u0102\u1eae\u1eb0\u1eb2\u1eb4\u1eb6\u00c2\u1ea4\u1ea6\u1ea8\u1eaa\u1eac\u00c9\u00c8\u1eba\u1ebc\u1eb8\u00ca\u1ebe\u1ec0\u1ec2\u1ec4\u1ec6";
    return (ch >= u'a' && ch <= u'z') || (ch >= u'A' && ch <= u'Z') || (ch >= u'0' && ch <= u'9')
        || (ch >= 0x0104 && ch <= 0x044F) || extra.find(ch) != Text::npos;
}
bool word(char16_t ch) {
    static const Text extra = u"\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df\u00e9\u00e8\u00e7\u00e0\u00f9\u00ea\u00e2\u00ee\u00f4\u00fb\u0401\u0451";
    return (ch >= u'a' && ch <= u'z') || (ch >= u'A' && ch <= u'Z') || (ch >= u'0' && ch <= u'9')
        || (ch >= 0x0410 && ch <= 0x044F) || extra.find(ch) != Text::npos;
}
size_t tailWord(const Text &text, bool any = false) {
    size_t index = text.size(); while (index > 0 && english(text[index - 1])) --index;
    return index < text.size() ? text.size() - index : any && !text.empty() && !trimSpace(text.back()) ? 1 : 0;
}
std::vector<Text> split(const Text &text) {
    std::vector<Text> result;
    size_t start = 0, end;
    while ((end = text.find(u'\n', start)) != Text::npos) { result.push_back(text.substr(start, end - start)); start = end + 1; }
    result.push_back(text.substr(start)); return result;
}
size_t firstWord(const Text &text, size_t start) {
    // getSymbolAt indexes emoji/ZWJ sequences as a single symbol in Web.
    std::vector<Text> symbols;
    for (size_t index = 0; index < text.size();) {
        const auto end = std::max<int64_t>(index + 1, symbolEnd(text, index) + 1);
        symbols.push_back(sub(text, index, end)); index = static_cast<size_t>(end);
    }
    auto special = [&](size_t index) { return index < symbols.size() && !symbols[index].empty() && (unicodeSpace(symbols[index][0]) || (symbols[index].size() == 1 && cjk(symbols[index][0]))); };
    if (special(start)) return 1;
    size_t length = 1;
    for (size_t i = start + 1; i < text.size() && !special(i); ++i) ++length;
    return length;
}

template <typename Measure>
std::vector<Text> fragments(Text text, double width, double maxWidth, const Measure &measure) {
    std::vector<Text> result;
    while (width > maxWidth && text.size() > 1) {
        int64_t length = static_cast<int64_t>(text.size() * (maxWidth / width));
        Text remaining = safeSub(text, length), nextLine = remaining;
        double firstWidth = width - measure(remaining);
        int count = 0;
        int64_t pushed = 0;
        while (firstWidth > maxWidth && count++ < 100) {
            length = static_cast<int64_t>(length * maxWidth / firstWidth);
            remaining = safeSub(text, length);
            firstWidth = width - measure(remaining);
        }
        count = 0;
        while (!remaining.empty() && firstWidth <= maxWidth && count++ < 100) {
            size_t start = 0;
            while (start < remaining.size() && trimSpace(remaining[start])) ++start;
            pushed = 1;
            if (start < remaining.size() && word(remaining[start])) {
                size_t end = start;
                while (end < remaining.size() && word(remaining[end])) ++end;
                pushed = end - start;
            }
            nextLine = remaining;
            length += pushed;
            remaining = safeSub(text, length);
            firstWidth = width - measure(remaining);
        }
        length -= pushed;
        if (length == 0) {
            length = 1;
            nextLine = safeSub(text, 1);
        } else if (length == 1 && high(at(text, 0))) {
            length = 2;
            nextLine = safeSub(text, 2);
        }
        Text current = safeSub(text, 0, length);
        const Text &following = nextLine.empty() ? remaining : nextLine;
        static const Text symbols = u"!,.:;'}]%?>\u3001\u2018\u201c\u300b\uff1f\u3002\uff0c\uff01";
        if (!following.empty() && symbols.find(following[0]) != Text::npos) {
            length -= tailWord(current, true);
            if (length == 0) length = 1;
            nextLine = safeSub(text, length);
            current = safeSub(text, 0, length);
        }
        if (!nextLine.empty() && english(nextLine[0])) {
            const auto tail = tailWord(current);
            if (tail && current.size() != tail) {
                length -= tail;
                nextLine = safeSub(text, length);
                current = safeSub(text, 0, length);
            }
        }
        if (!result.empty()) current = trim(current);
        if (!current.empty() || result.empty()) result.push_back(std::move(current));
        text = nextLine.empty() ? remaining : nextLine;
        width = measure(text);
    }
    if (!result.empty()) text = trim(text);
    if (!text.empty() || result.empty()) result.push_back(std::move(text));
    return result;
}

class Layout {
public:
    Layout(const std::vector<RichTextSpan> &spans, const RichTextLayoutOptions &options, const RichTextLayout::Measure &measure, const RichTextLayout::ImageSize &images)
    : _spans(spans), _options(options), _measure(measure), _images(images) {}
    RichTextLayoutResult build() {
        bool lastEmpty = false;
        for (size_t i = 0; i < _spans.size(); ++i) {
            const auto &span = _spans[i];
            if (span.text.empty() && span.style) {
                if (span.style->isNewLine) { newLine(); continue; }
                if (span.style->isImage && addImage(i)) continue;
            }
            auto pieces = splitLong(utf16(span.text), i);
            Text joined;
            for (size_t p = 0; p < pieces.size(); ++p) { if (p) joined += u'\n'; joined += pieces[p]; }
            const auto lines = split(joined);
            for (size_t j = 0; j < lines.size(); ++j) {
                if (lines[j].empty()) {
                    if ((joined.empty() || joined.back() == u'\n') && j + 1 == lines.size()) continue;
                    newLine(); lastEmpty = true; continue;
                }
                lastEmpty = false;
                if (_options.maxWidth > 0) wrap(lines[j], i);
                else { addText(lines[j], i); _offset += measure(i, lines[j]).width; _result.width = std::max(_result.width, _offset); }
                if (j + 1 < lines.size()) newLine();
            }
        }
        if (!lastEmpty) _result.linesWidth.push_back(_offset);
        if (_options.maxWidth > 0) _result.width = _options.maxWidth;
        _result.height = (_result.lineCount + 0.26) * _options.lineHeight;
        position(); return std::move(_result);
    }
private:
    RichTextExtent measure(size_t span, const Text &text) {
        const auto key = std::make_pair(span, text);
        const auto found = _measurements.find(key);
        if (found != _measurements.end()) return found->second;
        const auto size = _measure(span, utf8(text));
        _measurements.emplace(key, size); return size;
    }
    void newLine() { _result.linesWidth.push_back(_offset); _offset = 0; ++_result.lineCount; }
    void addText(const Text &text, size_t span) {
        const auto size = measure(span, text);
        RichTextPlacement placement; placement.spanIndex = span; placement.text = utf8(text);
        placement.line = _result.lineCount; placement.width = size.width; placement.height = size.height;
        _result.placements.push_back(std::move(placement));
    }
    bool addImage(size_t index) {
        const auto &style = *_spans[index].style;
        if (!style.src) return false;
        const auto size = _images(*style.src);
        if (!size) return false;
        if (size->height <= 0) return true;
        RichTextPlacement placement; placement.spanIndex = index; placement.image = true;
        placement.height = style.imageHeight && *style.imageHeight > 0 ? *style.imageHeight : _options.lineHeight;
        placement.width = size->width * placement.height / size->height;
        if (style.imageWidth && *style.imageWidth > 0) placement.width = *style.imageWidth;
        placement.anchorY = style.imageAlign == "top" ? 1 : style.imageAlign == "center" ? 0.5 : 0;
        if (_options.maxWidth > 0 && _offset + placement.width > _options.maxWidth) newLine();
        _offset += placement.width;
        if (_options.maxWidth <= 0) _result.width = std::max(_result.width, _offset);
        placement.line = _result.lineCount; _result.placements.push_back(std::move(placement)); return true;
    }
    void wrap(Text text, size_t span) {
        double width = measure(span, text).width;
        if (_offset > 0 && width + _offset > _options.maxWidth) {
            size_t start = 0;
            while (_offset <= _options.maxWidth) {
                const size_t length = firstWord(text, start);
                const auto wordText = sub(text, start, start + length);
                if (!wordText.empty() && _offset + measure(span, wordText).width <= _options.maxWidth) {
                    _offset += measure(span, wordText).width; start += length;
                } else {
                    if (start > 0) { addText(sub(text, 0, start), span); text = sub(text, start); width = measure(span, text).width; }
                    newLine(); break;
                }
            }
        }
        if (width > _options.maxWidth) {
            const auto parts = fragments(std::move(text), width, _options.maxWidth, [&](const Text &part) {
                return measure(span, part).width;
            });
            for (size_t i = 0; i < parts.size(); ++i) {
                addText(parts[i], span); _offset += measure(span, parts[i]).width;
                if (i + 1 < parts.size()) newLine();
            }
        } else { _offset += width; addText(text, span); }
    }
    std::vector<Text> splitLong(const Text &text, size_t span) {
        if (text.size() * _options.fontSize <= 2048 * 0.8 || measure(span, text).width < 2048) return {text};
        std::vector<Text> result;
        for (const auto &line : split(text)) {
            if (measure(span, line).width < 2048) { result.push_back(line); continue; }
            double start = 0, end = line.size() / 2.0;
            Text current = sub(line, start, end), left = sub(line, end);
            auto currentSize = measure(span, current);
            const double limit = _options.maxWidth == 0 ? 2047.9 : _options.maxWidth;
            while (currentSize.width > limit) {
                end /= 2; if (end < 1) { end *= 2; break; }
                current = sub(current, start, end); left = sub(line, end); currentSize = measure(span, current);
            }
            int tries = 1000; size_t step = 1;
            while (tries && start < line.size()) {
                while (tries && currentSize.width < limit) {
                    if (!left.empty() && english(left[0])) step = 1;
                    end += step; current = sub(line, start, end); left = sub(line, end); currentSize = measure(span, current); --tries;
                }
                while (tries && current.size() >= 2 && currentSize.width > limit) {
                    end -= step; current = sub(line, start, end); currentSize = measure(span, current); step = 1; --tries;
                }
                const auto tail = tailWord(current);
                if (current.size() >= 2 && tail && current.size() != tail) { end -= tail; current = sub(line, start, end); }
                result.push_back(current); const auto partStep = current.size(); start = end; end += partStep;
                current = sub(line, start, end); left = sub(line, end);
                auto leftSize = measure(span, left); currentSize = measure(span, current); --tries;
                if (leftSize.width < 2048 && currentSize.width < limit) {
                    result.push_back(current); if (!left.empty()) result.push_back(left); break;
                }
            }
        }
        return result;
    }
    void position() {
        double nextX = 0; uint32_t nextLine = 1;
        for (auto &placement : _result.placements) {
            if (placement.line > nextLine) { nextX = 0; nextLine = placement.line; }
            double lineX = _result.width * (_options.horizontalAlign * 0.5 - _options.anchorX);
            const auto lineWidth = placement.line <= _result.linesWidth.size() ? _result.linesWidth[placement.line - 1] : 0;
            if (_options.horizontalAlign == 1) lineX -= lineWidth / 2;
            else if (_options.horizontalAlign == 2) lineX -= lineWidth;
            placement.x = nextX + lineX;
            placement.y = _options.lineHeight * (_result.lineCount - placement.line) - _result.height * _options.anchorY;
            nextX += placement.width;
            const auto &style = _spans[placement.spanIndex].style;
            if (placement.image) {
                placement.y += _options.lineHeight * (placement.anchorY + 0.13);
                if (style && style->imageOffset) {
                    const auto &value = *style->imageOffset; const auto comma = value.find(',');
                    auto offset = [](const std::string &part) {
                        char *end = nullptr; const double number = std::strtod(part.c_str(), &end);
                        return end != part.c_str() && std::isfinite(number) && std::floor(number) == number ? number : 0.0;
                    };
                    if (comma == std::string::npos) placement.y += offset(value);
                    else if (value.find(',', comma + 1) == std::string::npos) { placement.x += offset(value.substr(0, comma)); placement.y += offset(value.substr(comma + 1)); }
                }
            } else if (style && style->outline) placement.y -= style->outline->width;
        }
    }
    const std::vector<RichTextSpan> &_spans;
    const RichTextLayoutOptions &_options;
    const RichTextLayout::Measure &_measure;
    const RichTextLayout::ImageSize &_images;
    RichTextLayoutResult _result;
    std::map<std::pair<size_t, Text>, RichTextExtent> _measurements;
    double _offset{0};
};
} // namespace
std::vector<std::string> fragmentTextForWidth(const std::string &paragraph, double maxWidth,
                                              const std::function<double(const std::string &)> &measure) {
    if (paragraph.empty() || maxWidth < 0) return {std::string{}};
    const double width = measure(paragraph);
    if (width <= maxWidth) return {paragraph};
    const auto parts = fragments(utf16(paragraph), width, maxWidth, [&](const Text &part) {
        return measure(utf8(part));
    });
    std::vector<std::string> lines;
    lines.reserve(parts.size());
    for (const auto &part : parts) lines.push_back(utf8(part));
    return lines;
}

RichTextLayoutResult RichTextLayout::build(const std::vector<RichTextSpan> &spans, const RichTextLayoutOptions &options,
                                          const Measure &measure, const ImageSize &images) {
    return Layout(spans, options, measure, images).build();
}
} // namespace cc
