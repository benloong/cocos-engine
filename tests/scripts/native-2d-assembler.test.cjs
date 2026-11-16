'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('native assembler managers forward updates without loading Web assemblers', () => {
    const root = path.resolve(__dirname, '../..');
    const config = JSON.parse(fs.readFileSync(path.join(root, 'cc.config.json'), 'utf8'));
    const overrides = Object.assign({}, ...config.moduleOverrides.filter(e => /NATIVE/.test(e.test || '')).map(e => e.overrides));
    assert.equal(overrides['cocos/2d/assembler/index.ts'], 'cocos/2d/assembler/index.jsb.ts');
    const source = fs.readFileSync(path.join(root, overrides['cocos/2d/assembler/index.ts']), 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    class Sprite {} class Label {}
    const exports = {};
    vm.runInNewContext(output, { exports, require(id) {
        if (id === '../components/sprite') return { Sprite };
        if (id === '../components/label') return { Label };
        throw new Error('Unexpected native assembler runtime dependency: ' + id);
    } });
    assert.equal(Sprite.Assembler, exports.spriteAssembler);
    assert.equal(Label.Assembler, exports.labelAssembler);
    const calls = [];
    const comp = { color: { r: 12, g: 34, b: 56, a: 78 }, _native: {
        setDirty: () => calls.push('dirty'),
        updateRenderData: () => calls.push('label'),
        setColorRGBA: (...args) => calls.push(args),
    } };
    const sprite = Sprite.Assembler.getAssembler(comp), label = Label.Assembler.getAssembler(comp);
    sprite.updateRenderData(comp); sprite.updateUVs(comp); sprite.updateColor(comp);
    label.updateRenderData(comp); label.updateColor(comp);
    assert.deepEqual(calls, ['dirty', 'dirty', [12, 34, 56, 78], 'label', [12, 34, 56, 78]]);
    assert.notEqual(sprite, label);
    comp._native = null;
    sprite.updateRenderData(comp); sprite.updateUVs(comp); sprite.updateColor(comp);
    label.updateRenderData(comp); label.updateColor(comp);
    assert.equal(calls.length, 5);
});
