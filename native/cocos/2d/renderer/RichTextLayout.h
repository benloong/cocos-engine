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
#pragma once
#include "2d/renderer/RichTextParser.h"
#include <functional>
#include <cstdint>

namespace cc {
// Wrap a paragraph with the same word and symbol boundaries as the Web text assembler.
std::vector<std::string> fragmentTextForWidth(const std::string &paragraph, double maxWidth,
                                              const std::function<double(const std::string &)> &measure);

struct RichTextExtent { double width{0}; double height{0}; };
struct RichTextLayoutOptions {
    double fontSize{40};
    double lineHeight{40};
    double maxWidth{0};
    double anchorX{0.5};
    double anchorY{0.5};
    int horizontalAlign{0};
};
struct RichTextPlacement {
    size_t spanIndex{0};
    std::string text;
    bool image{false};
    uint32_t line{1};
    double x{0};
    double y{0};
    double width{0};
    double height{0};
    double anchorY{0};
};
struct RichTextLayoutResult {
    double width{0};
    double height{0};
    uint32_t lineCount{1};
    std::vector<double> linesWidth;
    std::vector<RichTextPlacement> placements;
};
class RichTextLayout final {
public:
    // Measurements must remain stable during one build; repeated requests are
    // memoized locally and all measurement cache storage is released on return.
    using Measure = std::function<RichTextExtent(size_t, const std::string &)>;
    using ImageSize = std::function<std::optional<RichTextExtent>(const std::string &)>;
    static RichTextLayoutResult build(const std::vector<RichTextSpan> &spans, const RichTextLayoutOptions &options,
                                      const Measure &measure, const ImageSize &imageSize);
};
} // namespace cc
