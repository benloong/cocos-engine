#pragma once
#include <array>
#include <chrono>
#include <cstdint>
#include <string>

class M6TtfTimer {
public:
    enum class Stage { Layout, CanvasSetup, Background, Draw, Readback, TextureSetup, Diagnostics, Upload, Finish, Count };
    inline static thread_local uint64_t hits{}, draws{};

    M6TtfTimer() { ++calls; }
    ~M6TtfTimer() { next(Stage::Finish); }
    void next(Stage stage) {
        const auto now = Clock::now();
        nanos[static_cast<size_t>(stage)] += std::chrono::duration_cast<std::chrono::nanoseconds>(now - start).count();
        start = now;
    }
    static std::string drain() {
        std::string data = "," + std::to_string(calls);
        calls = 0;
        for (auto &value : nanos) {
            data += "," + std::to_string(value);
            value = 0;
        }
        data += "," + std::to_string(hits) + "," + std::to_string(draws);
        hits = draws = 0;
        return data;
    }
private:
    using Clock = std::chrono::steady_clock;
    Clock::time_point start{Clock::now()};
    inline static thread_local uint64_t calls{};
    inline static thread_local std::array<uint64_t, static_cast<size_t>(Stage::Count)> nanos{};
};
