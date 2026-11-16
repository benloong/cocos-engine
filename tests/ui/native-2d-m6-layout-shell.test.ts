import { Node } from '../../cocos/scene-graph/node';
import { UITransform } from '../../cocos/2d/framework/ui-transform';
import { builtinResMgr } from '../../cocos/asset/asset-manager/builtin-res-mgr';

const nativeGraphics = {
    setNode: jest.fn(), setUITransform: jest.fn(), setPriority: jest.fn(), setEnabled: jest.fn(),
    setLineWidth: jest.fn(), setFillColor: jest.fn(), setStrokeColor: jest.fn(), setMaterial: jest.fn(),
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
    expect(nativeGraphics.setMaterial).not.toHaveBeenCalled();
    expect(nativeGraphics.setLineWidth).toHaveBeenCalledWith(1);
    graphics.onDestroy();
    expect(nativeGraphics.setNode).toHaveBeenLastCalledWith(null);
    getBuiltin.mockRestore();
});
