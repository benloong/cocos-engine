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

#pragma once
#include <map>
#include <optional>
#include <string>
#include <vector>

namespace cc {

struct RichTextOutline {
    std::string color{"#ffffff"};
    double width{1};
};

// Optional values preserve the distinction between an absent property, zero,
// and an explicitly empty event object in the Web parser's inheritance rules.
struct RichTextStyle {
    std::optional<std::string> color;
    std::optional<double> size;
    std::optional<std::map<std::string, std::string>> event;
    bool isNewLine{false};
    bool isImage{false};
    std::optional<std::string> src;
    std::optional<double> imageWidth;
    std::optional<double> imageHeight;
    std::optional<std::string> imageOffset;
    std::optional<std::string> imageAlign;
    bool underline{false};
    bool italic{false};
    bool bold{false};
    std::optional<RichTextOutline> outline;
};

struct RichTextSpan {
    std::string text;
    std::optional<RichTextStyle> style;
};

/** Native input for RichText layout; no JS objects or per-span JSB transfer. */
class RichTextParser final {
public:
    static std::vector<RichTextSpan> parse(const std::string &html);
};

} // namespace cc
