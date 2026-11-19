import { instantiate, Size, Vec2 } from '../../exports/base';
import { Node } from '../../cocos/scene-graph/node';
import { getClassById } from '../../cocos/core/utils/js-typed';
import { deserialize } from '../../cocos/serialization/deserialize';
import { Sprite, UITransform } from '../../exports/2d';

test('UI classes resolve by serialized class id', function () {
    expect(getClassById('cc.UITransform')).toBe(UITransform);
    expect(getClassById('cc.Sprite')).toBe(Sprite);
});

test('UITransform is a registered component', function () {
    const node = new Node('ui-transform');
    const transform = node.addComponent(UITransform);

    expect(node.getComponent(UITransform)).toBe(transform);
    expect(transform.contentSize).toEqual(new Size(100, 100));
    expect(transform.anchorPoint).toEqual(new Vec2(0.5, 0.5));

    transform.contentSize = new Size(200, 150);
    transform.anchorPoint = new Vec2(0.25, 0.75);
    expect(transform.contentSize).toEqual(new Size(200, 150));
    expect(transform.anchorPoint).toEqual(new Vec2(0.25, 0.75));
});

test('UITransform deserializes from a scene record', function () {
    const data = [{
        __type__: 'cc.UITransform',
        _contentSize: { __type__: 'cc.Size', width: 64, height: 32 },
        _anchorPoint: { __type__: 'cc.Vec2', x: 0, y: 1 },
    }];
    const transform = deserialize(data, undefined, {
        classFinder: (id: string) => getClassById(id) as any,
    }) as UITransform;

    expect(transform).toBeInstanceOf(UITransform);
    expect(transform.contentSize).toEqual(new Size(64, 32));
    expect(transform.anchorPoint).toEqual(new Vec2(0, 1));
});

test('UITransform survives instantiate()', function () {
    const node = new Node('ui-clone');
    const transform = node.addComponent(UITransform);
    transform.contentSize = new Size(64, 32);
    transform.anchorPoint = new Vec2(0, 1);

    const clone = instantiate(node);
    const clonedTransform = clone.getComponent(UITransform);
    expect(clonedTransform).not.toBeNull();
    expect(clonedTransform!.contentSize).toEqual(new Size(64, 32));
    expect(clonedTransform!.anchorPoint).toEqual(new Vec2(0, 1));
});

test('Sprite is a registered component', function () {
    const node = new Node('ui-sprite');
    const sprite = node.addComponent(Sprite);

    expect(node.getComponent(Sprite)).toBe(sprite);
    expect(sprite.spriteFrame).toBeNull();
    expect(sprite.trim).toBe(true);
});
