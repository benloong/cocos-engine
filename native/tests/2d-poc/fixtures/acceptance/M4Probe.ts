import {
    builtinResMgr,
    Camera,
    Canvas,
    Color,
    director,
    native,
    sys,
    Graphics,
    DynamicAtlasManager,
    dynamicAtlasManager,
    ImageAsset,
    Mask,
    Material,
    Node,
    Rect,
    RenderTexture,
    Size,
    Sprite,
    SpriteFrame,
    Texture2D,
    UITransform,
} from 'cc';

/** M4 Mask + Graphics probe. */
export class M4Probe {
    public static run (parent: Node): void {
        // A local manager owns these frames; Web auto packing must not preempt it.
        const autoPacking = dynamicAtlasManager.enabled;
        dynamicAtlasManager.enabled = false;
        const texture = new Texture2D();
        texture.reset({ width: 8, height: 8, format: Texture2D.PixelFormat.RGBA8888 });
        const pixels = new Uint8Array(8 * 8 * 4);
        for (let i = 0; i < pixels.length; i += 4) { pixels[i] = 255; pixels[i + 3] = 255; }
        texture.image = new ImageAsset({ _data: pixels, width: 8, height: 8, format: Texture2D.PixelFormat.RGBA8888 } as any);
        texture.uploadData(pixels);
        const frame = new SpriteFrame();
        frame.texture = texture;
        frame.rect = new Rect(0, 0, 8, 8);
        frame.originalSize = new Size(8, 8);

        const alphaTexture = new Texture2D();
        alphaTexture.reset({ width: 64, height: 64, format: Texture2D.PixelFormat.RGBA8888 });
        const alphaPixels = new Uint8Array(64 * 64 * 4);
        for (let y = 0; y < 64; y++) {
            for (let x = 0; x < 64; x++) {
                const i = (y * 64 + x) * 4;
                alphaPixels[i] = 255;
                alphaPixels[i + 1] = 255;
                alphaPixels[i + 2] = 255;
                alphaPixels[i + 3] = x >= 32 ? 255 : 0;
            }
        }
        alphaTexture.image = new ImageAsset({ _data: alphaPixels, width: 64, height: 64, format: Texture2D.PixelFormat.RGBA8888 } as any);
        alphaTexture.uploadData(alphaPixels);
        const spriteMaskFrame = new SpriteFrame();
        spriteMaskFrame.texture = alphaTexture;
        spriteMaskFrame.rect = new Rect(0, 0, 64, 64);
        spriteMaskFrame.originalSize = new Size(64, 64);

        const maskNode = new Node('M4RectMask');
        parent.addChild(maskNode);
        maskNode.setPosition(0, 0, 0);
        const maskTransform = maskNode.addComponent(UITransform);
        maskTransform.setContentSize(80, 80);
        const mask = maskNode.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_RECT;
        mask.inverted = false;

        const spriteNode = new Node('M4MaskedSprite');
        maskNode.addChild(spriteNode);
        const spriteTransform = spriteNode.addComponent(UITransform);
        spriteTransform.setContentSize(300, 200);
        const sprite = spriteNode.addComponent(Sprite);
        sprite.sizeMode = 0;
        sprite.spriteFrame = frame;
        sprite.color = new Color(255, 0, 0, 255);
        const material = builtinResMgr.get<Material>('ui-sprite-material');
        if (material) { sprite.customMaterial = material; }

        const scene = director.getScene();
        const canvas = scene?.getComponentInChildren(Canvas) ?? null;
        const camera = canvas?.cameraComponent ?? null;
        if (!camera || !canvas) { console.log('M4_MASK_ERROR no canvas camera'); return; }
        const renderTexture = new RenderTexture();
        renderTexture.reset({ width: 256, height: 256 });
        // Keep unrelated UI batches out of the capture on both render backends.
        const captureLayer = 1 << 18;
        const oldVisibility = camera.visibility;
        maskNode.layer = captureLayer;
        spriteNode.layer = captureLayer;
        camera.visibility = captureLayer;
        const oldTarget = camera.targetTexture;
        const oldOrthoHeight = camera.orthoHeight;
        camera.targetTexture = renderTexture;
        camera.orthoHeight = renderTexture.height / 2;

        const states = canvas.node.children.map((child) => ({
            node: child,
            active: child.active,
            position: child.position.clone(),
        }));
        for (const state of states) {
            state.node.active = state.node === maskNode || state.node === camera.node;
        }

        const readRed = (): number => {
            let red = 0;
            try {
                const data = renderTexture.readPixels();
                if (data) {
                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i] > 50 && data[i + 1] < 20 && data[i + 2] < 20) { red++; }
                    }
                }
            } catch (error) { console.log(`M4_MASK_ERROR ${String(error)}`); }
            return red;
        };

        // Native renders outside the JS director AFTER_DRAW dispatch.
        const wait = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 80));
        const verifyPacking = async (target: SpriteFrame, consumer: Sprite | null, name: string, sampling: 'repeat' | 'clamp'): Promise<void> => {
            // Native observes frame revision. Web assembler refresh is explicit
            // because this test calls the internal packing hook outside it.
            const refreshWeb = (): void => { if (!sys.isNative) consumer!.markForUpdateRenderData(); };
            const source = target.texture;
            const previous = source.getSamplerInfo();
            const wraps = [previous.addressU, previous.addressV, previous.addressW];
            const mode = sampling === 'repeat' ? Texture2D.WrapMode.REPEAT : Texture2D.WrapMode.CLAMP_TO_EDGE;
            source.setWrapMode(mode, mode, mode);
            target.rect = target.rect;
            refreshWeb();
            await wait();
            const capture = async (stage: string): Promise<Uint8Array> => {
                const pixels = renderTexture.readPixels();
                if (!pixels || pixels.length !== 256 * 256 * 4) throw new Error('Invalid atlas capture');
                const data = new Uint8Array(pixels);
                const file = name.toLowerCase() + '-' + sampling + '-' + stage;
                if (sys.isNative) {
                    const output = native.fileUtils.getDefaultResourceRootPath() + 'm6-atlas-captures';
                    if (!native.fileUtils.createDirectory(output)) throw new Error('Atlas capture directory failed');
                    if (!native.fileUtils.writeDataToFile(data.buffer, output + '/' + file + '.rgba')) throw new Error('Atlas capture write failed');
                } else {
                    const response = await fetch('/m6-capture?name=' + file, { method: 'POST', body: data });
                    if (!response.ok) throw new Error('Atlas capture upload failed');
                }
                return data;
            };
            const before = await capture('source');
            const uv = target.uv.slice();
            const manager = new DynamicAtlasManager();
            manager.textureSize = 128;
            manager.enabled = true;
            const matches = async (stage: string): Promise<boolean> => {
                const actual = await capture(stage);
                let differences = 0;
                actual.forEach((v, i) => { if (v !== before[i]) differences++; });
                console.log('M6_ATLAS_CAPTURE ' + JSON.stringify({ consumer: name, sampling, stage, differences }));
                return differences === 0;
            };
            try {
                manager.packToDynamicAtlas(null, target);
                refreshWeb();
                const atlas = target.texture;
                if (target.original?._texture !== source || atlas === source || target.rect.x <= 0 || target.rect.y <= 0) throw new Error('dynamic atlas state');
                const clone = target.clone();
                clone._resetDynamicAtlasFrame();
                if (clone.texture !== source || target.texture !== atlas) throw new Error('dynamic atlas clone');
                clone.destroy();
                await wait();
                const packedMatches = await matches('packed');
                manager.reset();
                refreshWeb();
                await wait();
                const restoredMatches = await matches('restored');
                const state = target.original === null && target.texture === source && target.uv.every((v, i) => v === uv[i]);
                console.log('M6_DYNAMIC_ATLAS ' + JSON.stringify({ consumer: name, sampling, state, restored: restoredMatches, equal: packedMatches && restoredMatches }));
            } finally {
                target._resetDynamicAtlasFrame();
                manager.enabled = false;
                source.setWrapMode(wraps[0] as any, wraps[1] as any, wraps[2] as any);
                target.rect = target.rect;
                refreshWeb();
                await wait();
            }
        };

        setTimeout(async () => {
            await verifyPacking(frame, sprite, 'Sprite', 'repeat');
            await verifyPacking(frame, sprite, 'Sprite', 'clamp');
            const normal = readRed();
            console.log(`M4_MASK_PIXEL ${JSON.stringify({ width: 256, height: 256, red: normal, opaque: 65536, inverted: false })}`);

            mask.inverted = true;
            setTimeout(() => {
                const inverted = readRed();
                console.log(`M4_MASK_PIXEL ${JSON.stringify({ width: 256, height: 256, red: inverted, opaque: 0, inverted: true })}`);

                mask.inverted = false;
                mask.type = Mask.Type.GRAPHICS_ELLIPSE;
                setTimeout(() => {
                    console.log(`M4_ELLIPSE_PIXEL ${JSON.stringify({ red: readRed() })}`);

                    mask.type = Mask.Type.SPRITE_STENCIL;
                    mask.spriteFrame = spriteMaskFrame;
                    // Web Mask creates a TRIMMED Sprite; keep the same explicit size on both backends.
                    maskTransform.setContentSize(80, 80);
                    setTimeout(async () => {
                        const stencil = mask.subComp as Sprite;
                        const pass = stencil?.getMaterialInstance(0)?.passes[0];
                        const sampler = spriteMaskFrame.texture.getSamplerInfo();
                        console.log('M6_MASK_STATE ' + JSON.stringify({ alphaThreshold: mask.alphaThreshold,
                            uniform: pass?.getUniform(pass.getHandle('alphaThreshold'), 0),
                            min: sampler.minFilter, mag: sampler.magFilter, u: sampler.addressU, v: sampler.addressV }));
                        await verifyPacking(spriteMaskFrame, stencil, 'Mask', 'repeat');
                        await verifyPacking(spriteMaskFrame, stencil, 'Mask', 'clamp');
                        console.log(`M4_SPRITE_PIXEL ${JSON.stringify({ red: readRed() })}`);

                        maskNode.active = false;
                        const graphicsNode = new Node('M4Graphics');
                        parent.addChild(graphicsNode);
                        graphicsNode.layer = captureLayer;
                        graphicsNode.setPosition(0, 0, 0);
                        const graphics = graphicsNode.addComponent(Graphics);
                        graphics.fillColor = new Color(255, 0, 0, 255);
                        graphics.rect(-40, -40, 80, 80);
                        graphics.fill();
                        setTimeout(() => {
                            console.log(`M4_GRAPHICS ${JSON.stringify({
                                textureWidth: renderTexture.width,
                                textureHeight: renderTexture.height,
                                opaque: readRed(),
                            })}`);
                            for (const state of states) {
                                state.node.active = state.active;
                                state.node.setPosition(state.position);
                            }
                            graphicsNode.destroy();
                            camera.visibility = oldVisibility;
                            camera.orthoHeight = oldOrthoHeight;
                            camera.targetTexture = oldTarget;
                            renderTexture.destroy();
                            dynamicAtlasManager.enabled = autoPacking;
                        }, 600);
                    }, 700);
                }, 700);
            }, 700);
        }, 900);
    }
}
