#pragma once

#include <array>
#include <chrono>
#include <cstdint>
#include <cstring>
#include <string>
#include <unordered_map>
#include <vector>
#include "renderer/gfx-base/GFXBuffer.h"
#include "renderer/gfx-base/GFXDevice.h"

// Measurement build only. Remember the bytes actually submitted to each GPU buffer.
namespace m6mesh {
enum Counter {
    DRAWS, CHECKED_V, CHECKED_I, STALE, WRITES_V, WRITES_I, BYTES_V, BYTES_I,
    REPEATED_V, REPEATED_I, UPDATE_NS, GENERATE_NS, RETAIN_NS, APPEND_NS, UPLOAD_NS, RESET_NS, COUNT
};
inline thread_local std::array<uint64_t, COUNT> counters{};
inline thread_local std::unordered_map<uint32_t, std::vector<uint8_t>> submitted;

class Timer {
public:
    explicit Timer(Counter counter) : _counter(counter) {}
    ~Timer() {
        counters[_counter] += std::chrono::duration_cast<std::chrono::nanoseconds>(
            std::chrono::steady_clock::now() - _start).count();
    }
private:
    Counter _counter;
    std::chrono::steady_clock::time_point _start{std::chrono::steady_clock::now()};
};

inline bool matches(cc::gfx::Buffer *buffer, const void *data, size_t bytes) {
    const auto it = submitted.find(buffer->getObjectID());
    return it != submitted.end() && it->second.size() == bytes
        && std::memcmp(it->second.data(), data, bytes) == 0;
}

inline void check(cc::gfx::Buffer *buffer, const void *data, size_t bytes, bool index) {
    ++counters[index ? CHECKED_I : CHECKED_V];
    if (!matches(buffer, data, bytes)) ++counters[STALE];
}

inline void record(cc::gfx::Buffer *buffer, const void *data, bool index) {
    const auto bytes = buffer->getSize();
    ++counters[index ? WRITES_I : WRITES_V];
    counters[index ? BYTES_I : BYTES_V] += bytes;
    if (matches(buffer, data, bytes)) {
        ++counters[index ? REPEATED_I : REPEATED_V];
    } else {
        const auto *begin = static_cast<const uint8_t *>(data);
        submitted[buffer->getObjectID()].assign(begin, begin + bytes);
    }
}

inline std::string drain() {
    std::string out;
    for (auto value : counters) out += "," + std::to_string(value);
    counters.fill(0);
    auto *device = cc::gfx::Device::getInstance();
    return out + "," + std::to_string(device->getNumDrawCalls()) + "," + std::to_string(device->getNumTris());
}
} // namespace m6mesh
