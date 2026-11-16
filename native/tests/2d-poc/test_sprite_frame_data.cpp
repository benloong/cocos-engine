#include <cassert>
#include <cstdio>
#include "2d/assets/SpriteFrameData.h"

template <size_t N>
void printArray(const std::array<float, N> &values) {
    std::printf("[");
    for (size_t i = 0; i < N; ++i) std::printf("%s%.9g", i == 0 ? "" : ",", static_cast<double>(values[i]));
    std::printf("]");
}

int main() {
    cc::SpriteFrameData data;
    data.x = 7; data.y = 11; data.width = 40; data.height = 28;
    data.originalWidth = 60; data.originalHeight = 50;
    data.offsetX = 3; data.offsetY = -2;
    data.insetLeft = 5; data.insetRight = 9; data.insetTop = 6; data.insetBottom = 8;
    data.pivotX = 0.25F;
    data.packable = false;
    auto copy = data;
    copy.resetGeometry();
    assert(copy.width == 0 && copy.insetLeft == 0 && copy.originalWidth == 0);
    assert(copy.pivotX == 0.25F && !copy.packable);
    assert(data.width == 40 && data.offsetX == 3);

    std::printf("[");
    bool first = true;
    for (int dimensions = 0; dimensions < 4; ++dimensions) {
        const float tw = (dimensions & 1) ? 0.F : 128.F;
        const float th = (dimensions & 2) ? 0.F : 256.F;
        for (int flags = 0; flags < 8; ++flags) {
            data.rotated = (flags & 1) != 0;
            data.flipUVX = (flags & 2) != 0;
            data.flipUVY = (flags & 4) != 0;
            std::printf("%s{\"width\":%.0f,\"height\":%.0f,\"rotated\":%s,\"flipX\":%s,\"flipY\":%s,\"uv\":",
                        first ? "" : ",", tw, th, data.rotated ? "true" : "false",
                        data.flipUVX ? "true" : "false", data.flipUVY ? "true" : "false");
            first = false;
            printArray(data.calculateUV(tw, th));
            std::printf(",\"sliced\":");
            printArray(data.calculateSlicedUV(tw, th));
            std::printf("}");
        }
    }
    std::printf("]\n");
}
