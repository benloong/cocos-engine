import {
    builtinResMgr,
    Camera,
    Canvas,
    Color,
    director,
    Graphics,
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

import { M4Probe } from './M4Probe';

/** M4 GRAPHICS_STENCIL + nested Mask pixel probe. */
export class M4ExtraProbe {
    public static completion: Promise<void> = Promise.resolve();

    public static run (parent: Node): void {
        this.completion = M4Probe.completion.then(() => new Promise<void>((resolve) => this.runProbe(parent, resolve)));
    }

    private static runProbe (parent: Node, finish: () => void): void {
        const texture = new Texture2D();
        texture.reset({ width: 8, height: 8, format: Texture2D.PixelFormat.RGBA8888 });
        const pixels = new Uint8Array(8 * 8 * 4);
        for (let i = 0; i < pixels.length; i += 4) { pixels[i] = 255; pixels[i + 3] = 255; }
        texture.uploadData(pixels);
        const frame = new SpriteFrame();
        frame.texture = texture;
        frame.rect = new Rect(0, 0, 8, 8);
        frame.originalSize = new Size(8, 8);

        const scene = director.getScene();
        const canvas = scene?.getComponentInChildren(Canvas) ?? null;
        const camera = canvas?.cameraComponent ?? null;
        if (!camera || !canvas) { console.log('M4_EXTRA_ERROR no camera'); finish(); return; }

        const rt = new RenderTexture();
        rt.reset({ width: 256, height: 256 });
        const oldTarget = camera.targetTexture;
        const oldOrtho = camera.orthoHeight;
        camera.targetTexture = rt;
        camera.orthoHeight = 128;

        const states = canvas.node.children.map((child) => ({ node: child, active: child.active }));
        for (const state of states) {
            state.node.active = state.node === camera.node;
        }

        const makeSprite = (node: Node): void => {
            const transform = node.addComponent(UITransform);
            transform.setContentSize(300, 200);
            const sprite = node.addComponent(Sprite);
            sprite.sizeMode = 0;
            sprite.spriteFrame = frame;
            sprite.color = new Color(255, 0, 0, 255);
            const material = builtinResMgr.get<Material>('ui-sprite-material');
            if (material) { sprite.customMaterial = material; }
        };

        // ---- GRAPHICS_STENCIL ----
        const gMaskNode = new Node('M4GraphicsMask');
        parent.addChild(gMaskNode);
        const gTransform = gMaskNode.addComponent(UITransform);
        gTransform.setContentSize(256, 256);
        const gMask = gMaskNode.addComponent(Mask);
        gMask.type = Mask.Type.GRAPHICS_STENCIL;
        const gGraphics = gMask.subComp!;
        const gSpriteNode = new Node('M4GraphicsMaskedSprite');
        gMaskNode.addChild(gSpriteNode);
        makeSprite(gSpriteNode);

        setTimeout(() => {
            gGraphics.clear();
            gGraphics.fillColor = new Color(255, 255, 255, 255);
            gGraphics.rect(-20, -20, 40, 40);
            gGraphics.fill();
            setTimeout(() => {
                const entity = (gMask as any)._native?.getRenderEntity();
                if (entity) {
                    const draw = entity.getRenderDrawInfosSize() ? entity.getRenderDrawInfoAt(0) : null;
                    console.log(`M4_GRAPHICS_GEOMETRY ${JSON.stringify({ vertices: draw?.vbCount ?? 0, indices: draw?.ibCount ?? 0 })}`);
                }
                let graphicsRed = 0;
                try {
                    const data = rt.readPixels();
                    if (data) {
                        for (let i = 0; i < data.length; i += 4) {
                            if (data[i] > 50 && data[i + 1] < 20 && data[i + 2] < 20) { graphicsRed++; }
                        }
                    }
                } catch (error) { console.log(`M4_EXTRA_ERROR graphics ${String(error)}`); }
                console.log(`M4_GRAPHICS_STENCIL ${JSON.stringify({ red: graphicsRed })}`);

                // ---- nested masks ----
                gMaskNode.active = false;
                const outer = new Node('M4NestedOuter');
                parent.addChild(outer);
                const outerTransform = outer.addComponent(UITransform);
                outerTransform.setContentSize(120, 120);
                const outerMask = outer.addComponent(Mask);
                outerMask.type = Mask.Type.GRAPHICS_RECT;

                const inner = new Node('M4NestedInner');
                outer.addChild(inner);
                const innerTransform = inner.addComponent(UITransform);
                innerTransform.setContentSize(60, 60);
                const innerMask = inner.addComponent(Mask);
                innerMask.type = Mask.Type.GRAPHICS_RECT;

                const nestedSpriteNode = new Node('M4NestedSprite');
                inner.addChild(nestedSpriteNode);
                makeSprite(nestedSpriteNode);

                setTimeout(() => {
                    let nestedRed = 0;
                    try {
                        const data = rt.readPixels();
                        if (data) {
                            for (let i = 0; i < data.length; i += 4) {
                                if (data[i] > 50 && data[i + 1] < 20 && data[i + 2] < 20) { nestedRed++; }
                            }
                        }
                    } catch (error) { console.log(`M4_EXTRA_ERROR nested ${String(error)}`); }
                    console.log(`M4_NESTED_MASK ${JSON.stringify({ red: nestedRed })}`);

                    for (const state of states) { state.node.active = state.active; }
                    camera.orthoHeight = oldOrtho;
                    camera.targetTexture = oldTarget;
                    rt.destroy();
                    finish();
                }, 700);
            }, 450);
        }, 1000);
    }
}
