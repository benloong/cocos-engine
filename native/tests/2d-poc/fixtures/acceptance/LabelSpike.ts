import { BitmapFont, builtinResMgr, Camera, Canvas, Color, director, ImageAsset, Label, LabelOutline, LabelShadow, Material, Node, Rect, RenderTexture, resources, Size, SpriteFrame, Texture2D, UITransform, Vec2 } from 'cc';

declare const n2d: any;

interface LabelCase {
    name: string;
    text: string;
    width: number;
    fontSize: number;
    lineHeight: number;
    wrap: boolean;
}

/**
 * M3.0 text measurement probe. It intentionally uses the regular Label
 * component: the goal is to validate the existing platform text delegate
 * before introducing a native Label shell.
 */
export class LabelSpike {
    public static run (parent: Node): void {
        const cases: LabelCase[] = [
            { name: 'english', text: 'Hello Label', width: 240, fontSize: 32, lineHeight: 40, wrap: false },
            { name: 'cjk', text: '你好，世界', width: 240, fontSize: 32, lineHeight: 40, wrap: false },
            {
                name: 'wrap',
                text: 'The quick brown fox jumps over the lazy dog 你好世界',
                width: 220,
                fontSize: 24,
                lineHeight: 30,
                wrap: true,
            },
        ];

        console.log(`M3_NATIVE_LABEL_AVAILABLE ${JSON.stringify({ hasN2d: typeof n2d !== 'undefined', hasLabel: typeof n2d !== 'undefined' && !!n2d.Label })}`);
        if (typeof n2d !== 'undefined' && n2d.Label) {
            const atlas = new Texture2D();
            atlas.reset({ width: 64, height: 32, format: Texture2D.PixelFormat.RGBA8888 });
            const pixels = new Uint8Array(64 * 32 * 4);
            for (let y = 0; y < 16; y++) {
                for (let x = 0; x < 16; x++) {
                    const i = (y * 64 + x) * 4;
                    pixels[i] = 255; pixels[i + 3] = 255;
                    const j = (y * 64 + x + 16) * 4;
                    pixels[j + 1] = 255; pixels[j + 3] = 255;
                }
            }
            const atlasImage = new ImageAsset({ _data: pixels, width: 64, height: 32, format: Texture2D.PixelFormat.RGBA8888 } as any);
            atlas.image = atlasImage;
            atlas.uploadData(pixels);
            const frame = new SpriteFrame();
            frame.texture = atlas;
            frame.rect = new Rect(0, 0, 64, 32);
            frame.originalSize = new Size(64, 32);
            const bitmapFont = new BitmapFont();
            bitmapFont.spriteFrame = frame;
            bitmapFont.fontSize = 16;
            bitmapFont.fntConfig = {
                fontSize: 16, commonHeight: 16, atlasName: 'M3-memory',
                fontDefDictionary: {
                    '65': { rect: { x: 0, y: 0, width: 16, height: 16 }, xOffset: 0, yOffset: 0, xAdvance: 16 },
                    '66': { rect: { x: 16, y: 0, width: 16, height: 16 }, xOffset: 0, yOffset: 0, xAdvance: 16 },
                },
                kerningDict: { [(65 << 16) | 66]: -4 },
            };
            bitmapFont.onLoaded();

            const bitmapNode = new Node('M3BitmapLabel');
            parent.addChild(bitmapNode);
            bitmapNode.setPosition(-360, -220, 0);
            const bitmapTransform = bitmapNode.addComponent(UITransform);
            bitmapTransform.setContentSize(80, 24);
            const bitmapLabel = bitmapNode.addComponent(Label);
            bitmapLabel.fontSize = 16;
            bitmapLabel.lineHeight = 20;
            bitmapLabel.overflow = 3;
            console.log(`M3_BITMAP_FONT ${JSON.stringify({
                hasDict: !!bitmapFont.fontDefDictionary,
                glyphs: bitmapFont.fontDefDictionary ? Object.keys(bitmapFont.fontDefDictionary.letterDefinitions ?? {}).length : -1,
                hasFrame: !!bitmapFont.spriteFrame,
                nativeIdentity: bitmapFont.spriteFrame instanceof SpriteFrame,
            })}`);
            bitmapLabel.font = bitmapFont;
            bitmapLabel.string = 'ABBA';
            setTimeout(() => {
                const native = (bitmapLabel as any)._native;
                const draw = native?.getRenderEntity().getStaticRenderDrawInfo(0);
                console.log(`M3_BITMAP_LABEL ${JSON.stringify({
                    width: bitmapTransform.width, height: bitmapTransform.height, actualFontSize: bitmapLabel.actualFontSize,
                    glyphs: draw ? draw.vbCount / 4 : undefined, vertices: draw?.vbCount, indices: draw?.ibCount,
                    textureWidth: native?.getTextureWidth?.(),
                    textureHeight: native?.getTextureHeight?.(),
                    lines: native?.getLineCount?.(),
                    opaque: native?.getOpaquePixels?.(),
                })}`);
            }, 500);
        }
        if (typeof n2d !== 'undefined' && n2d.Label) {
            const nativeNode = new Node('M3NativeLabel');
            parent.addChild(nativeNode);
            nativeNode.setPosition(0, -220, 0);
            const nativeTransform = nativeNode.addComponent(UITransform);
            nativeTransform.setContentSize(320, 60);
            const nativeLabel = new n2d.Label();
            nativeLabel.setNode(nativeNode);
            nativeLabel.setUITransform((nativeTransform as any)._native);
            nativeLabel.setString('Native Label 你好');
            nativeLabel.setFont('32px Arial');
            nativeLabel.setFontSize(32);
            nativeLabel.setLineHeight(40);
            nativeLabel.setEnableWrapText(false);
            nativeLabel.setOverflow(3);
            nativeLabel.setHorizontalAlign(1);
            nativeLabel.setColorRGBA(255, 255, 0, 255);
            const material = builtinResMgr.get<Material>('ui-sprite-material');
            if (material) {
                nativeLabel.setMaterial(material);
            }
            nativeLabel.setPriority(1);
            nativeLabel.setEnabled(true);
            setTimeout(() => {
                console.log('M3_NATIVE_LABEL_GETTERS', nativeLabel.getTextureWidth(), nativeLabel.getTextureHeight(), nativeLabel.getLineCount());
                console.log(`M3_NATIVE_LABEL ${JSON.stringify({
                    contentSize: nativeTransform.contentSize,
                    hasWidthGetter: typeof nativeLabel.getTextureWidth,
                    textureWidth: nativeLabel.getTextureWidth(),
                    textureHeight: nativeLabel.getTextureHeight(),
                    lines: nativeLabel.getLineCount(),
                })}`);
            }, 300);
        }
        resources.load('M3BitmapFont/OpenSans-Bold', BitmapFont, (err, realFont) => {
            if (err || !realFont) {
                console.log(`M3_REAL_BMFONT_ERROR ${String(err)}`);
                return;
            }
            const realTexture: any = realFont.spriteFrame?.texture;
            const realImage: any = realTexture?.image;
            console.log(`M3_REAL_BMFONT_TEXTURE ${JSON.stringify({
                hasTexture: !!realTexture,
                frameIdentity: realFont.spriteFrame instanceof SpriteFrame,
                frameCtor: realFont.spriteFrame?.constructor?.name,
                hasImage: !!realImage,
                dataLength: realImage?.data?.length ?? -1,
                width: realImage?.width ?? realTexture?.width ?? -1,
                height: realImage?.height ?? realTexture?.height ?? -1,
            })}`);
            console.log(`M3_REAL_BMFONT_ASSET ${JSON.stringify({
                hasFrame: !!realFont.spriteFrame,
                hasDict: !!realFont.fontDefDictionary,
                fontSize: realFont.fontSize,
            })}`);
            const realNode = new Node('M3RealBitmapLabel');
            parent.addChild(realNode);
            realNode.setPosition(-360, -260, 0);
            const realTransform = realNode.addComponent(UITransform);
            realTransform.setContentSize(320, 32);
            const realLabel = realNode.addComponent(Label);
            realLabel.lineHeight = 20;
            realLabel.overflow = 3;
            realLabel.font = realFont;
            realLabel.string = 'Hello BMFont';
            setTimeout(() => {
                const native = (realLabel as any)._native;
                console.log(`M3_REAL_BMFONT ${JSON.stringify({
                    textureWidth: native?.getTextureWidth?.(),
                    textureHeight: native?.getTextureHeight?.(),
                    lines: native?.getLineCount?.(),
                    opaque: native?.getOpaquePixels?.(),
                })}`);
            }, 500);
        });
        const asciiCharNode = new Node('M3CharAscii');
        parent.addChild(asciiCharNode);
        asciiCharNode.setPosition(-360, -180, 0);
        const asciiCharTransform = asciiCharNode.addComponent(UITransform);
        asciiCharTransform.setContentSize(240, 32);
        const asciiCharLabel = asciiCharNode.addComponent(Label);
        asciiCharLabel.cacheMode = 2;
        asciiCharLabel.lineHeight = 32;
        asciiCharLabel.overflow = 3;
        asciiCharLabel.string = 'Hello ASCII';
        setTimeout(() => {
            const native = (asciiCharLabel as any)._native;
            console.log(`M3_CHAR_ASCII ${JSON.stringify({
                textureWidth: native?.getTextureWidth?.(),
                textureHeight: native?.getTextureHeight?.(),
                lines: native?.getLineCount?.(),
                opaque: native?.getOpaquePixels?.(),
            })}`);
        }, 700);
        const bitmapNodeA = new Node('M3BitmapAtlasA');
        parent.addChild(bitmapNodeA);
        bitmapNodeA.setPosition(-360, -300, 0);
        const bitmapTransformA = bitmapNodeA.addComponent(UITransform);
        bitmapTransformA.setContentSize(180, 40);
        const bitmapLabelA = bitmapNodeA.addComponent(Label);
        bitmapLabelA.cacheMode = 1;
        bitmapLabelA.overflow = 3;
        bitmapLabelA.string = 'Atlas A';

        const bitmapNodeB = new Node('M3BitmapAtlasB');
        parent.addChild(bitmapNodeB);
        bitmapNodeB.setPosition(-160, -300, 0);
        const bitmapTransformB = bitmapNodeB.addComponent(UITransform);
        bitmapTransformB.setContentSize(180, 40);
        const bitmapLabelB = bitmapNodeB.addComponent(Label);
        bitmapLabelB.cacheMode = 1;
        bitmapLabelB.overflow = 3;
        bitmapLabelB.string = 'Atlas B';

        setTimeout(() => {
            const nativeA = (bitmapLabelA as any)._native;
            const nativeB = (bitmapLabelB as any)._native;
            console.log(`M3_BITMAP_ATLAS ${JSON.stringify({
                a: { id: String(nativeA?.getAtlasTextureId?.()), w: nativeA?.getAtlasWidth?.(), x: nativeA?.getAtlasX?.(), y: nativeA?.getAtlasY?.() },
                b: { id: String(nativeB?.getAtlasTextureId?.()), w: nativeB?.getAtlasWidth?.(), x: nativeB?.getAtlasX?.(), y: nativeB?.getAtlasY?.() },
            })}`);
        }, 800);
        const warmCaptureNode = new Node('M3Warm');
        parent.addChild(warmCaptureNode);
        warmCaptureNode.active = false;

        const created: Node[] = [];
        cases.forEach((item, index) => {
            const node = new Node(`M3Label-${item.name}`);
            created.push(node);
            parent.addChild(node);
            node.setPosition(-360 + index * 360, 220, 0);

            const transform = node.addComponent(UITransform);
            transform.setContentSize(item.width, item.lineHeight);

            const label = node.addComponent(Label);
            label.string = item.text;
            label.fontSize = item.fontSize;
            label.lineHeight = item.lineHeight;
            label.enableWrapText = item.wrap;
            label.overflow = Label.Overflow.RESIZE_HEIGHT;
            label.color = new Color(255, 255, 255, 255);
            if (item.name === 'cjk') {
                label.cacheMode = 2;
            }
            if (item.name === 'english') {
                label.enableOutline = true;
                label.outlineWidth = 2;
                label.outlineColor = new Color(0, 0, 0, 255);
                label.enableShadow = true;
                label.shadowBlur = 2;
                label.shadowColor = new Color(0, 0, 0, 160);
                label.shadowOffset = new Vec2(2, -2);
                const outline = node.addComponent(LabelOutline);
                outline.width = 3;
                outline.color = new Color(255, 0, 0, 255);
                const shadow = node.addComponent(LabelShadow);
                shadow.blur = 2;
                shadow.offset = new Vec2(2, -2);
            }

            setTimeout(() => {
                if (typeof n2d !== 'undefined' && n2d.TextMetrics) {
                    const metrics = new n2d.TextMetrics();
                    metrics.setFont(`${item.fontSize}px Arial`);
                    const measured = metrics.measure(item.text);
                    console.log(`M3_NATIVE_MEASURE ${JSON.stringify({
                        name: item.name,
                        width: measured.width,
                        height: measured.height,
                    })}`);
                }
                const nativeLabel = (label as any)._native;
                if (nativeLabel) {
                    if (item.name === 'cjk') {
                    console.log(`M3_CHAR_LABEL ${JSON.stringify({
                        textureWidth: nativeLabel.getTextureWidth(),
                        textureHeight: nativeLabel.getTextureHeight(),
                        lines: nativeLabel.getLineCount(),
                        opaque: nativeLabel.getOpaquePixels(),
                    })}`);
                }
                console.log(`M3_SHELL_LABEL ${JSON.stringify({
                        name: item.name,
                        textureWidth: nativeLabel.getTextureWidth(),
                        textureHeight: nativeLabel.getTextureHeight(),
                        lines: nativeLabel.getLineCount(),
                        checksum: nativeLabel.getPixelChecksum(),
                        opaque: nativeLabel.getOpaquePixels(),
                    })}`);
                }
                const size = node.getComponent(UITransform)?.contentSize;
                console.log(`M3_LABEL_MEASURE ${JSON.stringify({
                    name: item.name,
                    text: item.text,
                    fontSize: item.fontSize,
                    lineHeight: item.lineHeight,
                    wrap: item.wrap,
                    overflow: label.overflow,
                    width: size?.width ?? 0,
                    height: size?.height ?? 0,
                })}`);
            }, 300);
        });

        setTimeout(() => {
            LabelSpike.capture([warmCaptureNode, created[1], created[2], created[0], asciiCharNode]);
        }, 1500);
    }

    private static capture (nodes: Node[]): void {
        const scene = director.getScene();
        const canvas = scene?.getComponentInChildren(Canvas) ?? null;
        const camera = canvas?.cameraComponent ?? null;
        if (!camera || !canvas) {
            console.log('M3_LABEL_PIXEL_ERROR no canvas camera');
            return;
        }
        const renderTexture = new RenderTexture();
        renderTexture.reset({ width: 256, height: 256 });
        const oldTarget = camera.targetTexture;
        const oldOrthoHeight = camera.orthoHeight;
        camera.targetTexture = renderTexture;
        camera.orthoHeight = renderTexture.height / 2;

        const states = canvas.node.children.map((child) => ({
            node: child,
            active: child.active,
            position: child.position.clone(),
        }));

        const warm = new Set<Node>();
        const restore = (): void => {
            for (const state of states) {
                state.node.active = state.active;
                state.node.setPosition(state.position);
            }
            camera.orthoHeight = oldOrthoHeight;
            camera.targetTexture = oldTarget;
            renderTexture.destroy();
        };

        const step = (index: number): void => {
            if (index >= nodes.length) {
                restore();
                return;
            }
            for (const state of states) {
                state.node.active = state.node === nodes[index] || state.node === camera.node;
            }
            nodes[index].setPosition(0, 0, 0);
            setTimeout(() => {
                if (!warm.has(nodes[index])) {
                    warm.add(nodes[index]);
                    step(index);
                    return;
                }
                try {
                    const pixels = renderTexture.readPixels();
                    let nonzero = 0;
                    let colored = 0;
                    let checksum = 0;
                    if (pixels) {
                        for (let i = 0; i < pixels.length; i += 4) {
                            const r = pixels[i]; const g = pixels[i + 1]; const b = pixels[i + 2]; const a = pixels[i + 3];
                            if (a > 0) { nonzero++; }
                            if (a > 0 && (r > 8 || g > 8 || b > 8)) { colored++; }
                            checksum = (checksum + r + g + b + a) >>> 0;
                        }
                    }
                    console.log(`M3_LABEL_PIXEL ${JSON.stringify({
                        name: nodes[index].name,
                        width: renderTexture.width,
                        height: renderTexture.height,
                        nonzero,
                        colored,
                        checksum,
                    })}`);
                } catch (error) {
                    console.log(`M3_LABEL_PIXEL_ERROR ${String(error)}`);
                }
                step(index + 1);
            }, 800);
        };
        step(0);
    }
}
