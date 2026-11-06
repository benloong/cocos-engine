import fs from 'fs';
import path from 'path';
import { Canvas, SpriteFrame, UITransform } from '../../cocos/2d';
import { Sprite } from '../../cocos/2d/components';
import { Texture2D } from '../../cocos/asset/assets';
import { Node } from '../../cocos/scene-graph/node';
import { Camera, Rect, Scene, Size, director } from '../../exports/base';
import { Batcher2D } from '../../cocos/2d/renderer/batcher-2d';

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

    const renderData = sprite.renderData as any;
    expect(renderData).toBeTruthy();
    const vertices: number[][] = [];
    for (const v of renderData.data.slice(0, 4)) {
        vertices.push([v.x, v.y, v.z, v.u, v.v, v.color.r, v.color.g, v.color.b, v.color.a]);
    }
    const stride = 9;
    const iData = (renderData.chunk && renderData.chunk.meshBuffer && renderData.chunk.meshBuffer.iData)
        || renderData.indices
        || new Uint16Array([0, 1, 2, 1, 3, 2]);

    const outDir = path.join(__dirname, '..', '..', 'native', 'tests', '2d-poc', 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'web-sprite-quad.json'), JSON.stringify({
        stride,
        vertices,
        indices: Array.from(iData.slice(0, 6)),
    }, null, 2));

    console.log('WEB_SPRITE_QUAD', JSON.stringify({ stride, vertices, indices: Array.from(iData.slice(0, 6)) }));
    expect(stride).toBeGreaterThan(0);
    expect(iData.length).toBeGreaterThanOrEqual(6);
});
