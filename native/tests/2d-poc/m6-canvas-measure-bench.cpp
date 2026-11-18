#include "platform/interfaces/modules/canvas/CanvasRenderingContext2D.h"
#include <chrono>
#include <cstdio>
#include <cmath>
int main() {
    using Canvas = cc::CanvasRenderingContext2D;
    constexpr int count = 2000;
    const ccstd::string words[]{"AB", "CD"};
    const ccstd::string font = "14px Arial";
    double totals[2]{};
    for (int pair = -1; pair < 8; ++pair) {
        for (int side = 0; side < 2; ++side) {
            const bool reuse = (pair + side + 2) % 2;
            Canvas cached(1, 1);
            cached.setFont(font);
            double sum = 0;
            auto start = std::chrono::steady_clock::now();
            for (int i = 0; i < count; ++i) {
                if (reuse) sum += cached.measureText(words[i % 2]).width;
                else {
                    Canvas temporary(1, 1);
                    temporary.setFont(font);
                    sum += temporary.measureText(words[i % 2]).width;
                }
            }
            auto us = std::chrono::duration<double, std::micro>(std::chrono::steady_clock::now()-start).count()/count;
            totals[reuse]=sum;
            if (pair >= 0) std::printf("%d,%d,%.6f,%.0f\n", pair, reuse, us, sum);
        }
        if (totals[0] <= 0 || totals[0] != totals[1]) return 2;
    }
}
