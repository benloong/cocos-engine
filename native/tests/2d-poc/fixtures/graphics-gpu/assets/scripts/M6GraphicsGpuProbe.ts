import { _decorator, Camera, Canvas, Color, Component, director, Graphics, Mask, native, Node, Rect, RenderTexture, Size, Sprite, SpriteFrame, sys, Texture2D, UIOpacity, UITransform } from 'cc';

const { ccclass } = _decorator;
// Replaced by prepare-graphics-gpu-project.cjs in the generated project only.
const outputRoot = '__M6_GPU_OUTPUT__';
const snapshot = '__M6_GPU_SNAPSHOT__';
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
        ];
        for (const threshold of [.2, .5, .8]) cases.push({ name: `mask-alpha-${threshold}`, draw: root => {
            const { n, m } = mask(root, 120, 100, 3);
            if (sys.isNative) (m as any).spriteFrame = alphaFrame;
            else { const sprite = m.subComp as Sprite; sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.spriteFrame = alphaFrame; }
            m.alphaThreshold = threshold; red(n);
        } });
        for (let cap = 0; cap < 3; ++cap) for (let join = 0; join < 3; ++join) cases.push({
            name: `stroke-${cap}-${join}`, draw: root => { const g = graphics(root); g.lineWidth = 18; g.lineCap = cap; g.lineJoin = join; g.miterLimit = 2; g.strokeColor = new Color(220, 30, 40, 160); g.moveTo(-80, -35); g.lineTo(-15, 45); g.lineTo(20, -35); g.lineTo(80, 40); g.stroke(); },
        });
        const captures: string[] = [];
        const capture = async (name: string): Promise<void> => {
            await wait();
            const pixels = rt.readPixels();
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
        for (const item of cases) {
            const root = node(canvas.node, item.name);
            const update = item.draw(root);
            await capture(item.name);
            if (update) { update(); await capture(`${item.name}-updated`); }
            root.destroy(); await wait(40);
        }
        const device = director.root!.device;
        const result = { backend: sys.isNative ? 'native' : 'web', snapshot, captures,
            width: 256, height: 256, environment: { os: sys.os, renderer: device.renderer, vendor: device.vendor } };
        if (sys.isNative) native.fileUtils.writeStringToFile(JSON.stringify(result), `${outputRoot}/manifest.json`);
        else await fetch('/m6-result', { method: 'POST', body: JSON.stringify(result) });
        console.log(`M6_GPU_DONE ${JSON.stringify(result)}`);
        (globalThis as any).__M6_GPU_DONE__ = result;
    }
}
