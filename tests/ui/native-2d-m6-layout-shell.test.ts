import { Node } from '../../cocos/scene-graph/node';
import { UITransform } from '../../cocos/2d/framework/ui-transform';
import { builtinResMgr } from '../../cocos/asset/asset-manager/builtin-res-mgr';
import { deserialize } from '../../cocos/serialization/deserialize';

const nativeGraphics = {
    setNode: jest.fn(), setUITransform: jest.fn(), setPriority: jest.fn(), setEnabled: jest.fn(),
    setLineWidth: jest.fn(), setFillColor: jest.fn(), setStrokeColor: jest.fn(), setMaterial: jest.fn(),
    setLineJoin: jest.fn(), setLineCap: jest.fn(), setMiterLimit: jest.fn(), setColorRGBA: jest.fn(),
    getSharedMaterialCount: () => 0, getSharedMaterial: () => null, getRenderMaterial: () => null,
    setSharedMaterial: jest.fn(), setMaterialInstance: jest.fn(), resizeMaterials: jest.fn(),
};

test('Graphics leaves builtin material selection to the native renderer', () => {
    (global as any).n2d = { Graphics: jest.fn(() => nativeGraphics) };
    const getBuiltin = jest.spyOn(builtinResMgr, 'get');
    const { Graphics } = require('../../cocos/2d/components/graphics.jsb');
    const node = new Node('graphics-native-material');
    node.addComponent(UITransform);
    const graphics = node.addComponent(Graphics) as any;
    getBuiltin.mockClear();
    graphics.onLoad();
    expect(getBuiltin).not.toHaveBeenCalledWith('ui-sprite-material');
    expect(nativeGraphics.setMaterial).toHaveBeenCalledWith(null);
    expect(nativeGraphics.setLineWidth).toHaveBeenCalledWith(1);
    graphics.onDestroy();
    expect(nativeGraphics.setNode).toHaveBeenLastCalledWith(null);
    getBuiltin.mockRestore();
});

test('Graphics restores stroke metadata and binds Mask geometry across load/destroy without polling', () => {
    const { Graphics } = require('../../cocos/2d/components/graphics.jsb');
    const graphics:any=deserialize({__type__:'cc.Graphics',_lineJoin:0,_lineCap:2,_miterLimit:3});
    graphics.node=new Node('graphics-styles');
    const mask={setGraphics:jest.fn()};
    graphics._setMask(mask);
    expect(mask.setGraphics).toHaveBeenLastCalledWith(null);
    graphics.onLoad();
    expect(nativeGraphics.setLineJoin).toHaveBeenLastCalledWith(Graphics.LineJoin.BEVEL);
    expect(nativeGraphics.setLineCap).toHaveBeenLastCalledWith(Graphics.LineCap.SQUARE);
    expect(nativeGraphics.setMiterLimit).toHaveBeenLastCalledWith(3);
    expect(mask.setGraphics).toHaveBeenLastCalledWith(nativeGraphics);
    graphics.lineJoin=1;graphics.lineCap=1;graphics.miterLimit=4;
    expect(nativeGraphics.setLineJoin).toHaveBeenLastCalledWith(1);
    expect(nativeGraphics.setMiterLimit).toHaveBeenLastCalledWith(4);
    graphics.onDestroy();
    expect(mask.setGraphics).toHaveBeenLastCalledWith(null);
    expect(graphics.lateUpdate).toBeUndefined();
});
