import { cclegacy, Rect, Size, Vec2 } from '../../cocos/core';

class NativeFrame {
    constructor () {
        (this as any)._ctor();
    }
}
const nativeMethods: Record<string, jest.Mock> = {};
for (const method of ['setTexture', 'setRect', 'setOriginalSize', 'setOffset', 'setRotated', 'setInsets']) {
    nativeMethods[method] = jest.fn();
    (NativeFrame.prototype as any)[method] = nativeMethods[method];
}

const assetCtor = jest.fn();

beforeAll(() => {
    (global as any).jsb = {
        Asset: { prototype: { _ctor: assetCtor } },
        SpriteFrame: NativeFrame,
    };
});

beforeEach(() => {
    jest.clearAllMocks();
});

test('SpriteFrame thin shell forwards frame data to native', () => {
    const { SpriteFrame } = require('../../cocos/2d/assets/sprite-frame.jsb') as typeof import('../../cocos/2d/assets/sprite-frame.jsb');
    const frame = new SpriteFrame();
    const texture = { width: 128, height: 256 } as any;

    frame.texture = texture;
    frame.rect = new Rect(1, 2, 3, 4);
    frame.originalSize = new Size(5, 6);
    frame.offset = new Vec2(7, 8);
    frame.rotated = true;
    frame.insetLeft = 10;
    frame.insetRight = 20;
    frame.insetTop = 30;
    frame.insetBottom = 40;

    expect(frame).toBeInstanceOf(NativeFrame);
    expect('native' in frame).toBe(false);
    expect(nativeMethods.setTexture).toHaveBeenLastCalledWith(texture);
    expect(nativeMethods.setRect).toHaveBeenLastCalledWith(1, 2, 3, 4);
    expect(nativeMethods.setOriginalSize).toHaveBeenLastCalledWith(5, 6);
    expect(nativeMethods.setOffset).toHaveBeenLastCalledWith(7, 8);
    expect(nativeMethods.setRotated).toHaveBeenLastCalledWith(true);
    expect(nativeMethods.setInsets).toHaveBeenLastCalledWith(10, 20, 30, 40);
    expect(nativeMethods.setTexture).toHaveBeenCalledTimes(1);
    expect(nativeMethods.setRect).toHaveBeenCalledTimes(1);
    expect(nativeMethods.setOriginalSize).toHaveBeenCalledTimes(1);
    expect(nativeMethods.setOffset).toHaveBeenCalledTimes(1);
    expect(nativeMethods.setRotated).toHaveBeenCalledTimes(1);
    expect(nativeMethods.setInsets).toHaveBeenCalledTimes(4);
});

test.each([
    ['texture', null, 'setTexture', [null]],
    ['rect', new Rect(1, 2, 3, 4), 'setRect', [1, 2, 3, 4]],
    ['originalSize', new Size(5, 6), 'setOriginalSize', [5, 6]],
    ['offset', new Vec2(7, 8), 'setOffset', [7, 8]],
    ['rotated', true, 'setRotated', [true]],
    ['insetLeft', 10, 'setInsets', [10, 0, 0, 0]],
    ['insetRight', 20, 'setInsets', [0, 20, 0, 0]],
    ['insetTop', 30, 'setInsets', [0, 0, 30, 0]],
    ['insetBottom', 40, 'setInsets', [0, 0, 0, 40]],
])('setting %s only synchronizes its native field', (property, value, method, args) => {
    const { SpriteFrame } = require('../../cocos/2d/assets/sprite-frame.jsb');
    const frame = new SpriteFrame();
    frame[property] = value;

    for (const name of Object.keys(nativeMethods)) {
        expect(nativeMethods[name]).toHaveBeenCalledTimes(name === method ? 1 : 0);
    }
    expect(nativeMethods[method]).toHaveBeenCalledWith(...args);
});

test('reset batches native updates and keeps the existing value objects', () => {
    const { SpriteFrame } = require('../../cocos/2d/assets/sprite-frame.jsb');
    const frame = new SpriteFrame();
    const rect = frame.rect;
    const size = frame.originalSize;
    const offset = frame.offset;
    const texture = { width: 128, height: 256 };

    frame.reset({ texture, rect: new Rect(1, 2, 3, 4), originalSize: new Size(5, 6),
        offset: new Vec2(7, 8), isRotate: true, borderLeft: 10, borderRight: 20, borderTop: 30, borderBottom: 40 }, true);

    expect(frame.rect).toBe(rect);
    expect(frame.originalSize).toBe(size);
    expect(frame.offset).toBe(offset);
    expect(nativeMethods.setTexture).toHaveBeenLastCalledWith(texture);
    expect(nativeMethods.setRect).toHaveBeenLastCalledWith(1, 2, 3, 4);
    expect(nativeMethods.setOriginalSize).toHaveBeenLastCalledWith(5, 6);
    expect(nativeMethods.setOffset).toHaveBeenLastCalledWith(7, 8);
    expect(nativeMethods.setRotated).toHaveBeenLastCalledWith(true);
    expect(nativeMethods.setInsets).toHaveBeenLastCalledWith(10, 20, 30, 40);
    for (const method of Object.values(nativeMethods)) {
        expect(method).toHaveBeenCalledTimes(1);
    }

    frame.reset();
    expect(frame.texture).toBe(texture);
    expect(frame.rect).toEqual(new Rect());
    expect(frame.originalSize).toEqual(new Size());
    expect(frame.offset).toEqual(new Vec2());
    expect(frame.rotated).toBe(false);
    expect(nativeMethods.setInsets).toHaveBeenLastCalledWith(0, 0, 0, 0);
});

test('SpriteFrame patches the native constructor and initializes independent instance state', () => {
    const { SpriteFrame } = require('../../cocos/2d/assets/sprite-frame.jsb') as typeof import('../../cocos/2d/assets/sprite-frame.jsb');
    const frame = new SpriteFrame();
    const other = new SpriteFrame();

    expect(SpriteFrame).toBe(NativeFrame);
    expect(cclegacy.SpriteFrame).toBe(NativeFrame);
    expect(Object.getPrototypeOf(frame)).toBe(NativeFrame.prototype);
    expect(assetCtor).toHaveBeenCalled();
    expect(assetCtor.mock.instances).toContain(frame);
    frame.setRect(new Rect(1, 2, 3, 4));
    frame.setOriginalSize(new Size(5, 6));
    frame.setOffset(new Vec2(7, 8));
    frame.setRotated(true);
    frame.insetLeft = 9;
    frame.pivot = new Vec2(0, 1);
    frame.uv.push(1);

    expect(other.rect).toEqual(new Rect());
    expect(other.originalSize).toEqual(new Size());
    expect(other.offset).toEqual(new Vec2());
    expect(other.rotated).toBe(false);
    expect(other.insetLeft).toBe(0);
    expect(other.pivot).toEqual(new Vec2(0.5, 0.5));
    expect(other.uv).toEqual([]);
    expect(nativeMethods.setRect).toHaveBeenLastCalledWith(1, 2, 3, 4);
    expect(nativeMethods.setRotated).toHaveBeenLastCalledWith(true);
});

test('SpriteFrame thin shell keeps serialized fields', () => {
    const { SpriteFrame } = require('../../cocos/2d/assets/sprite-frame.jsb') as typeof import('../../cocos/2d/assets/sprite-frame.jsb');
    const frame = new SpriteFrame();
    frame._deserialize({
        name: 'frame',
        rect: { x: 1, y: 2, width: 3, height: 4 },
        offset: { x: 5, y: 6 },
        originalSize: { width: 7, height: 8 },
        rotated: true,
        capInsets: [9, 10, 11, 12],
        packable: false,
        pixelsToUnit: 100,
        pivot: { x: 0.5, y: 0.5 },
        meshType: 0,
    });
    expect(frame.width).toBe(3);
    expect(frame.height).toBe(4);
    expect(frame.insetLeft).toBe(9);
    expect(frame.insetTop).toBe(10);
    expect(frame.insetRight).toBe(11);
    expect(frame.insetBottom).toBe(12);
    const data = frame._serialize();
    expect(data.rect).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    expect(data.rotated).toBe(true);
});
