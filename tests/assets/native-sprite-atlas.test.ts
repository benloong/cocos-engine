import { cclegacy, js } from '../../cocos/core';
import { Details } from '../../cocos/serialization/deserialize';

const assetCtor = jest.fn();
class NativeFrame {
    name = '';
    texture: any;
    constructor (public _uuid = 'frame') { this.texture = { uuid: _uuid }; }
}
const native = {
    add: jest.fn(function (name, frame) {
        if (frame?.invalid) throw new TypeError('Invalid SpriteFrame');
        if (!this.frames.has(name)) this.order.push(name);
        this.frames.set(name, frame);
    }),
    remove: jest.fn(function (name) { this.frames.delete(name); this.order = this.order.filter(key => key !== name); }),
    get: jest.fn(function (name) { return this.frames.get(name) ?? null; }),
    replace: jest.fn(function (names, frames) {
        if (frames.some(frame => frame?.invalid)) throw new TypeError('Invalid SpriteFrame');
        this.frames = new Map(names.map((name, i) => [name, frames[i]]));
        this.order = names.slice();
    }),
};
class NativeAtlas {
    frames = new Map<string, any>();
    order: string[] = [];
    constructor () { (this as any)._ctor(); }
}
Object.assign(NativeAtlas.prototype, {
    addSpriteFrame: native.add, removeSpriteFrame: native.remove, getSpriteFrame: native.get,
    setSpriteFrames: native.replace,
    getSpriteFrameNames () { return this.order.slice(); },
    setSpriteFrameOrder (names) { this.order = names.slice(); },
    getSpriteFrameCount () { return this.frames.size; },
    getTexture () { return this.frames.get(this.order[0])?.texture ?? null; },
});
beforeAll(() => {
    (global as any).jsb = { Asset: { prototype: { _ctor: assetCtor } }, SpriteAtlas: NativeAtlas, SpriteFrame: NativeFrame };
});
beforeEach(() => { jest.clearAllMocks(); });
function createAtlas (): any {
    const { SpriteAtlas } = require('../../cocos/2d/assets/sprite-atlas.jsb');
    return new SpriteAtlas();
}
function frame (uuid = 'frame'): any { return new NativeFrame(uuid); }
function expectNativeMatches (atlas): void {
    expect(atlas.getSpriteFrameNames()).toEqual(Object.keys(atlas.spriteFrames));
    expect(atlas.getSpriteFrameCount()).toBe(Object.keys(atlas.spriteFrames).length);
    for (const key of Object.keys(atlas.spriteFrames)) expect(native.get.call(atlas, key)).toBe(atlas.spriteFrames[key]);
}

test('SpriteAtlas patches the native asset and initializes maps per instance', () => {
    const atlas = createAtlas();
    expect(cclegacy.SpriteAtlas).toBe(NativeAtlas);
    expect(js.getClassById('cc.SpriteAtlas')).toBe(NativeAtlas);
    expect((NativeAtlas as any).__values__).toContain('spriteFrames');
    expect(Object.getPrototypeOf(atlas)).toBe(NativeAtlas.prototype);
    expect(assetCtor.mock.instances).toContain(atlas);
    atlas.spriteFrames.empty = null;
    expect(createAtlas().spriteFrames).toEqual({});
    expectNativeMatches(atlas);
});

test('whole map assignment, key writes, replacement, null and delete update native immediately', () => {
    const atlas = createAtlas();
    const first = frame('first'), second = frame('second');
    const source = { hero: first };
    atlas.spriteFrames = source;
    expect(atlas.spriteFrames).not.toBe(source);
    expect(atlas.getTexture()).toBe(first.texture);
    atlas.spriteFrames.hero = second;
    expect(native.get.call(atlas, 'hero')).toBe(second);
    atlas.spriteFrames.hero = null;
    expect(native.get.call(atlas, 'hero')).toBeNull();
    expect(atlas.getTexture()).toBeNull();
    atlas.spriteFrames.icon = first;
    expect(atlas.getTexture()).toBeNull(); // Web uses the first slot, including null.
    delete atlas.spriteFrames.hero;
    expect(atlas.getTexture()).toBe(first.texture);
    expectNativeMatches(atlas);
    atlas.addSpriteFrame('icon', second);
    expect(atlas.getSpriteFrame('icon')).toBe(second);
    expect(second.name).toBe('icon');
    atlas.removeSpriteFrame('icon');
    expect(atlas.getSpriteFrameCount()).toBe(0);
});

test('property definition, numeric ordering and dictionary-like names preserve Web lookup order', () => {
    const atlas = createAtlas();
    atlas.spriteFrames.hero = frame('hero');
    atlas.spriteFrames['10'] = frame('ten');
    atlas.spriteFrames['2'] = frame('two');
    Object.defineProperty(atlas.spriteFrames, 'constructor', { value: frame('constructor'), enumerable: true, writable: true, configurable: true });
    atlas.spriteFrames.__proto__ = frame('proto');
    expect(atlas.getSpriteFrameNames()).toEqual(['2', '10', 'hero', 'constructor', '__proto__']);
    expect(atlas.getTexture()).toBe(atlas.spriteFrames['2'].texture);
    expectNativeMatches(atlas);
    expect(() => Object.defineProperty(atlas.spriteFrames, 'accessor', { get: () => frame() })).toThrow(TypeError);
});

test('native rejection and frozen maps do not leave JS and native entries inconsistent', () => {
    const atlas = createAtlas();
    atlas.spriteFrames.hero = frame();
    const original = atlas.spriteFrames.hero;
    expect(() => { atlas.spriteFrames.hero = { invalid: true }; }).toThrow(TypeError);
    expect(atlas.spriteFrames.hero).toBe(original);
    expect(native.get.call(atlas, 'hero')).toBe(original);
    expect(() => Object.defineProperty(atlas.spriteFrames, 'bad', { value: { invalid: true } })).toThrow(TypeError);
    expect(Object.prototype.hasOwnProperty.call(atlas.spriteFrames, 'bad')).toBe(false);
    expect(() => { atlas.spriteFrames = { invalid: { invalid: true } }; }).toThrow(TypeError);
    expect(atlas.spriteFrames.hero).toBe(original);
    Object.freeze(atlas.spriteFrames);
    expect(Reflect.set(atlas.spriteFrames, 'hero', null)).toBe(false);
    expectNativeMatches(atlas);
});

test('dependency assignment after deserialization synchronizes native and preserves declared order', () => {
    const atlas = createAtlas();
    const details = new Details(); details.init();
    atlas.spriteFrames.old = frame('old');
    atlas._deserialize({ name: 'atlas', spriteFrames: ['hero', 'hero-id', 'icon', 'icon-id', 'empty', ''] }, { result: details });
    expect(details.uuidList).toEqual(['hero-id', 'icon-id']);
    expectNativeMatches(atlas);
    const icon = frame('icon-id'), hero = frame('hero-id');
    // Resolve in reverse order through the same Details target used by asset-manager.
    details.uuidObjList![1][details.uuidPropList![1]] = icon;
    expect(atlas.getTexture()).toBeNull();
    details.uuidObjList![0][details.uuidPropList![0]] = hero;
    expect(atlas.getTexture()).toBe(hero.texture);
    expect(atlas.getSpriteFrames()).toEqual([hero, icon, null]);
    expectNativeMatches(atlas);
    const dependsOn = jest.fn();
    const data = atlas._serialize({ dependsOn, _compressUuid: false });
    expect(data).toEqual({ name: 'atlas', spriteFrames: ['hero', 'hero-id', 'icon', 'icon-id', 'empty', ''] });
    expect(dependsOn.mock.calls).toEqual([['_textureSource', 'hero-id'], ['_textureSource', 'icon-id']]);
});

test('clear and replacing maps detach outstanding dependency writes', () => {
    const atlas = createAtlas();
    const pending: any[] = [];
    atlas._deserialize({ spriteFrames: ['hero', 'old-id'] }, { result: { push: (...args) => pending.push(args) } });
    const oldMap = atlas.spriteFrames;
    atlas.clear();
    pending[0][0][pending[0][1]] = frame('old-id');
    expect(atlas.getSpriteFrameCount()).toBe(0);
    atlas.spriteFrames = { icon: frame('new-id') };
    oldMap.hero = frame('late');
    delete oldMap.hero;
    expect(atlas.getSpriteFrameNames()).toEqual(['icon']);
    expectNativeMatches(atlas);
});

test('native-created atlases can expose their initial frame map without clearing it', () => {
    const atlas = createAtlas();
    const hero = frame();
    native.add.call(atlas, 'hero', hero);
    expect(atlas.getSpriteFrame('hero')).toBe(hero);
    expect(atlas.getTexture()).toBe(hero.texture);
    expectNativeMatches(atlas);
});

test('native-created atlas integer names normalize before its first texture lookup', () => {
    const atlas = createAtlas();
    const ten = frame('ten'), two = frame('two');
    native.add.call(atlas, '10', ten);
    native.add.call(atlas, '2', two);
    expect(atlas.getTexture()).toBe(two.texture);
    expectNativeMatches(atlas);
});
