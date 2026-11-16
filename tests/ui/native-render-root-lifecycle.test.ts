import { Node } from '../../cocos/scene-graph/node';
import { Batcher2D } from '../../cocos/2d/renderer/batcher-2d';
import * as constants from 'internal:constants';

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

test('Web batcher deduplicates root registration and sorts by sibling index', () => {
    const batcher: any = Object.create(Batcher2D.prototype);
    batcher._screens = [];
    const first = { node: { siblingIndex: 2 } }, second = { node: { siblingIndex: 1 } };
    batcher.addScreen(first); batcher.addScreen(second); batcher.addScreen(first);
    expect(batcher._screens).toEqual([second, first]);
    first.node.siblingIndex = 0;
    batcher.sortScreens();
    expect(batcher._screens).toEqual([first, second]);
    batcher.removeScreen(first); batcher.removeScreen(first);
    expect(batcher._screens).toEqual([second]);
});

test('native sortScreens sorts the live registry without replacing it from the empty JS screen list', () => {
    const original = constants.JSB;
    (constants as any).JSB = true;
    const batcher: any = Object.create(Batcher2D.prototype);
    batcher._screens = [];
    batcher._nativeObj = { sortRootNodes: jest.fn(), syncRootNodesToNative: jest.fn() };
    try {
        batcher.sortScreens();
        expect(batcher._nativeObj.sortRootNodes).toHaveBeenCalledTimes(1);
        expect(batcher._nativeObj.syncRootNodesToNative).not.toHaveBeenCalled();
    } finally {
        (constants as any).JSB = original;
    }
});
