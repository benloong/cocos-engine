import { M4ExtraProbe } from './M4ExtraProbe';
import { BitmapGpuProbe } from './BitmapGpuProbe';
import {
    _decorator,
    Camera,
    Component,
    DirectorEvent,
    EventTouch,
    Touch,
    view,
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

@_decorator.ccclass('M6RichTextClickReceiver')
class ClickReceiver extends Component {
    public calls: string[] = [];
    public received (event: EventTouch, parameter: string): void {
        if (event.type !== Node.EventType.TOUCH_END) throw new Error('Unexpected RichText click event');
        this.calls.push(parameter);
    }
}

async function checkLabelTextureUpdates (parent: Node): Promise<void> {
    const host = new Node('m6-label-texture-updates');
    host.layer = parent.layer;
    parent.addChild(host);
    try {
        const transform = host.addComponent(UITransform);
        const label = host.addComponent(Label);
        const backend = (label as any)._native;
        if (!backend) return;
        label.overflow = Label.Overflow.CLAMP;
        label.fontSize = 16;
        label.lineHeight = 20;
        transform.setContentSize(100, 32);
        const render = async (value: string) => {
            label.string = value;
            for (let i = 0; i < 2; ++i) {
                await new Promise<void>(resolve => director.once(DirectorEvent.END_FRAME, () => resolve()));
            }
            const texture = backend.getRenderEntity().getStaticRenderDrawInfo(0).texture;
            if (!texture || !backend.getOpaquePixels()) throw new Error('Missing Label texture update');
            return { id: texture.objectID, checksum: backend.getPixelChecksum(), width: backend.getTextureWidth() };
        };
        for (const mode of [Label.CacheMode.NONE, Label.CacheMode.CHAR]) {
            label.cacheMode = mode;
            transform.setContentSize(100, 32);
            const before = await render('AB');
            const updated = await render('BA');
            if (before.id !== updated.id || before.checksum === updated.checksum) {
                throw new Error('Equal-size Label upload lost texture identity or pixels: ' + mode);
            }
            transform.setContentSize(160, 32);
            const resized = await render('A longer string');
            if (resized.width === updated.width || resized.id === updated.id) {
                throw new Error('Resized Label texture did not reallocate: ' + mode);
            }
        }
        console.log('M6_LABEL_TEXTURE_REUSE_PASS');
    } finally { host.destroy(); }
}

async function checkRichTextEvents (parent: Node): Promise<string[]> {
    const host = new Node('m6-click-host'); host.layer = parent.layer; parent.addChild(host);
    host.addComponent(UITransform);
    const receiver = host.addComponent(ClickReceiver);
    const rich = host.addComponent(RichText);
    const settle = (): Promise<void> => new Promise(resolve => director.once(DirectorEvent.END_FRAME, () => resolve()));
    const update = async (param: string): Promise<Vec2> => {
        rich.string = "<on click='received' param='" + param + "'>word</on>";
        await settle();
        const child = host.children[0];
        const backend = (rich as any)._native;
        if (backend) {
            const local = new Vec3(backend.getSegmentLabel(0).getContentWidth() / 2, 0, 0);
            const p = Vec3.transformMat4(new Vec3(), local, child.worldMatrix);
            return new Vec2(p.x, p.y);
        }
        const rect = child.getComponent(UITransform)!.getBoundingBoxToWorld();
        return new Vec2(rect.x + rect.width / 2, rect.y + rect.height / 2);
    };
    const send = (point: Vec2, expected: boolean): void => {
        const viewport = view.getViewportRect();
        const touch = new Touch(viewport.x + point.x * view.getScaleX(), viewport.y + point.y * view.getScaleY());
        const event = new EventTouch([touch], true, Node.EventType.TOUCH_END, [touch]); event.touch = touch;
        host.dispatchEvent(event);
        if (event.propagationStopped !== expected) throw new Error('Unexpected propagation for RichText click');
    };
    try {
        const first = await update('first');
        send(first, true); send(new Vec2(first.x - 1000, first.y), false);
        rich.handleTouchEvent = false; send(first, false);
        rich.handleTouchEvent = true;
        const second = await update('second');
        send(second, true);
        rich.enabled = false; send(second, false);
        rich.enabled = true; await settle(); send(second, true);
        rich.destroy(); await settle(); await settle(); send(second, false);
        if (receiver.calls.join(',') !== 'first,second,second') throw new Error('Unexpected click sequence ' + receiver.calls);
        return receiver.calls;
    } finally { host.destroy(); }
}

/** RichText GPU pixels and real segment data on both render backends. */
export class RichTextProbe {
    public static run (parent: Node): void {
        this.runWithBitmap(parent).catch(error => console.log('M5_RICHTEXT_ERROR ' + String(error.stack || error)));
    }
    private static async runWithBitmap (parent: Node): Promise<void> {
        // All three probes borrow the same Camera. Wait for the previous target to be restored.
        await M4ExtraProbe.completion;
        await BitmapGpuProbe.run(parent);
        await checkLabelTextureUpdates(parent);
        const clicks = await checkRichTextEvents(parent);
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
            const jsSprites = children.filter(child => !!child.getComponent(Sprite));
            const queryMatches = node.getComponent(RichText) === richText
                && node.getComponentsInChildren(Label).length === jsLabels.length
                && node.getComponentsInChildren(Sprite).length === jsSprites.length;
            if (!queryMatches || (native && (jsLabels.length || jsSprites.length))) {
                throw new Error('RichText segment component query contract failed');
            }
            const labels = native ? nativeLabels.length : jsLabels.length;
            const sprites = native ? children.filter((_, i) => !!backend.getSegmentSprite(i)).length
                : jsSprites.length;
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
                jsSpriteComponents: jsSprites.length,
                queryMatches,
                clicks,
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
