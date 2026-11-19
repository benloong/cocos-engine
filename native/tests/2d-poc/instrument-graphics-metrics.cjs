'use strict';
const fs = require('node:fs');
const path = require('node:path');
const [source, output] = process.argv.slice(2);
let code = fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n');
function insert(anchor, extra) {
    if (code.split(anchor).length !== 2) throw new Error('Missing or ambiguous hook: ' + anchor);
    code = code.replace(anchor, () => anchor + extra);
}
const declarations = `#include <atomic>
#include <chrono>
#include <cstdint>
namespace m6graphics {
inline std::atomic<uint64_t> uploadBytes{0}, draws{0}, triangles{0};
inline uint64_t batches{}, elapsedNs{}, frames{};
}
`;
switch (path.basename(source)) {
case 'Batcher2d.cpp':
    insert('void Batcher2d::update() {', '\n    const auto m6Start = std::chrono::steady_clock::now();');
    insert('void Batcher2d::update() {\n    const auto m6Start = std::chrono::steady_clock::now();\n    fillBuffersAndMergeBatches();\n    resetRenderStates();',
        '\n    m6graphics::elapsedNs += std::chrono::duration_cast<std::chrono::nanoseconds>(std::chrono::steady_clock::now() - m6Start).count();\n    m6graphics::batches += _batches.size();\n    ++m6graphics::frames;');
    break;
case 'GLES3Commands.cpp':
    insert('void cmdFuncGLES3CopyBuffersToTexture(GLES3Device *device, const uint8_t *const *buffers, GLES3GPUTexture *gpuTexture, const BufferTextureCopy *regions, uint32_t count) {\n    if (!gpuTexture->memoryAllocated) return;',
        `\n    for (uint32_t i = 0; i < count; ++i) {
        const auto &r = regions[i];
        m6graphics::uploadBytes.fetch_add(static_cast<uint64_t>(formatSize(gpuTexture->format, r.texExtent.width, r.texExtent.height, r.texExtent.depth)) * r.texSubres.layerCount, std::memory_order_relaxed);
    }`);
    break;
case 'GLES3Queue.cpp':
    insert('_numTriangles += cmdBuff->_numTriangles;', `
        m6graphics::draws.fetch_add(cmdBuff->_numDrawCalls, std::memory_order_relaxed);
        m6graphics::triangles.fetch_add(cmdBuff->_numTriangles, std::memory_order_relaxed);`);
    break;
case 'jsb_global.cpp':
    insert('SE_BIND_FUNC(js_performance_now)', `
static bool js_readGraphicsMetrics(se::State &s) {
    using namespace m6graphics;
    s.rval().setString(std::to_string(frames) + "," + std::to_string(batches) + "," + std::to_string(elapsedNs) + "," +
        std::to_string(uploadBytes.exchange(0)) + "," + std::to_string(draws.exchange(0)) + "," + std::to_string(triangles.exchange(0)));
    frames = batches = elapsedNs = 0;
    return true;
}
SE_BIND_FUNC(js_readGraphicsMetrics)
`);
    insert('__jsbObj->defineFunction("garbageCollect", _SE(jsc_garbageCollect));', '\n    __jsbObj->defineFunction("readGraphicsMetrics", _SE(js_readGraphicsMetrics));');
    break;
default: throw Error('Unknown instrumentation source: ' + source);
}
fs.writeFileSync(output, declarations + code);
