// Raw Canvas/DWrite comparison, independent of Cocos layout, GPU and sampling.
#include "platform/win32/modules/DirectWriteFont.h"
#include <filesystem>
#include <fstream>
#include <cstdio>
#include <vector>

int main(int argc, char **argv) {
    if (argc != 3) { std::fprintf(stderr, "usage: ttf-raster font-path output-dir\n"); return 2; }
    std::filesystem::create_directories(argv[2]);
    for (int size : {12, 24, 36, 48}) for (int style = 0; style < 3; ++style) {
        const auto font = cc::DirectWriteFont::create(argv[1], static_cast<float>(size), style == 1, style == 2);
        if (!font) return 3;
        std::vector<uint8_t> pixels(256 * 128 * 4, 255);
        for (size_t i = 3; i < pixels.size(); i += 4) pixels[i] = 1;
        if (!font->draw("Atlas 123", 4.5F, size * .87F + 4, 3, pixels.data(), 256, 128, {1, 1, 1, 1})) return 4;
        const auto name = std::to_string(size) + "-" + std::to_string(style) + ".rgba";
        std::ofstream output(std::filesystem::path(argv[2]) / name, std::ios::binary);
        output.write(reinterpret_cast<const char *>(pixels.data()), static_cast<std::streamsize>(pixels.size()));
        if (!output) return 5;
    }
    std::puts("TTF raw raster: 12 captures");
    return 0;
}
