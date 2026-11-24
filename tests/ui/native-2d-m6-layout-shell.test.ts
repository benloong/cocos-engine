import { Material } from '../../cocos/asset/assets/material';
import { Node } from '../../cocos/scene-graph/node';
import { UITransform } from '../../cocos/2d/framework/ui-transform';
import { builtinResMgr } from '../../cocos/asset/asset-manager/builtin-res-mgr';
import { deserialize } from '../../cocos/serialization/deserialize';

const nativeGraphics = {
    setNode: jest.fn(), setUITransform: jest.fn(), setPriority: jest.fn(), setEnabled: jest.fn(),
    setLineWidth: jest.fn(), setFillColor: jest.fn(), setStrokeColor: jest.fn(), setMaterial: jest.fn(),
    setLineJoin: jest.fn(), setLineCap: jest.fn(), setMiterLimit: jest.fn(), setColorRGBA: jest.fn(),
    getMaterialInstanceCount: () => 0, getSharedMaterialCount: () => 0, getSharedMaterial: () => null, getRenderMaterial: () => null,
    setSharedMaterial: jest.fn(), setMaterialInstance: jest.fn(), resizeMaterials: jest.fn(),
    fillRect: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(), stroke: jest.fn(),
    flushRenderData: jest.fn(),
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

test('Graphics retains native drawing before onLoad and never recreates a destroyed backend', () => {
    const { Graphics } = require('../../cocos/2d/components/graphics.jsb');
    const node = new Node('inactive-graphics'); node.active = false;
    const graphics: any = node.addComponent(Graphics);
    const create = (global as any).n2d.Graphics;
    create.mockClear(); nativeGraphics.fillRect.mockClear();
    nativeGraphics.setNode.mockClear();
    graphics.lineWidth = 7;
    graphics.fillRect(1, 2, 3, 4);
    expect(create).toHaveBeenCalledTimes(1);
    expect(nativeGraphics.fillRect).toHaveBeenCalledWith(1, 2, 3, 4);
    expect(nativeGraphics.setLineWidth).toHaveBeenLastCalledWith(7);
    expect(nativeGraphics.setNode).not.toHaveBeenCalled();
    graphics.onLoad();
    expect(create).toHaveBeenCalledTimes(1);
    expect(nativeGraphics.setNode).toHaveBeenLastCalledWith(node);
    graphics.onDestroy(); graphics.fillRect(5, 6, 7, 8);
    expect(create).toHaveBeenCalledTimes(1);
    expect(nativeGraphics.fillRect).toHaveBeenCalledTimes(1);
});

test('Graphics destroys a pre-load backend and unbinds Mask when the inactive component is destroyed', () => {
    const { Graphics } = require('../../cocos/2d/components/graphics.jsb');
    const node = new Node('never-loaded-graphics'); node.active = false;
    const graphics: any = node.addComponent(Graphics);
    const mask = { setGraphics: jest.fn() };
    graphics._setMask(mask); graphics.moveTo(0, 0); graphics.lineTo(5, 5); graphics.stroke();
    expect(mask.setGraphics).toHaveBeenLastCalledWith(nativeGraphics);
    const onDestroy = jest.spyOn(graphics, 'onDestroy');
    graphics._destroyImmediate();
    expect(onDestroy).not.toHaveBeenCalled();
    expect(mask.setGraphics).toHaveBeenLastCalledWith(null);
    expect(graphics._native).toBeNull();
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

test('Graphics restores authored styles and forwards an explicit renderer update to its native backend', () => {
    const { Graphics } = require('../../cocos/2d/components/graphics.jsb');
    const node = new Node('legacy-graphics');
    node.active = false;
    const graphics = node.addComponent(Graphics) as InstanceType<typeof import('../../cocos/2d/components/graphics.jsb').Graphics>;
    nativeGraphics.flushRenderData.mockClear();
    graphics.updateRenderer();
    expect(nativeGraphics.flushRenderData).not.toHaveBeenCalled();
    graphics.onLoad();
    Object.assign(graphics, { _lineWidth: 8, _lineCap: Graphics.LineCap.ROUND, _miterLimit: 5 });
    graphics.onRestore();
    expect(nativeGraphics.setLineWidth).toHaveBeenLastCalledWith(8);
    expect(nativeGraphics.setLineCap).toHaveBeenLastCalledWith(Graphics.LineCap.ROUND);
    expect(nativeGraphics.setMiterLimit).toHaveBeenLastCalledWith(5);
    graphics.updateRenderer();
    expect(nativeGraphics.flushRenderData).toHaveBeenCalledTimes(1);
    graphics.onDestroy();
    graphics.updateRenderer();
    expect(nativeGraphics.flushRenderData).toHaveBeenCalledTimes(1);
});

test('Graphics forwards legacy material refresh and supports a guarded model activation call', () => {
    const { Graphics } = require('../../cocos/2d/components/graphics.jsb');
    const node = new Node('legacy-graphics-material');
    node.active = false;
    const graphics = node.addComponent(Graphics) as any;
    const material = {};
    graphics.onLoad();
    graphics.customMaterial = material;
    nativeGraphics.setMaterial.mockClear();
    graphics.updateMaterial();
    expect(nativeGraphics.setMaterial).toHaveBeenCalledWith(material);
    graphics.customMaterial = null;
    expect(nativeGraphics.setMaterial).toHaveBeenLastCalledWith(null);
    expect(() => graphics.activeSubModel(0, 4, 6)).not.toThrow();
    expect('impl' in graphics).toBe(false);
    expect(graphics.model).toBeUndefined();
    expect(graphics.graphicsNativeProxy).toBeUndefined();
    graphics.onDestroy();
});


test.each([false, true])('Graphics preserves staged materials and pre-load instances (custom=%s)', (custom) => {
    const shared: any[] = [], instances: any[] = [];
    const backend = {
        ...nativeGraphics,
        setMaterial: jest.fn((value) => { shared[0] = value; instances[0] = null; }),
        setSharedMaterial: jest.fn((value, index) => { shared[index] = value; }),
        getSharedMaterialCount: () => shared.length,
        getSharedMaterial: (index) => shared[index] ?? null,
        getRenderMaterial: (index) => instances[index] ?? shared[index] ?? null,
        getMaterialInstanceCount: () => instances.length,
        getMaterialInstanceSlot: (index) => instances[index] ?? null,
        getMaterialInstance: (index) => instances[index] ?? (instances[index] = { parent: shared[index] }),
        writeMaterialSlot: jest.fn((isShared, index, value) => { (isShared ? shared : instances)[index] = value; }),
        resizeMaterials: jest.fn((size) => { shared.length = instances.length = size; }),
    };
    const previous = (global as any).n2d;
    (global as any).n2d = { Graphics: jest.fn(() => backend) };
    try {
        const { Graphics } = require('../../cocos/2d/components/graphics.jsb');
        const node = new Node('graphics-preload-material'); node.active = false;
        node.addComponent(UITransform);
        const graphics: any = node.addComponent(Graphics);
        const first = new Material(), second = new Material();
        graphics.sharedMaterials = [first, second];
        if (custom) graphics.customMaterial = first;
        graphics.fillRect(0, 0, 20, 10);
        expect(graphics.sharedMaterials).toEqual([first, second]);
        expect(shared).toEqual([first, second]);
        const instance = graphics.getMaterialInstance(0);
        expect(instance.parent).toBe(first);
        expect(instance._owner).toBe(graphics);
        expect(backend.setMaterial).toHaveBeenCalledTimes(1);
        graphics.onLoad();
        expect(graphics.getMaterialInstance(0)).toBe(instance);
        expect(instance._owner).toBe(graphics);
        expect(backend.setMaterial).toHaveBeenCalledTimes(1);
        graphics.onDestroy();
        expect(instance._owner).toBeNull();
        expect(shared).toEqual([]);
        expect(instances).toEqual([]);
    } finally { (global as any).n2d = previous; }
});
