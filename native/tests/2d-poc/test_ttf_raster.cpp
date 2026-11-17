// Raw Canvas/DWrite comparison, independent of Cocos layout, GPU and sampling.
#include "platform/win32/modules/DirectWriteFont.h"
#include <filesystem>
#include <fstream>
#include <cstdio>
#include <vector>
#include <string>

int main(int argc, char **argv) {
    if (argc < 3 || argc > 6) { std::fprintf(stderr, "usage: ttf-raster font-path output-dir [color] [sample] [mode]\n"); return 2; }
    const std::string colorName = argc >= 4 ? argv[3] : "white";
    std::array<float, 4> color{1, 1, 1, 1};
    if (colorName == "red") color = {1, 0, 0, 1};
    else if (colorName == "green") color = {0, 1, 0, 1};
    else if (colorName == "gray") color = {128.F / 255.F, 128.F / 255.F, 128.F / 255.F, 1};
    else if (colorName == "black") color = {0, 0, 0, 1};
    else if (colorName == "half-white") color[3] = .5F;
    else if (colorName != "white") return 2;
    const std::string sample = argc >= 5 ? argv[4] : "latin";
    const std::string text = sample == "combining" ? u8"A\u0301tlas" : sample == "thai" ? u8"\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22" : sample == "latin" ? "Atlas 123" : "";
    if (text.empty()) return 2;
    const std::string mode = argc >= 6 ? argv[5] : "fill";
    if (mode != "fill" && mode != "outline" && mode != "stroke-round" && mode != "stroke-miter" && mode != "stroke-bevel") return 2;
    std::filesystem::create_directories(argv[2]);
    for (int size : {12, 24, 36, 48}) for (int style = 0; style < 3; ++style) {
        const auto font = cc::DirectWriteFont::create(argv[1], static_cast<float>(size), style == 1, style == 2);
        if (!font) return 3;
        std::vector<uint8_t> pixels(256 * 128 * 4, 255);
        for (size_t i = 3; i < pixels.size(); i += 4) pixels[i] = 1;
        if (mode == "fill") {
            if (!font->draw(text, 4.5F, size * .87F + 4, 3, pixels.data(), 256, 128, color)) return 4;
        } else {
            const auto join = mode == "stroke-miter" ? cc::DirectWriteFont::StrokeJoin::MITER
                : mode == "stroke-bevel" ? cc::DirectWriteFont::StrokeJoin::BEVEL : cc::DirectWriteFont::StrokeJoin::ROUND;
            if (!font->stroke(text, 4.5F, size * .87F + 4, 3, pixels.data(), 256, 128, color, 4, join)) return 4;
            if (mode == "outline" && !font->draw(text, 4.5F, size * .87F + 4, 3, pixels.data(), 256, 128, {1, 1, 1, 1})) return 4;
        }
        const auto name = std::to_string(size) + "-" + std::to_string(style) + ".rgba";
        std::ofstream output(std::filesystem::path(argv[2]) / name, std::ios::binary);
        output.write(reinterpret_cast<const char *>(pixels.data()), static_cast<std::streamsize>(pixels.size()));
        if (!output) return 5;
    }
    std::puts("TTF raw raster: 12 captures");
    return 0;
}
