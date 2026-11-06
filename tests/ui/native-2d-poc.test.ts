import { instantiate, Size, Vec2 } from '../../exports/base';
import { Node } from '../../cocos/scene-graph/node';
import { getClassById } from '../../cocos/core/utils/js-typed';
import { deserialize } from '../../cocos/serialization/deserialize';
import { NativeSpritePoc, NativeUITransformPoc } from '../../exports/native-2d-poc';

test('PoC classes resolve by serialized class id', function () {
    expect(getClassById('cc.NativeUITransformPoc')).toBe(NativeUITransformPoc);
    expect(getClassById('cc.NativeSpritePoc')).toBe(NativeSpritePoc);
});

test('NativeUITransformPoc is a registered component', function () {
    const node = new Node('poc-transform');
    const transform = node.addComponent(NativeUITransformPoc);

    expect(node.getComponent(NativeUITransformPoc)).toBe(transform);
    expect(transform.contentSize).toEqual(new Size(100, 100));
    expect(transform.anchorPoint).toEqual(new Vec2(0.5, 0.5));

    transform.contentSize = new Size(200, 150);
    transform.anchorPoint = new Vec2(0.25, 0.75);
    expect(transform.contentSize).toEqual(new Size(200, 150));
    expect(transform.anchorPoint).toEqual(new Vec2(0.25, 0.75));
});

test('NativeUITransformPoc deserializes from a scene record', function () {
    const data = [{
        __type__: 'cc.NativeUITransformPoc',
        _contentSize: { __type__: 'cc.Size', width: 64, height: 32 },
        _anchorPoint: { __type__: 'cc.Vec2', x: 0, y: 1 },
    }];
    const transform = deserialize(data, undefined, {
        classFinder: (id: string) => getClassById(id) as any,
    }) as NativeUITransformPoc;

    expect(transform).toBeInstanceOf(NativeUITransformPoc);
    expect(transform.contentSize).toEqual(new Size(64, 32));
    expect(transform.anchorPoint).toEqual(new Vec2(0, 1));
});

test('NativeUITransformPoc survives instantiate()', function () {
    const node = new Node('poc-clone');
    const transform = node.addComponent(NativeUITransformPoc);
    transform.contentSize = new Size(64, 32);
    transform.anchorPoint = new Vec2(0, 1);

    const clone = instantiate(node);
    const clonedTransform = clone.getComponent(NativeUITransformPoc);
    expect(clonedTransform).not.toBeNull();
    expect(clonedTransform!.contentSize).toEqual(new Size(64, 32));
    expect(clonedTransform!.anchorPoint).toEqual(new Vec2(0, 1));
});

test('NativeSpritePoc is a registered component', function () {
    const node = new Node('poc-sprite');
    const sprite = node.addComponent(NativeSpritePoc);

    expect(node.getComponent(NativeSpritePoc)).toBe(sprite);
    expect(sprite.spriteFrame).toBeNull();
    expect(sprite.trim).toBe(true);
});
