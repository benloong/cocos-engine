import { BitmapFont, LabelAtlas, Canvas, Color, director, DynamicAtlasManager, dynamicAtlasManager, ImageAsset,
    Label, native, Node, Rect, RenderTexture, Size, SpriteFrame, sys, Texture2D, UITransform, Vec2 } from 'cc';

/** Real GPU font source/packed/restored captures. No CPU diagnostic getter is used. */
export class BitmapGpuProbe {
    public static async run (parent: Node): Promise<void> {
        const canvas = director.getScene()?.getComponentInChildren(Canvas);
        const camera = canvas?.cameraComponent;
        if (!canvas || !camera) throw new Error('Bitmap GPU probe needs a Canvas camera');
        const oldAuto = dynamicAtlasManager.enabled;
        dynamicAtlasManager.enabled = false;
        const oldTarget = camera.targetTexture;
        const oldHeight = camera.orthoHeight;
        const states = canvas.node.children.map(node => ({ node, active: node.active }));
        for (const state of states) state.node.active = state.node === camera.node;
        const rt = new RenderTexture(); rt.reset({ width: 256, height: 256 });
        camera.targetTexture = rt; camera.orthoHeight = 128;
        const wait = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 100));
        const names: string[] = [];
        const checks: any[] = [];
        const layoutMetrics: any[] = [];
        try {
            for (const kind of ['bitmap', 'atlas']) for (const rotated of [false, true]) {
                const width = rotated ? 32 : 48, height = rotated ? 48 : 32;
                const pixels = new Uint8Array(width * height * 4);
                for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) {
                    const px = 4 + (rotated ? 15 - y : x), py = 6 + (rotated ? x : y);
                    const at = (py * width + px) * 4;
                    pixels[at] = x < 16 ? (x < 8 ? 255 : 64) : 32;
                    pixels[at + 1] = x >= 16 ? (x < 24 ? 255 : 64) : 32;
                    pixels[at + 2] = y < 8 ? 32 : 128; pixels[at + 3] = 255;
                }
                const image = new ImageAsset({ _data: pixels, width, height, format: Texture2D.PixelFormat.RGBA8888 } as any);
                const texture = new Texture2D(); texture.image = image;
                texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
                texture.uploadData(pixels);
                const frame = new SpriteFrame(); frame.texture = texture; frame.rotated = rotated;
                frame.rect = new Rect(4, 6, 32, 16); frame.originalSize = new Size(32, 16);
                const font = kind === 'bitmap' ? new BitmapFont() : new LabelAtlas();
                font.fontSize = 16; font.spriteFrame = frame;
                font.fntConfig = { fontSize: 16, commonHeight: 16, atlasName: 'memory', kerningDict: { [(65 << 16) | 66]: -4 }, fontDefDictionary: {
                    65: { rect: { x: 0, y: 0, width: 16, height: 16 }, xOffset: 0, yOffset: 0, xAdvance: 16 },
                    66: { rect: { x: 16, y: 0, width: 16, height: 16 }, xOffset: 0, yOffset: 0, xAdvance: 16 },
                } } as any;
                font.onLoaded();
                const node = new Node('BitmapGpu-' + kind); parent.addChild(node);
                node.layer = canvas.node.layer;
                const transform = node.addComponent(UITransform); transform.setContentSize(64, 32);
                const label = node.addComponent(Label);
                label.fontSize = 16; label.lineHeight = 16; label.font = font; label.useSystemFont = false;
                label.overflow = Label.Overflow.CLAMP; label.enableWrapText = false;
                label.horizontalAlign = 1; label.verticalAlign = 1;
                label.color = new Color(128, 192, 255, 200); label.string = 'AB';
                transform.setContentSize(64, 32);
                const manager = new DynamicAtlasManager(); manager.textureSize = 128; manager.enabled = true;
                const refresh = (): void => { if (!sys.isNative) label.markForUpdateRenderData(); };
                const name = kind + '-' + (rotated ? 'rotated' : 'flat');
                let baseline: Uint8Array;
                const capture = async (stage: string): Promise<void> => {
                    await wait();
                    const raw = rt.readPixels();
                    if (!raw || raw.length !== 262144) throw new Error('Invalid bitmap capture');
                    const data = new Uint8Array(raw);
                    let colored = 0;
                    for (let i = 0; i < data.length; i += 4) if (data[i] !== data[i + 1] || data[i + 1] !== data[i + 2]) colored++;
                    if (colored < 200) throw new Error('Bitmap glyphs are empty');
                    if (stage === 'source') baseline = data;
                    else if (!data.every((v, i) => v === baseline[i])) throw new Error('Bitmap pack/restore changes pixels: ' + name + '/' + stage);
                    const backend = (label as any)._native;
                    if (sys.isNative) {
                        const entity = backend.getRenderEntity();
                        const draw = entity.getStaticRenderDrawInfo(0);
                        if (backend.getRenderedBitmapGlyphCount() !== 2 || backend.getBitmapDiagnosticBuildCount() !== 0
                            || entity.staticDrawInfoSize !== 1 || draw.vbCount !== 8 || draw.ibCount !== 12
                            || draw.texture !== frame.texture.getGFXTexture()) throw new Error('Bitmap is not sampling its current GPU atlas directly: ' + JSON.stringify({ stage, glyphs: backend.getRenderedBitmapGlyphCount(), diagnostics: backend.getBitmapDiagnosticBuildCount(), draws: entity.staticDrawInfoSize, vertices: draw.vbCount, indices: draw.ibCount, textureMatches: draw.texture === frame.texture.getGFXTexture(), submittedId: draw.texture?.objectID, expectedId: frame.texture.getGFXTexture()?.objectID, submittedNull: draw.texture == null, expectedNull: frame.texture.getGFXTexture() == null }));
                    }
                    const file = name + '-' + stage;
                    if (sys.isNative) {
                        const output = native.fileUtils.getDefaultResourceRootPath() + 'm6-bitmap-captures';
                        if (!native.fileUtils.createDirectory(output) || !native.fileUtils.writeDataToFile(data.buffer, output + '/' + file + '.rgba')) throw new Error('Bitmap output failed');
                    } else {
                        const response = await fetch('/m6-bitmap-capture?name=' + file, { method: 'POST', body: data });
                        if (!response.ok) throw new Error('Bitmap collector failed');
                    }
                    names.push(file);
                    console.log('M6_BITMAP_CAPTURE ' + JSON.stringify({ name: file, colored }));
                };
                try {
                    await capture('source');
                    manager.packToDynamicAtlas(label, frame); refresh();
                    if (sys.isNative) {
                        if (manager.enabled || manager.atlasCount !== 0 || frame.original || frame.texture !== texture) {
                            throw new Error('JSB Native packed a bitmap font frame');
                        }
                    } else if (!frame.original || frame.texture === texture) {
                        throw new Error('Web bitmap frame did not pack');
                    }
                    await capture(sys.isNative ? 'disabled' : 'packed');
                    manager.reset(); refresh();
                    if (frame.original || frame.texture !== texture) throw new Error('Bitmap frame did not restore');
                    await capture(sys.isNative ? 'reset' : 'restored');
                    font.fontSize = 64; // Metadata differs from the configured source size.
                    const reloadSource = (size: number): void => {
                        font.fntConfig!.fontSize = size; font.onLoaded(); refresh();
                    };
                    const layouts: any[] = [];
                    for (let h = 0; h < 3; h++) for (let v = 0; v < 3; v++) layouts.push({ id: 'align-' + h + '-' + v, horizontalAlign: h, verticalAlign: v });
                    layouts.push({ id: 'small', fontSize: 8 }, { id: 'large', fontSize: 24 },
                        { id: 'spacing', spacingX: 3 }, { id: 'wrap', string: 'AB AB AB', enableWrapText: true, width: 40, height: 64 },
                        { id: 'none', overflow: Label.Overflow.NONE, string: 'AB\nA' },
                        { id: 'resize', overflow: Label.Overflow.RESIZE_HEIGHT, string: 'AB AB AB', width: 40 },
                        { id: 'shrink', overflow: Label.Overflow.SHRINK, string: 'ABABAB', width: 40, height: 20 },
                        { id: 'clamp', string: 'ABAB', width: 24, height: 8 },
                        { id: 'line-height', string: 'AB\nA', lineHeight: 24, height: 64, sourceSize: 32 },
                        { id: 'shrink-wrap', overflow: Label.Overflow.SHRINK, string: 'AB AB AB', enableWrapText: true, width: 40, height: 24, sourceSize: 8 });
                    const profiles = [
                        { id: 'base', x: 4, y: 6, width: 32, height: 16, ox: 0, oy: 0 },
                        { id: 'trim', x: 6, y: 3, width: 40, height: 24, ox: 2, oy: -2 },
                        { id: 'offset', x: 2, y: 8, width: 40, height: 24, ox: -6, oy: 6 },
                        { id: 'rotated-edge', x: 4, y: 6, width: 32, height: 16, ox: 8, oy: -4 },
                    ];
                    for (const [caseIndex, settings] of layouts.entries()) {
                        const profile = profiles[caseIndex % profiles.length];
                        frame.rect = new Rect(profile.x, profile.y, 32, 16);
                        frame.originalSize = new Size(profile.width, profile.height);
                        frame.offset = new Vec2(profile.ox, profile.oy); refresh();
                        reloadSource(settings.sourceSize ?? 16);
                        Object.assign(label, { fontSize: 16, lineHeight: 16, spacingX: 0, horizontalAlign: 1, verticalAlign: 1,
                            overflow: Label.Overflow.CLAMP, enableWrapText: false, string: 'AB' });
                        for (const key of Object.keys(settings)) if (key !== 'id' && key !== 'width' && key !== 'height' && key !== 'sourceSize') (label as any)[key] = settings[key];
                        transform.setContentSize(settings.width ?? 64, settings.height ?? 32);
                        await wait();
                        const raw = rt.readPixels();
                        if (!raw || raw.length !== 262144) throw new Error('Invalid bitmap layout capture');
                        const data = new Uint8Array(raw), file = name + '-layout-' + settings.id;
                        if (sys.isNative) {
                            const output = native.fileUtils.getDefaultResourceRootPath() + 'm6-bitmap-captures/';
                            if (!native.fileUtils.writeDataToFile(data.buffer, output + file + '.rgba')) throw new Error('Bitmap layout output failed');
                        } else if (!(await fetch('/m6-bitmap-capture?name=' + file, { method: 'POST', body: data })).ok) throw new Error('Bitmap layout collector failed');
                        const glyphs = sys.isNative ? (label as any)._native.getRenderedBitmapGlyphCount() : (label as any).renderData.vertexCount / 4;
                        const metric = { name: file, width: transform.width, height: transform.height, actualFontSize: label.actualFontSize, glyphs, metadataFontSize: font.fontSize,
                            sourceFontSize: sys.isNative ? (font as any).getSourceFontSize() : font.fntConfig!.fontSize,
                            frameProfile: profile.id, rectX: frame.rect.x, rectY: frame.rect.y, originalWidth: frame.originalSize.width,
                            originalHeight: frame.originalSize.height, offsetX: frame.offset.x, offsetY: frame.offset.y };
                        layoutMetrics.push(metric); console.log('M6_BITMAP_LAYOUT ' + JSON.stringify(metric));
                    }
                    if (sys.isNative && kind === 'bitmap' && !rotated) {
                        const backend = (label as any)._native;
                        frame.rect = new Rect(4, 6, 32, 16); frame.originalSize = new Size(32, 16); frame.offset = new Vec2();
                        reloadSource(16);
                        label.overflow = Label.Overflow.NONE; label.enableWrapText = false; label.fontSize = 16; label.lineHeight = 16;
                        label.string = 'A'.repeat(70000); await wait();
                        const entity = backend.getRenderEntity();
                        const overflow = entity.getStaticRenderDrawInfo(4);
                        if (backend.getRenderedBitmapGlyphCount() !== 70000 || entity.staticDrawInfoSize !== 5
                            || overflow.vbCount !== 17872 || overflow.ibCount !== 26808) throw new Error('Large bitmap GPU chunks truncated');
                        label.string = ''; await wait();
                        if (entity.staticDrawInfoSize !== 0 || overflow.texture || overflow.material) throw new Error('Bitmap clear retains submissions');
                        if (backend.getBitmapDiagnosticBuildCount() !== 0) throw new Error('Large bitmap rendered through CPU diagnostic pixels');
                        console.log('M6_BITMAP_LARGE ' + JSON.stringify({ glyphs: 70000, chunks: 5, cleared: true, diagnostics: 0 }));
                    }
                    checks.push({ name, gpuOnly: sys.isNative, quads: 2 });
                } finally {
                    manager.enabled = false;
                    node.destroy(); await wait();
                    font.destroy(); frame.destroy(); texture.destroy(); image.destroy(); await wait();
                }
            }
            console.log('M6_BITMAP_GPU_READY ' + JSON.stringify({ captures: names.length, layoutCaptures: layoutMetrics.length, checks, native: sys.isNative }));
        } finally {
            for (const state of states) state.node.active = state.active;
            camera.targetTexture = oldTarget; camera.orthoHeight = oldHeight;
            rt.destroy(); dynamicAtlasManager.enabled = oldAuto;
        }
    }
}
