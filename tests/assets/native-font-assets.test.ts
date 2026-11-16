import { Details } from '../../cocos/serialization/deserialize';
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
    getSpriteFrame () { return this.frame; }
    setSpriteFrame (frame) { this.frame = frame; this.revision++; }
    getFontSize () { return this.size; }
    setFontSize (size) { this.size = size; this.revision++; }
    getFntDataStr () { return this.text; }
    setFntDataStr (text) { this.text = text; }
    getConfigJson () { return this.json; }
    setConfigJson (json) { this.json = json; this.revision++; return true; }
    getGlyphData () { return this.json === 'null' ? [] : [65, 0, 0, 2, 3, 1, 2, 4]; }
    clearNativeData () { this.frame = null; this.json = 'null'; super.clearNativeData(); }
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
