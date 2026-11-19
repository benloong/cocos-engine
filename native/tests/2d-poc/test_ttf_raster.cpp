// Raw Canvas/DWrite comparison, independent of Cocos layout, GPU and sampling.
#include "platform/win32/modules/DirectWriteFont.h"
#include <filesystem>
#include <cmath>
#include <cstdlib>
#include <fstream>
#include <cstdio>
#include <vector>
#include <map>
#include <string>

int main(int argc, char **argv) {
    if (argc < 3 || argc > 7) { std::fprintf(stderr, "usage: ttf-raster font-path output-dir [color] [sample] [mode] [stroke-width]\n"); return 2; }
    const std::string colorName = argc >= 4 ? argv[3] : "white";
    std::array<float, 4> color{1, 1, 1, 1};
    if (colorName == "red") color = {1, 0, 0, 1};
    else if (colorName == "green") color = {0, 1, 0, 1};
    else if (colorName == "gray") color = {128.F / 255.F, 128.F / 255.F, 128.F / 255.F, 1};
    else if (colorName == "black") color = {0, 0, 0, 1};
    else if (colorName == "half-white") color[3] = .5F;
    else if (colorName != "white") return 2;
    const std::string sample = argc >= 5 ? argv[4] : "latin";
    const std::map<std::string, std::string> texts{
        {"combining", u8"A\u0301tlas"},
        {"thai", u8"\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22"},
        {"bidi-override", u8"A\u202E123\u202CB"},
        {"bidi-visual", "A321B"},
        {"latin-space", "A V A"},
        {"latin-kern", "AVATAR"},
        {"hebrew", u8"\u05D0\u05D1\u05D2"},
        {"arabic", u8"\u0633\u064E\u0644\u064E\u0627\u0645"},
        {"hebrew-mixed", u8"A \u05D0\u05D1\u05D2 12 B"},
        {"arabic-marks", u8"A \u0633\u064E\u0644\u064E\u0627\u0645 B"},
        {"thai-marks", u8"\u0E01\u0E34\u0E49 \u0E19\u0E49\u0E33"},
        {"stems", "I E L"},
        {"rounds", "O S C"},
        {"latin", "Atlas 123"},
        {"origin-stem", "I"},
        {"origin-curve", "O"},
    };
    const auto entry = texts.find(sample);
    if (entry == texts.end()) return 2;
    const auto &text = entry->second;
    const std::string mode = argc >= 6 ? argv[5] : "fill";
    if (mode != "fill" && mode != "outline" && mode != "stroke-round" && mode != "stroke-miter" && mode != "stroke-bevel") return 2;
    float lineWidth = 4.F;
    if (argc == 7) {
        char *end = nullptr;
        lineWidth = std::strtof(argv[6], &end);
        if (mode == "fill" || *end || !std::isfinite(lineWidth) || lineWidth <= 0.F) return 2;
    }
    std::filesystem::create_directories(argv[2]);
    const bool originGrid = sample == "origin-stem" || sample == "origin-curve";
    const unsigned width = originGrid ? 512 : 256, height = originGrid ? 512 : 128;
    for (int size : {12, 24, 36, 48}) for (int style = 0; style < (originGrid ? 4 : 3); ++style) {
        const auto font = cc::DirectWriteFont::create(argv[1], static_cast<float>(size), (style & 1) != 0, (style & 2) != 0);
        if (!font) return 3;
        std::vector<uint8_t> pixels(width * height * 4, 255);
        for (size_t i = 3; i < pixels.size(); i += 4) pixels[i] = 1;
        const int tiles = originGrid ? 8 : 1;
        for (int row = 0; row < tiles; ++row) for (int column = 0; column < tiles; ++column) {
            const float x = originGrid ? 8.F + column * 64 + column / 8.F : 4.5F;
            const float y = originGrid ? 50.F + row * 64 + row / 8.F : size * .87F + 4;
            if (mode == "fill") {
                if (!font->draw(text, x, y, 3, pixels.data(), width, height, color)) return 4;
            } else {
                const auto join = mode == "stroke-miter" ? cc::DirectWriteFont::StrokeJoin::MITER
                    : mode == "stroke-bevel" ? cc::DirectWriteFont::StrokeJoin::BEVEL : cc::DirectWriteFont::StrokeJoin::ROUND;
                if (!font->stroke(text, x, y, 3, pixels.data(), width, height, color, lineWidth, join)) return 4;
                if (mode == "outline" && !font->draw(text, x, y, 3, pixels.data(), width, height, {1, 1, 1, 1})) return 4;
            }
        }
        const auto name = std::to_string(size) + "-" + std::to_string(style) + ".rgba";
        std::ofstream output(std::filesystem::path(argv[2]) / name, std::ios::binary);
        output.write(reinterpret_cast<const char *>(pixels.data()), static_cast<std::streamsize>(pixels.size()));
        if (!output) return 5;
    }
    std::printf("TTF raw raster: %d captures\n", originGrid ? 16 : 12);
    return 0;
}
