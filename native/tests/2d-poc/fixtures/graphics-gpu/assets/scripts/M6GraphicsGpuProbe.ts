import { _decorator, Camera, Canvas, Color, Component, director, Graphics, Mask, native, Node, Rect, RenderRoot2D, RenderTexture, Size, Sprite, SpriteFrame, sys, Texture2D, UIOpacity, UITransform, Vec2, Vec3 } from 'cc';
import { runSceneMatrix } from './M6SceneMatrix';

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
        const capture = async (name: string, source = rt): Promise<void> => {
            await wait();
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
            scenes, roots, hits, width: 256, height: 256, environment: { os: sys.os, renderer: device.renderer, vendor: device.vendor } };
        if (sys.isNative) native.fileUtils.writeStringToFile(JSON.stringify(result), `${outputRoot}/manifest.json`);
        else await fetch('/m6-result', { method: 'POST', body: JSON.stringify(result) });
        console.log(`M6_GPU_DONE ${JSON.stringify(result)}`);
        (globalThis as any).__M6_GPU_DONE__ = result;
    }
}
