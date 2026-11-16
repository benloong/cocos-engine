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
};

beforeAll(() => {
    (global as any).n2d = { Mask: jest.fn(() => nativeMask) };
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
