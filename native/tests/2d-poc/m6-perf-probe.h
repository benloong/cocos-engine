#pragma once
#include <chrono>
#include <cstdint>
inline thread_local uint64_t m6BindingCalls = 0;
inline thread_local uint64_t m6BatchNanos = 0;
class M6BatchTimer {
public:
    M6BatchTimer() : _start(std::chrono::steady_clock::now()) {}
    ~M6BatchTimer() {
        m6BatchNanos += std::chrono::duration_cast<std::chrono::nanoseconds>(std::chrono::steady_clock::now() - _start).count();
    }
private:
    std::chrono::steady_clock::time_point _start;
};
