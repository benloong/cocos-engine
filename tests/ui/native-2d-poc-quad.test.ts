import fs from 'fs';
import path from 'path';
import { Canvas, SpriteFrame, UITransform } from '../../cocos/2d';
import { Sprite } from '../../cocos/2d/components';
import { Texture2D } from '../../cocos/asset/assets';
import { Node } from '../../cocos/scene-graph/node';
import { Camera, Rect, Scene, Size, director } from '../../exports/base';
import { Batcher2D } from '../../cocos/2d/renderer/batcher-2d';
import { simple } from '../../cocos/2d/assembler/sprite/simple';

test('Native 2D PoC Web sprite quad', function () {
    // @ts-expect-error
    director.root!._batcher = new Batcher2D(director.root!);
    const scene = new Scene('native-2d-poc-quad');
    director.runSceneImmediate(scene);
    const canvasNode = new Node('Canvas');
    scene.addChild(canvasNode);
    canvasNode.addComponent(Canvas);
    canvasNode.addComponent(UITransform).setContentSize(new Size(320, 240));

    const cameraNode = new Node('UICamera');
    cameraNode.parent = canvasNode;
    cameraNode.addComponent(Camera);

    const node = new Node('Sprite');
    node.parent = canvasNode;
    const transform = node.addComponent(UITransform) as UITransform;
    transform.setAnchorPoint(0.5, 0.5);
    transform.setContentSize(new Size(100, 100));
    const sprite = node.addComponent(Sprite) as Sprite;

    const texture = new Texture2D();
    texture.reset({ width: 100, height: 100, format: Texture2D.PixelFormat.RGBA8888 });
    const frame = new SpriteFrame();
    frame.texture = texture;
    frame.rect = new Rect(0, 0, 100, 100);
    frame.originalSize = new Size(100, 100);
    sprite.spriteFrame = frame;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.updateRenderer();

    const renderData = sprite.renderData!;
    const { chunk, floatStride: stride } = renderData;
    const { meshBuffer } = chunk;
    const start = meshBuffer.indexOffset;
    simple.fillBuffers(sprite, director.root!.batcher2D);
    const indices = Array.from(meshBuffer.iData.subarray(start, meshBuffer.indexOffset), index => index - chunk.vertexOffset);
    expect(indices).toHaveLength(6);
    expect(renderData.vertexCount).toBe(4);
    const vertices: number[][] = [];
    for (let i = 0; i < renderData.vertexCount; ++i) {
        const { x, y, z } = renderData.data[i];
        const at = i * stride;
        const uv = chunk.vb.subarray(at + 3, at + 5);
        const rgba = chunk.vb.subarray(at + 5, at + 9);
        vertices.push([x, y, z, ...uv, ...Array.from(rgba, value => Math.round(value * 255))]);
    }

    const outDir = path.join(__dirname, '..', '..', 'native', 'tests', '2d-poc', 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'web-sprite-quad.json'), JSON.stringify({
        stride,
        vertices,
        indices,
    }, null, 2));

    expect(stride).toBe(9);
});
