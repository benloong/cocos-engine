// Windows benchmark only. The decoder borrows the typed array for this call.
static bool js_submitGraphicsCommands(se::State &s) {
    const auto &args = s.args();
    if (args.size() != 2 || !args[0].isObject() || args[0].toObject()->_getClass() != __jsb_cc_Graphics_class || !args[1].isObject()) return false;
    auto *graphics = static_cast<cc::Graphics *>(args[0].toObject()->getPrivateData());
    if (!graphics) return false;
    auto *commands = args[1].toObject();
    if (!commands->isTypedArray() || commands->getTypedArrayType() != se::Object::TypedArrayType::FLOAT64) return false;
    uint8_t *bytes = nullptr;
    size_t length = 0;
    if (!commands->getTypedArrayData(&bytes, &length) || length % sizeof(double)) return false;
    const auto *data = reinterpret_cast<const double *>(bytes);
    const size_t count = length / sizeof(double);
    for (size_t i = 0; i < count;) {
        const double op = data[i++];
        if (op == 0 && count - i >= 4) {
            graphics->rect(data[i], data[i+1], data[i+2], data[i+3]);
            i += 4;
        } else if ((op == 1 || op == 2) && count - i >= 2) {
            if (op == 1) graphics->moveTo(data[i], data[i+1]);
            else graphics->lineTo(data[i], data[i+1]);
            i += 2;
        } else if (op == 3) {
            graphics->close();
        } else return false;
    }
    return true;
}
SE_BIND_FUNC(js_submitGraphicsCommands)

namespace {
thread_local std::chrono::steady_clock::time_point commandStart;
#ifdef _DEBUG
thread_local bool countCommandAllocations = false;
thread_local uint64_t commandAllocations = 0, commandAllocatedBytes = 0;
std::atomic<_CRT_ALLOC_HOOK> previousCommandHook{nullptr};
int __cdecl graphicsAllocationHook(int type, void *data, size_t size, int block, long request, const unsigned char *file, int line) {
    if (countCommandAllocations && block != _CRT_BLOCK && (type == _HOOK_ALLOC || type == _HOOK_REALLOC)) {
        ++commandAllocations;
        commandAllocatedBytes += size;
    }
    const auto previous = previousCommandHook.load();
    return !previous || previous(type, data, size, block, request, file, line);
}
#endif
}
static bool js_beginGraphicsCommands(se::State &) {
#ifdef _DEBUG
    commandAllocations = commandAllocatedBytes = 0;
    previousCommandHook = _CrtSetAllocHook(graphicsAllocationHook);
    countCommandAllocations = true;
#endif
    commandStart = std::chrono::steady_clock::now();
    return true;
}
SE_BIND_FUNC(js_beginGraphicsCommands)
static bool js_endGraphicsCommands(se::State &s) {
    const auto ns = std::chrono::duration_cast<std::chrono::nanoseconds>(std::chrono::steady_clock::now() - commandStart).count();
#ifdef _DEBUG
    countCommandAllocations = false;
    _CrtSetAllocHook(previousCommandHook.load());
    s.rval().setString(std::to_string(ns) + "," + std::to_string(commandAllocations) + "," + std::to_string(commandAllocatedBytes));
#else
    s.rval().setString(std::to_string(ns));
#endif
    return true;
}
SE_BIND_FUNC(js_endGraphicsCommands)
