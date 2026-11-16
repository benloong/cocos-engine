import { deserialize, Details } from '../../cocos/serialization/deserialize';
import { js } from '../../cocos/core';

const assetCtor = jest.fn();
class NativeFont {
    revision = 0;
    released = false;
    constructor () { (this as any)._ctor(); }
    getRevision () { return this.revision; }
    isReleased () { return this.released; }
    clearNativeData () { this.revision++; }
    _destroy () { this.released = true; this.clearNativeData(); return true; }
}
class NativeTTF extends NativeFont {
    family = '';
    source = '';
    size = 0;
    getFontFamily () { return this.family; }
    setFontFamily (value) { this.family = value; this.revision++; }
    getSourcePath () { return this.source; }
    getFontDataSize () { return this.size; }
    loadFontData = jest.fn((source) => { this.source = source; this.size = 100; return true; });
    clearNativeData () { this.family = ''; this.source = ''; this.size = 0; super.clearNativeData(); }
}
class NativeBitmap extends NativeFont {
    frame: any = null;
    size = -1;
    text = '';
    json = 'null';
    configRevision = 0;
    getSpriteFrame () { return this.frame; }
    setSpriteFrame (frame) { this.frame = frame; this.revision++; }
    getFontSize () { return this.size; }
    setFontSize (size) { this.size = size; this.revision++; }
    getFntDataStr () { return this.text; }
    setFntDataStr (text) { this.text = text; }
    getConfigJson () { return this.json; }
    getConfigRevision () { return this.configRevision; }
    setConfigJson (json) { this.json = json; this.configRevision++; this.revision++; return true; }
    getGlyphData () { return this.json === 'null' ? [] : [65, 0, 0, 2, 3, 1, 2, 4]; }
    clearNativeData () { this.frame = null; this.json = 'null'; this.configRevision++; super.clearNativeData(); }
}
class NativeLabelAtlas extends NativeBitmap {}

beforeAll(() => {
    (global as any).jsb = {
        Asset: { prototype: { _ctor: assetCtor } }, Font: NativeFont,
        TTFFont: NativeTTF, BitmapFont: NativeBitmap, LabelAtlas: NativeLabelAtlas,
    };
    require('../../cocos/2d/assets/font.jsb');
    require('../../cocos/2d/assets/ttf-font.jsb');
    require('../../cocos/2d/assets/bitmap-font.jsb');
    require('../../cocos/2d/assets/label-atlas.jsb');
});

test('font shells retain native identity, constructor initialization and serialized metadata', () => {
    const ttf: any = new NativeTTF(), bitmap: any = new NativeBitmap(), atlas = new NativeLabelAtlas();
    expect(assetCtor.mock.instances).toEqual(expect.arrayContaining([ttf, bitmap, atlas]));
    for (const [name, klass] of [['Font', NativeFont], ['TTFFont', NativeTTF], ['BitmapFont', NativeBitmap], ['LabelAtlas', NativeLabelAtlas]]) {
        expect(js.getClassById(`cc.${name}`)).toBe(klass);
    }
    expect((NativeTTF as any).__values__).toContain('_fontFamily');
    expect((NativeBitmap as any).__values__).toEqual(expect.arrayContaining(['fntDataStr', 'spriteFrame', 'fontSize', 'fntConfig']));
    expect(atlas).toBeInstanceOf(NativeFont);
    expect(ttf._nativeAsset).toBeNull();
    expect(bitmap.fntConfig).toBeNull();
    expect(bitmap.fontSize).toBe(-1);
});

test('TTF alias, native dependency and load-once source forward to native storage', () => {
    const font: any = new NativeTTF();
    font._uuid = 'font-id'; font._native = '.ttf'; font.nativeUrl = '/fonts/example.ttf';
    font._nativeAsset = 'Example_LABEL'; font.onLoaded();
    expect(font._fontFamily).toBe('Example_LABEL');
    expect(font.loadFontData).toHaveBeenCalledTimes(1);
    expect(font._nativeDep).toEqual({ uuid: 'font-id', __nativeName__: '.ttf', ext: '.ttf', __isNative__: true });
    font.nativeUrl = '/fonts/replacement.ttf'; font.onLoaded();
    expect(font.loadFontData).toHaveBeenLastCalledWith('/fonts/replacement.ttf');
    font._nativeAsset = null;
    expect(font._fontFamily).toBe('Arial');
});

test('bitmap serialized data and dependency writes reach native and compatibility views release safely', () => {
    const font: any = new NativeBitmap();
    const texture = { addRef: jest.fn(), decRef: jest.fn(), destroy: jest.fn() };
    const frame = { texture };
    const details = new Details(); details.init();
    details.push(font, 'spriteFrame', 'frame-id');
    details.uuidObjList![0][details.uuidPropList![0]] = frame;
    font.fontSize = 18; font.fntDataStr = 'original'; font.fntConfig = { fontDefDictionary: {} };
    expect(font.getSpriteFrame()).toBe(frame);
    expect(font.getFontSize()).toBe(18);
    expect(font.getFntDataStr()).toBe('original');
    const view = font.fontDefDictionary;
    expect(view.getLetterDefinitionForChar('A').xAdvance).toBe(4);
    const replacement = {};
    frame.texture = replacement as any;
    expect(font.fontDefDictionary.texture).toBe(replacement);
    font.fntConfig.fontSize = 24; font.onLoaded();
    expect(JSON.parse(font.getConfigJson()).fontSize).toBe(24);
    font.clearNativeData();
    expect(font._atlasView).toBeUndefined();
    expect(font.spriteFrame).toBeNull();
    expect(font.fntConfig).toBeNull();
    font.spriteFrame = frame; font.fntConfig = {}; font.fontDefDictionary;
    font._destroy();
    expect(font._atlasView).toBeUndefined();
    expect(texture.addRef).not.toHaveBeenCalled();
    expect(texture.decRef).not.toHaveBeenCalled();
    expect(texture.destroy).not.toHaveBeenCalled();
    expect(new NativeBitmap().getSpriteFrame()).toBeNull();
});

test.each([NativeBitmap, NativeLabelAtlas])('font views are independent and stale edits cannot overwrite native updates: %p', (FontClass) => {
    const first: any = new FontClass(), second: any = new FontClass();
    first.fntConfig = { fontSize: 12, fontDefDictionary: {} };
    second.fntConfig = { fontSize: 12, fontDefDictionary: {} };
    const stale = first.fntConfig;
    stale.fontSize = 18;
    expect(second.fntConfig.fontSize).toBe(12);
    expect(first.fontDefDictionary).not.toBe(second.fontDefDictionary);

    first.setConfigJson(JSON.stringify({ fontSize: 24, fontDefDictionary: {} }));
    first.onLoaded();
    expect(first.fntConfig.fontSize).toBe(24);
    expect(first.fntConfig).not.toBe(stale);
    stale.fontSize = 36;
    first.onLoaded();
    expect(first.fntConfig.fontSize).toBe(24);

    first.clearNativeData();
    expect(first.fntConfig).toBeNull();
    expect(second.fntConfig.fontSize).toBe(12);
    expect(second.fontDefDictionary.getLetter('65').xAdvance).toBe(4);
});

test.each([NativeBitmap, NativeLabelAtlas])('native reload of identical config invalidates edited views: %p', (FontClass) => {
    const font: any = new FontClass();
    const json = JSON.stringify({ fontSize: 12, fontDefDictionary: {} });
    font.setConfigJson(json);
    const stale = font.fntConfig;
    stale.fontSize = 99;
    font.setConfigJson(json);
    font.onLoaded();
    expect(font.fntConfig.fontSize).toBe(12);
    expect(font.fntConfig).not.toBe(stale);

    font.fntConfig.fontSize = 24;
    font.spriteFrame = { texture: {} };
    font.fontSize = 18;
    font.onLoaded();
    expect(font.fntConfig.fontSize).toBe(24);
});

test('released TTF ignores late onLoaded callbacks without file access', () => {
    const font: any = new NativeTTF();
    font.nativeUrl = '/fonts/late.ttf';
    font._destroy();
    font.onLoaded();
    expect(font.loadFontData).not.toHaveBeenCalled();
});

test.each([NativeBitmap, NativeLabelAtlas])('released bitmap ignores late onLoaded after reading its config: %p', (FontClass) => {
    const font: any = new FontClass();
    font._destroy();
    expect(font.fntConfig).toBeNull();
    const revision = font.getRevision();
    font.onLoaded();
    expect(font.getRevision()).toBe(revision);
});

test.each([NativeBitmap, NativeLabelAtlas])('released bitmap ignores late configuration assignments without serializing them: %p', (FontClass) => {
    const font: any = new FontClass();
    font.fntConfig = { fontSize: 12 };
    font._destroy();
    const write = jest.spyOn(font, 'setConfigJson');
    const revision = font.getRevision();
    // A delayed dependency callback can still hold the asset wrapper. It must
    // neither refill native storage nor throw from the serialization bridge.
    const late: any = { toJSON: jest.fn(() => { throw new Error('released asset serialized'); }) };
    expect(() => { font.fntConfig = late; font.onLoaded(); }).not.toThrow();
    expect(late.toJSON).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(font.getRevision()).toBe(revision);
    expect(font.fntConfig).toBeNull();
});

test('released TTF ignores the entire late native asset setter', () => {
    const font: any = new NativeTTF();
    font._destroy();
    const write = jest.spyOn(font, 'setFontFamily');
    font._nativeAsset = 'Late_LABEL';
    expect(write).not.toHaveBeenCalled();
    expect(font.loadFontData).not.toHaveBeenCalled();
    expect(font._nativeAsset).toBeNull();
});

test.each(['BitmapFont', 'LabelAtlas'])('%s deserializes native data and records its atlas dependency', (name) => {
    const details = new Details();
    const config = { fontDefDictionary: { 65: { rect: { x: 0, y: 0, width: 2, height: 3 }, xAdvance: 4 } } };
    const font: any = deserialize({
        __type__: `cc.${name}`,
        fontSize: 18,
        fntDataStr: 'serialized-font',
        fntConfig: config,
        spriteFrame: { __uuid__: 'font-frame' },
    }, details);
    expect(font).toBeInstanceOf(name === 'LabelAtlas' ? NativeLabelAtlas : NativeBitmap);
    expect(font.getFontSize()).toBe(18);
    expect(font.getFntDataStr()).toBe('serialized-font');
    expect(JSON.parse(font.getConfigJson())).toEqual(config);
    expect(details.uuidList).toEqual(['font-frame']);
    expect(details.uuidObjList).toEqual([font]);
    expect(details.uuidPropList).toEqual(['spriteFrame']);
    const frame = { texture: {} };
    details.uuidObjList![0][details.uuidPropList![0]] = frame;
    font.onLoaded();
    expect(font.getSpriteFrame()).toBe(frame);
    expect(font.fontDefDictionary.texture).toBe(frame.texture);
});

test('TTFFont deserializes its family without loading bytes until its native dependency arrives', () => {
    const font: any = deserialize({ __type__: 'cc.TTFFont', _fontFamily: 'Serialized_FONT' });
    expect(font).toBeInstanceOf(NativeTTF);
    expect(font.getFontFamily()).toBe('Serialized_FONT');
    expect(font.loadFontData).not.toHaveBeenCalled();
    font.nativeUrl = '/fonts/serialized.ttf';
    font._nativeAsset = 'Loaded_FONT';
    expect(font.loadFontData).toHaveBeenCalledTimes(1);
    expect(font.getFontFamily()).toBe('Loaded_FONT');
});
