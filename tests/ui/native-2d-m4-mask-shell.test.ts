import { Node } from '../../cocos/scene-graph/node';
import { UITransform } from '../../cocos/2d/framework/ui-transform';

const nativeMask = {
    setNode: jest.fn(),
    setUITransform: jest.fn(),
    setMaterial: jest.fn(),
    setType: jest.fn(),
    setInverted: jest.fn(),
    setAlphaThreshold: jest.fn(),
    setSpriteFrame: jest.fn(),
    setPriority: jest.fn(),
    setEnabled: jest.fn(),
    setSegments: jest.fn(), setGraphics: jest.fn(),
};

beforeAll(() => {
    (global as any).n2d = { Mask: jest.fn(() => nativeMask) };
});

test('Mask binds a disabled Graphics helper when its native backend becomes ready and unbinds on destroy', () => {
    const nativeGraphics={
        setNode:jest.fn(),setPriority:jest.fn(),setEnabled:jest.fn(),setLineWidth:jest.fn(),
        setFillColor:jest.fn(),setStrokeColor:jest.fn(),setLineJoin:jest.fn(),setLineCap:jest.fn(),
        setMiterLimit:jest.fn(),setColorRGBA:jest.fn(),setMaterial:jest.fn(),setSharedMaterial:jest.fn(),
        getSharedMaterialCount:()=>0,getSharedMaterial:()=>null,getRenderMaterial:()=>null,resizeMaterials:jest.fn(),
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

test('Mask forwards SpriteFrame directly during load, replacement and clearing', () => {
    const { Mask } = require('../../cocos/2d/components/mask.jsb');
    const node = new Node('mask');
    node.addComponent(UITransform);
    const mask = node.addComponent(Mask) as any;
    const frame = { texture: {} };
    mask.spriteFrame = frame;

    mask.onLoad();
    expect(nativeMask.setSpriteFrame).toHaveBeenLastCalledWith(frame);

    const replacement = { texture: {} };
    mask.spriteFrame = replacement;
    expect(nativeMask.setSpriteFrame).toHaveBeenLastCalledWith(replacement);
    mask.spriteFrame = null;
    expect(nativeMask.setSpriteFrame).toHaveBeenLastCalledWith(null);
    mask.onDestroy();
});
