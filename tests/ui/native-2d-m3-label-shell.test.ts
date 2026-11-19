import { Node } from '../../cocos/scene-graph/node';
import { UITransform } from '../../cocos/2d/framework/ui-transform';
import type { UIRenderer } from '../../cocos/2d/framework/ui-renderer';
import { Font } from '../../cocos/2d/assets/font';
import { BitmapFont } from '../../cocos/2d/assets/bitmap-font';
import { Label as WebLabel } from '../../cocos/2d/components/label';
import { Sprite as WebSprite } from '../../cocos/2d/components/sprite';
import { mockEnv } from '../utils/mock-cc-env';
import { deserialize, Details } from '../../cocos/serialization/deserialize';
import { instantiate } from '../../exports/base';
import { Color } from '../../cocos/core/math/color';
import { Material } from '../../cocos/asset/assets/material';

let shared: any[] = [], instances: any[] = [];

const nativeLabel = {
    setNode: jest.fn(),
    setUITransform: jest.fn(),
    setMaterial: jest.fn((value) => { shared[0] = value; instances[0] = null; }),
    getMaterialInstanceCount: jest.fn(() => instances.length),
    getMaterialInstanceSlot: jest.fn((i) => instances[i] ?? null),
    writeMaterialSlot: jest.fn((sharedSlot, i, value) => { (sharedSlot ? shared : instances)[i] = value; }),
    resizeMaterialArray: jest.fn((sharedSlot, size) => { (sharedSlot ? shared : instances).length = size; }),
    getSharedMaterialCount: jest.fn(() => shared.length),
    getSharedMaterial: jest.fn((index) => shared[index] ?? null),
    getRenderMaterial: jest.fn((index) => instances[index] ?? shared[index] ?? null),
    setSharedMaterial: jest.fn((value, index) => { shared[index] = value; instances[index] = null; }),
    getMaterialInstance: jest.fn((index) => instances[index] ?? (instances[index] = shared[index] ? { parent: shared[index] } : null)),
    setMaterialInstance: jest.fn((value, index) => {
        if (value?.parent) instances[index] = value;
        else { shared[index] = value; instances[index] = null; }
    }),
    resizeMaterials: jest.fn((size) => { shared.length = instances.length = size; }),
    setPriority: jest.fn(),
    setEnabled: jest.fn(),
    setString: jest.fn(),
    setFont: jest.fn(),
    setFontAsset: jest.fn(),
    updateRenderData: jest.fn(),
    setTTFContentWidth: jest.fn(),
    destroyTTFSpriteFrame: jest.fn(),
    setFontSize: jest.fn(),
    setActualFontSize: jest.fn(),
    setIsBold: jest.fn(),
    setIsItalic: jest.fn(),
    setIsUnderline: jest.fn(),
    setUnderlineHeight: jest.fn(),
    setLineHeight: jest.fn(),
    setEnableWrapText: jest.fn(),
    setOverflow: jest.fn(),
    setHorizontalAlign: jest.fn(),
    setVerticalAlign: jest.fn(),
    setSpacingX: jest.fn(),
    setColorRGBA: jest.fn(),
    setEnableOutline: jest.fn(),
    setOutlineColor: jest.fn(),
    setOutlineWidth: jest.fn(),
    setEnableShadow: jest.fn(),
    setShadowColor: jest.fn(),
    setShadowBlur: jest.fn(),
    setShadowOffset: jest.fn(),
    setCacheMode: jest.fn(),
    getLetterTexture: jest.fn(() => ({ addRef: jest.fn(), decRef: jest.fn(), destroy: jest.fn(), refCount: 0 })),
    setBitmapAtlas: jest.fn(),
    clearGlyphs: jest.fn(),
    clearKerning: jest.fn(),
    getContentHeight: jest.fn(() => 90),
};

beforeAll(() => {
    (global as any).n2d = {
        Label: jest.fn(() => nativeLabel),
    };
});

beforeEach(() => { jest.clearAllMocks(); shared = []; instances = []; });

test.each([false, true])('Label and Sprite color setters preserve node events (EDITOR=%s)', (editor) => {
    const { Label } = require('../../cocos/2d/components/label.jsb');
    const { Sprite } = require('../../cocos/2d/components/sprite.jsb');
    const fixtures = [WebLabel, WebSprite, Label, Sprite].map((Renderer) => {
        const node = new Node();
        const renderer = node.addComponent(Renderer) as UIRenderer;
        return { node, renderer, native: Renderer === Label || Renderer === Sprite };
    });
    const env = mockEnv('EDITOR', editor);
    try {
        for (const { node, renderer, native } of fixtures) {
            const bridge = { setColorRGBA: jest.fn() };
            if (native) Object.assign(renderer, { _native: bridge });
            const input = new Color(12, 34, 56, 78);
            const handler = jest.fn((snapshot: Color) => {
                expect(snapshot).toEqual(input);
                if (native) expect(bridge.setColorRGBA).toHaveBeenCalledWith(12, 34, 56, 78);
                snapshot.r = 99;
            });
            node.on(Node.EventType.COLOR_CHANGED, handler);
            renderer.color = input;
            renderer.color = input.clone();
            expect(handler).toHaveBeenCalledTimes(editor ? 1 : 0);
            expect(bridge.setColorRGBA).toHaveBeenCalledTimes(native ? 1 : 0);
            expect(renderer.color.r).toBe(12);
            expect(input.r).toBe(12);
        }
    } finally { env.restore(); }
});

test('Label reports the original bitmap font size as its assigned asset changes', () => {
    const { Label } = require('../../cocos/2d/components/label.jsb');
    for (const Component of [WebLabel, Label]) {
        const label = new Component();
        if (Component === WebLabel) jest.spyOn(label, 'updateRenderData').mockImplementation(() => {});
        const bitmap = new BitmapFont();
        expect(label._bmFontOriginalSize).toBe(-1);
        bitmap.fontSize = 18;
        label.font = bitmap;
        expect(label._bmFontOriginalSize).toBe(18);
        bitmap.fontSize = 32;
        expect(label._bmFontOriginalSize).toBe(32);
        label.font = new Font();
        expect(label._bmFontOriginalSize).toBe(-1);
    }
});

test('Label restores a missing system font on enable and preserves a configured family', () => {
    const { Label } = require('../../cocos/2d/components/label.jsb');
    const node = new Node('label-font-fallback');
    node.addComponent(UITransform);
    const label: any = node.addComponent(Label);
    label.useSystemFont = false;
    label.fontFamily = '';
    label.onLoad();
    label.onEnable();
    expect(label.useSystemFont).toBe(true);
    expect(label.fontFamily).toBe('Arial');
    expect(nativeLabel.setFont).toHaveBeenLastCalledWith('40px Arial');
    label.onDisable();
    label.fontFamily = 'Verdana';
    label.onEnable();
    expect(label.fontFamily).toBe('Verdana');
    label.onDisable();
    const font = new Font();
    label.font = font;
    label.fontFamily = '';
    label.onEnable();
    expect(label.font).toBe(font);
    expect(label.useSystemFont).toBe(false);
    expect(label.fontFamily).toBe('');
});

test('Label binds serialized material slots and releases instance owners on destruction', () => {
    const { Label } = require('../../cocos/2d/components/label.jsb');
    const node = new Node('label-materials'); node.addComponent(UITransform);
    const label: any = node.addComponent(Label);
    const material = new Material();
    label.sharedMaterials = [material, material];
    label.onLoad();
    expect(label.sharedMaterials).toEqual([material, material]);
    const instance = label.materials[1];
    expect(instance._owner).toBe(label);
    label.sharedMaterials = [null];
    expect(instance._owner).toBeNull();
    expect(label.getRenderMaterial(0)).toBeNull();
    label.customMaterial = material;
    const current = label.material;
    expect(current.parent).toBe(material);
    label.onDestroy();
    expect(current._owner).toBeNull();
    expect(shared).toEqual([]);
    expect(label.sharedMaterials).toEqual([]);
});

test('Label M3 shell attaches and forwards text properties', () => {
    const { Label, Overflow, HorizontalTextAlignment } = require('../../cocos/2d/components/label.jsb') as typeof import('../../cocos/2d/components/label.jsb');
    const node = new Node('label');
    node.addComponent(UITransform);
    const label = node.addComponent(Label) as InstanceType<typeof Label>;

    label.onLoad();
    expect((global as any).n2d.Label).toHaveBeenCalled();
    expect(nativeLabel.setNode).toHaveBeenCalledWith(node);
    expect(nativeLabel.setMaterial).toHaveBeenCalledWith(null);

    label.string = 'Hello';
    label.fontSize = 24;
    label.lineHeight = 30;
    label.enableWrapText = true;
    label.overflow = Overflow.RESIZE_HEIGHT;
    label.horizontalAlign = HorizontalTextAlignment.CENTER;
    label.verticalAlign = 2;
    label.spacingX = 2;
    label.cacheMode = 2;

    expect(nativeLabel.setString).toHaveBeenLastCalledWith('Hello');
    expect(nativeLabel.setFont).toHaveBeenLastCalledWith('24px Arial');
    expect(nativeLabel.setLineHeight).toHaveBeenLastCalledWith(30);
    expect(nativeLabel.setEnableWrapText).toHaveBeenLastCalledWith(true);
    expect(nativeLabel.setOverflow).toHaveBeenLastCalledWith(Overflow.RESIZE_HEIGHT);
    expect(nativeLabel.setHorizontalAlign).toHaveBeenLastCalledWith(1);
    expect(nativeLabel.setVerticalAlign).toHaveBeenLastCalledWith(2);
    expect(nativeLabel.setSpacingX).toHaveBeenLastCalledWith(2);
    expect(nativeLabel.setCacheMode).toHaveBeenLastCalledWith(2);

    label.color = new Color(10, 20, 30, 255);
    expect(nativeLabel.setColorRGBA).toHaveBeenLastCalledWith(10, 20, 30, 255);

    expect(Object.prototype.hasOwnProperty.call(Label.prototype, 'lateUpdate')).toBe(false);
    label.updateRenderData();
    expect(nativeLabel.updateRenderData).toHaveBeenLastCalledWith(false);
    label.updateRenderData(true);
    expect(nativeLabel.updateRenderData).toHaveBeenLastCalledWith(true);
    expect(nativeLabel.getContentHeight).not.toHaveBeenCalled();

    label.enableOutline = true;
    label.outlineWidth = 2;
    expect(nativeLabel.setEnableOutline).toHaveBeenLastCalledWith(true);
    expect(nativeLabel.setOutlineWidth).toHaveBeenLastCalledWith(2);

    label.enableShadow = true;
    label.shadowBlur = 2;
    expect(nativeLabel.setEnableShadow).toHaveBeenLastCalledWith(true);
    expect(nativeLabel.setShadowBlur).toHaveBeenLastCalledWith(2);

    const font = { get fontDefDictionary () { throw new Error('Label must not walk JS glyphs'); } };
    label.font = font;
    expect(nativeLabel.setFontAsset).toHaveBeenLastCalledWith(font);
    label.useSystemFont = true;
    expect(nativeLabel.setFontAsset).toHaveBeenLastCalledWith(null);
    label.useSystemFont = false;
    expect(label.font).toBeNull();
    expect(nativeLabel.setFontAsset).toHaveBeenLastCalledWith(null);
    label.font = null;
    expect(label.useSystemFont).toBe(false);
    label.onDestroy();
    expect(nativeLabel.setFontAsset).toHaveBeenLastCalledWith(null);
    expect(nativeLabel.setBitmapAtlas).not.toHaveBeenCalled();
});


test('native Label retains Web serialized field names and defaults', () => {
    const { Label } = require('../../cocos/2d/components/label.jsb');
    const web: any = new WebLabel(), label: any = new Label();
    const fields = ['_string','_horizontalAlign','_verticalAlign','_actualFontSize','_fontSize','_fontFamily',
        '_lineHeight','_overflow','_enableWrapText','_font','_isSystemFontUsed','_spacingX','_isItalic','_isBold',
        '_isUnderline','_underlineHeight','_cacheMode','_enableOutline','_outlineColor','_outlineWidth',
        '_enableShadow','_shadowColor','_shadowOffset','_shadowBlur'];
    expect(Label.__values__).toEqual(expect.arrayContaining(fields));
    for (const field of fields) expect(label[field]).toEqual(web[field]);
});

test('legacy records preserve font dependency and styles through load and instantiate', () => {
    const { Label } = require('../../cocos/2d/components/label.jsb');
    const details = new Details(); details.init();
    const label: any = deserialize([{__type__: 'cc.Label', _string: 'legacy font', _font: {__uuid__: 'font-id'},
        _isSystemFontUsed: false, _isBold: true, _isItalic: true, _isUnderline: true, _underlineHeight: 4,
        _enableOutline: true, _outlineWidth: 3, _enableShadow: true, _shadowBlur: 5,
        _shadowOffset: {__type__: 'cc.Vec2', x: 3, y: -2}}], details, {
        classFinder: (id: string) => id === 'cc.Label' ? Label : id === 'cc.Vec2' ? require('../../cocos/core').Vec2 : undefined,
    });
    expect(details.uuidList).toEqual(['font-id']);
    expect(details.uuidObjList![0]).toBe(label);
    expect(details.uuidPropList![0]).toBe('_font');
    const font = new Font(); font._uuid = 'font-id';
    details.uuidObjList![0][details.uuidPropList![0]] = font;
    label.node = new Node('loaded-label'); label.node.addComponent(UITransform);
    label.onLoad();
    expect(nativeLabel.setFontAsset).toHaveBeenLastCalledWith(font);
    expect(nativeLabel.setIsBold).toHaveBeenLastCalledWith(true);
    expect(nativeLabel.setIsItalic).toHaveBeenLastCalledWith(true);
    expect(nativeLabel.setIsUnderline).toHaveBeenLastCalledWith(true);
    expect(nativeLabel.setUnderlineHeight).toHaveBeenLastCalledWith(4);
    expect(nativeLabel.setOutlineWidth).toHaveBeenLastCalledWith(3);
    expect(nativeLabel.setShadowBlur).toHaveBeenLastCalledWith(5);
    expect(nativeLabel.setShadowOffset).toHaveBeenLastCalledWith(3, -2);
    const clone: any = instantiate(label);
    expect(clone).toBeInstanceOf(Label);
    expect(clone.string).toBe('legacy font');
    expect(clone.font).toBe(font);
    expect(clone._native).toBeNull();
    expect(clone.shadowOffset).toEqual(label.shadowOffset);
    expect(clone.shadowOffset).not.toBe(label.shadowOffset);
    expect(clone.isBold).toBe(true);
    expect(clone.underlineHeight).toBe(4);
    label.onDestroy();
});
