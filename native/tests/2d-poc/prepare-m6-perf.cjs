'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildEngine } = require('@cocos/ccbuild');
const key = process.argv[2];
if (!['before', 'after'].includes(key)) throw new Error('Select before or after');
const out = path.join(__dirname, 'build');
const source = path.join(out, 'perf-' + key);
const project = path.join(out, 'perf-project-' + key);
const windows = path.join(project, 'build/windows');
const template = path.join(out, 'graphics-gpu-project');
const revision = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
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
instrument('native/cocos/bindings/manual/jsb_global.cpp', [
    [hook, hook + '\n' + fs.readFileSync(path.join(__dirname, 'm6-perf-bindings.inc'), 'utf8')],
    ['__jsbObj->defineFunction("garbageCollect"', '\n#if defined(_MSC_VER) && defined(_DEBUG)\n    __jsbObj->defineFunction("readM6CrtHeap", _SE(js_readM6CrtHeap));\n#endif\n    __jsbObj->defineFunction("readM6Perf", _SE(js_readM6Perf));\n    __jsbObj->defineFunction("garbageCollect"'],
]);
const update = 'uiRendererManager.updateAllDirtyRenderers();';
instrument('cocos/game/director.ts', [[update, 'const m6Start = performance.now();\n            ' + update
    + '\n            (globalThis as any).__m6PrepareMs = performance.now() - m6Start;']]);
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
const platform = process.argv[3] || 'WINDOWS';
if (platform === 'HTML5') fs.cpSync(path.join(template, 'build/web-mobile'), path.join(project, 'build/web-mobile'), { recursive: true });
const features = ['base','2d','rich-text','mask','graphics','ui','affine-transform','custom-pipeline','custom-pipeline-builtin-scripts'];
if (platform === 'HTML5') features.push('gfx-webgl');
execFileSync(process.execPath, [path.join(source, 'scripts/spread-pal.cjs')], { cwd: source });
console.log('M6_PERF_BUILD', revision, platform);
buildEngine({ engine: source, out: path.join(project, platform === 'WINDOWS' ? 'build/windows/data/src/cocos-js' : 'build/web-mobile/cocos-js'),
    features, platform, mode: 'BUILD', flags: { DEBUG: false, NET_MODE: 0, SERVER_MODE: false },
    moduleFormat: 'system', compress: false, sourceMap: false, inlineEnum: true, nativeCodeBundleMode: 'wasm',
    targets: 'chrome 80' }).catch(error => { console.error(error); process.exitCode = 1; });
