'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const { declaration, runtimeImports, inspect, build, shellHotPaths, isWebAssembler } = require('../../native/tests/2d-poc/audit-m6.cjs');

test('component rollback removes only the selected Windows overrides and preserves Web overrides', async () => {
    const root = path.resolve(__dirname, '../..');
    const query = await require('@cocos/ccbuild').StatsQuery.create(root);
    function overrides (platform, flags) {
        const mode = 'BUILD';
        const buildTimeConstants = query.constantManager.genBuildTimeConstants({ mode, platform, flags });
        return query.evaluateModuleOverrides({ platform, mode, buildTimeConstants });
    }
    const components = { USE_JS_UI_OPACITY: 'components/ui-opacity', USE_JS_RENDER_ROOT_2D: 'framework/render-root-2d' };
    for (const selected of [['USE_JS_UI_OPACITY'], ['USE_JS_RENDER_ROOT_2D'], Object.keys(components)]) {
        const windows = overrides('WINDOWS', {});
        const flags = {};
        for (const flag of selected) {
            flags[flag] = true;
            const base = path.join(root, 'cocos/2d', components[flag]);
            assert.equal(windows[base + '.ts'], base + '.jsb.ts');
            delete windows[base + '.ts'];
        }
        assert.deepEqual(overrides('WINDOWS', flags), windows);
        assert.deepEqual(overrides('HTML5', flags), overrides('HTML5', {}));
    }
});

test('native 2D owners do not use shared_ptr or weak_ptr', () => {
    const root=path.resolve(__dirname,'../..');
    for(const {file} of build().nativeSourceHashes.filter(x=>x.file.startsWith('native/cocos/2d/')||/\/DirectWriteFont\.(h|cpp)$/.test(x.file))) {
        assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'), /\b(?:shared_ptr|weak_ptr|make_shared)\s*[<(]/, file);
    }
});

test('declaration baseline separates serialized fields from decorated accessor APIs', () => {
    const parsed = declaration('fixture.ts', `class Example extends Base {
        @serializable protected _font = null;
        @type(Font) get font(): Font { return this._font; }
        static Mode = Mode;
        private helper() {}
    }`, 'Example');
    assert.deepEqual(parsed.serialized.map(m=>m.name), ['_font']);
    assert.equal(parsed.members.find(m=>m.name==='font').kind, 'GetAccessor');
    assert.equal(parsed.members.find(m=>m.name==='helper').visibility, 'private');
    assert.equal(parsed.members.find(m=>m.name==='Mode').static, true);
    assert.deepEqual(parsed.extends, ['extends Base']);
    assert.equal(declaration('alias.ts', 'export const Example = jsb.Example;', 'Example').kind, 'native-alias');
    assert.throws(()=>declaration('broken.ts', 'class Example {', 'Example'), /Invalid TypeScript/);
    assert.throws(()=>declaration('missing.ts', 'class Other {}', 'Example'), /missing class/);
});

test('type-only imports are excluded while side effects and runtime reexports are tracked', () => {
    const source=ts.createSourceFile('fixture.ts', `
        import type {A} from './type-a';
        import {type B} from './type-b';
        export type {C} from './type-c';
        export {type F} from './type-f';
        import {} from './empty-side-effect';
        import './side-effect';
        import {type D, E} from './mixed';
        export {X} from './runtime';
        async function load() { return import('./lazy'); }
    `,ts.ScriptTarget.Latest,true);
    assert.deepEqual(runtimeImports(source), ['./empty-side-effect','./side-effect','./mixed','./runtime','./lazy']);
});

test('frame and buffer findings use syntax rather than comments or strings', () => {
    const info=inspect('fixture.ts', `// lateUpdate() { new RenderData(); }
        const text='new Float32Array(); update()';
        class Example { update() { this._native.prepare(); } api() { return new Uint16Array(3); } }
    `);
    assert.deepEqual(info.frameMethods.map(m=>m.name),['update']);
    assert.deepEqual(info.allocations.map(m=>m.type),['Uint16Array']);
    assert.deepEqual(info.nativeCalls.map(m=>m.expression),['this._native.prepare']);
});

test('current runtime gaps remain visible instead of being called a passing gate', () => {
    const report=build();
    assert.deepEqual(shellHotPaths(report), []);
    const label=report.classes.find(c=>c.name==='Label');
    assert.equal(label.overridden,true);
    assert.ok(report.limitations.some(s=>s.includes('not measured')));
    assert.ok(report.classes.some(c=>c.name==='UIRenderer'));
    assert.ok(report.classes.some(c=>c.name==='RichText'));
    for(const c of report.classes) assert.ok(c.imports.within2d.includes(c.runtime));
    assert.ok(report.entrypointImports.within2d.includes('cocos/2d/assembler/index.jsb.ts'));
    assert.deepEqual(report.entrypointImports.within2d.filter(file => /\/assembler\/(label|sprite)\//.test(file)), []);
});

test('native shell closures reject Web layout and tessellation while allowing the native Graphics bridge', () => {
    const paths = ['assembler/sprite/tiled.ts', 'assembler/label/font-utils.ts', 'assembler/graphics/webgl/earcut.ts',
        'utils/html-text-parser.ts', 'utils/text-utils.ts', 'assembler/graphics/types.ts', 'assembler/graphics/index.jsb.ts']
        .map(file => 'cocos/2d/' + file);
    const report = { classes: [{ name: 'Label', imports: { within2d: paths } }] };
    assert.deepEqual(shellHotPaths(report), paths.slice(0, 5).map(file => ({component: 'Label', file})));
    assert.equal(isWebAssembler('C:/engine/' + paths[2]), true);
    assert.equal(isWebAssembler('C:/engine/' + paths[6]), false);
});

test('shell budgets count physical lines and keep logic mixed with exclusions', () => {
    const { measure } = require('../../native/tests/2d-poc/measure-shell-lines.cjs');
    const lines = [
        '/* Copyright (c) example */', '', "import type { X } from './x';",
        "import { type X, Y } from './mixed';", 'interface A {', '    x: number;', '}',
        'type B = number; const live = 1;', 'class Shell {',
        '    /** @deprecated Use value. */', '    get old () { return this.value; }',
        '    /** @deprecated Has validation. */', '    set checked (x) { if (x) this.update(x); }',
        '    /** @deprecated */ @decorator get decorated () { return this.value; }',
        '    /** @deprecated */ alias (x) { return this.update(x); }',
        '    /** @deprecated */ aliasWithDefault (x = sideEffect()) { return this.update(x); }',
        '    /** @deprecated */ set oldValue (x) { this.value = x; }',
        '    /** @deprecated */ [key()] (x) { return this.update(x); }',
        '}', '// keep ordinary comments',
    ];
    const expected = { physical: 20, excluded: 9, counted: 11 };
    assert.deepEqual(measure('shell.ts', lines.join('\n')), expected);
    assert.deepEqual(measure('shell.ts', lines.join('\r\n') + '\r\n'), expected);
});
