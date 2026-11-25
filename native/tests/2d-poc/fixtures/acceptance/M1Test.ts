import { _decorator, builtinResMgr, Canvas, Color, Component, director, instantiate, Label, Material, Node, Prefab, Rect, RenderTexture, resources, screen, Size, Sprite, SpriteFrame, Texture2D, UIOpacity, UITransform, Vec2, Vec3 } from 'cc';

import { LabelSpike } from './LabelSpike';
import { M4Probe } from './M4Probe';
import { M4ExtraProbe } from './M4ExtraProbe';
import { RichTextProbe } from './RichTextProbe';

const { ccclass } = _decorator;

@ccclass('M1Test')
export class M1Test extends Component {
    public start(): void {
        if (director.getScene()?.name === 'm5-test') {
            RichTextProbe.run(this.node);
            return;
        }
        setTimeout(() => M4Probe.run(this.node), 10000);
        setTimeout(() => M4ExtraProbe.run(this.node), 16000);
        setTimeout(() => RichTextProbe.run(this.node), 22000);

        const node: Node | null = this.node.getChildByName('M1TestNode')
            ?? this.node.getChildByName('M1TestNode-001');
        const transform = node?.getComponent(UITransform) ?? null;
        if (transform) this.probeScreenHit(transform);
        LabelSpike.run(this.node);
        const opacity = node?.getComponent(UIOpacity) ?? null;
        const box = transform?.getBoundingBoxToWorld();
        const world: Vec3 | null = transform ? transform.convertToWorldSpaceAR(new Vec3(0, 0, 0)) : null;
        const payload = {
            contentSize: transform?.contentSize,
            opacity: opacity?.opacity,
            box,
            world,
        };
        console.log(`M1_TEST_NODE ${JSON.stringify(payload)}`);
        const label = node?.getComponent(Label) ?? null;
        if (label) {
            console.log(`M1_LABEL ${JSON.stringify({
                string: label.string,
                size: label.node.getComponent(UITransform)?.contentSize,
            })}`);
        }
        const sprite = node?.getComponent(Sprite) ?? null;
        if (sprite) {
            console.log(`M1_SPRITE ${JSON.stringify({
                hasFrame: sprite.spriteFrame !== null,
                size: sprite.node.getComponent(UITransform)?.contentSize,
            })}`);
            const texture = builtinResMgr.get<Texture2D>('default-texture');
            if (texture) {
                const frame = new SpriteFrame();
                frame.texture = texture;
                frame.rect = new Rect(0, 0, 16, 16);
                frame.originalSize = new Size(16, 16);
                sprite.spriteFrame = frame;
                sprite.color = new Color(255, 0, 0, 255);
                this.scheduleOnce(() => {
                    console.log(`M1_SPRITE_FRAME ${JSON.stringify({
                        hasFrame: sprite.spriteFrame !== null,
                    })}`);
                }, 0.1);
            }
            const probeTexture = new Texture2D();
            probeTexture.reset({ width: 64, height: 64, format: Texture2D.PixelFormat.RGBA8888 });
            const pixels = new Uint8Array(64 * 64 * 4);
            for (let i = 0; i < pixels.length; i += 4) {
                pixels[i] = 255;
                pixels[i + 1] = 0;
                pixels[i + 2] = 0;
                pixels[i + 3] = 255;
            }
            probeTexture.uploadData(pixels);
            const probeFrame = new SpriteFrame();
            probeFrame.texture = probeTexture;
            probeFrame.rect = new Rect(0, 0, 64, 64);
            probeFrame.originalSize = new Size(64, 64);
            sprite.spriteFrame = probeFrame;
            this.runPixelProbe(sprite);
            const builtinMaterial = builtinResMgr.get<Material>('ui-sprite-material');
            if (builtinMaterial) {
                sprite.customMaterial = builtinMaterial;
                const materialInstance = sprite.getMaterialInstance(0);
                console.log(`M2_MATERIAL_INSTANCE ${JSON.stringify({
                    hasMaterial: true,
                    hasInstance: materialInstance !== null,
                    distinct: materialInstance !== builtinMaterial,
                })}`);
                sprite.customMaterial = null;
            }
            this.scheduleOnce(() => {
                console.log(`M1_SPRITE_TEXTURE ${JSON.stringify({ hasFrame: sprite.spriteFrame !== null })}`);
            }, 0.1);
        }
        if (transform) {
            const uiHit = transform.isHit(new Vec2(640, 480));
            const uiMiss = transform.isHit(new Vec2(10, 10));
            console.log(`M1_UI_HIT ${JSON.stringify({ hit: uiHit, miss: uiMiss })}`);

            const perfStart = Date.now();
            for (let i = 0; i < 1000; i++) {
                transform.getBoundingBoxToWorld();
            }
            console.log(`M1_PERF ${JSON.stringify({
                calls: 1000,
                ms: Date.now() - perfStart,
            })}`);
        }
        if (typeof document !== 'undefined') {
            let output = document.getElementById('m1-test-output');
            if (!output) {
                output = document.createElement('pre');
                output.id = 'm1-test-output';
                document.body.appendChild(output);
            }
            output.textContent = `M1_TEST_NODE ${JSON.stringify(payload)}`;
        }

        if (node) {
            const clone = instantiate(node) as Node;
            clone.name = 'M1TestClone';
            clone.setPosition(100, 0, 0);
            this.node.addChild(clone);
            this.scheduleOnce(() => {
                const cloneTransform = clone.getComponent(UITransform);
                const cloneOpacity = clone.getComponent(UIOpacity);
                const cloneBox = cloneTransform?.getBoundingBoxToWorld();
                const cloneWorld = cloneTransform
                    ? cloneTransform.convertToWorldSpaceAR(new Vec3(0, 0, 0))
                    : null;
                console.log(`M1_CLONE ${JSON.stringify({
                    contentSize: cloneTransform?.contentSize,
                    opacity: cloneOpacity?.opacity,
                    box: cloneBox,
                    world: cloneWorld,
                })}`);
            }, 0.1);
        }

        resources.load('M1Prefab', Prefab, (err, prefab) => {
            if (err || !prefab) {
                console.log(`M1_PREFAB_ERROR ${err?.message ?? 'null prefab'}`);
                return;
            }
            const prefabNode = instantiate(prefab) as Node;
            prefabNode.name = 'M1PrefabInstance';
            prefabNode.setPosition(-100, 0, 0);
            this.node.addChild(prefabNode);
            this.scheduleOnce(() => {
                const prefabTransform = prefabNode.getComponent(UITransform);
                const prefabOpacity = prefabNode.getComponent(UIOpacity);
                const prefabBox = prefabTransform?.getBoundingBoxToWorld();
                const prefabWorld = prefabTransform
                    ? prefabTransform.convertToWorldSpaceAR(new Vec3(0, 0, 0))
                    : null;
                console.log(`M1_PREFAB ${JSON.stringify({
                    contentSize: prefabTransform?.contentSize,
                    opacity: prefabOpacity?.opacity,
                    box: prefabBox,
                    world: prefabWorld,
                })}`);
            }, 0.2);
        });
    }

    private probeScreenHit(transform: UITransform): void {
        const camera = director.getScene()?.getComponentInChildren(Canvas)?.cameraComponent;
        if (!camera) throw new Error('M1 screen hit test requires the canvas camera');
        camera.camera.update(true);
        const windowId = camera.camera.systemWindowId;
        const windowSize = screen.windowSize;
        const center = new Vec2(windowSize.width / 2, windowSize.height / 2);
        const outside = new Vec2(10, 10);
        const projected = camera.worldToScreen(transform.node.worldPosition);
        const wrongWindowId = windowId === 1 ? 2 : 1;
        console.log(`M1_HIT ${JSON.stringify({
            hit: transform.hitTest(center, windowId), miss: transform.hitTest(outside, windowId),
            omitted: transform.hitTest(center), explicitZero: transform.hitTest(center, 0),
            wrongWindowId, wrongWindow: transform.hitTest(center, wrongWindowId),
            windowId, windowSize, center, outside, projected: [projected.x, projected.y],
            screenTarget: camera.targetTexture === null && !!camera.camera.window?.swapchain,
        })}`);
    }

    private runPixelProbe(sprite: Sprite): void {
        const canvas = director.getScene()?.getComponentInChildren(Canvas) ?? null;
        const camera = canvas?.cameraComponent ?? null;
        if (!camera) {
            console.log('M2_PIXEL_ERROR no canvas camera');
            return;
        }

        const hiddenExtras: Array<{ node: Node; active: boolean }> = [];
        for (const name of ['M1TestClone', 'M1PrefabInstance']) {
            const extra = this.node.getChildByName(name);
            if (extra) {
                hiddenExtras.push({ node: extra, active: extra.active });
                extra.active = false;
            }
        }
        const renderTexture = new RenderTexture();
        renderTexture.reset({ width: 256, height: 256 });
        const probeTransform = sprite.node.getComponent(UITransform);
        probeTransform?.setContentSize(64, 64);
        const oldTarget = camera.targetTexture;
        const oldOrthoHeight = camera.orthoHeight;
        camera.targetTexture = renderTexture;
        camera.orthoHeight = renderTexture.height / 2;
        if (probeTransform) {
            camera.camera.update(true);
            const projected = camera.worldToScreen(probeTransform.node.worldPosition);
            const windowId = camera.camera.systemWindowId;
            console.log(`M1_HIT_OFFSCREEN ${JSON.stringify({
                windowId, projected: [projected.x, projected.y], size: [renderTexture.width, renderTexture.height],
                offscreenTarget: camera.targetTexture === renderTexture && !!camera.camera.window && !camera.camera.window.swapchain,
                hit: probeTransform.hitTest(new Vec2(projected.x, projected.y), windowId),
            })}`);
        }
        console.log(`M2_RT ${JSON.stringify({
            hasWindow: renderTexture.window !== null,
            windowSize: renderTexture.window ? [renderTexture.window.width, renderTexture.window.height] : null,
            targetApplied: camera.targetTexture === renderTexture,
        })}`);
        sprite.sizeMode = 0;

        const modes: Array<{ name: string; apply: () => void }> = [
            { name: 'SIMPLE', apply: () => { sprite.type = 0; } },
            { name: 'SLICED', apply: () => { sprite.type = 1; } },
            { name: 'TILED', apply: () => { sprite.type = 2; } },
            { name: 'FILLED_H', apply: () => { sprite.type = 3; sprite.fillType = 0; sprite.fillStart = 0; sprite.fillRange = 1; } },
            { name: 'FILLED_RADIAL', apply: () => { sprite.type = 3; sprite.fillType = 2; sprite.fillStart = 0; sprite.fillRange = 1; } },
        ];

        const results: Array<{ mode: string; red: number; maxR: number }> = [];
        const finish = (): void => {
            const ok = results.length === modes.length && results.every((item) => item.red > 0 && item.maxR > 50);
            const payload = { ok, results };
            console.log(`M2_PIXEL_RESULT ${JSON.stringify(payload)}`);
            console.log(ok ? "M2_PIXEL_PASS" : "M2_PIXEL_FAIL");
            if (typeof document !== 'undefined') {
                const output = document.getElementById('m1-test-output');
                if (output) {
                    output.textContent = `M2_PIXEL_RESULT ${JSON.stringify(payload)}`;
                }
            }
            camera.orthoHeight = oldOrthoHeight;
            camera.targetTexture = oldTarget;
            for (const item of hiddenExtras) {
                item.node.active = item.active;
            }
            renderTexture.destroy();
        };

        const step = (index: number): void => {
            if (index >= modes.length) {
                finish();
                return;
            }
            modes[index].apply();
            camera.orthoHeight = 128;
            this.scheduleOnce(() => {
                try {
                    const pixels = renderTexture.readPixels();
                    if (!pixels) {
                        console.log(`M2_PIXEL_ERROR ${modes[index].name} null`);
                    } else {
                        let red = 0;
                        let checksum = 0;
                        let maxR = 0;
                        let maxG = 0;
                        let maxB = 0;
                        let nonzeroAlpha = 0;
                        const sample: number[] = [];
                        for (let i = 0; i < pixels.length; i += 4) {
                            const r = pixels[i];
                            const g = pixels[i + 1];
                            const b = pixels[i + 2];
                            const a = pixels[i + 3];
                            if (sample.length < 12) {
                                sample.push(r, g, b, a);
                            }
                            maxR = Math.max(maxR, r);
                            maxG = Math.max(maxG, g);
                            maxB = Math.max(maxB, b);
                            if (a > 0) {
                                nonzeroAlpha++;
                            }
                            checksum = (checksum + r + g + b + a) >>> 0;
                            if (a > 0 && r > 50 && g < 20 && b < 20) {
                                red++;
                            }
                        }
                        const centerOffset = ((renderTexture.height >> 1) * renderTexture.width + (renderTexture.width >> 1)) * 4;
                        const center = [pixels[centerOffset], pixels[centerOffset + 1], pixels[centerOffset + 2], pixels[centerOffset + 3]];
                        results.push({ mode: modes[index].name, red, maxR, center } as any);
                        console.log(`M2_PIXEL ${JSON.stringify({
                            mode: modes[index].name,
                            width: renderTexture.width,
                            height: renderTexture.height,
                            bytes: pixels.length,
                            red,
                            checksum,
                            maxR,
                            maxG,
                            maxB,
                            nonzeroAlpha,
                            sample,
                        })}`);
                    }
                } catch (error) {
                    console.log(`M2_PIXEL_ERROR ${modes[index].name} ${String(error)}`);
                }
                step(index + 1);
            }, 0.15);
        };

        this.scheduleOnce(() => step(0), 0.2);
    }
}
