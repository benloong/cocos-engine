'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const { declaration, runtimeImports, inspect, build } = require('../../native/tests/2d-poc/audit-m6.cjs');

test('native 2D owners do not use shared_ptr or weak_ptr', () => {
    const root=path.resolve(__dirname,'../..');
    for(const {file} of build().nativeSourceHashes.filter(x=>x.file.startsWith('native/cocos/2d/'))) {
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
        import './side-effect';
        import {type D, E} from './mixed';
        export {X} from './runtime';
    `,ts.ScriptTarget.Latest,true);
    assert.deepEqual(runtimeImports(source), ['./side-effect','./mixed','./runtime']);
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
    const label=report.classes.find(c=>c.name==='Label');
    assert.equal(label.overridden,true);
    assert.ok(report.limitations.some(s=>s.includes('not measured')));
    assert.ok(report.classes.some(c=>c.name==='UIRenderer'));
    assert.ok(report.classes.some(c=>c.name==='RichText'));
    for(const c of report.classes) assert.ok(c.imports.within2d.includes(c.runtime));
    assert.ok(report.entrypointImports.within2d.includes('cocos/2d/assembler/index.jsb.ts'));
    assert.deepEqual(report.entrypointImports.within2d.filter(file => /\/assembler\/(label|sprite)\//.test(file)), []);
});
