import { Canvas, SpriteFrame, UITransform } from "../../cocos/2d";
import { SpriteFrameEvent } from '../../cocos/2d/assets/sprite-frame';
import { Sprite, UIOpacity } from "../../cocos/2d/components";
import { Texture2D } from "../../cocos/asset/assets";
import { Node } from "../../cocos/scene-graph/node";
import { Camera, Scene, Size, Vec3, director, game, instantiate } from "../../exports/base";
import { Batcher2D } from "../../cocos/2d/renderer/batcher-2d";

test('Sprite.fillCenter keeps its Vec2 identity and releases its owner on destruction', () => {
    const node = new Node('radial-fill-center');
    const sprite = node.addComponent(Sprite);
    const center = sprite.fillCenter;
    center.set(.25, .75);
    expect(sprite.fillCenter).toBe(center);

    const copy = instantiate(node);
    const copiedCenter = copy.getComponent(Sprite)!.fillCenter;
    expect(copiedCenter).not.toBe(center);
    expect(copiedCenter.equals(center)).toBe(true);
    copiedCenter.x = .5;
    expect(center.x).toBe(.25);
    copy._destroyImmediate();
    node._destroyImmediate();

    expect(Object.getOwnPropertyDescriptor(center, 'x')?.get).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(copiedCenter, 'y')?.get).toBeUndefined();
    expect(center.x).toBe(.25);
    expect(copiedCenter.y).toBe(.75);
});

test('sprite.updateWorldMatrix', () => {

    // @ts-expect-error
    director.root!._batcher = new Batcher2D(director.root!);

    const scene = new Scene('test');
    director.runSceneImmediate(scene);

    let canvasNode = new Node("Canvas");
    scene.addChild(canvasNode);
    let canvas = canvasNode.addComponent(Canvas) as Canvas;
    let uitrs = canvasNode.addComponent(UITransform) as UITransform;
    uitrs.contentSize = new Size(600, 600);

    let uiCamera = new Node('UICamera');
    let camera = uiCamera.addComponent(Camera) as Camera;
    uiCamera.parent = canvasNode;
    canvas.cameraComponent = camera;
    // camera._createCamera();
    // camera.onEnable();

    let node = new Node('root');
    let spriteFrame = new SpriteFrame();
    let texture = new Texture2D();
    spriteFrame.texture = texture;

    node.setParent(canvasNode);

    let node1 = new Node('sprite1');
    node1.addComponent(Sprite);
    let sprite1 = node1.getComponent(Sprite) as Sprite;
    node1.parent = node;

    let node2 = new Node('sprite2');
    node2.addComponent(Sprite);
    let sprite2 = node2.getComponent(Sprite) as Sprite;
    node2.parent = node;

    let node3 = new Node('sprite3');
    node3.addComponent(Sprite);
    let sprite3 = node3.getComponent(Sprite) as Sprite;
    node3.parent = node;

    let node4 = new Node('sprite4');
    node4.addComponent(Sprite);
    let sprite4 = node4.getComponent(Sprite) as Sprite;
    node4.parent = node;

    let node5 = new Node('sprite5');
    node5.addComponent(Sprite);
    let sprite5 = node5.getComponent(Sprite) as Sprite;
    node5.parent = node;

    sprite1.spriteFrame = spriteFrame;
    sprite2.spriteFrame = spriteFrame;
    sprite3.spriteFrame = spriteFrame;
    sprite4.spriteFrame = spriteFrame;
    sprite5.spriteFrame = spriteFrame;

    sprite1.type = Sprite.Type.SIMPLE;
    sprite2.type = Sprite.Type.SLICED;
    sprite3.type = Sprite.Type.TILED;
    sprite4.type = Sprite.Type.FILLED;
    sprite5.type = Sprite.Type.FILLED;
    sprite4.fillType = Sprite.FillType.HORIZONTAL;
    sprite5.fillType = Sprite.FillType.RADIAL;

    sprite5.fillRange = 1;

    let opacity = node.addComponent(UIOpacity) as UIOpacity;

    // normal part
    node.setPosition(100, 100, 0);
    game.step();
    expect(sprite1.node._pos).toStrictEqual(new Vec3(100, 100, 0));
    expect(sprite2.node._pos).toStrictEqual(new Vec3(100, 100, 0));
    expect(sprite3.node._pos).toStrictEqual(new Vec3(100, 100, 0));
    expect(sprite4.node._pos).toStrictEqual(new Vec3(100, 100, 0));
    expect(sprite5.node._pos).toStrictEqual(new Vec3(100, 100, 0));

    // disabled part
    node.active = false;
    node.setPosition(200, 200, 0);
    game.step();
    node.active = true;
    game.step();
    expect(sprite1.node._pos).toStrictEqual(new Vec3(200, 200, 0));
    expect(sprite2.node._pos).toStrictEqual(new Vec3(200, 200, 0));
    expect(sprite3.node._pos).toStrictEqual(new Vec3(200, 200, 0));
    expect(sprite4.node._pos).toStrictEqual(new Vec3(200, 200, 0));
    expect(sprite5.node._pos).toStrictEqual(new Vec3(200, 200, 0));

    // opacity part
    opacity.opacity = 0;
    node.setPosition(300, 300, 0);
    game.step();
    opacity.opacity = 255;
    game.step();
    expect(sprite1.node._pos).toStrictEqual(new Vec3(300, 300, 0));
    expect(sprite2.node._pos).toStrictEqual(new Vec3(300, 300, 0));
    expect(sprite3.node._pos).toStrictEqual(new Vec3(300, 300, 0));
    expect(sprite4.node._pos).toStrictEqual(new Vec3(300, 300, 0));
    expect(sprite5.node._pos).toStrictEqual(new Vec3(300, 300, 0));

    // disabled & after node change part
    node.active = false;
    node.setPosition(200, 200, 0);
    game.step();
    sprite1.node.worldMatrix;
    sprite2.node.worldMatrix;
    sprite3.node.worldMatrix;
    sprite4.node.worldMatrix;
    sprite5.node.worldMatrix;
    node.active = true;
    game.step();
    expect(sprite1.renderData!.chunk.vb[0]).toStrictEqual(200 - 0.5);
    expect(sprite2.renderData!.chunk.vb[0]).toStrictEqual(200 - 0.5);
    expect(sprite3.renderData!.chunk.vb[0]).toStrictEqual(200 - 0.5);
    expect(sprite4.renderData!.chunk.vb[0]).toStrictEqual(200 - 0.5);
    expect(sprite5.renderData!.chunk.vb[0]).toStrictEqual(200 - 0.5);

    // opacity & after node change part
    opacity.opacity = 0;
    node.setPosition(300, 300, 0);
    game.step();
    sprite1.node.worldMatrix;
    sprite2.node.worldMatrix;
    sprite3.node.worldMatrix;
    sprite4.node.worldMatrix;
    sprite5.node.worldMatrix;
    opacity.opacity = 255;
    game.step();
    expect(sprite1.renderData!.chunk.vb[0]).toStrictEqual(300 - 0.5);
    expect(sprite2.renderData!.chunk.vb[0]).toStrictEqual(300 - 0.5);
    expect(sprite3.renderData!.chunk.vb[0]).toStrictEqual(300 - 0.5);
    expect(sprite4.renderData!.chunk.vb[0]).toStrictEqual(300 - 0.5);
    expect(sprite5.renderData!.chunk.vb[0]).toStrictEqual(300 - 0.5);
});

test('Sprite refreshes geometry and texture for UV changes only on its enabled frame', () => {
    const scene = new Scene('tiled frame changes');
    director.runSceneImmediate(scene);
    const node = new Node('tiled sprite');
    scene.addChild(node);
    const sprite = node.addComponent(Sprite);
    const texture = new Texture2D();
    const first = new SpriteFrame();
    const second = new SpriteFrame();
    first.texture = texture;
    second.texture = texture;

    sprite.type = Sprite.Type.TILED;
    sprite.spriteFrame = first;
    expect(first.hasEventListener(SpriteFrameEvent.UV_UPDATED)).toBe(true);

    sprite.enabled = false;
    expect(first.hasEventListener(SpriteFrameEvent.UV_UPDATED)).toBe(false);
    sprite.spriteFrame = second;
    expect(second.hasEventListener(SpriteFrameEvent.UV_UPDATED)).toBe(false);

    sprite.enabled = true;
    expect(second.hasEventListener(SpriteFrameEvent.UV_UPDATED)).toBe(true);
    sprite.spriteFrame = first;
    expect(second.hasEventListener(SpriteFrameEvent.UV_UPDATED)).toBe(false);
    expect(first.hasEventListener(SpriteFrameEvent.UV_UPDATED)).toBe(true);
    const modes = [
        [Sprite.Type.SIMPLE, Sprite.FillType.HORIZONTAL],
        [Sprite.Type.SLICED, Sprite.FillType.HORIZONTAL],
        [Sprite.Type.TILED, Sprite.FillType.HORIZONTAL],
        [Sprite.Type.FILLED, Sprite.FillType.HORIZONTAL],
        [Sprite.Type.FILLED, Sprite.FillType.RADIAL],
    ] as const;
    for (const [type, fillType] of modes) {
        sprite.type = type;
        sprite.fillType = fillType;
        const data = sprite.renderData!;
        data.vertDirty = false;
        data.textureDirty = false;
        const update = jest.spyOn(sprite, '_markForUpdateRenderData');
        first.emit(SpriteFrameEvent.UV_UPDATED, first);
        expect(update).toHaveBeenCalledTimes(1);
        expect(data.vertDirty).toBe(true);
        expect(data.textureDirty).toBe(true);
        update.mockRestore();
    }
    node._destroyImmediate();
    expect(first.hasEventListener(SpriteFrameEvent.UV_UPDATED)).toBe(false);
});
