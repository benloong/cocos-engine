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
#include <array>
#include <cstdint>
#include <memory>
#include <string>

namespace cc {
// Owns an isolated DirectWrite factory, one private file collection and format.
// No process-wide font registration; all COM references end with this object.
class DirectWriteFont final {
public:
    static std::unique_ptr<DirectWriteFont> create(const std::string &path, float size, bool bold, bool italic);
    ~DirectWriteFont();
    std::array<float, 2> measure(const std::string &text) const;
    bool draw(const std::string &text, float x, float y, int baseline,
              uint8_t *pixels, uint32_t width, uint32_t height, const std::array<float, 4> &color) const;
private:
    DirectWriteFont();
    struct Impl;
    std::unique_ptr<Impl> _impl;
};
} // namespace cc
