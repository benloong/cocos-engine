import { Node } from '../../cocos/scene-graph/node';
import { UITransform } from '../../cocos/2d/framework/ui-transform';
import { Color } from '../../cocos/core/math/color';

const nativeFrame = {
    setTexture: jest.fn(),
    setUuid: jest.fn(),
    setName: jest.fn(),
    setRect: jest.fn(),
    setOriginalSize: jest.fn(),
    setOffset: jest.fn(),
    setRotated: jest.fn(),
    setInsets: jest.fn(),
};

const nativeMaterial = { parent: null } as any;

const nativeSprite = {
    setNode: jest.fn(),
    setUITransform: jest.fn(),
    setColorRGBA: jest.fn(),
    setMaterial: jest.fn(),
    setSharedMaterial: jest.fn(),
    getSharedMaterial: jest.fn(() => ({})),
    getMaterialInstance: jest.fn(() => nativeMaterial),
    setType: jest.fn(),
    setFillType: jest.fn(),
    setFillStart: jest.fn(),
    setFillRange: jest.fn(),
    setFillCenter: jest.fn(),
    setSizeMode: jest.fn(),
    setSrcBlendFactor: jest.fn(),
    setDstBlendFactor: jest.fn(),
    setPriority: jest.fn(),
    setEnabled: jest.fn(),
    setFrame: jest.fn(),
    clearFrame: jest.fn(),
};

beforeAll(() => {
    (global as any).n2d = {
        Sprite: jest.fn(() => nativeSprite),
        SpriteFrame: jest.fn(() => nativeFrame),
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
    expect(nativeSprite.setType).toHaveBeenCalledWith(0);
    expect(nativeSprite.setFillType).toHaveBeenCalledWith(0);
    expect(nativeSprite.setFillRange).toHaveBeenCalledWith(1);
    expect(nativeSprite.setSizeMode).toHaveBeenCalledWith(1);
    expect(nativeSprite.setSrcBlendFactor).toHaveBeenCalled();
    expect(nativeSprite.setDstBlendFactor).toHaveBeenCalled();
    expect(nativeSprite.setColorRGBA).toHaveBeenCalledWith(255, 255, 255, 255);

    const texture = { width: 128, height: 256 };
    sprite.spriteFrame = {
        texture,
        native: nativeFrame,
        uuid: 'frame-uuid',
        name: 'frame-name',
        rect: { x: 1, y: 2, width: 3, height: 4 },
        originalSize: { width: 5, height: 6 },
        offset: { x: 7, y: 8 },
        rotated: false,
        insetLeft: 1,
        insetRight: 2,
        insetTop: 3,
        insetBottom: 4,
    } as any;
    expect(nativeSprite.setFrame).toHaveBeenLastCalledWith(nativeFrame);

    sprite.color = new Color(10, 20, 30, 255);
    expect(nativeSprite.setColorRGBA).toHaveBeenLastCalledWith(10, 20, 30, 255);
    const material = {} as any;
    sprite.customMaterial = material;
    expect(nativeSprite.setMaterial).toHaveBeenLastCalledWith(material);
    const material2 = {} as any;
    sprite.setSharedMaterial(material2, 1);
    expect(nativeSprite.setSharedMaterial).toHaveBeenLastCalledWith(material2, 1);
    const instance = sprite.getMaterialInstance(0);
    expect(instance).toBe(nativeMaterial);
    const shared = sprite.getSharedMaterial(0);
    expect(shared).toEqual({});
    expect(nativeSprite.getSharedMaterial).toHaveBeenCalledWith(0);
    sprite.onDisable();
    expect(nativeSprite.setEnabled).toHaveBeenLastCalledWith(false);
    sprite.onDestroy();
    expect(nativeSprite.setEnabled).toHaveBeenLastCalledWith(false);
    expect(nativeSprite.setNode).toHaveBeenLastCalledWith(null);
});
