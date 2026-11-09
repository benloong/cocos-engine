import { Node } from '../../cocos/scene-graph/node';
import { UITransform } from '../../cocos/2d/framework/ui-transform';
import { Color } from '../../cocos/core/math/color';

const nativeSprite = {
    setNode: jest.fn(),
    setUITransform: jest.fn(),
    setColorRGBA: jest.fn(),
    setPriority: jest.fn(),
    setEnabled: jest.fn(),
    setFrame: jest.fn(),
    clearFrame: jest.fn(),
};

beforeAll(() => {
    (global as any).n2d = {
        Sprite: jest.fn(() => nativeSprite),
    };
});

test('Sprite M2 shell attaches and forwards SIMPLE frame data', () => {
    const { Sprite } = require('../../cocos/2d/components/sprite.jsb') as typeof import('../../cocos/2d/components/sprite.jsb');
    const node = new Node('sprite');
    node.addComponent(UITransform);
    const sprite = node.addComponent(Sprite) as InstanceType<typeof Sprite>;

    sprite.onLoad();
    expect((global as any).n2d.Sprite).toHaveBeenCalled();
    expect(nativeSprite.setNode).toHaveBeenCalledWith(node);
    expect(nativeSprite.setColorRGBA).toHaveBeenCalledWith(255, 255, 255, 255);

    const texture = { width: 128, height: 256 };
    sprite.spriteFrame = {
        texture,
        rect: { x: 1, y: 2, width: 3, height: 4 },
        originalSize: { width: 5, height: 6 },
        offset: { x: 7, y: 8 },
        rotated: false,
    } as any;
    expect(nativeSprite.setFrame).toHaveBeenLastCalledWith(
        texture, 1, 2, 3, 4, 5, 6, 7, 8, 128, 256, false,
    );

    sprite.color = new Color(10, 20, 30, 255);
    expect(nativeSprite.setColorRGBA).toHaveBeenLastCalledWith(10, 20, 30, 255);
    sprite.onDisable();
    expect(nativeSprite.setEnabled).toHaveBeenLastCalledWith(false);
    sprite.onDestroy();
    expect(nativeSprite.setEnabled).toHaveBeenLastCalledWith(false);
    expect(nativeSprite.setNode).toHaveBeenLastCalledWith(null);
});
