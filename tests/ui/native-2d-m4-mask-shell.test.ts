import { Node } from '../../cocos/scene-graph/node';
import { UITransform } from '../../cocos/2d/framework/ui-transform';

const nativeMask = {
    setNode: jest.fn(),
    setType: jest.fn(),
    setInverted: jest.fn(),
    setAlphaThreshold: jest.fn(),
    setPriority: jest.fn(),
    setEnabled: jest.fn(),
    setSegments: jest.fn(), setGraphics: jest.fn(), setRadius: jest.fn(), isHitWorldPointXY: jest.fn(() => true),
};

beforeAll(() => {
    (global as any).n2d = { Mask: jest.fn(() => nativeMask) };
});

test('Mask binds a disabled Graphics helper when its native backend becomes ready and unbinds on destroy', () => {
    const nativeGraphics={
        setNode:jest.fn(),setPriority:jest.fn(),setEnabled:jest.fn(),setLineWidth:jest.fn(),
        setFillColor:jest.fn(),setStrokeColor:jest.fn(),setLineJoin:jest.fn(),setLineCap:jest.fn(),
        setMiterLimit:jest.fn(),setColorRGBA:jest.fn(),setMaterial:jest.fn(),setSharedMaterial:jest.fn(),
        getMaterialInstanceCount: () => 0, getSharedMaterialCount:()=>0,getSharedMaterial:()=>null,getRenderMaterial:()=>null,resizeMaterials:jest.fn(),
    };
    (global as any).n2d.Graphics=jest.fn(()=>nativeGraphics);
    // Reproduce the ccbuild NATIVE override for this direct source test.
    // The normal Jest module graph otherwise selects the Web Graphics class.
    const graphicsModule=require('../../cocos/2d/components/graphics');
    const originalGraphics=graphicsModule.Graphics;
    graphicsModule.Graphics=require('../../cocos/2d/components/graphics.jsb').Graphics;
    try {
    const { Mask, MaskType }=require('../../cocos/2d/components/mask.jsb');
    const { replaceProperty }=require('../../cocos/core/utils/x-deprecated');
    replaceProperty(Mask.prototype, 'Mask', [{name:'graphics',newName:'subComp',target:Mask.prototype,targetName:'Mask'}]);
    const node=new Node('graphics-mask');node.addComponent(UITransform);
    const mask:any=node.addComponent(Mask);mask.type=MaskType.GRAPHICS_STENCIL;mask.onLoad();
    const helper:any=mask.graphics;
    expect(mask.subComp).toBe(helper);
    expect(helper.enabled).toBe(false);
    helper.onLoad();
    expect(nativeMask.setGraphics).toHaveBeenLastCalledWith(nativeGraphics);
    expect(nativeGraphics.setEnabled).toHaveBeenLastCalledWith(false);
    expect(mask.lateUpdate).toBeUndefined();
    mask.onDestroy();
    expect(nativeMask.setGraphics).toHaveBeenLastCalledWith(null);
    helper.onDestroy();
    } finally { graphicsModule.Graphics=originalGraphics; }
});

test('Mask stores a pending SpriteFrame and uses its host Sprite for replacement and clearing', () => {
    const spriteModule = require('../../cocos/2d/components/sprite');
    const originalSprite = spriteModule.Sprite;
    spriteModule.Sprite = require('../../cocos/2d/components/sprite.jsb').Sprite;
    try {
        const { Mask, MaskType } = require('../../cocos/2d/components/mask.jsb');
        const node = new Node('mask');
        node.addComponent(UITransform);
        const mask = node.addComponent(Mask) as any;
        const sprite = node.addComponent(spriteModule.Sprite);
        const frame = { texture: {} };
        mask.spriteFrame = frame;
        mask.type = MaskType.SPRITE_STENCIL;
        mask.onLoad();

        expect(mask.subComp).toBe(sprite);
        expect(sprite.spriteFrame).toBe(frame);
        const replacement = { texture: {} };
        sprite.spriteFrame = replacement;
        expect(mask.spriteFrame).toBe(replacement);
        mask.spriteFrame = null;
        expect(sprite.spriteFrame).toBeNull();
        mask.onDestroy();
    } finally {
        spriteModule.Sprite = originalSprite;
    }
});

test('Mask clamps geometric state and forwards world-space hit testing to native', () => {
    const { Mask } = require('../../cocos/2d/components/mask.jsb');
    const node = new Node('rounded-mask'); node.addComponent(UITransform);
    const mask: any = node.addComponent(Mask);
    mask.radius = 18;
    mask.onLoad();
    expect(nativeMask.setRadius).toHaveBeenLastCalledWith(18);
    mask.radius = -10;
    expect(mask.radius).toBe(0);
    expect(nativeMask.setRadius).toHaveBeenLastCalledWith(0);
    mask.segments = 1;
    expect(mask.segments).toBe(3);
    mask.segments = 20000;
    expect(mask.segments).toBe(10000);
    expect(mask.isHit({ x: 11, y: 22 })).toBe(true);
    expect(nativeMask.isHitWorldPointXY).toHaveBeenLastCalledWith(11, 22);
    mask.onDestroy();
    expect(mask.isHit({ x: 11, y: 22 })).toBe(false);
});

test('Native Mask leaves renderer APIs on the stencil component', () => {
    const { Mask } = require('../../cocos/2d/components/mask.jsb');
    for (const name of [
        'customMaterial', 'color', 'markForUpdateRenderData', 'requestRenderData', 'destroyRenderData',
        'updateRenderer', 'fillBuffers', 'postUpdateAssembler', 'setNodeDirty', 'setTextureDirty',
        'sharedMaterial', 'sharedMaterials', 'material', 'materials', 'getMaterial', 'setMaterial',
        'getMaterialInstance', 'setMaterialInstance', 'getRenderMaterial',
    ]) {
        expect(name in Mask.prototype).toBe(false);
    }
});

test('Mask restores serialized geometric state to the native stencil', () => {
    const { Mask, MaskType } = require('../../cocos/2d/components/mask.jsb');
    const node = new Node('restored-mask');
    node.addComponent(UITransform);
    const mask = node.addComponent(Mask) as any;
    mask.onLoad();
    Object.assign(mask, { _type: MaskType.GRAPHICS_ELLIPSE, _segments: 9, _radius: 8, _inverted: true, _alphaThreshold: 0.7 });
    mask.onRestore();
    expect(nativeMask.setType).toHaveBeenLastCalledWith(MaskType.GRAPHICS_ELLIPSE);
    expect(nativeMask.setSegments).toHaveBeenLastCalledWith(9);
    expect(nativeMask.setRadius).toHaveBeenLastCalledWith(8);
    expect(nativeMask.setInverted).toHaveBeenLastCalledWith(true);
    expect(nativeMask.setAlphaThreshold).toHaveBeenLastCalledWith(0.7);
    mask.onDestroy();
});
