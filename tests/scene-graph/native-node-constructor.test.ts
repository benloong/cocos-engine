import { readFileSync } from 'fs';
import { resolve } from 'path';
import ts from 'typescript';
import { Vec3, Quat } from '../../cocos/core';

test('actual Node JSB constructor preserves native initialized shared memory', () => {
    const filename = resolve(__dirname, '../../cocos/scene-graph/node.jsb.ts');
    const source = ts.createSourceFile(filename, readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
    let ctor: ts.FunctionExpression | undefined;
    source.forEachChild(node => {
        if (ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression)
            && node.expression.left.getText(source) === 'nodeProto._ctor' && ts.isFunctionExpression(node.expression.right)) ctor = node.expression.right;
    });
    expect(ctor).toBeDefined();
    const javascript = ts.transpileModule(`exports.ctor = ${ctor!.getText(source)};`, {
        compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const exported: any = {};
    const Stub = class {};
    new Function('exports', 'NodeEventProcessor', 'NodeUIProperties', 'Vec3', 'Quat', javascript)(exported, Stub, Stub, Vec3, Quat);
    for (const layer of [0, 1 << 25, 1 << 30]) {
        const memory = new ArrayBuffer(36);
        const flags = new Uint32Array(memory, 0, 3); flags.set([17, layer, 31]);
        const opacity = new Float32Array(memory, 20, 4); opacity.set([0, 0, 0.5, 0.75]);
        const before = new Uint8Array(memory).slice();
        const scene = {};
        const node: any = { _initAndReturnSharedBuffer: () => memory, getScene: () => scene };
        exported.ctor.call(node);
        expect(new Uint8Array(memory)).toEqual(before);
        expect(node._sharedUint32Arr[1]).toBe(layer);
        expect(node._scene).toBe(scene);
    }
});
