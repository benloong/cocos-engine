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
