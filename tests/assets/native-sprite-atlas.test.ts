import { cclegacy, js } from '../../cocos/core';

const assetCtor = jest.fn();
const nativeAddSpriteFrame = jest.fn();
const nativeRemoveSpriteFrame = jest.fn();
const nativeClear = jest.fn();

class NativeAtlas {
    constructor () {
        (this as any)._ctor();
    }
}

Object.assign(NativeAtlas.prototype, {
    addSpriteFrame: nativeAddSpriteFrame,
    removeSpriteFrame: nativeRemoveSpriteFrame,
    clear: nativeClear,
});

beforeAll(() => {
    (global as any).jsb = {
        Asset: { prototype: { _ctor: assetCtor } },
        SpriteAtlas: NativeAtlas,
    };
});

test('SpriteAtlas patches the native constructor and initializes independent frame maps', () => {
    const { SpriteAtlas } = require('../../cocos/2d/assets/sprite-atlas.jsb');
    const atlas = new SpriteAtlas();
    const other = new SpriteAtlas();

    expect(SpriteAtlas).toBe(NativeAtlas);
    expect(cclegacy.SpriteAtlas).toBe(NativeAtlas);
    expect(js.getClassById('cc.SpriteAtlas')).toBe(NativeAtlas);
    expect(Object.getPrototypeOf(atlas)).toBe(NativeAtlas.prototype);
    expect(assetCtor.mock.instances).toContain(atlas);
    atlas.spriteFrames.empty = null;
    expect(other.spriteFrames).toEqual({});
});

test('SpriteAtlas forwards mutations to native methods on the same instance', () => {
    const { SpriteAtlas } = require('../../cocos/2d/assets/sprite-atlas.jsb');
    const atlas = new SpriteAtlas();
    const texture = {};
    const frame = { name: '', texture };

    atlas.addSpriteFrame('hero', frame);
    expect(nativeAddSpriteFrame).toHaveBeenLastCalledWith('hero', frame);
    expect(nativeAddSpriteFrame.mock.instances).toContain(atlas);
    expect(atlas.getSpriteFrame('hero')).toBe(frame);
    expect(frame.name).toBe('hero');
    expect(atlas.getSpriteFrames()).toEqual([frame]);
    expect(atlas.getTexture()).toBe(texture);

    atlas.removeSpriteFrame('hero');
    expect(nativeRemoveSpriteFrame).toHaveBeenLastCalledWith('hero');
    expect(nativeRemoveSpriteFrame.mock.instances).toContain(atlas);
    expect(atlas.getSpriteFrame('hero')).toBeNull();
    atlas.addSpriteFrame('hero', frame);
    atlas.clear();
    expect(nativeClear).toHaveBeenLastCalledWith();
    expect(nativeClear.mock.instances).toContain(atlas);
    expect(atlas.getSpriteFrames()).toEqual([]);
    expect(atlas.getTexture()).toBeNull();
});

test('SpriteAtlas deserializes frame references into the JS map', () => {
    const { SpriteAtlas } = require('../../cocos/2d/assets/sprite-atlas.jsb');
    const atlas = new SpriteAtlas();
    const push = jest.fn();
    atlas.spriteFrames.old = null;
    atlas._deserialize({ name: 'atlas', spriteFrames: ['hero', 'frame-uuid'] }, { result: { push } });

    expect(atlas._name).toBe('atlas');
    expect(atlas.spriteFrames).toEqual({});
    expect(push).toHaveBeenCalledWith(atlas.spriteFrames, 'hero', 'frame-uuid', 'cc.SpriteFrame');
});
