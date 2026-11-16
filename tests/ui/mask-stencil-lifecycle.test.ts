import * as constants from 'internal:constants';
import { Batcher2D, _setSorting2DCount } from '../../cocos/2d/renderer/batcher-2d';
import { Stage, StencilManager } from '../../cocos/2d/renderer/stencil-manager';

test.each([
    [Stage.ENTER_LEVEL, 0], [Stage.ENTER_LEVEL_INVERTED, 0],
    [Stage.ENTER_LEVEL, 1], [Stage.ENTER_LEVEL_INVERTED, 1],
])('empty nested mask preserves enclosing stencil level: stage=%s sorting=%s', (stage, sorting) => {
    const previous = StencilManager.sharedManager;
    const previousSorting = constants.USE_SORTING_2D;
    (constants as any).USE_SORTING_2D = true;
    _setSorting2DCount(sorting);
    const stencil = StencilManager.sharedManager = new StencilManager();
    const depths: number[] = [];
    const renderer = (mask: boolean, draws: boolean) => ({
        stencilStage: mask ? stage : Stage.DISABLED,
        color: { a: 255 }, enabledInHierarchy: true, draws,
        postUpdateAssembler: jest.fn(),
    });
    const node = (render, children = []) => ({
        activeInHierarchy: true, children, _static: false,
        _uiProps: { uiComp: render, localOpacity: 1, colorDirty: false, setOpacity: jest.fn() },
    });
    const batcher: any = Object.create(Batcher2D.prototype);
    batcher._pOpacity = 1;
    batcher._opacityDirty = 0;
    batcher.autoMergeBatches = jest.fn();
    batcher.resetRenderStates = jest.fn();
    batcher._handleUIRenderer = (render) => {
        if (render.stencilStage === stage && render.draws) stencil.pushMask(1);
        if (render.stencilStage === Stage.DISABLED) depths.push(stencil.getMaskStackSize());
    };
    const queue: any[] = [];
    batcher._recordUIRenderer = (render) => queue.push(render);
    batcher._flushRecordedUIRenderers = () => {
        for (const render of queue.splice(0)) batcher._handleUIRenderer(render);
    };
    const content = () => node(renderer(false, true));
    const empty = node(renderer(true, false), [content()]);
    const outer = node(renderer(true, true), [empty, content()]);
    try {
        batcher.walk(outer);
        expect(depths).toEqual([1, 1]);
        expect(stencil.getMaskStackSize()).toBe(0);
    } finally {
        StencilManager.sharedManager = previous;
        (constants as any).USE_SORTING_2D = previousSorting;
        _setSorting2DCount(0);
    }
});
