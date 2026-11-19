// The benchmark target links the candidate engine and a renamed copy of the
// original Windows delegate. See native-2d-m6-performance.md for setup.
#include "UncachedCanvasDelegate.h"
#include "platform/win32/modules/CanvasRenderingContext2DDelegate.h"

#include <chrono>
#include <cstdio>
#include <vector>

namespace {
constexpr int ITERATIONS = 2000;
constexpr int WIDTH = 32;
constexpr int HEIGHT = 24;

template <class Delegate>
double measureAndDraw(std::vector<uint8_t> &firstImages, double &totalWidth) {
    Delegate canvas;
    canvas.updateFont("Arial", 14, false, false, false, false);
    canvas.setFillStyle(255, 255, 255, 255);
    canvas.setTextBaseline(Delegate::TextBaseline::ALPHABETIC);
    const ccstd::string words[]{"AB", "CD"};
    totalWidth = 0;
    const auto start = std::chrono::steady_clock::now();
    for (int i = 0; i < ITERATIONS; ++i) {
        const auto &word = words[i % 2];
        totalWidth += canvas.measureText(word)[0];
        canvas.recreateBuffer(WIDTH, HEIGHT);
        canvas.fillText(word, 0, 17, 0);
        if (i < 2) {
            const auto &data = canvas.getDataRef();
            firstImages.insert(firstImages.end(), data.getBytes(), data.getBytes() + data.getSize());
        }
    }
    return std::chrono::duration<double, std::micro>(std::chrono::steady_clock::now() - start).count() / ITERATIONS;
}
} // namespace

int main() {
    for (int pair = -1; pair < 16; ++pair) {
        double elapsed[2]{}, widths[2]{};
        std::vector<uint8_t> images[2];
        for (int side = 0; side < 2; ++side) {
            const int arm = (pair + side + 3) % 2;
            elapsed[arm] = arm == 0 ? measureAndDraw<cc::UncachedCanvasDelegate>(images[arm], widths[arm])
                                    : measureAndDraw<cc::CanvasRenderingContext2DDelegate>(images[arm], widths[arm]);
        }
        if (widths[0] <= 0 || widths[0] != widths[1] || images[0].size() != 2 * WIDTH * HEIGHT * 4 || images[0] != images[1]) {
            return 2;
        }
        for (int image = 0; image < 2; ++image) {
            bool visible = false;
            for (int pixel = 0; pixel < WIDTH * HEIGHT; ++pixel) {
                visible |= images[0][4 * (image * WIDTH * HEIGHT + pixel) + 3] != 0;
            }
            if (!visible) return 3;
        }
        if (pair >= 0) std::printf("%d,%.6f,%.6f\n", pair, elapsed[0], elapsed[1]);
    }
}
