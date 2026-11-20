import { getFontFamily, loadFont } from '../../cocos/2d/utils/font-loader';
import type { BrowserFont } from '../../cocos/2d/utils/font-loader';
import downloader from '../../cocos/asset/asset-manager/downloader';
import factory from '../../cocos/asset/asset-manager/factory';
import { assets } from '../../cocos/asset/asset-manager/shared';
import { TTFFont } from '../../cocos/2d/assets/ttf-font';
import { CCObject } from '../../cocos/core/data/object';

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

test('Web registers only the successful font face when a timed-out request is retried', async () => {
    jest.useFakeTimers();
    const faceDescriptor = Object.getOwnPropertyDescriptor(window, 'FontFace');
    const fontsDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
    const add = jest.fn();
    const loads: Array<() => void> = [];
    const faces: Array<{ family: string; source: string }> = [];
    class TestFace {
        constructor (public family: string, public source: string) { faces.push(this); }
        load (): Promise<void> { return new Promise(resolve => loads.push(resolve)); }
    }
    Object.defineProperty(window, 'FontFace', { value: TestFace, configurable: true });
    Object.defineProperty(document, 'fonts', { value: { add }, configurable: true });
    try {
        const url = 'fonts/Web Family 3.0.ttf';
        const fallback = jest.fn();
        loadFont(url, {}, fallback);
        jest.advanceTimersByTime(3100);
        expect(fallback).toHaveBeenCalledWith(null, 'Web Family 3.0_LABEL');

        const retry = jest.fn(), waiter = jest.fn();
        loadFont(url, {}, retry);
        loadFont(url, {}, waiter);
        expect(faces).toHaveLength(2);
        loads[0]();
        await Promise.resolve();
        expect(add).not.toHaveBeenCalled();
        loads[1]();
        await Promise.resolve();
        expect(faces[1]).toEqual({ family: 'Web Family 3.0_LABEL', source: 'url("fonts/Web Family 3.0.ttf")' });
        expect(add).toHaveBeenCalledTimes(1);
        expect(add).toHaveBeenCalledWith(faces[1]);
        for (const callback of [fallback, retry, waiter]) {
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(null, 'Web Family 3.0_LABEL');
        }
        expect(jest.getTimerCount()).toBe(0);
    } finally {
        if (faceDescriptor) Object.defineProperty(window, 'FontFace', faceDescriptor);
        else Reflect.deleteProperty(window, 'FontFace');
        if (fontsDescriptor) Object.defineProperty(document, 'fonts', fontsDescriptor);
        else Reflect.deleteProperty(document, 'fonts');
        jest.useRealTimers();
    }
});

test('Web font assets share one registration and can reuse preloaded data after release', async () => {
    const faceDescriptor = Object.getOwnPropertyDescriptor(window, 'FontFace');
    const fontsDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
    const add = jest.fn(), remove = jest.fn();
    class TestFace { load (): Promise<void> { return Promise.resolve(); } }
    Object.defineProperty(window, 'FontFace', { value: TestFace, configurable: true });
    Object.defineProperty(document, 'fonts', { value: { add, delete: remove }, configurable: true });
    try {
        const download = (id: string, url = 'fonts/BundleOwnerTest.ttf'): Promise<BrowserFont> => new Promise((resolve, reject) => {
            downloader.download(id, url, '.ttf', {},
                (error, content) => error ? reject(error) : resolve(content));
        });
        const data = await download('bundle-owner-test');
        const first = new TTFFont();
        const second = new TTFFont();
        first._nativeAsset = data;
        second._nativeAsset = data;
        expect(second._fontFamily).toBe('BundleOwnerTest_LABEL');
        expect(second._nativeAsset).toBe(data.family);
        expect(add).toHaveBeenCalledTimes(1);
        first.destroy();
        CCObject._deferredDestroy();
        expect(remove).not.toHaveBeenCalled();
        second.destroy();
        CCObject._deferredDestroy();
        expect(remove).toHaveBeenCalledTimes(1);
        expect(remove).toHaveBeenLastCalledWith(add.mock.calls[0][0]);

        const reloaded = new TTFFont();
        reloaded._nativeAsset = data;
        expect(add).toHaveBeenCalledTimes(2);
        expect(add).toHaveBeenLastCalledWith(add.mock.calls[0][0]);
        reloaded.destroy();
        CCObject._deferredDestroy();
        reloaded._nativeAsset = data;
        expect(remove).toHaveBeenCalledTimes(2);
        expect(add).toHaveBeenCalledTimes(2);

        const [fresh, other, waiter] = await Promise.all([
            download('fresh-owner'), download('other-owner', 'other/BundleOwnerTest.ttf'), download('same-source-waiter'),
        ]);
        expect(waiter).toBe(fresh);
        const current = new TTFFont(), stale = new TTFFont(), independent = new TTFFont();
        current._nativeAsset = fresh;
        stale._nativeAsset = data;
        independent._nativeAsset = other;
        expect(stale._nativeAsset).toBe(current._nativeAsset);
        expect(current._nativeAsset).not.toBe(data.family);
        expect(independent._fontFamily).toBe(current._fontFamily);
        expect(independent._nativeAsset).not.toBe(current._nativeAsset);
        expect(add).toHaveBeenCalledTimes(4);
        current.destroy();
        CCObject._deferredDestroy();
        expect(remove).toHaveBeenCalledTimes(2);
        stale.destroy();
        CCObject._deferredDestroy();
        expect(remove).toHaveBeenCalledTimes(3);
        expect(remove).toHaveBeenLastCalledWith(add.mock.calls[2][0]);
        independent.destroy();
        CCObject._deferredDestroy();
        expect(remove).toHaveBeenCalledTimes(4);
        expect(remove).toHaveBeenLastCalledWith(add.mock.calls[3][0]);
    } finally {
        if (faceDescriptor) Object.defineProperty(window, 'FontFace', faceDescriptor);
        else Reflect.deleteProperty(window, 'FontFace');
        if (fontsDescriptor) Object.defineProperty(document, 'fonts', fontsDescriptor);
        else Reflect.deleteProperty(document, 'fonts');
    }
});
