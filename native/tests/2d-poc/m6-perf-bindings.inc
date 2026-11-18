#if defined(_MSC_VER) && defined(_DEBUG)
#include <crtdbg.h>
static bool js_readM6CrtHeap(se::State &s) {
    _CrtMemState state{};
    _CrtMemCheckpoint(&state);
    s.rval().setString(std::to_string(state.lSizes[_NORMAL_BLOCK] + state.lSizes[_CLIENT_BLOCK]) + "," +
                       std::to_string(state.lCounts[_NORMAL_BLOCK] + state.lCounts[_CLIENT_BLOCK]));
    return true;
}
SE_BIND_FUNC(js_readM6CrtHeap)
#endif
static bool js_readM6Perf(se::State &s) {
    v8::HeapStatistics heap;
    v8::Isolate::GetCurrent()->GetHeapStatistics(&heap);
    s.rval().setString(std::to_string(m6BatchNanos) + "," + std::to_string(m6BindingCalls) + "," + std::to_string(heap.used_heap_size()));
    m6BatchNanos = 0;
    m6BindingCalls = 0;
    return true;
}
SE_BIND_FUNC(js_readM6Perf)
