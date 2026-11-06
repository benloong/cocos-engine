import { Canvas, SpriteFrame, UITransform } from '../../cocos/2d';
import { Sprite } from '../../cocos/2d/components';
import { Texture2D } from '../../cocos/asset/assets';
import { Node } from '../../cocos/scene-graph/node';
import { Camera, Scene, Size, director } from '../../exports/base';
import { Batcher2D } from '../../cocos/2d/renderer/batcher-2d';

function createScene (): Node {
    // @ts-expect-error
    director.root!._batcher = new Batcher2D(director.root!);

    const scene = new Scene('native-2d-poc-bench');
    director.runSceneImmediate(scene);

    const canvasNode = new Node('Canvas');
    scene.addChild(canvasNode);
    const canvas = canvasNode.addComponent(Canvas) as Canvas;
    const canvasTransform = canvasNode.addComponent(UITransform) as UITransform;
    canvasTransform.contentSize = new Size(600, 600);

    const cameraNode = new Node('UICamera');
    const camera = cameraNode.addComponent(Camera) as Camera;
    cameraNode.parent = canvasNode;
    canvas.cameraComponent = camera;
    return canvasNode;
}

test('JS Sprite updateRenderer baseline', function () {
    const canvasNode = createScene();

    const frame = new SpriteFrame();
    frame.texture = new Texture2D();

    const node = new Node('sprite');
    node.setParent(canvasNode);
    node.addComponent(UITransform);
    node.addComponent(Sprite);
    const sprite = node.getComponent(Sprite) as Sprite;
    sprite.spriteFrame = frame;
    sprite.updateRenderer();

    const iterations = 10000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        sprite.markForUpdateRenderData(true);
        sprite.updateRenderer();
    }
    const elapsedMs = performance.now() - start;
    const nsPerOp = (elapsedMs * 1e6) / iterations;
    console.log(`JS sprite updateRenderer: ${nsPerOp.toFixed(1)} ns/op`);

    const sceneSize = 1000;
    const gc = (global as any).gc as (() => void) | undefined;
    if (gc) gc();
    const heapBefore = process.memoryUsage().heapUsed;
    const sceneSprites: Sprite[] = [];
    for (let i = 0; i < sceneSize; i++) {
        const sceneNode = new Node(`sprite-${i}`);
        sceneNode.setParent(canvasNode);
        sceneNode.setPosition((i % 40) * 10, Math.floor(i / 40) * 10, 0);
        sceneNode.addComponent(UITransform);
        sceneNode.addComponent(Sprite);
        const sceneSprite = sceneNode.getComponent(Sprite) as Sprite;
        sceneSprite.spriteFrame = frame;
        sceneSprites.push(sceneSprite);
    }
    if (gc) gc();
    const heapAfter = process.memoryUsage().heapUsed;
    console.log(`JS heap per sprite: ${((heapAfter - heapBefore) / sceneSize).toFixed(0)} bytes${gc ? ' (gc)' : ''}`);

    const sceneTimes: number[] = [];
    for (let pass = 0; pass < 3; pass++) {
        const sceneStart = performance.now();
        for (const sceneSprite of sceneSprites) {
            sceneSprite.markForUpdateRenderData(true);
            sceneSprite.updateRenderer();
        }
        sceneTimes.push(performance.now() - sceneStart);
    }
    const bestSceneMs = Math.min(...sceneTimes);
    console.log(`JS sprite scene: ${sceneSize} sprites, ${(bestSceneMs * 1000).toFixed(1)} us total, ${((bestSceneMs * 1e6) / sceneSize).toFixed(1)} ns/sprite (best of 3)`);

    expect(nsPerOp).toBeGreaterThan(0);
    expect(bestSceneMs).toBeGreaterThan(0);
});
