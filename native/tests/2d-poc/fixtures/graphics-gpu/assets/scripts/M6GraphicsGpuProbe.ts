import { _decorator, BitmapFont, Camera, Canvas, Color, Component, director, Graphics, Label, Mask, native, Node, Rect, RenderRoot2D, RenderTexture, Size, Sprite, SpriteFrame, sys, Texture2D, UIOpacity, UITransform, Vec2, Vec3 } from 'cc';
import { runSceneMatrix } from './M6SceneMatrix';
import { EffectAsset, gfx, instantiate, isValid, Material, Prefab, resources, SpriteRenderer } from 'cc';
import { runRichTextMatrix } from './M6RichTextMatrix';

const { ccclass } = _decorator;
// Replaced by prepare-graphics-gpu-project.cjs in the generated project only.
const outputRoot = '__M6_GPU_OUTPUT__';
const snapshot = '__M6_GPU_SNAPSHOT__';
const probeMode: string = '__M6_GPU_MODE__';
const wait = (ms = 180): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

@ccclass('M6GraphicsGpuProbe')
export class M6GraphicsGpuProbe extends Component {
    public start (): void { this.run().catch(error => console.log(`M6_GPU_FAIL ${String(error.stack || error)}`)); }

    private async run (): Promise<void> {
        const canvas = this.node.getComponent(Canvas)!;
        const camera = canvas.cameraComponent!;
        if (!camera) throw new Error('Missing Canvas camera');
        camera.clearFlags = 7;
        camera.clearColor = new Color(0, 0, 0, 255);
        const rt = new RenderTexture(); rt.reset({ width: 256, height: 256 });
        camera.targetTexture = rt; camera.orthoHeight = 128;
        if (sys.isNative) native.fileUtils.createDirectory(outputRoot);
        const node = (parent: Node, name: string): Node => {
            const n = new Node(name); n.layer = canvas.node.layer; parent.addChild(n); n.addComponent(UITransform); return n;
        };
        const graphics = (n: Node): Graphics => {
            const g = n.addComponent(Graphics);
            if (sys.isNative && !(g as any)._native) throw new Error('Native Graphics override not active');
            g.fillColor = new Color(255, 0, 0, 255); g.strokeColor = new Color(255, 0, 0, 255); return g;
        };
        const solid = new Texture2D(); solid.reset({ width: 32, height: 32, format: Texture2D.PixelFormat.RGBA8888 });
        const white = new Uint8Array(32 * 32 * 4); white.fill(255); solid.uploadData(white);
        const frame = (texture: Texture2D): SpriteFrame => {
            const f = new SpriteFrame(); f.texture = texture; f.rect = new Rect(0, 0, 32, 32); f.originalSize = new Size(32, 32); f.packable = false; return f;
        };
        const whiteFrame = frame(solid);
        const alphaTexture = new Texture2D(); alphaTexture.reset({ width: 32, height: 32, format: Texture2D.PixelFormat.RGBA8888 });
        const alphaPixels = new Uint8Array(white);
        for (let y = 0; y < 32; ++y) for (let x = 0; x < 32; ++x) alphaPixels[(y * 32 + x) * 4 + 3] = x < 16 ? 64 : 192;
        alphaTexture.uploadData(alphaPixels); const alphaFrame = frame(alphaTexture);
        const red = (parent: Node): void => {
            const n = node(parent, 'content'); n.getComponent(UITransform)!.setContentSize(240, 220);
            const s = n.addComponent(Sprite); s.sizeMode = Sprite.SizeMode.CUSTOM; s.spriteFrame = whiteFrame; s.color = new Color(255, 0, 0, 255);
        };
        const mask = (parent: Node, width: number, height: number, type = 0, inverted = false): { n: Node; m: Mask } => {
            const n = node(parent, 'mask'); n.getComponent(UITransform)!.setContentSize(width, height);
            const m = n.addComponent(Mask); m.type = type; m.inverted = inverted;
            if (sys.isNative && !(m as any)._native) throw new Error('Native Mask override not active');
            return { n, m };
        };
        type Case = { name: string; draw: (root: Node) => void | (() => void) };
        const cases: Case[] = [
            { name: 'fill-rect', draw: root => graphics(root).fillRect(-40, -40, 80, 80) },
            { name: 'large-local-coordinates', draw: root => { root.setPosition(-400, 0, 0); graphics(root).fillRect(360, -40, 80, 80); } },
            { name: 'world-scale-rotation', draw: root => { root.setScale(.5, .75, 1); root.setRotationFromEuler(0, 0, 25); graphics(root).fillRect(-160, -60, 320, 120); } },
            { name: 'world-z-rotation', draw: root => { root.setRotationFromEuler(25, 15, 10); graphics(root).fillRect(-70, -50, 140, 100); } },
            { name: 'concave', draw: root => { const g = graphics(root); g.moveTo(-70, -60); g.lineTo(70, -60); g.lineTo(70, 60); g.lineTo(0, 10); g.lineTo(-70, 60); g.close(); g.fill(); } },
            { name: 'subpaths', draw: root => { const g = graphics(root); g.rect(-80, -50, 60, 100); g.rect(20, -50, 60, 100); g.fill(); } },
            { name: 'alpha-and-overlap', draw: root => { const g = graphics(root); g.fillColor = new Color(200, 40, 10, 128); g.fillRect(-70, -40, 90, 80); g.fillColor = new Color(20, 80, 220, 128); g.fillRect(-20, -60, 90, 80); } },
            { name: 'inherited-opacity', draw: root => { root.addComponent(UIOpacity).opacity = 128; const g = graphics(node(root, 'shape')); g.fillColor = new Color(200, 40, 10, 128); g.fillRect(-40, -40, 80, 80); } },
            { name: 'curves', draw: root => { const g = graphics(root); g.moveTo(-90, 0); g.bezierCurveTo(-40, 140, 40, -140, 90, 0); g.quadraticCurveTo(0, 100, -90, 0); g.close(); g.fill(); } },
            { name: 'ellipse', draw: root => { const g = graphics(root); g.ellipse(0, 0, 80, 45); g.fill(); } },
            { name: 'round-rect', draw: root => { const g = graphics(root); g.roundRect(-80, -50, 160, 100, 20); g.fill(); } },
            { name: 'arc', draw: root => { const g = graphics(root); g.lineWidth = 12; g.arc(0, 0, 70, .2, 5.5, false); g.stroke(); } },
            { name: 'clear-and-replace', draw: root => { const g = graphics(root); g.fillRect(-100, -100, 200, 200); g.clear(); g.fillRect(-20, -30, 40, 60); } },
            { name: 'large-mesh-chunks', draw: root => { const g = graphics(root); for (let i = 0; i < 20000; ++i) { g.rect(-100 + i % 200, -50 + Math.floor(i / 200), .6, .6); if (i % 4000 === 3999) g.fill(); } } },
            { name: 'mask-rect', draw: root => { const { n } = mask(root, 80, 80); red(n); } },
            { name: 'mask-rounded', draw: root => { const { n, m } = mask(root, 120, 80); m.radius = 20; red(n); } },
            { name: 'mask-radius-update', draw: root => { const { n, m } = mask(root, 120, 80); red(n); return () => { m.radius = 30; }; } },
            { name: 'mask-radius-clamp', draw: root => { const { n, m } = mask(root, 120, 80); m.radius = 1000; red(n); } },
            { name: 'mask-size-anchor-update', draw: root => { const { n, m } = mask(root, 120, 80); m.radius = 20; red(n); return () => { n.getComponent(UITransform)!.setContentSize(60, 100); n.getComponent(UITransform)!.setAnchorPoint(.25, .75); }; } },
            { name: 'mask-type-update', draw: root => { const { n, m } = mask(root, 120, 80); m.radius = 20; red(n); return () => { m.type = Mask.Type.GRAPHICS_ELLIPSE; m.segments = 24; }; } },
            { name: 'mask-inverted', draw: root => { const { n } = mask(root, 80, 80, 0, true); red(n); } },
            { name: 'mask-ellipse', draw: root => { const { n, m } = mask(root, 140, 100, 1); m.segments = 32; red(n); } },
            { name: 'mask-nested', draw: root => { const outer = mask(root, 140, 120); const inner = mask(outer.n, 80, 60); inner.n.setPosition(20, 10, 0); red(inner.n); } },
            { name: 'mask-nested-inverted', draw: root => { const outer = mask(root, 140, 120); const inner = mask(outer.n, 60, 60, 0, true); red(inner.n); } },
            { name: 'mask-custom', draw: root => { const { n, m } = mask(root, 100, 100, 2); const g = (m as any).graphics ?? m.subComp; g.clear(); g.rect(-35, -25, 70, 50); g.fill(); red(n); } },
            { name: 'mask-empty', draw: root => { const { n, m } = mask(root, 100, 100, 2); const g = (m as any).graphics ?? m.subComp; g.clear(); red(n); } },
            { name: 'mask-source-update', draw: root => { const { n, m } = mask(root, 100, 100, 2); const g = m.subComp as Graphics; g.clear(); g.rect(-15, -15, 30, 30); g.fill(); red(n); return () => { g.clear(); g.rect(-40, -25, 80, 50); g.fill(); }; } },
            { name: 'mask-empty-inverted', draw: root => { const { n, m } = mask(root, 100, 100, 2, true); (m.subComp as Graphics).clear(); red(n); } },
            { name: 'mask-nested-empty', draw: root => { const outer = mask(root, 140, 120); const inner = mask(outer.n, 80, 60, 2); (inner.m.subComp as Graphics).clear(); red(inner.n); red(outer.n); } },
            { name: 'mask-multichunk', draw: root => { const { n, m } = mask(root, 200, 100, 2); const g = m.subComp as Graphics; g.clear(); for (let i = 0; i < 20000; ++i) { g.rect(-100 + i % 200, -50 + Math.floor(i / 200), .6, .6); if (i % 4000 === 3999) g.fill(); } red(n); } },
            { name: 'mask-disable', draw: root => { const { n, m } = mask(root, 80, 80); red(n); return () => { m.enabled = false; }; } },
            { name: 'mask-ellipse-segments', draw: root => {
                const { n, m } = mask(root, 160, 100, Mask.Type.GRAPHICS_ELLIPSE);
                m.segments = 4; red(n);
                return () => { m.segments = 64; };
            } },
            { name: 'mask-mixed-frame', draw: root => {
                const { n, m } = mask(root, 120, 100, Mask.Type.SPRITE_STENCIL);
                const setFrame = (value: SpriteFrame): void => {
                    if (sys.isNative) (m as any).spriteFrame = value;
                    else {
                        const source = m.subComp as Sprite;
                        source.sizeMode = Sprite.SizeMode.CUSTOM;
                        source.spriteFrame = value;
                    }
                };
                setFrame(whiteFrame); m.alphaThreshold = .5; red(n);
                const shape = graphics(node(n, 'blue'));
                shape.fillColor = new Color(0, 0, 255, 255); shape.fillRect(-40, -20, 32, 40);
                const font = new BitmapFont(); font.fontSize = 16; font.spriteFrame = whiteFrame;
                font.fntConfig = { fontSize: 16, commonHeight: 16, atlasName: 'memory', kerningDict: {},
                    fontDefDictionary: { 65: { rect: { x: 0, y: 0, width: 16, height: 16 }, xOffset: 0, yOffset: 0, xAdvance: 16 } } } as any;
                font.onLoaded();
                const glyph = node(n, 'green'); glyph.setPosition(24, 0);
                const label = glyph.addComponent(Label);
                const systemFrame = label.ttfSpriteFrame;
                const systemTexture = systemFrame?.texture;
                label.font = font;
                if (label.spriteFrame !== font.spriteFrame) throw new Error('Bitmap Label did not expose the assigned sprite frame');
                if (!systemTexture || label.ttfSpriteFrame !== systemFrame || systemFrame?.texture !== systemTexture) {
                    throw new Error('Bitmap font replaced the retained TTF sprite frame or its texture');
                }
                const atlas = font.fontDefDictionary;
                if (!atlas || label.fontAtlas !== null) throw new Error('Unexpected initial Label fontAtlas');
                label.fontAtlas = atlas;
                label.font = font;
                label.updateRenderData(true);
                if (label.fontAtlas !== atlas) throw new Error('Same font or layout refresh discarded the assigned fontAtlas');
                label.fontSize = 16; label.lineHeight = 16; label.string = 'A'; label.color = new Color(0, 255, 0, 255);
                label.useSystemFont = true;
                if (label.fontAtlas !== null) throw new Error('Changing the font retained the previous fontAtlas');
                if (label.font || !label.useSystemFont || label._bmFontOriginalSize !== -1) throw new Error('System font retained bitmap asset');
                label.useSystemFont = false;
                label.font = null;
                if (label.font || label.useSystemFont) throw new Error('Empty font slot restored a previous font');
                label.font = font;
                if (label.font !== font || label.useSystemFont || glyph.getComponent(UITransform)!.width !== 16) {
                    throw new Error('Assigning bitmap font failed to publish its glyph width immediately');
                }
                label.string = 'A'.repeat(129);
                for (const spacing of [0, 1 / 128, 0, -1 / 128, 0]) {
                    label.spacingX = spacing;
                    label.updateRenderData(true);
                    const width = glyph.getComponent(UITransform)!.width;
                    const expected = 129 * 16 + 128 * spacing;
                    if (width !== expected) throw new Error(`Bitmap spacing ${spacing}: expected ${expected}, got ${width}`);
                }
                const transform = glyph.getComponent(UITransform)!;
                label.string = 'A'.repeat(128);
                for (const size of [16 + 1 / 128, 16, 16 - 1 / 128, 16]) {
                    label.fontSize = size;
                    label.updateRenderData(true);
                    if (transform.width !== 128 * size) throw new Error(`Bitmap fontSize ${size}: width ${transform.width}`);
                }
                label.string = Array(128).fill('A').join('\n');
                for (const height of [16 + 1 / 128, 16, 16 - 1 / 128, 16]) {
                    label.lineHeight = height;
                    label.updateRenderData(true);
                    if (transform.height !== 128 * height) throw new Error(`Bitmap lineHeight ${height}: height ${transform.height}`);
                }
                label.string = 'A';
                label.updateRenderData(true);
                label.contentWidth = 7.125;
                label.updateRenderData(true);
                if (label.contentWidth !== 7.125) throw new Error('Bitmap font overwrote the TTF layout width');
                const tinyNode = node(root, 'bitmap-minimum-shrink');
                const tiny = tinyNode.addComponent(Label);
                tiny.font = font;
                tiny.string = 'A';
                tiny.fontSize = tiny.lineHeight = 16;
                tiny.overflow = Label.Overflow.SHRINK;
                tinyNode.getComponent(UITransform)!.setContentSize(16, 0.25);
                tiny.updateRenderData(true);
                if (tiny.actualFontSize !== 0.1) throw new Error(`Minimum bitmap SHRINK size was ${tiny.actualFontSize}`);
                tinyNode.destroy();
                const sibling = graphics(node(root, 'yellow'));
                sibling.fillColor = new Color(255, 255, 0, 255); sibling.fillRect(70, -10, 20, 20);
                return () => { setFrame(alphaFrame); };
            } },
        ];
        cases.push({ name: 'mask-independent-thresholds', draw: root => {
            const makeStencil = (x: number, threshold: number): Mask => {
                const { n, m } = mask(root, 80, 80, Mask.Type.SPRITE_STENCIL);
                n.setPosition(x, 0);
                if (sys.isNative) (m as any).spriteFrame = alphaFrame;
                else {
                    const sprite = m.subComp as Sprite;
                    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                    sprite.spriteFrame = alphaFrame;
                }
                m.alphaThreshold = threshold;
                red(n);
                return m;
            };
            const left = makeStencil(-64, .2);
            const right = makeStencil(64, .8);
            return () => { left.alphaThreshold = .8; right.alphaThreshold = .2; };
        } });
        for (const threshold of [.2, .5, .8]) cases.push({ name: `mask-alpha-${threshold}`, draw: root => {
            const { n, m } = mask(root, 120, 100, 3);
            if (sys.isNative) (m as any).spriteFrame = alphaFrame;
            else { const sprite = m.subComp as Sprite; sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.spriteFrame = alphaFrame; }
            m.alphaThreshold = threshold; red(n);
        } });
        for (let cap = 0; cap < 3; ++cap) for (let join = 0; join < 3; ++join) cases.push({
            name: `stroke-${cap}-${join}`, draw: root => { const g = graphics(root); g.lineWidth = 18; g.lineCap = cap; g.lineJoin = join; g.miterLimit = 2; g.strokeColor = new Color(220, 30, 40, 160); g.moveTo(-80, -35); g.lineTo(-15, 45); g.lineTo(20, -35); g.lineTo(80, 40); g.stroke(); },
        });
        for (const count of [1, 128]) cases.push({ name: 'sprite-batch-' + count, draw: root => {
            for (let i = 0; i < count; ++i) {
                const n = node(root, 'quad');
                n.setPosition((i % 16 - 7.5) * 12, (Math.floor(i / 16) - 3.5) * 12);
                n.getComponent(UITransform)!.setContentSize(8, 8);
                const sprite = n.addComponent(Sprite);
                sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.spriteFrame = whiteFrame;
                sprite.color = i % 2 ? new Color(0, 255, 0, 255) : new Color(255, 0, 0, 255);
            }
        } });
        const batchDrawCalls: Record<string, number> = {};
        const captures: string[] = [];
        const capture = async (name: string, source = rt): Promise<void> => {
            await wait();
            if (name.startsWith('sprite-batch-')) batchDrawCalls[name] = director.root!.device.numDrawCalls;
            const pixels = source.readPixels();
            if (!pixels || pixels.length !== 256 * 256 * 4) throw new Error(`Bad capture ${name}`);
            if (sys.isNative) {
                if (!native.fileUtils.writeDataToFile(new Uint8Array(pixels).buffer, `${outputRoot}/${name}.rgba`)) throw new Error('Could not write capture');
            } else {
                const response = await fetch(`/m6-capture?name=${encodeURIComponent(name)}`, { method: 'POST', body: new Uint8Array(pixels) });
                if (!response.ok) throw new Error('Capture collector failed');
            }
            captures.push(name);
            console.log(`M6_GPU_CAPTURE ${JSON.stringify({ name, backend: sys.isNative ? 'native' : 'web' })}`);
        };
        if (probeMode === 'richtext') {
            const text = await runRichTextMatrix(canvas.node, capture);
            const device = director.root!.device;
            const result = { backend: sys.isNative ? 'native' : 'web', snapshot, captures, text,
                width: 256, height: 256, environment: { os: sys.os, renderer: device.renderer, vendor: device.vendor } };
            if (sys.isNative) native.fileUtils.writeStringToFile(JSON.stringify(result), `${outputRoot}/manifest.json`);
            else await fetch('/m6-result', { method: 'POST', body: JSON.stringify(result) });
            console.log(`M6_GPU_DONE ${JSON.stringify(result)}`);
            return;
        }
        const prefab = await new Promise<Prefab>((resolve, reject) =>
            resources.load('M6StaticAtlas/AtlasSprite', Prefab, (error, asset) => error ? reject(error) : resolve(asset)));
        const effect = await new Promise<EffectAsset>((resolve, reject) =>
            resources.load('AtlasMesh', EffectAsset, (error, asset) => error ? reject(error) : resolve(asset)));
        const instance = instantiate(prefab);
        const legacySprite = instance.getComponent(Sprite)!;
        const left = legacySprite.spriteFrame!;
        const right = legacySprite.spriteAtlas!.getSpriteFrame('right')!;
        if (!right.rotated || right.texture !== left.texture || left.mesh || right.mesh) throw new Error('Unexpected imported atlas frames');
        // Both renderers sample the imported sheet throughout this static atlas case.
        left.packable = right.packable = false;
        canvas.node.addChild(instance);
        await capture('prefab-atlas-sprite');
        legacySprite.enabled = false;
        instance.setScale(400, 400, 1);
        const material = new Material();
        material.initialize({ effectAsset: effect });
        const meshRenderer = instance.addComponent(SpriteRenderer);
        meshRenderer.setSharedMaterial(material, 0);
        meshRenderer.visibility = instance.layer;
        meshRenderer.spriteFrame = left;
        await capture('prefab-atlas-mesh-left');
        meshRenderer.spriteFrame = right;
        await capture('prefab-atlas-mesh-right');
        instance.destroy();
        await wait();
        const alternate = new Material();
        const variantEffect = await new Promise<EffectAsset>((resolve, reject) =>
            resources.load('VariantSprite', EffectAsset, (error, asset) => error ? reject(error) : resolve(asset)));
        alternate.initialize({ effectAsset: variantEffect, defines: { USE_TEXTURE: false } });
        for (const Type of [Sprite, Label, Graphics] as const) {
            const ownerNode = node(canvas.node, 'material-array');
            const owner = ownerNode.addComponent(Type as typeof Sprite);
            owner.enabled = false;
            owner.sharedMaterials = [material, alternate];
            const shared = owner.sharedMaterials;
            const instances = owner.materials;
            const old = instances[1];
            if (!old || old === alternate) throw new Error('Expected an independent material instance');
            const rebuild = owner._onRebuildPSO;
            const notifications: number[] = [];
            owner._onRebuildPSO = function (index, changed) {
                if (changed !== old) throw new Error('Shader rebuild reported a different material');
                notifications.push(index);
                rebuild.call(this, index, changed);
            };
            try {
                const originalHash = old.hash;
                old.recompileShaders({ USE_TEXTURE: true }, 0);
                if (old.hash === originalHash) throw new Error('Textured shader variant retained the original hash');
                old.recompileShaders({ USE_TEXTURE: true }, 0);
                old.recompileShaders({ USE_TEXTURE: false });
                if (old.hash !== originalHash || notifications.join(',') !== '1,1') {
                    throw new Error(`Material variant rebuild failed for ${owner.constructor.name}: slots ${notifications}`);
                }
            } finally {
                owner._onRebuildPSO = rebuild;
            }
            shared[1] = material;
            if (owner.sharedMaterials !== shared || owner.getSharedMaterial(1) !== material || owner.getRenderMaterial(1) !== old) {
                throw new Error('In-place shared material replacement discarded the existing instance');
            }
            shared.length = 1;
            if (owner.getMaterialInstance(1) || owner.getRenderMaterial(1) !== old) throw new Error('Shared truncation changed the instance array');
            shared.push(material);
            instances[1] = null;
            if (owner.getRenderMaterial(1) !== material) throw new Error('Cleared instance did not expose its shared material');
            shared.splice(1, 1, alternate, material);
            delete shared[1];
            if (1 in owner.sharedMaterials || owner.getSharedMaterial(1) !== undefined || owner.getSharedMaterial(2) !== material) {
                throw new Error('Material array splice/delete lost slot identity');
            }
            const disposable = new Material();
            disposable.initialize({ effectAsset: variantEffect });
            owner.setSharedMaterial(disposable, 1);
            const held = owner.getMaterialInstance(1)!;
            owner.setMaterialInstance(disposable, 1);
            if (owner.getRenderMaterial(1) !== held || !held.passes.length) throw new Error('Same parent discarded a live instance');
            owner.setSharedMaterial(disposable, 1, true);
            if (held.passes.length || !isValid(held, true) || !disposable.passes.length) {
                throw new Error('Replacing a slot failed to dispose only the instance passes');
            }
            const next = owner.getMaterialInstance(1)!;
            if (next === held || !next.passes.length) throw new Error('Failed to recreate instance after disposal');
            owner.setMaterialInstance(alternate, 1);
            if (next.passes.length || owner.getRenderMaterial(1) !== alternate) throw new Error('Replacing the parent retained instance passes');
            owner.setSharedMaterial(disposable, 2);
            if (!disposable.destroy() || disposable.destroy() || disposable.passes.length || !isValid(disposable)
                || isValid(disposable, true) || owner.getSharedMaterial(2) !== disposable) {
                throw new Error('Unexpected shared material state during deferred destruction');
            }
            await wait();
            if (isValid(disposable) || owner.getSharedMaterial(2) !== disposable || !isValid(held, true)) {
                throw new Error('Unexpected shared material or instance lifetime after deferred destruction');
            }
            owner.setSharedMaterial(null, 2);
            ownerNode.destroy();
        }
        await wait();
        alternate.destroy();
        material.destroy();
        const labelNode = node(canvas.node, 'immediate-label-layout');
        const label = labelNode.addComponent(Label);
        const colorNode = node(canvas.node, 'sprite-color-contract');
        for (const renderer of [label, colorNode.addComponent(Sprite)]) {
            const original = renderer.color.clone();
            let events = 0;
            const changed = (): void => { ++events; };
            renderer.node.on(Node.EventType.COLOR_CHANGED, changed);
            const input = new Color(12, 34, 56, 78);
            renderer.color = input;
            input.r = 99;
            renderer.color = renderer.color.clone();
            if (renderer.color.r !== 12 || renderer.color.a !== 78 || events !== 0) throw new Error('Runtime renderer color assignment failed');
            renderer.node.off(Node.EventType.COLOR_CHANGED, changed);
            renderer.color = original;
        }
        colorNode.destroy();
        label.enabled = false;
        label.useSystemFont = false;
        label.fontFamily = '';
        label.enabled = true;
        if (!label.useSystemFont || label.fontFamily !== 'Arial') throw new Error('Enabled Label did not restore its default font');
        label.enabled = false;
        label.fontFamily = 'Verdana';
        label.enabled = true;
        if (label.fontFamily !== 'Verdana') throw new Error('Enabled Label replaced a configured font family');
        label.fontFamily = 'Arial';
        const ttfFrame = label.ttfSpriteFrame;
        if (label.spriteFrame !== ttfFrame) throw new Error('System Label spriteFrame differs from its TTF frame');
        if (!(ttfFrame instanceof SpriteFrame) || !ttfFrame.texture) throw new Error('Enabled Label has no TTF sprite frame');
        const transform = labelNode.getComponent(UITransform)!;
        label.fontSize = 16;
        label.actualFontSize = 14.123456789;
        if (label.actualFontSize !== 14.123456789) throw new Error('Label rounded a manual actualFontSize');
        label.lineHeight = 20;
        label.enableWrapText = true;
        label.overflow = Label.Overflow.RESIZE_HEIGHT;
        label.string = 'AAAA AAAA AAAA AAAA';
        transform.setContentSize(48, 80);
        label.enableWrapText = true;
        label.updateRenderData(true);
        const wrappedHeight = transform.height;
        if (Number(label.actualFontSize) !== label.fontSize) throw new Error('TTF layout did not publish its resolved size');
        label.enableWrapText = false;
        label.updateRenderData(true);
        if (transform.width !== 48 || wrappedHeight <= label.lineHeight * 2 || transform.height !== wrappedHeight) {
            throw new Error('RESIZE_HEIGHT must wrap independently of enableWrapText');
        }
        label.enableWrapText = true;
        const labelLayout: { force: boolean; overflow: number; width: number; height: number }[] = [];
        for (const force of [false, true]) {
            for (const overflow of [Label.Overflow.CLAMP, Label.Overflow.SHRINK, Label.Overflow.RESIZE_HEIGHT, Label.Overflow.NONE]) {
                label.overflow = overflow;
                transform.setContentSize(72, 80);
                label.string = 'one line\nsecond line';
                label.updateRenderData(force);
                const { width, height } = transform;
                if (label.contentWidth !== width) throw new Error('TTF contentWidth disagrees with the published layout');
                labelLayout.push({ force, overflow, width, height });
                const fixedWidth = overflow !== Label.Overflow.NONE;
                const fixedHeight = overflow === Label.Overflow.CLAMP || overflow === Label.Overflow.SHRINK;
                if (width <= 0 || height <= 0 || (width === 72) !== fixedWidth || (height === 80) !== fixedHeight) {
                    throw new Error('Immediate Label layout failed: ' + JSON.stringify(labelLayout));
                }
            }
        }
        const pool = Label._canvasPool;
        const borrowed = pool.get();
        if (!borrowed.context || borrowed.canvas.getContext('2d') !== borrowed.context) throw new Error('Invalid Label canvas context');
        borrowed.context.font = '18px Arial';
        if (!(borrowed.context.measureText('M6').width > 0)) throw new Error('Label canvas could not measure text');
        const previousFont = borrowed.context.font;
        const other = pool.get();
        if (other.canvas === borrowed.canvas) throw new Error('Label canvas issued to two callers');
        pool.put(other);
        pool.put(borrowed);
        const reused = pool.get();
        if (reused !== borrowed || reused.context?.font !== previousFont) throw new Error('Label canvas lost its identity or state');
        pool.put(reused);
        label.contentWidth = -17.125;
        label.updateRenderData();
        if (label.contentWidth !== -17.125) throw new Error('Clean Label refresh overwrote contentWidth');
        label.updateRenderData(true);
        if (label.contentWidth !== transform.width) throw new Error('Forced TTF refresh did not publish contentWidth');
        label.cacheMode = Label.CacheMode.CHAR;
        if (label.ttfSpriteFrame !== ttfFrame) throw new Error('Entering CHAR discarded the cached TTF sprite frame');
        label.contentWidth = 13.25;
        label.updateRenderData(true);
        if (label.contentWidth !== 13.25) throw new Error('CHAR cache overwrote the TTF layout width');
        const atlasTexture = label.spriteFrame as unknown as Texture2D;
        if (!(atlasTexture instanceof Texture2D) || atlasTexture.width !== 1024 || atlasTexture.height !== 1024) {
            throw new Error('Invalid CHAR atlas texture');
        }
        const peerNode = node(canvas.node, 'char-atlas-peer');
        const peer = peerNode.addComponent(Label);
        peer.fontSize = 28;
        peer.color = new Color(0, 255, 0, 255);
        peer.string = 'Q';
        peer.cacheMode = Label.CacheMode.CHAR;
        peer.updateRenderData(true);
        if (peer.spriteFrame !== atlasTexture) throw new Error('CHAR Labels with different styles did not share a texture');
        const region = new gfx.BufferTextureCopy();
        region.texExtent.width = atlasTexture.width;
        region.texExtent.height = atlasTexture.height;
        const atlasPixels = new Uint8Array(atlasTexture.width * atlasTexture.height * 4);
        director.root!.device.copyTextureToBuffers(atlasTexture.getGFXTexture()!, [atlasPixels], [region]);
        let green = 0;
        for (let i = 0; i < atlasPixels.length; i += 4) {
            if (atlasPixels[i] < 10 && atlasPixels[i + 1] > 200 && atlasPixels[i + 2] < 10 && atlasPixels[i + 3] > 128) green++;
        }
        if (!green) throw new Error('Shared GPU texture lacks the second Label glyph');
        label.cacheMode = Label.CacheMode.NONE;
        if (!isValid(atlasTexture, true) || peer.spriteFrame !== atlasTexture) throw new Error('One Label leaving CHAR invalidated its peer');
        peerNode.destroy();
        const freshFrame = label.ttfSpriteFrame;
        if (!freshFrame?.texture || freshFrame === ttfFrame) throw new Error('Leaving CHAR did not replace the TTF sprite frame');
        const freshTexture = freshFrame.texture;
        const shrinkSizes: number[] = [];
        label.fontSize = 32;
        label.lineHeight = 40;
        label.overflow = Label.Overflow.SHRINK;
        label.string = 'I\nI';
        for (const wrap of [false, true]) {
            label.enableWrapText = wrap;
            for (const height of [20, 100, 20]) {
                transform.setContentSize(120, height);
                label.updateRenderData(true);
                if (label.fontSize !== 32 || transform.width !== 120 || transform.height !== height) throw new Error('SHRINK mutated requested size');
                shrinkSizes.push(label.actualFontSize);
            }
        }
        label.enableWrapText = false;
        label.string = 'MMMM';
        for (const width of [26, 200]) {
            transform.setContentSize(width, 100);
            label.updateRenderData(true);
            shrinkSizes.push(label.actualFontSize);
        }
        labelNode.destroy();
        await wait();
        if (isValid(freshFrame) || isValid(freshTexture)) throw new Error('Destroyed Label retained valid TTF assets');
        for (const item of cases) {
            const root = node(canvas.node, item.name);
            const update = item.draw(root);
            await capture(item.name);
            if (update) { update(); await capture(`${item.name}-updated`); }
            root.destroy(); await wait(40);
        }
        const roots: { name: string; actual: number; expected: number }[] = [];
        const rootCount = (name: string, expected: number): void => {
            const batcher: any = director.root!.batcher2D;
            const actual = sys.isNative ? batcher._nativeObj.getRootNodeCount() : batcher._screens.length;
            roots.push({ name, actual, expected });
            if (actual !== expected) throw new Error(`Root count ${name}: ${actual}, expected ${expected}`);
        };
        const makeRoot = (name: string, color: Color, useCanvas = false): { n: Node; comp: RenderRoot2D } => {
            const n = node(director.getScene()!, name); n.setWorldPosition(canvas.node.worldPosition);
            const comp = useCanvas ? n.addComponent(Canvas) : n.addComponent(RenderRoot2D);
            const g = graphics(n); g.fillColor = color; g.fillRect(-40, -40, 80, 80);
            return { n, comp };
        };
        rootCount('base-canvas', 1);
        const rootB = makeRoot('root-blue', new Color(0, 0, 255, 128));
        const rootA = makeRoot('root-red', new Color(255, 0, 0, 128));
        rootA.n.setSiblingIndex(1); director.root!.batcher2D.sortScreens();
        await capture('root-order-registration'); rootCount('two-roots-added', 3);
        rootA.n.setSiblingIndex(2); director.root!.batcher2D.sortScreens();
        await capture('root-order-reordered'); rootCount('two-roots-reordered', 3);
        rootA.comp.enabled = false;
        await capture('root-first-disabled'); rootCount('root-disabled', 2);
        rootA.comp.enabled = true; rootA.comp.onEnable();
        await capture('root-first-enabled'); rootCount('root-duplicate-enable', 3);
        rootA.n.destroy();
        await capture('root-first-destroyed'); rootCount('root-destroyed', 2);
        rootB.comp.enabled = false;
        await capture('root-both-disabled'); rootCount('both-roots-disabled', 1);
        rootB.n.destroy(); await wait(40);
        const canvasA = makeRoot('canvas-green', new Color(0, 255, 0, 128), true);
        const canvasB = makeRoot('canvas-red', new Color(255, 0, 0, 128), true);
        await capture('root-canvas-pair'); rootCount('two-canvases-added', 3);
        canvasA.comp.enabled = false;
        await capture('root-canvas-disabled'); rootCount('canvas-disabled', 2);
        canvasA.comp.enabled = true;
        await capture('root-canvas-reenabled'); rootCount('canvas-reenabled', 3);
        canvasA.n.destroy(); canvasB.n.destroy();
        await capture('root-canvas-destroyed'); rootCount('canvases-destroyed', 1);
        const hits: { name: string; actual: boolean; expected: boolean }[] = [];
        const hit = (name: string, actual: boolean, expected: boolean): void => {
            hits.push({ name, actual, expected });
            if (actual !== expected) throw new Error(`Hit test ${name}: ${actual}, expected ${expected}`);
        };
        const hitRoot = node(canvas.node, 'hit-root');
        const outer = mask(hitRoot, 100, 80); outer.m.radius = 20;
        const target = node(outer.n, 'hit-target'); target.getComponent(UITransform)!.setContentSize(400, 400);
        target.on(Node.EventType.TOUCH_START, () => {});
        const outerUI = outer.n.getComponent(UITransform)!;
        const targetUI = target.getComponent(UITransform)!;
        const worldPoint = (x: number, y: number): Vec3 => outerUI.convertToWorldSpaceAR(new Vec3(x, y, 0));
        const maskHit = (name: string, x: number, y: number, expected: boolean): void => {
            const p = worldPoint(x, y); hit(name, outer.m.isHit(new Vec2(p.x, p.y)), expected);
        };
        maskHit('rounded-center', 0, 0, true); maskHit('rounded-corner', 49, 39, false);
        maskHit('rounded-edge', 50, 0, true);
        outer.n.setPosition(10, 20); outer.n.setScale(1.5, .5, 1); outer.n.setRotationFromEuler(0, 0, 35);
        maskHit('transformed-center', 0, 0, true); maskHit('transformed-corner', 49, 39, false);
        outer.n.setPosition(0, 0); outer.n.setScale(1, 1, 1); outer.n.setRotationFromEuler(0, 0, 0);
        outer.m.type = Mask.Type.GRAPHICS_ELLIPSE;
        maskHit('ellipse-center', 0, 0, true); maskHit('ellipse-edge', 50, 0, false);
        outer.m.type = Mask.Type.GRAPHICS_RECT;
        const screenHit = (name: string, x: number, y: number, expected: boolean, wrongWindow = false): void => {
            const screen = camera.worldToScreen(worldPoint(x, y));
            const windowId = camera.camera.systemWindowId;
            hit(name, targetUI.hitTest(new Vec2(screen.x, screen.y), windowId + (wrongWindow ? 1 : 0)), expected);
        };
        await wait();
        screenHit('offscreen-camera-excluded', 0, 0, false);
        camera.targetTexture = null; await wait();
        screenHit('screen-center', 0, 0, true); screenHit('screen-rounded-corner', 49, 39, false);
        screenHit('wrong-window-excluded', 0, 0, false, true);
        const visibility = camera.visibility; camera.visibility = 0; await wait();
        screenHit('camera-layer-excluded', 0, 0, false);
        camera.visibility = visibility; await wait();
        const secondRoot = node(director.getScene()!, 'hit-second-root');
        secondRoot.setWorldPosition(canvas.node.worldPosition);
        secondRoot.addComponent(RenderRoot2D);
        hitRoot.parent = secondRoot;
        hitRoot.setPosition(17, -11);
        hitRoot.setScale(1.25, .75, 1);
        hitRoot.setRotationFromEuler(0, 0, 27);
        await wait();
        screenHit('second-root-transformed-center', 0, 0, true);
        screenHit('second-root-transformed-rounded-corner', 49, 39, false);
        hitRoot.parent = canvas.node;
        secondRoot.destroy();
        await wait();
        screenHit('original-root-after-destroy', 0, 0, true);
        outer.m.enabled = false; screenHit('disabled-mask', 49, 39, true);
        outer.m.enabled = true; outer.m.inverted = true;
        screenHit('inverted-center', 0, 0, false); screenHit('inverted-corner', 49, 39, true);
        outer.m.inverted = false;
        const inner = mask(outer.n, 20, 20, 1); target.parent = inner.n; await wait();
        screenHit('nested-mask-outside', 15, 0, false);
        inner.m.enabled = false; screenHit('nested-mask-disabled', 15, 0, true);
        target.parent = hitRoot; inner.n.destroy(); await wait();
        screenHit('reparent-drops-ancestors', 49, 39, true);
        target.parent = outer.n; await wait();
        outer.m.destroy(); await wait();
        screenHit('destroyed-mask-detached', 49, 39, true);
        hitRoot.destroy(); await wait(40);
        const scenes = await runSceneMatrix(rt, capture);
        const device = director.root!.device;
        const result = { backend: sys.isNative ? 'native' : 'web', snapshot, captures,
            scenes, roots, hits, batchDrawCalls, labelLayout, shrinkSizes, width: 256, height: 256, environment: { os: sys.os, renderer: device.renderer, vendor: device.vendor } };
        if (sys.isNative) native.fileUtils.writeStringToFile(JSON.stringify(result), `${outputRoot}/manifest.json`);
        else await fetch('/m6-result', { method: 'POST', body: JSON.stringify(result) });
        console.log(`M6_GPU_DONE ${JSON.stringify(result)}`);
        (globalThis as any).__M6_GPU_DONE__ = result;
    }
}
