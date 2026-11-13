import { Rect, Size, Vec2 } from '../../cocos/core';

class NativeFrame {}
for (const method of ['setTexture', 'setRect', 'setOriginalSize', 'setOffset', 'setRotated', 'setInsets']) {
    (NativeFrame.prototype as any)[method] = jest.fn();
}
const nativeFrame = new NativeFrame();

beforeAll(() => {
    (global as any).jsb = {
        Asset: class {},
        SpriteFrame: NativeFrame,
    };
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

    const native = frame.native;
    expect(native).toBe(frame);
    expect(nativeFrame.setTexture).toHaveBeenLastCalledWith(texture);
    expect(nativeFrame.setRect).toHaveBeenLastCalledWith(1, 2, 3, 4);
    expect(nativeFrame.setOriginalSize).toHaveBeenLastCalledWith(5, 6);
    expect(nativeFrame.setOffset).toHaveBeenLastCalledWith(7, 8);
    expect(nativeFrame.setRotated).toHaveBeenLastCalledWith(true);
    expect(nativeFrame.setInsets).toHaveBeenLastCalledWith(10, 20, 30, 40);
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
