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
    class Sprite {} class Label {}
    function load(file) {
        const source = fs.readFileSync(path.join(root, overrides[file]), 'utf8');
        const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
        const exports = {};
        vm.runInNewContext(output, { exports, require(id) {
            if (id === './sprite' || id === './label') return load('cocos/2d/assembler/' + id.slice(2) + '/index.ts');
            if (id === '../../components/sprite') return { Sprite };
            if (id === '../../components/label') return { Label };
            throw new Error('Unexpected native assembler runtime dependency: ' + id);
        } });
        return exports;
    }
    const exports = load('cocos/2d/assembler/index.ts');
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

test('native Graphics export forwards explicit assembler calls to its component', () => {
    const root = path.resolve(__dirname, '../..');
    const config = JSON.parse(fs.readFileSync(path.join(root, 'cc.config.json'), 'utf8'));
    const overrides = Object.assign({}, ...config.moduleOverrides.filter(entry => /NATIVE/.test(entry.test || '')).map(entry => entry.overrides));
    const file = overrides['cocos/2d/assembler/graphics/index.ts'];
    assert.equal(file, 'cocos/2d/assembler/graphics/index.jsb.ts');
    const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText;
    const exports = {};
    class Graphics {}
    vm.runInNewContext(code, { exports, require(id) {
        assert.equal(id, '../../components/graphics');
        return { Graphics };
    } });
    assert.equal(Graphics.Assembler, exports.graphicsAssembler);
    const calls = [];
    const component = {
        fill: () => calls.push('fill'), stroke: () => calls.push('stroke'),
        _markForUpdateRenderData: () => calls.push('end'), getMaterialInstance: slot => slot,
    };
    const assembler = Graphics.Assembler.getAssembler(component);
    assert.equal(assembler, exports.graphics);
    assembler.fill(component);
    assembler.stroke(component);
    assembler.end(component);
    assembler.updateRenderData(component);
    component.renderData = {};
    assembler.updateRenderData(component);
    assert.equal(component.renderData.material, 0);
    assert.deepEqual(calls, ['fill', 'stroke', 'end']);
});
