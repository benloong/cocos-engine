import { loadFont } from '../../cocos/2d/utils/font-loader';
import type { BrowserFont } from '../../cocos/2d/utils/font-loader';
import downloader from '../../cocos/asset/asset-manager/downloader';
import { TTFFont } from '../../cocos/2d/assets/ttf-font';
import { CCObject } from '../../cocos/core/data/object';

test('Web polling observes new font metrics and permits retry from the timeout callback', () => {
    jest.useFakeTimers();
    const callback = jest.fn();
    const createElement = document.createElement.bind(document);
    const nodes: HTMLElement[] = [];
    let loaded = false;
    const measuredFonts: string[] = [];
    const context = {
        font: '10px sans-serif',
        measureText: jest.fn(() => {
            measuredFonts.push(context.font);
            return { width: loaded ? 200 : 100 };
        }),
    };
    const canvas = createElement('canvas');
    const getContext = jest.spyOn(canvas, 'getContext').mockImplementation((() => context) as unknown as typeof canvas.getContext);
    const create = jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
        if (tag === 'canvas') return canvas;
        const element = createElement(tag);
        nodes.push(element);
        return element;
    }) as typeof document.createElement);

    try {
        loadFont('fonts/Web Family 3.0.ttf', {}, callback);
        const style = nodes.find((node) => node.tagName === 'STYLE')!;
        const preload = nodes.find((node) => node.tagName === 'DIV')!;
        expect(style.textContent).toBe('@font-face { font-family:"Web Family 3.0_LABEL"; src:url("fonts/Web Family 3.0.ttf");}');
        expect(preload.style.fontFamily).toBe('"Web Family 3.0_LABEL"');
        expect(measuredFonts).toEqual(['40px "Web Family 3.0_LABEL"']);
        expect(callback).not.toHaveBeenCalled();

        // Measuring again must observe the loaded font, rather than reuse a cached fallback width.
        loaded = true;
        jest.advanceTimersByTime(100);
        expect(measuredFonts).toEqual(['40px "Web Family 3.0_LABEL"', '40px "Web Family 3.0_LABEL"']);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(null, 'Web Family 3.0_LABEL');
        expect(jest.getTimerCount()).toBe(0);
        expect(preload.isConnected).toBe(false);

        const retryURL = 'fonts/Retry.ttf';
        const retry = jest.fn();
        const waiter = jest.fn();
        loaded = false;
        loadFont(retryURL, {}, () => loadFont(retryURL, {}, retry));
        const failedStyle = nodes.filter(node => node.tagName === 'STYLE').pop()!;
        loadFont(retryURL, {}, waiter);
        expect(waiter).not.toHaveBeenCalled();
        jest.advanceTimersByTime(3100);
        expect(failedStyle.isConnected).toBe(false);
        expect(waiter).toHaveBeenCalledTimes(1);
        expect(waiter).toHaveBeenCalledWith(null, 'Retry_LABEL');
        expect(retry).not.toHaveBeenCalled();
        loaded = true;
        jest.advanceTimersByTime(100);
        expect(retry).toHaveBeenCalledTimes(1);
        expect(retry).toHaveBeenCalledWith(null, 'Retry_LABEL');
        expect(jest.getTimerCount()).toBe(0);

        const owner = new TTFFont();
        let prepared: BrowserFont | null = null;
        loaded = false;
        downloader.download('polling-owner-test', 'fonts/PollingOwnerTest.ttf', '.ttf', {}, (error, data) => {
            expect(error).toBeNull();
            prepared = data;
        });
        loaded = true;
        jest.advanceTimersByTime(100);
        const ownedStyle = nodes.filter(node => node.tagName === 'STYLE').pop()!;
        expect(prepared).not.toBeNull();
        expect(ownedStyle.isConnected).toBe(false);
        owner._nativeAsset = prepared;
        expect(owner._fontFamily).toBe('PollingOwnerTest_LABEL');
        expect(ownedStyle.textContent).toContain(`font-family:"${owner._nativeAsset}"`);
        expect(ownedStyle.isConnected).toBe(true);
        owner.destroy();
        CCObject._deferredDestroy();
        expect(ownedStyle.isConnected).toBe(false);
    } finally {
        create.mockRestore();
        getContext.mockRestore();
        nodes.forEach((node) => node.remove());
        jest.useRealTimers();
    }
});
