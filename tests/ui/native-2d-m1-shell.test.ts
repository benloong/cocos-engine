import { Node } from '../../cocos/scene-graph/node';
import { Mat4, Size, Vec2, Vec3 } from '../../exports/base';

const nativeUITransform = {
    sizeChanged: null as ((width: number, height: number) => void) | null,
    setSizeChangedCallback: jest.fn(function (callback) { this.sizeChanged = callback; }),
    setContentSizeXY: jest.fn(function (width, height) { this.sizeChanged?.(width, height); }),
    setAnchorPointXY: jest.fn(),
    setPriority: jest.fn(),
    getBoundingBoxX: jest.fn(() => 1),
    getBoundingBoxY: jest.fn(() => 2),
    getBoundingBoxWidth: jest.fn(() => 3),
    getBoundingBoxHeight: jest.fn(() => 4),
    getBoundingBoxToWorldX: jest.fn(() => 5),
    getBoundingBoxToWorldY: jest.fn(() => 6),
    getBoundingBoxToWorldWidth: jest.fn(() => 7),
    getBoundingBoxToWorldHeight: jest.fn(() => 8),
    getBoundingBoxToX: jest.fn(() => 9),
    getBoundingBoxToY: jest.fn(() => 10),
    getBoundingBoxToWidth: jest.fn(() => 11),
    getBoundingBoxToHeight: jest.fn(() => 12),
    convertToNodeSpaceARX: jest.fn((x: number) => x + 1),
    convertToNodeSpaceARY: jest.fn((y: number) => y + 2),
    convertToWorldSpaceARX: jest.fn((x: number) => x + 3),
    convertToWorldSpaceARY: jest.fn((y: number) => y + 4),
    containsWorldPointXY: jest.fn(() => true),
    hitTestXY: jest.fn(() => true),
    detach: jest.fn(function () { this.sizeChanged = null; }),
};

const nativeUIOpacity = {
    setOpacity: jest.fn(),
    setActive: jest.fn(),
    detach: jest.fn(),
};

beforeAll(() => {
    (global as any).n2d = {
        UITransform: jest.fn(() => nativeUITransform),
        UIOpacity: jest.fn(() => nativeUIOpacity),
    };
});

test('UITransform shell attaches and forwards to native', () => {
    const { UITransform } = require('../../cocos/2d/framework/ui-transform.jsb') as typeof import('../../cocos/2d/framework/ui-transform.jsb');
    const node = new Node('shell');
    const ui = node.addComponent(UITransform) as InstanceType<typeof UITransform>;

    ui.onLoad();
    expect((global as any).n2d.UITransform).toHaveBeenCalledWith(node);
    expect(nativeUITransform.setContentSizeXY).toHaveBeenCalledWith(100, 100);

    ui.contentSize = new Size(64, 32);
    expect(nativeUITransform.setContentSizeXY).toHaveBeenLastCalledWith(64, 32);
    const changes = jest.fn(() => expect(ui.height).toBe(48));
    node.on('size-changed', changes);
    nativeUITransform.sizeChanged!(75, 48);
    expect(changes).toHaveBeenCalledTimes(1);
    node.off('size-changed', changes);
    expect(ui.contentSize).toEqual(new Size(75, 48));
    const anchors = jest.fn((_point: Vec2) => expect(nativeUITransform.setAnchorPointXY).toHaveBeenLastCalledWith(0.25, 0.75));
    node.on('anchor-changed', anchors);
    ui.setAnchorPoint(0.25, 0.75);
    ui.setAnchorPoint(0.25, 0.75);
    expect(anchors).toHaveBeenCalledTimes(1);
    expect(anchors.mock.calls[0][0]).toEqual(new Vec2(0.25, 0.75));

    expect(ui.getBoundingBox().x).toBe(1);
    const bounds = ui.getComputeAABB();
    expect(bounds.center).toEqual(new Vec3(8.5, 10, 0));
    expect(bounds.halfExtents).toEqual(new Vec3(3.5, 4, 0));
    expect(ui.hitTest(new Vec2(10, 20))).toBe(true);
    expect(nativeUITransform.hitTestXY).toHaveBeenCalledWith(10, 20, 0);
    expect(ui.hitTest(new Vec2(10, 20), 3)).toBe(true);
    expect(nativeUITransform.hitTestXY).toHaveBeenLastCalledWith(10, 20, 3);
    expect(ui.getBoundingBoxTo(new Mat4()).x).toBe(9);
    expect(ui.convertToWorldSpaceAR(new Vec3(1, 2, 0)).x).toBe(4);

    ui.onDestroy();
    expect(nativeUITransform.detach).toHaveBeenCalled();
    expect(nativeUITransform.sizeChanged).toBeNull();
});

test('UIOpacity shell attaches and forwards to native', () => {
    const { UIOpacity } = require('../../cocos/2d/components/ui-opacity.jsb') as typeof import('../../cocos/2d/components/ui-opacity.jsb');
    const node = new Node('opacity');
    const opacity = node.addComponent(UIOpacity) as InstanceType<typeof UIOpacity>;

    opacity.onLoad();
    expect((global as any).n2d.UIOpacity).toHaveBeenCalledWith(node);
    expect(nativeUIOpacity.setActive).toHaveBeenLastCalledWith(false);
    expect(nativeUIOpacity.setOpacity).not.toHaveBeenCalled();

    opacity.onEnable();
    expect(nativeUIOpacity.setOpacity).toHaveBeenCalledWith(255);
    expect(nativeUIOpacity.setActive).toHaveBeenLastCalledWith(true);

    opacity.opacity = 128;
    expect(nativeUIOpacity.setOpacity).toHaveBeenLastCalledWith(128);
    opacity.onDisable();
    expect(nativeUIOpacity.setActive).toHaveBeenLastCalledWith(false);

    opacity.onDestroy();
    expect(nativeUIOpacity.detach).toHaveBeenCalled();
});
