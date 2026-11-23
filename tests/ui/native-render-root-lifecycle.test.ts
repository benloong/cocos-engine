import { readFileSync } from 'fs';
import { resolve } from 'path';
import ts from 'typescript';
import { Node } from '../../cocos/scene-graph/node';
import { Batcher2D } from '../../cocos/2d/renderer/batcher-2d';
import { UIRendererManager } from '../../cocos/2d/framework/ui-renderer-manager';
import * as constants from 'internal:constants';

const rootFilename = resolve(__dirname, '../../cocos/root.jsb.ts');
const rootSource = ts.createSourceFile(rootFilename, readFileSync(rootFilename, 'utf8'), ts.ScriptTarget.Latest, true);

test('native RenderRoot2D creates one backend and detaches it through disable/destroy', () => {
    const backend = { setNode: jest.fn(), setEnabled: jest.fn() };
    const create = jest.fn(() => backend);
    (global as any).n2d = { RenderRoot2D: create };
    const { RenderRoot2D } = require('../../cocos/2d/framework/render-root-2d.jsb');
    const node = new Node('root-lifecycle');
    const root: any = node.addComponent(RenderRoot2D);
    root.onLoad(); root.onLoad();
    expect(create).toHaveBeenCalledTimes(1);
    expect(backend.setNode).toHaveBeenLastCalledWith(node);
    root.onEnable(); root.onEnable();
    expect(backend.setEnabled).toHaveBeenLastCalledWith(true);
    root.onDisable();
    expect(backend.setEnabled).toHaveBeenLastCalledWith(false);
    root.onDestroy();
    expect(backend.setNode).toHaveBeenLastCalledWith(null);
    const calls = backend.setEnabled.mock.calls.length;
    root.onEnable(); root.onDisable(); root.onDestroy();
    expect(backend.setEnabled).toHaveBeenCalledTimes(calls);
    node._destroyImmediate();
});

test('Web batcher sorts roots by sibling index', () => {
    const batcher: any = Object.create(Batcher2D.prototype);
    batcher._screens = [];
    const first = { node: { siblingIndex: 2 } }, second = { node: { siblingIndex: 1 } };
    batcher.addScreen(first); batcher.addScreen(second);
    expect(batcher._screens).toEqual([second, first]);
    first.node.siblingIndex = 0;
    batcher.sortScreens();
    expect(batcher._screens).toEqual([first, second]);
    batcher.removeScreen(first); batcher.removeScreen(first);
    expect(batcher._screens).toEqual([second]);
});

test('native sortScreens sorts the live registry without replacing it from the empty JS screen list', () => {
    let createBatcher: ts.FunctionExpression | undefined;
    rootSource.forEachChild((statement) => {
        if (ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression)
            && statement.expression.left.getText(rootSource) === 'rootProto._createBatcher2D'
            && ts.isFunctionExpression(statement.expression.right)) {
            createBatcher = statement.expression.right;
        }
    });
    expect(createBatcher).toBeDefined();
    const javascript = ts.transpileModule(`exports.create = ${createBatcher!.getText(rootSource)};`, {
        compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const exported: any = {};
    const original = constants.JSB;
    (constants as any).JSB = true;
    const batcher: any = Object.create(Batcher2D.prototype);
    batcher._screens = [];
    const nativeBatcher = { sortRootNodes: jest.fn(), syncRootNodesToNative: jest.fn() };
    const root = { _batcher: null, getBatcher2D: () => nativeBatcher };
    try {
        new Function('exports', 'cclegacy', javascript)(exported, { internal: { Batcher2D: jest.fn(() => batcher) } });
        exported.create.call(root);
        expect(root._batcher).toBe(batcher);
        batcher.sortScreens();
        expect(nativeBatcher.sortRootNodes).toHaveBeenCalledTimes(1);
        expect(nativeBatcher.syncRootNodesToNative).not.toHaveBeenCalled();
        const screen = { node: { siblingIndex: 0 } };
        batcher.addScreen(screen);
        batcher.addScreen(screen);
        expect(batcher._screens).toEqual([screen]);
        expect(nativeBatcher.syncRootNodesToNative).toHaveBeenCalledTimes(1);
    } finally {
        (constants as any).JSB = original;
    }
});

test('Root JSB flushes native renderers after the TS queue and before submitting each frame', () => {
    const frameStatements = rootSource.statements.filter((statement) => {
        if (ts.isVariableStatement(statement)) {
            return statement.declarationList.declarations.some(({ name }) => ts.isIdentifier(name)
                && (name.text === 'nativeUIRendererManager' || name.text === 'oldFrameMove'));
        }
        return ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression)
            && statement.expression.left.getText(rootSource) === 'rootProto.frameMove';
    });
    expect(frameStatements).toHaveLength(3);
    const javascript = ts.transpileModule(frameStatements.map(statement => statement.getText(rootSource)).join('\n'), {
        compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS },
    }).outputText;

    const calls: string[] = [];
    const nativeManager = { updateAllDirtyRenderers: jest.fn(() => { calls.push('native'); }) };
    const createNativeManager = jest.fn(() => nativeManager);
    const submitFrame = jest.fn((_deltaTime: number, _frame?: number) => { calls.push('frame'); });
    const rootProto = { frameMove: submitFrame };
    const cclegacy = { director: { getTotalFrames: jest.fn().mockReturnValueOnce(7).mockReturnValueOnce(8) } };
    new Function('rootProto', 'NativeUIRendererManager', 'cclegacy', javascript)(rootProto, createNativeManager, cclegacy);

    const shared = new UIRendererManager();
    const renderer = {
        _internalId: -1,
        _dirtyVersion: -1,
        updateRenderer: () => { calls.push('ts'); },
    } as unknown as Parameters<UIRendererManager['addRenderer']>[0];
    shared.addRenderer(renderer);
    shared.markDirtyRenderer(renderer);
    shared.updateAllDirtyRenderers();
    expect(calls).toEqual(['ts']);
    rootProto.frameMove(0.25);
    expect(calls).toEqual(['ts', 'native', 'frame']);

    shared.updateAllDirtyRenderers();
    rootProto.frameMove(0.5);
    expect(calls).toEqual(['ts', 'native', 'frame', 'native', 'frame']);
    expect(createNativeManager).toHaveBeenCalledTimes(1);
    expect(submitFrame).toHaveBeenNthCalledWith(1, 0.25, 7);
    expect(submitFrame).toHaveBeenNthCalledWith(2, 0.5, 8);
});
