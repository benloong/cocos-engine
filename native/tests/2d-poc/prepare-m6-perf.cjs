'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildEngine } = require('@cocos/ccbuild');
const key = process.argv[2];
if (!['before', 'after'].includes(key)) throw new Error('Select before or after');
const platform = process.argv[3] || 'WINDOWS';
const traceGc = process.argv.includes('--gc-trace');
if (traceGc && platform !== 'WINDOWS') throw new Error('V8 GC tracing requires a Windows benchmark executable');
const out = path.join(__dirname, 'build');
const source = process.env.CC_M6_PERF_CHECKOUT ? path.resolve(process.env.CC_M6_PERF_CHECKOUT) : path.join(out, 'perf-' + key);
if (path.dirname(source) !== out || !new RegExp('^perf-' + key + '(?:-[0-9a-f]+)?$').test(path.basename(source))) {
    throw new Error('Expected an isolated measurement checkout under ' + out);
}
const revision = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const projectSuffix = process.argv.includes('--isolated-project') ? '-' + revision.slice(0, 10) : '';
const project = path.join(out, 'perf-project-' + key + projectSuffix);
const windows = path.join(project, 'build/windows');
const template = path.join(out, 'graphics-gpu-project');
if (path.resolve(execFileSync('git', ['-C', source, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()) !== source) {
    throw new Error('Expected a dedicated benchmark checkout');
}

function instrument (file, edits) {
    let text = execFileSync('git', ['-C', source, 'show', 'HEAD:' + file], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    for (const [from, to] of edits) {
        if (text.split(from).length !== 2) throw new Error('Ambiguous measurement hook: ' + file + ' ' + from);
        text = text.replace(from, () => to);
    }
    if (fs.readFileSync(path.join(source, file), 'utf8') !== text) fs.writeFileSync(path.join(source, file), text);
}
const included = '#include "M6PerfProbe.h"\n';
fs.writeFileSync(path.join(source, 'native/cocos/M6PerfProbe.h'), fs.readFileSync(path.join(__dirname, 'm6-perf-probe.h')));
const batchCalls = ['update', 'uploadBuffers', 'reset'];
instrument('native/cocos/core/Root.cpp', [['#include "core/Root.h"', included + '#include "core/Root.h"'],
    ...batchCalls.map(name => ['_batcher->' + name + '();', '{ M6BatchTimer timer; _batcher->' + name + '(); }'])]);
instrument('native/cocos/bindings/jswrapper/v8/HelperMacros.h', [
    ['#include "v8.h"', '#include "v8.h"\n' + included],
    ['do {                    \\\n            } while (0)', '++m6BindingCalls'],
]);
const hook = 'SE_BIND_FUNC(js_performance_now)';
const labelStages = process.argv.includes('--label-stages');
const labelFile = 'native/cocos/2d/components/Label.cpp';
const timer = 'M6TtfTimer.h';
if (labelStages) {
    if (key !== 'after' || process.argv[3] !== 'WINDOWS') throw new Error('TTF stage timings require the migrated Windows backend');
    fs.copyFileSync(path.join(__dirname, 'm6-ttf-timer.h'), path.join(source, 'native/cocos', timer));
    const labelSource = execFileSync('git', ['-C', source, 'show', 'HEAD:' + labelFile], { encoding: 'utf8' });
    const drawContext = 'auto &context = measurement.drawingContext(textureWidth, textureHeight);';
    const hasRasterReuse = labelSource.includes('uploadRaster(cache->pixels);');
    const drawLines = labelSource.includes('auto drawLine =')
        ? 'auto drawLine =' : 'for (size_t i = 0; i < lines.size(); ++i)';
    const cuts = [
        ['Layout', labelSource.includes(drawContext) ? drawContext : 'CanvasRenderingContext2D context(static_cast<float>(textureWidth), static_cast<float>(textureHeight));'],
        ['CanvasSetup', 'const Color &edgeColor ='],
        ['Background', hasRasterReuse ? drawLines : 'float textTop ='],
        ['Draw', 'cc::Data pixels;'],
        ...(hasRasterReuse ? [
            ['Layout', 'uploadRaster(cache->pixels);'],
            ['Readback', 'uploadRaster(pixels);'],
            ['TextureSetup', '_texture->uploadData(data.getBytes());'],
        ] : [
            ['Readback', '_texture = _ttfTexture;'],
            ['TextureSetup', 'const uint8_t *bytes = pixels.getBytes();'],
            ['Diagnostics', '_texture->uploadData(bytes);'],
        ]),
        ['Upload', labelSource.includes('_lastTextureWidth = static_cast<float>(textureWidth);')
            ? '_lastTextureWidth = static_cast<float>(textureWidth);' : '_lastContentWidth = contentWidth;'],
    ];
    instrument(labelFile, [
        ['#include "2d/components/Label.h"', '#include "M6TtfTimer.h"\n#include "2d/components/Label.h"'],
        ['const auto box = _transform->getContentSize();', 'M6TtfTimer timer;\n    const auto box = _transform->getContentSize();'],
        ...cuts.map(([stage, line]) => [line, 'timer.next(M6TtfTimer::Stage::' + stage + ');\n    ' + line]),
        ...(hasRasterReuse ? [['uploadRaster(cache->pixels);', '++M6TtfTimer::hits;\n        uploadRaster(cache->pixels);']] : []),
        ['cc::Data pixels;', '++M6TtfTimer::draws;\n    cc::Data pixels;'],
    ]);
} else if (fs.existsSync(path.join(source, 'native/cocos', timer))) {
    instrument(labelFile, []);
}
let bindings = fs.readFileSync(path.join(__dirname, 'm6-perf-bindings.inc'), 'utf8');
if (labelStages) bindings = '#include "M6TtfTimer.h"\n' + bindings.replace('std::to_string(heap.used_heap_size())', 'std::to_string(heap.used_heap_size()) + M6TtfTimer::drain()');
if (traceGc) bindings = '#define CC2D_M6_TRACE_GC\n' + bindings;
const traceRegistration = traceGc ? '    __jsbObj->defineFunction("traceM6Gc", _SE(js_traceM6Gc));\n' : '';
instrument('native/cocos/bindings/manual/jsb_global.cpp', [
    [hook, hook + '\n' + bindings],
    ['__jsbObj->defineFunction("garbageCollect"', '\n#if defined(_MSC_VER) && defined(_DEBUG)\n    __jsbObj->defineFunction("saveM6HeapSnapshot", _SE(js_saveM6HeapSnapshot));\n    __jsbObj->defineFunction("readM6CrtHeap", _SE(js_readM6CrtHeap));\n#endif\n    __jsbObj->defineFunction("readM6Perf", _SE(js_readM6Perf));\n' + traceRegistration + '    __jsbObj->defineFunction("garbageCollect"'],
]);
const update = 'uiRendererManager.updateAllDirtyRenderers();';
const nativeUpdate = 'nativeUIRendererManager.updateAllDirtyRenderers();';
const rootShell = 'cocos/root.jsb.ts';
const nativePrepareInRoot = platform === 'WINDOWS' && key === 'after'
    && execFileSync('git', ['-C', source, 'show', 'HEAD:' + rootShell], { encoding: 'utf8' }).includes(nativeUpdate);
if (nativePrepareInRoot) {
    // Measure both dirty queues across the JSB frame hook with one timer pair.
    instrument('cocos/game/director.ts', [[update, '(globalThis as any).__m6PrepareStart = performance.now();\n            ' + update]]);
    instrument(rootShell, [[nativeUpdate, nativeUpdate
        + '\n    (globalThis as any).__m6PrepareMs = performance.now() - (globalThis as any).__m6PrepareStart;']]);
} else {
    instrument('cocos/game/director.ts', [[update, 'const m6Start = performance.now();\n            ' + update
        + '\n            (globalThis as any).__m6PrepareMs = performance.now() - m6Start;']]);
}
instrument('cocos/root.ts', [
    ['this._batcher.update();', 'const m6Begin = performance.now();\n                this._batcher.update();'],
    ['this._batcher.uploadBuffers();', 'this._batcher.uploadBuffers();\n                (globalThis as any).__m6BatchMs = performance.now() - m6Begin;'],
    ['if (this._batcher) this._batcher.reset();', 'if (this._batcher) { const m6Begin = performance.now(); this._batcher.reset(); (globalThis as any).__m6BatchMs += performance.now() - m6Begin; }'],
]);
fs.cpSync(path.join(template, 'native'), path.join(project, 'native'), { recursive: true });
fs.mkdirSync(path.join(windows, 'proj'), { recursive: true });
fs.copyFileSync(path.join(template, 'build/windows/proj/cfg.cmake'), path.join(windows, 'proj/cfg.cmake'));
fs.writeFileSync(path.join(project, 'native/engine/common/localCfg.cmake'), 'set(COCOS_X_PATH "' + source.replaceAll('\\', '/') + '/native")\n');
if (process.argv[3] !== 'HTML5') fs.cpSync(path.join(template, 'build/windows/data'), path.join(windows, 'data'), { recursive: true });
if (!fs.existsSync(path.join(windows, 'assets'))) fs.symlinkSync(path.join(windows, 'data'), path.join(windows, 'assets'), 'junction');
execFileSync(process.execPath, [path.join(source, 'scripts/build-debug-infos.js')], { cwd: source });
if (platform === 'HTML5') fs.cpSync(path.join(template, 'build/web-mobile'), path.join(project, 'build/web-mobile'), { recursive: true });
const features = ['base','2d','rich-text','mask','graphics','ui','affine-transform','custom-pipeline','custom-pipeline-builtin-scripts'];
if (platform === 'HTML5') features.push('gfx-webgl');
execFileSync(process.execPath, [path.join(source, 'scripts/spread-pal.cjs')], { cwd: source });
console.log('M6_PERF_BUILD', revision, platform);
buildEngine({ engine: source, out: path.join(project, platform === 'WINDOWS' ? 'build/windows/data/src/cocos-js' : 'build/web-mobile/cocos-js'),
    features, platform, mode: 'BUILD', flags: { DEBUG: false, NET_MODE: 0, SERVER_MODE: false },
    moduleFormat: 'system', compress: false, sourceMap: false, inlineEnum: true, nativeCodeBundleMode: 'wasm',
    targets: 'chrome 80' }).catch(error => { console.error(error); process.exitCode = 1; });
