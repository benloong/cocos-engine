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

/** M4 Mask + Graphics probe. */
export class M4Probe {
    public static run (parent: Node): void {
        const texture = new Texture2D();
        texture.reset({ width: 8, height: 8, format: Texture2D.PixelFormat.RGBA8888 });
        const pixels = new Uint8Array(8 * 8 * 4);
        for (let i = 0; i < pixels.length; i += 4) { pixels[i] = 255; pixels[i + 3] = 255; }
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

        setTimeout(() => {
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
                    setTimeout(() => {
                        console.log(`M4_SPRITE_PIXEL ${JSON.stringify({ red: readRed() })}`);

                        maskNode.active = false;
                        const graphicsNode = new Node('M4Graphics');
                        parent.addChild(graphicsNode);
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
                            camera.orthoHeight = oldOrthoHeight;
                            camera.targetTexture = oldTarget;
                            renderTexture.destroy();
                        }, 600);
                    }, 700);
                }, 700);
            }, 700);
        }, 900);
    }
}
