import { getFontFamily, loadFont } from '../../cocos/2d/utils/font-loader';
import factory from '../../cocos/asset/asset-manager/factory';
import { assets } from '../../cocos/asset/asset-manager/shared';
import { TTFFont } from '../../cocos/2d/assets/ttf-font';

test.each([
    ['fonts/Alibaba PuHuiTi 3.0.ttf', 'Alibaba PuHuiTi 3.0_LABEL'],
    ['fonts/Font3.0.ttf', 'Font3.0_LABEL'],
    ['fonts/A,B.ttf', 'A,B_LABEL'],
])('Web loader returns a raw alias for %s', (url, expected) => {
    expect(getFontFamily(url)).toBe(expected);
});

test('font creation failure releases the partial asset, reports an error and permits retry', () => {
    const failure = new Error('native font assignment failed');
    let partial: TTFFont | undefined;
    const setter = jest.spyOn(TTFFont.prototype, '_nativeAsset', 'set').mockImplementation(function () {
        partial = this;
        throw failure;
    });
    const destroy = jest.spyOn(TTFFont.prototype, 'destroy');
    const complete = jest.fn();
    try {
        factory.create('font-factory-retry.ttf', 'Retry_LABEL', '.ttf', { cacheAsset: false }, complete);
        expect(complete).toHaveBeenCalledTimes(1);
        expect(complete).toHaveBeenCalledWith(failure, null);
        expect(destroy).toHaveBeenCalledTimes(1);
        expect(destroy.mock.instances[0]).toBe(partial);
        expect(assets.has('font-factory-retry.ttf')).toBe(false);
    } finally {
        setter.mockRestore(); destroy.mockRestore();
    }
    const retried = jest.fn();
    factory.create('font-factory-retry.ttf', 'Retry_LABEL', '.ttf', { cacheAsset: false }, retried);
    expect(retried).toHaveBeenCalledTimes(1);
    expect(retried.mock.calls[0][0]).toBeNull();
    expect(retried.mock.calls[0][1]._nativeAsset).toBe('Retry_LABEL');
    retried.mock.calls[0][1].destroy();
});

test('a native font without loaded bytes is rejected and released rather than cached as a success', () => {
    Object.defineProperty(TTFFont.prototype, 'getFontDataSize', { configurable: true, value: () => 0 });
    const destroy = jest.spyOn(TTFFont.prototype, 'destroy'), complete = jest.fn();
    try {
        factory.create('missing-native-font.ttf', 'Missing_LABEL', '.ttf', { cacheAsset: false }, complete);
        expect(complete).toHaveBeenCalledTimes(1);
        expect(complete.mock.calls[0][0]).toBeInstanceOf(Error);
        expect(complete.mock.calls[0][0].message).toContain('missing-native-font.ttf');
        expect(complete.mock.calls[0][1]).toBeNull();
        expect(destroy).toHaveBeenCalledTimes(1);
        expect(assets.has('missing-native-font.ttf')).toBe(false);
    } finally {
        Reflect.deleteProperty(TTFFont.prototype, 'getFontDataSize'); destroy.mockRestore();
    }
});

test('Web registration and FontFaceSet loading share one CSS family and return a raw alias', async () => {
    jest.useFakeTimers();
    const faceDescriptor = Object.getOwnPropertyDescriptor(window, 'FontFace');
    const fontsDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
    const load = jest.fn().mockResolvedValue([{}]);
    Object.defineProperty(window, 'FontFace', { value: class {}, configurable: true });
    Object.defineProperty(document, 'fonts', { value: { load }, configurable: true });
    const callback = jest.fn();
    const createElement = document.createElement.bind(document);
    const nodes: HTMLElement[] = [];
    const canvas = createElement('canvas');
    const getContext = jest.spyOn(canvas, 'getContext').mockImplementation((() => ({})) as unknown as typeof canvas.getContext);
    const create = jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
        if (tag === 'canvas') return canvas;
        const element = createElement(tag);
        nodes.push(element);
        return element;
    }) as typeof document.createElement);

    try {
        await new Promise<void>((resolve, reject) => {
            loadFont('fonts/Web Family 3.0.ttf', {}, (error, family) => {
                if (error) {
                    reject(error);
                    return;
                }
                callback(family);
                resolve();
            });
        });
        const style = nodes.find((node) => node.tagName === 'STYLE')!;
        const preload = nodes.find((node) => node.tagName === 'DIV')!;
        expect(style.textContent).toBe('@font-face { font-family:"Web Family 3.0_LABEL"; src:url("fonts/Web Family 3.0.ttf");}');
        expect(preload.style.fontFamily).toBe('"Web Family 3.0_LABEL"');
        expect(load).toHaveBeenCalledWith('40px "Web Family 3.0_LABEL"');
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('Web Family 3.0_LABEL');
        expect(jest.getTimerCount()).toBe(0);
    } finally {
        create.mockRestore();
        getContext.mockRestore();
        nodes.forEach((node) => node.remove());
        if (faceDescriptor) Object.defineProperty(window, 'FontFace', faceDescriptor);
        else Reflect.deleteProperty(window, 'FontFace');
        if (fontsDescriptor) Object.defineProperty(document, 'fonts', fontsDescriptor);
        else Reflect.deleteProperty(document, 'fonts');
        jest.useRealTimers();
    }
});
