// Standalone Windows Release probe. Links against the engine used by the workload.
#include <windows.h>
#include <array>
#include <chrono>
#include <cstdio>
#include <vector>

namespace {
using Clock = std::chrono::steady_clock;
enum Stage { MEASURE, DRAW, FORMAT, READ, STAGES };
struct Sample {
    size_t calls{};
    double us{};
};
std::array<Sample, STAGES> samples;
bool profileCalls = false;
bool useExtTextOut = false;

template<class Call>
int timed(Stage stage, Call call) {
    if (!profileCalls) return call();
    const auto start = Clock::now();
    const int result = call();
    samples[stage].us += std::chrono::duration<double, std::micro>(Clock::now() - start).count();
    ++samples[stage].calls;
    return result;
}

int probeDrawText(HDC dc, const wchar_t *text, int length, RECT *rect, UINT format) {
    if (useExtTextOut && format == (DT_SINGLELINE | DT_NOPREFIX)) {
        return ExtTextOutW(dc, rect->left, rect->top, ETO_CLIPPED, rect, text, length, nullptr);
    }
    return timed(format & DT_CALCRECT ? MEASURE : DRAW, [&] { return DrawTextW(dc, text, length, rect, format); });
}

int probeGetDIBits(HDC dc, HBITMAP bitmap, UINT start, UINT lines, void *pixels, BITMAPINFO *info, UINT usage) {
    return timed(pixels ? READ : FORMAT, [&] { return GetDIBits(dc, bitmap, start, lines, pixels, info, usage); });
}
} // namespace

// Compile a private copy of the current delegate. Only this executable intercepts the GDI calls.
#define CanvasRenderingContext2DDelegate ProfiledCanvasDelegate
#define DrawTextW probeDrawText
#define GetDIBits probeGetDIBits
#include "platform/win32/modules/CanvasRenderingContext2DDelegate.cpp"
#undef GetDIBits
#undef DrawTextW
#undef CanvasRenderingContext2DDelegate

namespace {
using Canvas = cc::ProfiledCanvasDelegate;
constexpr int ITERATIONS = 4000;
double run(bool resetIdle, int repetitions = 1) {
    Canvas canvas;
    canvas.updateFont("Arial", 14, false, false, false, false);
    canvas.setTextBaseline(Canvas::TextBaseline::ALPHABETIC);
    canvas.setFillStyle(255, 255, 255, 255);
    canvas.recreateBuffer(1, 1);
    const ccstd::string words[]{"AB", "CD"};
    samples = {};
    const auto start = Clock::now();
    for (int i = 0; i < ITERATIONS; ++i) {
        const int wordIndex = (i / repetitions) % 2;
        const auto &word = words[wordIndex];
        if (canvas.measureText(word)[0] <= 0) std::abort();
        canvas.recreateBuffer(20 + 2 * wordIndex, 24);
        canvas.fillText(word, static_cast<float>(i % 4), 17, 0);
        if (resetIdle) canvas.recreateBuffer(1, 1);
    }
    return std::chrono::duration<double, std::micro>(Clock::now() - start).count() / ITERATIONS;
}

std::vector<uint8_t> render(bool alternate, const char *font, int size, int style, int align, int baseline,
                            int position, const char *text) {
    useExtTextOut = alternate;
    Canvas canvas;
    canvas.updateFont(font, static_cast<float>(size), style & 1, style & 2, false, false);
    canvas.setTextAlign(static_cast<Canvas::TextAlign>(align));
    canvas.setTextBaseline(static_cast<Canvas::TextBaseline>(baseline));
    canvas.setFillStyle(213, 142, 98, 255);
    canvas.recreateBuffer(80, 43);
    canvas.fillText(text, position ? -2.F : 24.75F, position ? 4.F : 20.5F, 0);
    const auto &data = canvas.getDataRef();
    if (data.getSize() != 80 * 43 * 4) std::abort();
    return {data.getBytes(), data.getBytes() + data.getSize()};
}
} // namespace

int main() {
    for (int pair = -1; pair < 16; ++pair) {
        double us[3]{};
        for (int arm = 0; arm < 3; ++arm) {
            const int variant = (pair & 1) ? 2 - arm : arm;
            useExtTextOut = variant == 2;
            us[variant] = run(variant != 1);
        }
        if (pair >= 0) std::printf("pair,%d,%.6f,%.6f,%.6f\n", pair, us[0], us[1], us[2]);
    }
    useExtTextOut = false;
    profileCalls = true;
    for (int repetitions : {1, 20}) {
        for (int i = 0; i < 12; ++i) {
            const double total = run(true, repetitions);
            std::printf("profile,%d,%d,%.6f", repetitions, i, total);
            for (int stage = 0; stage < STAGES; ++stage) {
                const auto &sample = samples[stage];
                const int expected = stage == MEASURE ? ITERATIONS / repetitions : ITERATIONS;
                if (sample.calls != expected) return 2;
                std::printf(",%.6f", sample.us / ITERATIONS);
            }
            std::puts("");
        }
    }
    profileCalls = false;
    for (const char *text : {"AB", "CD", " fi AV ", "I&W", "0123..", "office", u8"Café", u8"中文", u8"אב12",
                             u8"عربي", u8"🍀", u8"a\u0301", "a\tb", "a\nb", "a\rb", " ", u8"a\u00adb", "italic f"}) {
        int cases = 0, differences = 0;
        for (const char *font : {"Arial", "Times New Roman", "Consolas"})
            for (int size : {12, 17, 28})
                for (int style : {0, 1, 2, 3})
                    for (int align : {0, 1, 2})
                        for (int baseline : {0, 1, 2, 3})
                            for (int pos : {0, 1}) {
                                auto before = render(false, font, size, style, align, baseline, pos, text);
                                auto after = render(true, font, size, style, align, baseline, pos, text);
                                differences += before != after;
                                ++cases;
                            }
        std::printf("pixels,%d,%d\n", cases, differences);
    }
}
