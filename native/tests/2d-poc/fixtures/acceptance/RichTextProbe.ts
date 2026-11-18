import { M4ExtraProbe } from './M4ExtraProbe';
import { BitmapGpuProbe } from './BitmapGpuProbe';
import {
    Camera,
    Canvas,
    Color,
    director,
    Label,
    Node,
    Rect,
    RenderTexture,
    RichText,
    Size,
    Sprite,
    SpriteAtlas,
    SpriteFrame,
    Texture2D,
    UITransform,
    Vec2,
    Vec3,
} from 'cc';

/** RichText GPU pixels and real segment data on both render backends. */
export class RichTextProbe {
    public static run (parent: Node): void {
        this.runWithBitmap(parent).catch(error => console.log('M5_RICHTEXT_ERROR ' + String(error.stack || error)));
    }
    private static async runWithBitmap (parent: Node): Promise<void> {
        // All three probes borrow the same Camera. Wait for the previous target to be restored.
        await M4ExtraProbe.completion;
        await BitmapGpuProbe.run(parent);
        console.log('M5_RICHTEXT_BEGIN');
        const node = new Node('M5RichText');
        parent.addChild(node);
        node.setPosition(0, 0, 0);
        const transform = node.addComponent(UITransform);
        transform.setContentSize(300, 200);
        const iconTexture = new Texture2D();
        iconTexture.reset({ width: 8, height: 8, format: Texture2D.PixelFormat.RGBA8888 });
        const iconPixels = new Uint8Array(8 * 8 * 4);
        for (let i = 0; i < iconPixels.length; i += 4) {
            iconPixels[i] = 255;
            iconPixels[i + 1] = 128;
            iconPixels[i + 3] = 255;
        }
        iconTexture.uploadData(iconPixels);
        const iconFrame = new SpriteFrame();
        iconFrame.texture = iconTexture;
        iconFrame.rect = new Rect(0, 0, 8, 8);
        iconFrame.originalSize = new Size(8, 8);
        console.log('M5_STEP_ATLAS_BEFORE');
        const atlas = new SpriteAtlas('M5RichTextAtlas');
        console.log('M5_STEP_ATLAS_AFTER');
        console.log('M5_STEP_ADD_BEFORE');
        atlas.spriteFrames['icon'] = iconFrame;
        console.log('M5_STEP_ADD_AFTER');
        console.log(`M5_ATLAS ${JSON.stringify({ found: !!atlas.getSpriteFrame('icon') })}`);

        const richText = node.addComponent(RichText);
        richText.imageAtlas = atlas;
        richText.lineHeight = 32;
        richText.maxWidth = 300;
        richText.string = "<on click='m5Click'><size=20>Small</size></on> <color=#ff0000>Red</color>"
            + "<outline color=#00ff00 width=2>Outline</outline><br/>"
            + "<b>Bold</b> <i>Italic</i> <u>Underline</u>"
            + "<img src='icon'/>";

        const scene = director.getScene();
        const canvas = scene?.getComponentInChildren(Canvas) ?? null;
        const camera = canvas?.cameraComponent ?? null;
        if (!camera || !canvas) {
            console.log('M5_RICHTEXT_ERROR no camera');
            return;
        }
        const rt = new RenderTexture();
        rt.reset({ width: 256, height: 256 });
        const oldTarget = camera.targetTexture;
        const oldOrtho = camera.orthoHeight;
        camera.targetTexture = rt;
        camera.orthoHeight = 128;

        const states = canvas.node.children.map((child) => ({ node: child, active: child.active }));
        for (const state of states) {
            state.node.active = state.node === node || state.node === camera.node;
        }

        setTimeout(() => {
            const children = node.children;
            const backend = (richText as any)._native;
            const native = !!backend?.getSegmentCount;
            const nativeLabels = native ? Array.from({ length: backend.getSegmentCount() }, (_, i) => backend.getSegmentLabel(i)).filter(Boolean) : [];
            const jsLabels = children.filter((child) => !!child.getComponent(Label));
            const labels = native ? nativeLabels.length : jsLabels.length;
            const sprites = native ? children.filter((_, i) => !!backend.getSegmentSprite(i)).length
                : children.filter((child) => !!child.getComponent(Sprite)).length;
            if (native && (backend.getSegmentCount() !== children.length || labels + sprites !== children.length)) {
                throw new Error('Native RichText segment graph is incomplete');
            }
            const styles = native ? nativeLabels.map((label: any) => ({
                fontSize: label.getActualFontSize(), bold: label.isBold(), italic: label.isItalic(), underline: label.isUnderline(),
            })) : jsLabels.map((child) => child.getComponent(Label)!).map((label: Label) => ({
                fontSize: label.fontSize,
                outline: label.enableOutline,
                outlineWidth: label.outlineWidth,
                bold: (label as any).isBold,
                italic: (label as any).isItalic,
                underline: (label as any).isUnderline,
            }));
            let colored = 0;
            try {
                const data = rt.readPixels();
                if (data) {
                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i + 3] > 0
                            && (data[i] > 20 || data[i + 1] > 20 || data[i + 2] > 20)) {
                            colored++;
                        }
                    }
                }
            } catch (error) {
                console.log(`M5_RICHTEXT_ERROR pixel ${String(error)}`);
            }
            const hitSegment = children.find((child) => !!child.getComponent(Label)) ?? null;
            let hit = false;
            let miss = false;
            if (native && nativeLabels.length) {
                const index = children.findIndex((_, i) => !!backend.getSegmentLabel(i));
                const label = backend.getSegmentLabel(index);
                const point = Vec3.transformMat4(new Vec3(), new Vec3(label.getContentWidth() / 2, 0, 0), children[index].worldMatrix);
                hit = backend.getHitSegments(point.x, point.y).includes(index);
                miss = backend.getHitSegments(point.x - 1000, point.y - 1000).includes(index);
            } else if (hitSegment) {
                const segmentTransform = hitSegment.getComponent(UITransform)!;
                const box = segmentTransform.getBoundingBoxToWorld();
                hit = (richText as any)._containsTouchLocation(
                    { node: hitSegment },
                    new Vec2(box.x + box.width / 2, box.y + box.height / 2),
                );
                miss = (richText as any)._containsTouchLocation(
                    { node: hitSegment },
                    new Vec2(box.x - 1000, box.y - 1000),
                );
            }
            const segments = children.map((child, i) => {
                if (native) {
                    const label = backend.getSegmentLabel(i);
                    return { name: child.name, text: label?.getString() ?? '', x: child.position.x, y: child.position.y,
                        w: label?.getContentWidth() ?? null, h: label?.getContentHeight() ?? null };
                }
                const label = child.getComponent(Label);
                const t = child.getComponent(UITransform);
                return {
                    name: child.name,
                    text: label?.string ?? '',
                    x: child.position.x,
                    y: child.position.y,
                    w: t?.contentSize.width ?? 0,
                    h: t?.contentSize.height ?? 0,
                };
            });
            const result = {
                children: children.length,
                native,
                jsLabelComponents: jsLabels.length,
                labels,
                sprites,
                width: transform.contentSize.width,
                height: transform.contentSize.height,
                colored,
                styles,
                hit,
                miss,
                segments,
            };
            console.log(`M5_RICHTEXT ${JSON.stringify(result)}`);
            if (typeof document !== 'undefined') {
                let el = document.getElementById('m5-result');
                if (!el) {
                    el = document.createElement('pre');
                    el.id = 'm5-result';
                    document.body.appendChild(el);
                }
                el.textContent = JSON.stringify(result);
            }

            for (const state of states) { state.node.active = state.active; }
            camera.orthoHeight = oldOrtho;
            camera.targetTexture = oldTarget;
            rt.destroy();
        }, 900);
    }
}
