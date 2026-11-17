import { BitmapFont, LabelAtlas, Canvas, Color, director, DynamicAtlasManager, dynamicAtlasManager, ImageAsset,
    Label, native, Node, Rect, RenderTexture, Size, SpriteFrame, sys, Texture2D, UITransform } from 'cc';

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
        try {
            for (const kind of ['bitmap', 'atlas']) for (const rotated of [false, true]) {
                const width = rotated ? 16 : 32, height = rotated ? 32 : 16;
                const pixels = new Uint8Array(width * height * 4);
                for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) {
                    const px = rotated ? 15 - y : x, py = rotated ? x : y;
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
                frame.rect = new Rect(0, 0, 32, 16); frame.originalSize = new Size(32, 16);
                const font = kind === 'bitmap' ? new BitmapFont() : new LabelAtlas();
                font.fontSize = 16; font.spriteFrame = frame;
                font.fntConfig = { fontSize: 16, commonHeight: 16, atlasName: 'memory', kerningDict: {}, fontDefDictionary: {
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
                // This matrix isolates GPU atlas sampling; full bitmap alignment/layout remains a separate gate.
                label.horizontalAlign = 0; label.verticalAlign = 0;
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
                        if (stage === 'packed' && (frame.texture as Texture2D).image) throw new Error('Packed bitmap fixture must have no CPU image');
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
                    if (!frame.original || frame.texture === texture) throw new Error('Bitmap frame did not pack');
                    await capture('packed');
                    manager.reset(); refresh();
                    if (frame.original || frame.texture !== texture) throw new Error('Bitmap frame did not restore');
                    await capture('restored');
                    if (sys.isNative && kind === 'bitmap' && !rotated) {
                        const backend = (label as any)._native;
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
            console.log('M6_BITMAP_GPU_READY ' + JSON.stringify({ captures: names.length, checks, native: sys.isNative }));
        } finally {
            for (const state of states) state.node.active = state.active;
            camera.targetTexture = oldTarget; camera.orthoHeight = oldHeight;
            rt.destroy(); dynamicAtlasManager.enabled = oldAuto;
        }
    }
}
