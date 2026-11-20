#if defined(_MSC_VER) && defined(_DEBUG)
#include <crtdbg.h>
#include <fstream>
#include "v8-profiler.h"

class M6SnapshotFile final : public v8::OutputStream {
public:
    explicit M6SnapshotFile(const char *name) : file(name, std::ios::binary) {}
    WriteResult WriteAsciiChunk(char *data, int size) override {
        return file.write(data, size) ? kContinue : kAbort;
    }
    int GetChunkSize() override { return 65536; }
    void EndOfStream() override { file.flush(); complete = file.good(); }
    std::ofstream file;
    bool complete{false};
};

static bool js_saveM6HeapSnapshot(se::State &s) {
    if (s.args().size() != 1 || !s.args()[0].isNumber()) return false;
    const int cycle = s.args()[0].toInt32();
    if (cycle != 100 && cycle != 1000) return false;
    M6SnapshotFile stream(cycle == 100 ? "m6-100.heapsnapshot" : "m6-1000.heapsnapshot");
    if (!stream.file) return false;
    auto *profiler = v8::Isolate::GetCurrent()->GetHeapProfiler();
    const auto *snapshot = profiler->TakeHeapSnapshot();
    if (!snapshot) return false;
    snapshot->Serialize(&stream);
    const_cast<v8::HeapSnapshot *>(snapshot)->Delete();
    s.rval().setBoolean(stream.complete);
    return true;
}
SE_BIND_FUNC(js_saveM6HeapSnapshot)
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

#if defined(CC2D_M6_TRACE_GC)
#include <array>
#include <chrono>
#include "bindings/jswrapper/MappingUtils.h"

struct M6GcTrace {
    using Clock = std::chrono::steady_clock;
    struct Event {
        v8::GCType type{};
        unsigned flags{0};
        Clock::time_point start;
        double ms{0};
    };
    std::array<Event, 32> events;
    std::array<size_t, 32> pending;
    size_t size{0};
    size_t depth{0};
    bool complete{true};
};

static void m6GcBegin(v8::Isolate *, v8::GCType type, v8::GCCallbackFlags flags, void *data) {
    auto &trace = *static_cast<M6GcTrace *>(data);
    if (trace.size == trace.events.size()) {
        trace.complete = false;
        return;
    }
    trace.pending[trace.depth++] = trace.size;
    trace.events[trace.size++] = {type, static_cast<unsigned>(flags), M6GcTrace::Clock::now(), 0};
}

static void m6GcEnd(v8::Isolate *, v8::GCType type, v8::GCCallbackFlags flags, void *data) {
    auto &trace = *static_cast<M6GcTrace *>(data);
    if (!trace.complete || trace.depth == 0 || trace.events[trace.pending[trace.depth - 1]].type != type) {
        trace.complete = false;
        return;
    }
    auto &event = trace.events[trace.pending[--trace.depth]];
    event.flags |= static_cast<unsigned>(flags);
    event.ms = std::chrono::duration<double, std::milli>(M6GcTrace::Clock::now() - event.start).count();
}

static bool js_traceM6Gc(se::State &s) {
    auto *isolate = v8::Isolate::GetCurrent();
    v8::HeapStatistics before;
    isolate->GetHeapStatistics(&before);
    const auto wrappersBefore = se::NativePtrToObjectMap::size();
    M6GcTrace trace;
    isolate->AddGCPrologueCallback(m6GcBegin, &trace);
    isolate->AddGCEpilogueCallback(m6GcEnd, &trace);
    const auto start = M6GcTrace::Clock::now();
    se::ScriptEngine::getInstance()->garbageCollect();
    const auto wallMs = std::chrono::duration<double, std::milli>(M6GcTrace::Clock::now() - start).count();
    isolate->RemoveGCEpilogueCallback(m6GcEnd, &trace);
    isolate->RemoveGCPrologueCallback(m6GcBegin, &trace);
    if (!trace.complete || trace.depth != 0 || trace.size == 0) return false;

    v8::HeapStatistics after;
    isolate->GetHeapStatistics(&after);
    std::string result = "{\"wallMs\":" + std::to_string(wallMs)
        + ",\"usedBefore\":" + std::to_string(before.used_heap_size())
        + ",\"usedAfter\":" + std::to_string(after.used_heap_size())
        + ",\"wrappersBefore\":" + std::to_string(wrappersBefore)
        + ",\"wrappersAfter\":" + std::to_string(se::NativePtrToObjectMap::size())
        + ",\"events\":[";
    for (size_t i = 0; i < trace.size; ++i) {
        const auto &event = trace.events[i];
        if (i) result += ',';
        result += "{\"type\":" + std::to_string(event.type) + ",\"flags\":" + std::to_string(event.flags)
            + ",\"ms\":" + std::to_string(event.ms) + '}';
    }
    result += "]}";
    s.rval().setString(result);
    return true;
}
SE_BIND_FUNC(js_traceM6Gc)
#endif
