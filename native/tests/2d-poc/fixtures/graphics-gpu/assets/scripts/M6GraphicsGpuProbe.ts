import { _decorator, BitmapFont, Camera, Canvas, Color, Component, deserialize, Director, director, dynamicAtlasManager, Graphics, Label, LabelOutline, LabelShadow, Mask, native, Node, Rect, RenderRoot2D, RenderTexture, Size, Sprite, SpriteFrame, sys, Texture2D, UIOpacity, UITransform, Vec2, Vec3 } from 'cc';
import { countTraversedRoots, runSceneMatrix } from './M6SceneMatrix';
import { assetManager, EffectAsset, gfx, ImageAsset, instantiate, isValid, Material, Prefab, resources, SpriteRenderer } from 'cc';
import { runRichTextMatrix } from './M6RichTextMatrix';

const { ccclass } = _decorator;
// Replaced by prepare-graphics-gpu-project.cjs in the generated project only.
const outputRoot = '__M6_GPU_OUTPUT__';
const snapshot = '__M6_GPU_SNAPSHOT__';
const probeMode: string = '__M6_GPU_MODE__';
const spriteImplementation = (globalThis as { __m6SpriteImplementation?: string }).__m6SpriteImplementation ?? (sys.isNative ? 'native' : 'js');
const labelImplementation = (globalThis as { __m6LabelImplementation?: string }).__m6LabelImplementation ?? (sys.isNative ? 'native' : 'js');
const graphicsMaskImplementation = (globalThis as { __m6GraphicsMaskImplementation?: string }).__m6GraphicsMaskImplementation ?? (sys.isNative ? 'native' : 'js');
const wait = (ms = 180): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

async function checkLegacyLabelEffects (parent: Node, target: RenderTexture): Promise<object> {
    const prefab = deserialize([
        { __type__: 'cc.Prefab', data: { __id__: 1 } },
        { __type__: 'cc.Node', _name: 'LegacyLabelEffects', _components: [2, 3, 4, 5].map(__id__ => ({ __id__ })) },
        { __type__: 'cc.UITransform', node: { __id__: 1 } },
        { __type__: 'cc.Label', node: { __id__: 1 }, _string: 'Atlas', _fontSize: 32, _lineHeight: 40 },
        { __type__: 'cc.LabelOutlineComponent', node: { __id__: 1 } },
        { __type__: 'cc.LabelShadow', node: { __id__: 1 } },
    ]) as Prefab;
    const instance = instantiate(prefab);
    instance.layer = parent.layer;
    parent.addChild(instance);
    const label = instance.getComponent(Label)!;
    const outline = instance.getComponent(LabelOutline);
    const shadow = instance.getComponent(LabelShadow);
    const pixels = async (): Promise<Uint8Array> => {
        await wait();
        const rgba = target.readPixels();
        if (!rgba) throw new Error('Legacy Label effects could not read the render target');
        return new Uint8Array(rgba);
    };
    const equal = (a: Uint8Array, b: Uint8Array): boolean => a.every((byte, i) => byte === b[i]);
    const hasColor = (rgba: Uint8Array, channel: 0 | 1): boolean => {
        for (let i = 0; i < rgba.length; i += 4) {
            if (rgba[i + channel] > 32 + Math.max(rgba[i + 1 - channel], rgba[i + 2])) return true;
        }
        return false;
    };
    try {
        if (!outline || !shadow || !label.enableOutline || !label.enableShadow) throw new Error('Legacy Label effects did not activate from the Prefab');
        outline.width = 2;
        shadow.blur = 0;
        const outlineColor = new Color(255, 0, 0, 255);
        const shadowColor = new Color(0, 255, 0, 255);
        const offset = new Vec2(16, 14);
        const holder = (label as any)._native ?? label;
        const keys = holder === label ? ['_markForUpdateRenderData'] : ['setOutlineColor', 'setShadowColor', 'setShadowOffset'];
        const original = keys.map(key => holder[key]);
        let updates = 0;
        try {
            keys.forEach((key, i) => {
                holder[key] = function (...args: unknown[]): void { ++updates; original[i].apply(this, args); };
            });
            outline.color = outline.color;
            shadow.color = shadow.color;
            shadow.offset = shadow.offset;
            outline.color = outlineColor;
            shadow.color = shadowColor;
            shadow.offset = offset;
            outline.color = outline.color;
            shadow.color = shadow.color;
            shadow.offset = shadow.offset;
        } finally {
            keys.forEach((key, i) => { holder[key] = original[i]; });
        }
        if (updates !== 3) throw new Error(`Legacy Label effects expected three updates, received ${updates}`);
        if (outline.color !== label.outlineColor || shadow.color !== label.shadowColor || shadow.offset !== label.shadowOffset
            || label.outlineWidth !== outline.width || label.shadowBlur !== shadow.blur) throw new Error('Legacy effect getters did not forward to Label');
        const both = await pixels();
        outline.enabled = false;
        const shadowOnly = await pixels();
        outline.enabled = true;
        shadow.enabled = false;
        const outlineOnly = await pixels();
        shadow.enabled = true;
        if (!equal(both, await pixels()) || !hasColor(both, 0) || !hasColor(both, 1)
            || hasColor(shadowOnly, 0) || !hasColor(shadowOnly, 1) || !hasColor(outlineOnly, 0) || hasColor(outlineOnly, 1)) {
            throw new Error('Legacy Label effect activation did not reach the rendered pixels');
        }
        outline.destroy();
        shadow.destroy();
        const plain = await pixels();
        if (isValid(outline) || isValid(shadow) || label.enableOutline || label.enableShadow || hasColor(plain, 0) || hasColor(plain, 1)) {
            throw new Error('Destroying the legacy effects did not remove their rendering');
        }
        label.enableOutline = label.enableShadow = true;
        if (!equal(both, await pixels())) throw new Error('Legacy and direct Label effects rendered differently');
        return { updates, prefab: true, forwarding: true, rendered: true, destroyed: true };
    } finally {
        instance.destroy();
        prefab.destroy();
        await wait();
    }
}

async function releaseMeshedFrame (frame: SpriteFrame): Promise<void> {
    const mesh = frame.mesh!;
    const subMesh = mesh.renderingSubMeshes[0];
    const nativeSubMesh = subMesh as typeof subMesh & { getVertexBuffers(): unknown[]; getIndexBuffer(): unknown };
    const vertexCount = (): number => (sys.isNative ? nativeSubMesh.getVertexBuffers() : subMesh.vertexBuffers).length;
    const indexBuffer = (): unknown => sys.isNative ? nativeSubMesh.getIndexBuffer() : subMesh.indexBuffer;
    const endFrame = (): Promise<void> => new Promise(resolve => director.once(Director.EVENT_END_FRAME, () => resolve()));

    assetManager.releaseAsset(frame);
    if (isValid(frame, true) || !isValid(mesh, true) || !vertexCount() || !indexBuffer()) {
        throw new Error('SpriteFrame release invalidated the rendered mesh before deferred destruction');
    }
    await endFrame();
    if (frame.mesh || isValid(mesh, true) || vertexCount() || indexBuffer()) {
        throw new Error('SpriteFrame deferred destruction retained mesh or submitted GPU buffers');
    }
    await endFrame();
    frame.ensureMeshData();
    if (isValid(mesh) || frame.mesh) throw new Error('A released SpriteFrame retained or recreated its mesh');
}

async function checkAuthoredPolygon (parent: Node, layer: number, material: Material, capture: (name: string) => Promise<void>): Promise<void> {
    const makeMeshTexture = (side: number, channel: number): Texture2D => {
        const texture = new Texture2D();
        texture.reset({ width: side, height: side, format: Texture2D.PixelFormat.RGBA8888 });
        const pixels = new Uint8Array(side * side * 4);
        for (let i = 0; i < pixels.length; i += 4) {
            pixels[i + channel] = 255;
            pixels[i + 3] = 255;
        }
        texture.uploadData(pixels);
        return texture;
    };
    const red = makeMeshTexture(16, 0);
    const green = makeMeshTexture(24, 1);
    const polygon = new SpriteFrame();
    const indices = [0, 1, 2, 0, 2, 3, 0, 3, 5, 3, 4, 5];
    const uvs = [0, 0, 1, 0, 1, 0.5, 0.5, 0.5, 0.5, 1, 0, 1];
    polygon._deserialize({
        meshType: SpriteFrame.MeshType.POLYGON, pixelsToUnit: 16, pivot: { x: 0.25, y: 0.75 },
        rect: { x: 0, y: 0, width: 16, height: 16 }, originalSize: { width: 16, height: 16 },
        vertices: {
            rawPosition: [-8, -8, 0, 8, -8, 0, 8, 0, 0, 0, 0, 0, 0, 8, 0, -8, 8, 0],
            indexes: indices, uv: uvs.map(value => value * 16), nuv: uvs,
            minPos: { x: -8, y: -8, z: 0 }, maxPos: { x: 8, y: 8, z: 0 },
        },
    }, null);
    polygon._textureSource = red;
    const polygonNode = new Node('authored-polygon');
    polygonNode.layer = layer;
    polygonNode.setScale(64, 64, 1);
    parent.addChild(polygonNode);
    const renderer = polygonNode.addComponent(SpriteRenderer);
    renderer.setSharedMaterial(material, 0);
    renderer.visibility = polygonNode.layer;
    const checkPolygon = (frame: SpriteFrame, dx: number, dy: number): void => {
        const mesh = frame.mesh!;
        const actualPositions = Array.from(mesh.readAttribute(0, gfx.AttributeName.ATTR_POSITION)!);
        const expectedPositions = [-0.5 + dx, -0.5 + dy, 0, 0.5 + dx, -0.5 + dy, 0,
            0.5 + dx, dy, 0, dx, dy, 0, dx, 0.5 + dy, 0, -0.5 + dx, 0.5 + dy, 0];
        if (actualPositions.join() !== expectedPositions.join() || Array.from(mesh.readIndices(0)!).join() !== indices.join()
            || Array.from(mesh.readAttribute(0, gfx.AttributeName.ATTR_TEX_COORD)!).join() !== uvs.join()
            || mesh.struct.minPosition?.x !== -0.5 + dx || mesh.struct.minPosition?.y !== -0.5 + dy
            || mesh.struct.maxPosition?.x !== 0.5 + dx || mesh.struct.maxPosition?.y !== 0.5 + dy) {
            throw new Error('The authored polygon lost positions, indices, UVs or bounds');
        }
    };
    renderer.spriteFrame = polygon;
    checkPolygon(polygon, 0.25, -0.25);
    await capture('authored-mesh');
    const clone = polygon.clone();
    if (clone.mesh === polygon.mesh || clone.vertices!.rawPosition[0] === polygon.vertices!.rawPosition[0]) {
        throw new Error('The authored polygon clone borrows mutable source data');
    }
    renderer.spriteFrame = clone;
    await capture('authored-mesh-clone');
    renderer.spriteFrame = polygon;
    clone.texture = green;
    renderer.spriteFrame = clone;
    checkPolygon(clone, 0.375, -0.375);
    checkPolygon(polygon, 0.25, -0.25);
    await releaseMeshedFrame(polygon);
    checkPolygon(clone, 0.375, -0.375);
    await capture('authored-mesh-replaced-texture');
    polygonNode.destroy();
    await wait();
    await releaseMeshedFrame(clone);
    red.destroy();
    green.destroy();
}

async function checkPackedFrameReset (
    frame: SpriteFrame, clone: SpriteFrame, sprite: Sprite, model: SpriteRenderer, capture: (name: string) => Promise<void>,
): Promise<void> {
    const source = clone.texture;
    const replacement = new Texture2D();
    replacement.reset({ width: 32, height: 24, format: Texture2D.PixelFormat.RGBA8888 });
    const rgba = new Uint8Array(32 * 24 * 4);
    for (let i = 0; i < rgba.length; i += 4) { rgba[i + 1] = 255; rgba[i + 3] = 255; }
    replacement.uploadData(rgba);
    try {
        sprite.spriteFrame = clone;
        model.spriteFrame = frame;
        dynamicAtlasManager.enabled = true;
        dynamicAtlasManager.packToDynamicAtlas(sprite, clone);
        dynamicAtlasManager.packToDynamicAtlas(null, frame);
        const page = clone.texture;
        if (!sys.isNative && (page === source || frame.texture !== page || frame.original?._texture !== source)) {
            throw new Error('Frame reset fixture did not pack the shared source');
        }
        const originalMesh = frame.mesh;
        const events: number[][] = [];
        const record = (): void => {
            const { x, y, width, height } = frame.rect;
            const min = frame.mesh!.struct.minPosition!;
            events.push([x, y, width, height, min.x, min.y, min.z]);
        };
        frame.pivot.set(.25, .75);
        frame.on(SpriteFrame.EVENT_UV_UPDATED, record);
        try {
            frame.reset({ texture: replacement, rect: new Rect(3, 1, 16, 8), originalSize: new Size(20, 12) }, true);
        } finally {
            frame.off(SpriteFrame.EVENT_UV_UPDATED, record);
        }
        await capture('packed-polygon-reset-custom');
        const mesh = frame.mesh!;
        if (events.length !== 1 || events[0].join() !== '3,1,16,8,-0.125,-0.5,8'
            || mesh === originalMesh || mesh.struct.maxPosition?.z !== 20 || frame.original || frame.texture !== replacement
            || frame.originalSize.width !== 20 || frame.originalSize.height !== 12
            || clone.texture !== page || (!sys.isNative && clone.original?._texture !== source)) {
            throw new Error(`Packed polygon reset published stale bounds or atlas ownership: ${JSON.stringify(events)}`);
        }
        frame.reset({ texture: replacement });
        await capture('packed-polygon-reset-full');
        const { x, y, width, height } = frame.rect;
        if (x !== 0 || y !== 0 || width !== 32 || height !== 24
            || frame.mesh?.struct.minPosition?.x !== .125 || frame.mesh?.struct.minPosition?.y !== -.75) {
            throw new Error(`Full texture reset kept a stale origin or mesh: ${x},${y},${width},${height}`);
        }
        model.spriteFrame = clone;
        await releaseMeshedFrame(frame);
        if (clone.texture !== page || !isValid(clone.mesh, true)) throw new Error('Releasing the reset frame invalidated its packed clone');
        dynamicAtlasManager.enabled = false;
        if (clone.texture !== source || clone.original) throw new Error('Clone did not restore the source after the atlas was reset');
        await capture('packed-polygon-reset-survivor');
    } finally {
        model.spriteFrame = clone;
        replacement.destroy();
    }
}

async function checkPackedMeshes (
    parent: Node, layer: number, material: Material, source: SpriteFrame, camera: Camera, capture: (name: string) => Promise<void>,
): Promise<void> {
    const texture = source.texture;
    const atlasEnabled = dynamicAtlasManager.enabled;
    dynamicAtlasManager.enabled = false;
    const rebound = new Material();
    rebound.copy(material);
    try {
        for (const meshType of [SpriteFrame.MeshType.RECT, SpriteFrame.MeshType.POLYGON]) {
            const polygon = meshType === SpriteFrame.MeshType.POLYGON;
            const name = polygon ? 'packed-polygon-mesh' : 'packed-rect-mesh';
            const frame = new SpriteFrame();
            frame._deserialize({
                meshType, pixelsToUnit: 16,
                rect: { x: 2, y: 2, width: 12, height: 12 },
                originalSize: { width: 12, height: 12 },
                vertices: polygon ? {
                    rawPosition: [-6, -6, 8, 6, -6, 12, 6, 0, 16, 0, 0, 12, 0, 6, 20, -6, 6, 8],
                    indexes: [0, 1, 2, 0, 2, 3, 0, 3, 5, 3, 4, 5],
                    uv: [2, 14, 14, 14, 14, 8, 8, 8, 8, 2, 2, 2],
                    nuv: [0.0625, 0.125, 0.4375, 0.125, 0.4375, 0.5, 0.25, 0.5, 0.25, 0.875, 0.0625, 0.875],
                    minPos: { x: -6, y: -6, z: 8 }, maxPos: { x: 6, y: 6, z: 20 },
                } : undefined,
            }, null);
            frame._textureSource = texture;
            frame.packable = true;
            const late = frame.clone();
            let packedClone: SpriteFrame | null = null;
            const uiNode = new Node(name + '-ui');
            uiNode.layer = layer;
            uiNode.setPosition(-48, 0);
            parent.addChild(uiNode);
            const transform = uiNode.addComponent(UITransform);
            const sprite = uiNode.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = frame;
            transform.setContentSize(48, 48);

            const meshNode = new Node(name + '-model');
            meshNode.layer = layer;
            meshNode.setPosition(48, 0);
            meshNode.setScale(64, 64, 1);
            parent.addChild(meshNode);
            const model = meshNode.addComponent(SpriteRenderer);
            model.visibility = layer;
            model.setSharedMaterial(material, 0);
            model.spriteFrame = frame;
            try {
                await capture(name + '-source');
                if (late.mesh || frame.original) throw new Error('Expected unpacked source and lazy clone');
                dynamicAtlasManager.enabled = true;
                dynamicAtlasManager.packToDynamicAtlas(sprite, frame);
                dynamicAtlasManager.packToDynamicAtlas(null, late);
                if (sys.isNative) {
                    if (dynamicAtlasManager.enabled || dynamicAtlasManager.atlasCount !== 0
                        || frame.original || late.original || frame.texture !== texture || late.texture !== texture) {
                        throw new Error('Windows admitted a runtime dynamic atlas mesh');
                    }
                } else if (!dynamicAtlasManager.enabled || frame.original?._texture !== texture
                    || late.original?._texture !== texture || frame.texture !== late.texture || frame.texture === texture) {
                    throw new Error('Shared Web mesh frames did not enter the same atlas page');
                }

                model.setSharedMaterial(rebound, 0);
                await capture(name + '-rebound');
                model.spriteFrame = late;
                await capture(name + '-lazy');
                if (polygon) {
                    packedClone = late.clone();
                    model.spriteFrame = packedClone;
                    const depth = camera.node.worldPosition.z;
                    const far = camera.far;
                    sprite.enabled = false;
                    try {
                        // The origin is behind the far plane, while all authored vertices are in front of it.
                        camera.far = depth - 4;
                        await capture(name + '-depth-visible');
                        camera.far = depth - 24;
                        await capture(name + '-depth-culled');
                    } finally {
                        camera.far = far;
                        sprite.enabled = true;
                    }
                    for (const asset of [frame, late, packedClone]) {
                        const bounds = asset.mesh!.struct;
                        if (bounds.minPosition?.z !== 8 || bounds.maxPosition?.z !== 20) {
                            throw new Error(`Authored polygon depth bounds changed to ${bounds.minPosition?.z},${bounds.maxPosition?.z}`);
                        }
                    }
                    if (packedClone.mesh === late.mesh || packedClone.texture !== late.texture
                        || (!sys.isNative && packedClone.original?._texture !== texture)) {
                        throw new Error('Cloning a packed polygon lost its atlas or mesh ownership');
                    }
                }
                const lateTexture = late.texture;
                sprite.spriteFrame = late;
                await releaseMeshedFrame(frame);
                if (late.texture !== lateTexture || !isValid(late.mesh, true)) {
                    throw new Error('Releasing a packed frame invalidated its surviving clone');
                }
                dynamicAtlasManager.enabled = false;
                if (late.original || late.texture !== texture) {
                    throw new Error('The surviving mesh frame did not return to its source texture');
                }
                if (packedClone && (packedClone.original || packedClone.texture !== texture
                    || packedClone.mesh?.struct.minPosition?.z !== 8 || packedClone.mesh.struct.maxPosition?.z !== 20)) {
                    throw new Error('Atlas reset changed the cloned polygon bounds or left it on the retired page');
                }
                await capture(name + '-restored');
                if (packedClone) await checkPackedFrameReset(late, packedClone, sprite, model, capture);
            } finally {
                dynamicAtlasManager.enabled = false;
                uiNode.destroy();
                meshNode.destroy();
                await wait();
                await Promise.all([frame, late, packedClone].map((value) => {
                    if (!value || !isValid(value, true)) return undefined;
                    if (value.mesh) return releaseMeshedFrame(value);
                    assetManager.releaseAsset(value);
                    return undefined;
                }));
                if (!isValid(texture, true)) throw new Error('Releasing the mesh frames destroyed their source texture');
            }
        }
    } finally {
        rebound.destroy();
        dynamicAtlasManager.enabled = atlasEnabled;
    }
}

async function checkRectMeshOrientation (
    parent: Node, layer: number, material: Material, capture: (name: string) => Promise<void>,
): Promise<void> {
    const width = 12;
    const height = 8;
    const textureWidth = 64;
    const textureHeight = 32;
    const flatRect = new Rect(3, 2, width, height);
    const rotatedRect = new Rect(21, 5, width, height);
    const pixels = new Uint8Array(textureWidth * textureHeight * 4);
    const colors = [[0, 0, 255, 255], [255, 255, 0, 255], [255, 0, 0, 255], [0, 255, 0, 255]];
    for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
            const color = colors[(y < height / 2 ? 0 : 2) + (x < width / 2 ? 0 : 1)];
            pixels.set(color, 4 * ((flatRect.y + y) * textureWidth + flatRect.x + x));
            pixels.set(color, 4 * ((rotatedRect.y + x) * textureWidth + rotatedRect.x + height - 1 - y));
        }
    }
    const image = new ImageAsset({ _data: pixels, width: textureWidth, height: textureHeight, format: Texture2D.PixelFormat.RGBA8888 } as any);
    const texture = new Texture2D();
    texture.image = image;
    texture.uploadData(pixels);
    const frame = new SpriteFrame();
    frame._deserialize({ pixelsToUnit: 16, rect: flatRect, originalSize: { width, height } }, null);
    frame._textureSource = texture;
    frame.packable = false;
    const atlasEnabled = dynamicAtlasManager.enabled;
    dynamicAtlasManager.enabled = false;

    const uiNode = new Node('oriented-rect-sprite');
    uiNode.layer = layer;
    uiNode.setPosition(-48, 0);
    parent.addChild(uiNode);
    const transform = uiNode.addComponent(UITransform);
    const sprite = uiNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = frame;
    transform.setContentSize(width * 4, height * 4);

    const meshNode = new Node('oriented-rect-mesh');
    meshNode.layer = layer;
    meshNode.setPosition(48, 0);
    meshNode.setScale(64, 64, 1);
    parent.addChild(meshNode);
    const renderer = meshNode.addComponent(SpriteRenderer);
    renderer.visibility = layer;
    renderer.setSharedMaterial(material, 0);
    renderer.spriteFrame = frame;
    try {
        for (const rotated of [false, true]) {
            frame.reset({ rect: rotated ? rotatedRect : flatRect, isRotate: rotated });
            for (let flips = 0; flips < 4; ++flips) {
                frame.flipUVX = !!(flips & 1);
                frame.flipUVY = !!(flips & 2);
                const meshUVs = frame.mesh!.readAttribute(0, gfx.AttributeName.ATTR_TEX_COORD)!;
                if (!Array.from(meshUVs).every((uv, i) => uv === (i % 2 === 0 ? frame.uv[i] : 1 - frame.uv[i]))) {
                    throw new Error('Bound mesh does not address the current source corners');
                }
                await capture(`mesh-rect-${rotated ? 'rotated' : 'flat'}-${flips}`);
            }
        }
        const beforePacking = frame.mesh;
        frame.packable = true;
        dynamicAtlasManager.enabled = true;
        dynamicAtlasManager.packToDynamicAtlas(sprite, frame);
        if (frame.mesh !== beforePacking || (sys.isNative ? frame.texture !== texture || frame.original
            : frame.texture === texture || frame.original?._texture !== texture)) {
            throw new Error('Packing changed the mesh source UV or violated the backend atlas policy');
        }
        await capture('mesh-rect-packed');
        renderer.enabled = false;
        frame.flipUVX = false;
        renderer.enabled = true;
        await capture('mesh-rect-packed-flip');
        const beforeRestore = frame.mesh;
        dynamicAtlasManager.enabled = false;
        if (frame.original || frame.texture !== texture || frame.mesh !== beforeRestore) {
            throw new Error('Atlas restore changed the oriented source mesh');
        }
        await capture('mesh-rect-restored');
    } finally {
        dynamicAtlasManager.enabled = false;
        uiNode.destroy();
        meshNode.destroy();
        await wait();
        await releaseMeshedFrame(frame);
        texture.destroy();
        image.destroy();
        dynamicAtlasManager.enabled = atlasEnabled;
    }
}

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
            if (Boolean((g as any)._native) !== (graphicsMaskImplementation === 'native')) throw new Error('Unexpected Graphics implementation');
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
            if (Boolean((m as any)._native) !== (graphicsMaskImplementation === 'native')) throw new Error('Unexpected Mask implementation');
            return { n, m };
        };
        const stencilSprite = (node: Node, mask: Mask): Sprite => {
            const sprite = mask.subComp;
            if (!(sprite instanceof Sprite) || node.getComponent(Sprite) !== sprite || node.getComponents(Sprite).length !== 1) {
                throw new Error('Sprite stencil must use the host Sprite component');
            }
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            return sprite;
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
                const source = stencilSprite(n, m);
                source.spriteFrame = whiteFrame;
                if (m.spriteFrame !== whiteFrame) throw new Error('Mask.spriteFrame must reflect its Sprite');
                m.alphaThreshold = .5; red(n);
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
                return () => {
                    m.spriteFrame = alphaFrame;
                    if (source.spriteFrame !== alphaFrame) throw new Error('Mask.spriteFrame did not update its Sprite');
                };
            } },
        ];
        cases.push({ name: 'mask-independent-thresholds', draw: root => {
            const makeStencil = (x: number, threshold: number): Mask => {
                const n = node(root, 'mask');
                n.active = false;
                n.getComponent(UITransform)!.setContentSize(80, 80);
                const existing = n.addComponent(Sprite);
                existing.sizeMode = Sprite.SizeMode.CUSTOM;
                existing.spriteFrame = alphaFrame;
                const m = n.addComponent(Mask);
                m.type = Mask.Type.SPRITE_STENCIL;
                n.active = true;
                n.setPosition(x, 0);
                if (stencilSprite(n, m) !== existing || m.spriteFrame !== alphaFrame) {
                    throw new Error('Sprite stencil must preserve the existing Sprite and its frame');
                }
                m.alphaThreshold = threshold;
                m.enabled = false;
                if (existing.enabled) throw new Error('Disabling the Mask must also disable its Sprite stencil');
                m.enabled = true;
                if (!existing.enabled || m.subComp !== existing) throw new Error('Enabling the Mask must reuse its Sprite stencil');
                red(n);
                return m;
            };
            const left = makeStencil(-64, .2);
            const right = makeStencil(64, .8);
            return () => { left.alphaThreshold = .8; right.alphaThreshold = .2; };
        } });
        for (const threshold of [.2, .5, .8]) cases.push({ name: `mask-alpha-${threshold}`, draw: root => {
            const { n, m } = mask(root, 120, 100, 3);
            stencilSprite(n, m).spriteFrame = alphaFrame;
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
        if (probeMode === 'graphics') {
            const patternTexture = new Texture2D();
            patternTexture.reset({ width: 32, height: 32, format: Texture2D.PixelFormat.RGBA8888 });
            patternTexture.setFilters(gfx.Filter.POINT, gfx.Filter.POINT);
            const pixels = new Uint8Array(32 * 32 * 4);
            for (let y = 0; y < 32; ++y) {
                for (let x = 0; x < 32; ++x) {
                    const offset = (y * 32 + x) * 4;
                    pixels[offset] = (Math.floor(x / 4) + 1) * 28;
                    pixels[offset + 1] = (Math.floor(y / 4) + 1) * 28;
                    pixels[offset + 2] = 80;
                    pixels[offset + 3] = 255;
                }
            }
            patternTexture.uploadData(pixels);
            const patternFrame = frame(patternTexture);
            const rotatedFrame = frame(patternTexture);
            rotatedFrame.rect = new Rect(3, 5, 18, 12);
            rotatedFrame.originalSize = new Size(18, 12);
            rotatedFrame.rotated = true;
            const radial = (root: Node, spriteFrame = patternFrame): Sprite => {
                const transform = root.getComponent(UITransform)!;
                transform.setContentSize(72, 56);
                const sprite = root.addComponent(Sprite);
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                sprite.type = Sprite.Type.FILLED;
                sprite.fillType = Sprite.FillType.RADIAL;
                sprite.fillCenter = new Vec2(.5, .5);
                sprite.fillStart = 0;
                sprite.fillRange = .25;
                sprite.spriteFrame = spriteFrame;
                if (Boolean((sprite as any)._native) !== (spriteImplementation === 'native')) throw new Error('Unexpected Sprite implementation');
                return sprite;
            };
            const spriteWithFrame = (root: Node, spriteFrame: SpriteFrame, width: number, height: number, type: Sprite['type']): UITransform => {
                const transform = root.getComponent(UITransform)!;
                transform.setContentSize(width, height);
                transform.setAnchorPoint(.25, .375);
                const sprite = root.addComponent(Sprite);
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                sprite.type = type;
                sprite.spriteFrame = spriteFrame;
                if (Boolean((sprite as any)._native) !== (spriteImplementation === 'native')) throw new Error('Unexpected Sprite implementation');
                return transform;
            };
            const slicedFrame = patternFrame.clone();
            slicedFrame.insetLeft = 12;
            slicedFrame.insetRight = 8;
            slicedFrame.insetTop = 8;
            slicedFrame.insetBottom = 8;
            const editedFrame = slicedFrame.clone();
            const slicedRotatedFrame = rotatedFrame.clone();
            slicedRotatedFrame.insetLeft = 6;
            slicedRotatedFrame.insetRight = 4;
            slicedRotatedFrame.insetTop = 3;
            slicedRotatedFrame.insetBottom = 5;
            const tiledEditedFrame = slicedFrame.clone();
            const tiledOneAxisFrame = patternFrame.clone();
            tiledOneAxisFrame.insetLeft = 12;
            tiledOneAxisFrame.insetRight = 8;
            const tiledNoCenterFrame = slicedFrame.clone();
            tiledNoCenterFrame.insetLeft = 16;
            tiledNoCenterFrame.insetRight = 16;
            cases.push(
                { name: 'sprite-radial-quadrant', draw: root => {
                    const sprite = radial(root);
                    return () => { sprite.fillStart = .25; sprite.fillRange = -.25; };
                } },
                { name: 'sprite-radial-center', draw: root => {
                    const sprite = radial(root);
                    sprite.fillStart = .75;
                    sprite.fillRange = .5;
                    return () => { sprite.fillCenter.x = .25; sprite.fillCenter.y = .75; };
                } },
                { name: 'sprite-radial-rotated', draw: root => {
                    radial(root, rotatedFrame);
                    root.getComponent(UITransform)!.setAnchorPoint(.25, .375);
                    root.setPosition(10, -13, 0);
                    root.setRotationFromEuler(0, 0, 17);
                    root.setScale(.875, .75, 1);
                    return () => { rotatedFrame.flipUVX = true; rotatedFrame.flipUVY = true; };
                } },
                { name: 'sprite-radial-empty', draw: root => {
                    const sprite = radial(root);
                    sprite.fillRange = 0;
                    return () => { sprite.fillRange = 1; };
                } },
                { name: 'sprite-sliced-resize', draw: root => {
                    const transform = spriteWithFrame(root, slicedFrame, 72, 56, Sprite.Type.SLICED);
                    return () => { transform.setContentSize(16, 10); };
                } },
                { name: 'sprite-sliced-insets', draw: root => {
                    spriteWithFrame(root, editedFrame, 16, 10, Sprite.Type.SLICED);
                    return () => { editedFrame.insetLeft = 4; editedFrame.insetRight = 14; };
                } },
                { name: 'sprite-sliced-rotated', draw: root => {
                    const transform = spriteWithFrame(root, slicedRotatedFrame, 42, 32, Sprite.Type.SLICED);
                    return () => { transform.setContentSize(8, 6); };
                } },
                { name: 'sprite-tiled-plain', draw: root => {
                    spriteWithFrame(root, patternFrame, 60, 48, Sprite.Type.TILED);
                } },
                { name: 'sprite-tiled-insets', draw: root => {
                    spriteWithFrame(root, tiledEditedFrame, 60, 48, Sprite.Type.TILED);
                    return () => { tiledEditedFrame.insetLeft = 4; tiledEditedFrame.insetRight = 14; };
                } },
                { name: 'sprite-tiled-compact', draw: root => {
                    const transform = spriteWithFrame(root, slicedFrame, 60, 48, Sprite.Type.TILED);
                    return () => { transform.setContentSize(16, 8); };
                } },
                { name: 'sprite-tiled-rotated', draw: root => {
                    spriteWithFrame(root, slicedRotatedFrame, 36, 24, Sprite.Type.TILED);
                } },
                { name: 'sprite-tiled-one-axis', draw: root => {
                    spriteWithFrame(root, tiledOneAxisFrame, 60, 48, Sprite.Type.TILED);
                } },
                { name: 'sprite-tiled-no-center', draw: root => {
                    spriteWithFrame(root, tiledNoCenterFrame, 40, 32, Sprite.Type.TILED);
                } },
            );
        }
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
            const text = await runRichTextMatrix(canvas.node, camera, capture, () => rt.readPixels()!);
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
        if (Boolean((legacySprite as any)._native) !== (spriteImplementation === 'native')) throw new Error('Unexpected legacy Sprite implementation');
        legacySprite.sizeMode = Sprite.SizeMode.CUSTOM;
        legacySprite.type = Sprite.Type.FILLED;
        legacySprite.fillType = Sprite.FillType.RADIAL;
        legacySprite.fillCenter.set(.5, .5);
        legacySprite.fillStart = .125;
        legacySprite.fillRange = .625;
        await capture('prefab-atlas-radial');
        legacySprite.spriteFrame = right;
        await capture('prefab-atlas-radial-rotated');
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
        const meshLayer = instance.layer;
        instance.destroy();
        await wait();

        await checkAuthoredPolygon(canvas.node, meshLayer, material, capture);
        await checkPackedMeshes(canvas.node, meshLayer, material, left, camera, capture);
        await checkRectMeshOrientation(canvas.node, meshLayer, material, capture);
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
        // Calibrate the shrink boundary using this backend's own font metrics.
        label.overflow = Label.Overflow.NONE;
        label.updateRenderData(true);
        const naturalWidth = transform.width;
        label.enableOutline = true;
        for (const width of [2, 2 + 1 / 128, 2, 2 - 1 / 128, 2]) {
            label.outlineWidth = width;
            label.updateRenderData(false);
            if (Math.abs(transform.width - naturalWidth - 2 * width) > 0.0001) {
                throw new Error(`Fractional outline ${width}: expected ${naturalWidth + 2 * width}, got ${transform.width}`);
            }
        }
        label.enableOutline = false;
        label.enableShadow = true;
        label.shadowOffset = new Vec2(0, 0);
        label.overflow = Label.Overflow.SHRINK;
        transform.setContentSize(naturalWidth + 4 + 1 / 128, 100);
        for (const blur of [2, 2 + 1 / 128, 2, 2 - 1 / 128, 2]) {
            label.shadowBlur = blur;
            label.updateRenderData(false);
            const expectedSize = blur > 2 ? 31 : 32;
            if (label.actualFontSize !== expectedSize) throw new Error(`Fractional blur ${blur}: expected ${expectedSize}, got ${label.actualFontSize}`);
        }
        label.enableShadow = false;
        const step = 1 / 2048;
        for (const offset of [step, -step, step]) {
            transform.setContentSize(naturalWidth + offset, 100);
            label.updateRenderData(false);
            const expected = offset < 0 ? 31 : 32;
            if (label.actualFontSize !== expected) throw new Error(`Container width delta ${offset}: expected ${expected}, got ${label.actualFontSize}`);
        }
        label.overflow = Label.Overflow.RESIZE_HEIGHT;
        label.enableWrapText = true;
        label.updateRenderData(false);
        const singleHeight = transform.height;
        for (const offset of [-step, step]) {
            transform.setContentSize(naturalWidth + offset, transform.height);
            label.updateRenderData(false);
            const expected = singleHeight + (offset < 0 ? label.lineHeight : 0);
            if (Math.abs(transform.height - expected) > 0.0001) throw new Error(`Wrap width delta ${offset}: expected height ${expected}, got ${transform.height}`);
        }
        label.lineHeight += step;
        label.updateRenderData(false);
        if (transform.height <= singleHeight + step / 2) throw new Error('RESIZE_HEIGHT dropped a fractional line-height change');
        labelNode.destroy();
        await wait();
        if (isValid(freshFrame) || isValid(freshTexture)) throw new Error('Destroyed Label retained valid TTF assets');
        const labelPrefab = deserialize([
            { __type__: 'cc.Prefab', data: { __id__: 1 } },
            { __type__: 'cc.Node', _name: 'LabelRollback', _components: [{ __id__: 2 }, { __id__: 3 }] },
            { __type__: 'cc.UITransform', node: { __id__: 1 } },
            { __type__: 'cc.Label', node: { __id__: 1 }, _string: 'Atlas 123', _fontSize: 24, _lineHeight: 30 },
        ]) as Prefab;
        const labelInstance = instantiate(labelPrefab);
        labelInstance.layer = canvas.node.layer;
        canvas.node.addChild(labelInstance);
        const restoredLabel = labelInstance.getComponent(Label);
        if (!restoredLabel || restoredLabel.string !== 'Atlas 123' || restoredLabel.fontSize !== 24
            || !!(restoredLabel as any)._native !== (labelImplementation === 'native')) {
            throw new Error('Label Prefab restored the wrong component');
        }
        const warmupBatches = 10;
        const updatesPerBatch = 8;
        const labelSamples: number[] = [];
        for (let batch = 0; batch < warmupBatches + 31; ++batch) {
            const start = performance.now();
            for (let update = 0; update < updatesPerBatch; ++update) {
                restoredLabel.string = update % 2 === 0 ? 'World 456' : 'Atlas 123';
                restoredLabel.updateRenderData();
            }
            if (batch >= warmupBatches) labelSamples.push(performance.now() - start);
        }
        await wait();
        const labelPixels = rt.readPixels()!;
        let visiblePixels = 0;
        for (let i = 0; i < labelPixels.length; i += 4) if (labelPixels[i] > 1) ++visiblePixels;
        if (visiblePixels === 0) throw new Error('Restored Label Prefab produced no visible glyphs');
        const labelBenchmark = { warmupBatches, updatesPerBatch, samples: labelSamples, visiblePixels };
        labelInstance.destroy();
        labelPrefab.destroy();
        await wait();
        if (isValid(labelInstance) || isValid(labelPrefab)) throw new Error('Label rollback Prefab was retained');
        const legacyLabelEffects = await checkLegacyLabelEffects(canvas.node, rt);
        for (const item of cases) {
            const root = node(canvas.node, item.name);
            const update = item.draw(root);
            await capture(item.name);
            if (update) { update(); await capture(`${item.name}-updated`); }
            root.destroy(); await wait(40);
        }
        const benchmarkRoot = node(canvas.node, 'sprite-rollback-workload');
        const sprites = Array.from({ length: 128 }, (_, i) => {
            const n = node(benchmarkRoot, 'sprite');
            n.setPosition((i % 16 - 7.5) * 12, (Math.floor(i / 16) - 3.5) * 12);
            n.getComponent(UITransform)!.setContentSize(8, 8);
            const sprite = n.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = whiteFrame;
            return sprite;
        });
        const tints = [new Color(64, 128, 255), new Color(255, 64, 128)];
        const samples: number[] = [];
        const warmupFrames = 30;
        await new Promise<void>(resolve => {
            let frame = 0;
            let start = 0;
            const beforeDraw = (): void => {
                start = performance.now();
                for (let i = 0; i < sprites.length; ++i) {
                    const sprite = sprites[i];
                    sprite.node.setPosition((i % 16 - 7.5) * 12 + (frame & 1), (Math.floor(i / 16) - 3.5) * 12);
                    sprite.color = tints[frame & 1];
                }
            };
            const afterDraw = (): void => {
                if (frame++ >= warmupFrames) samples.push(performance.now() - start);
                if (samples.length === 60) {
                    director.off(Director.EVENT_BEFORE_DRAW, beforeDraw);
                    director.off(Director.EVENT_AFTER_DRAW, afterDraw);
                    resolve();
                }
            };
            director.on(Director.EVENT_BEFORE_DRAW, beforeDraw);
            director.on(Director.EVENT_AFTER_DRAW, afterDraw);
        });
        const spriteBenchmark = { spriteCount: sprites.length, warmupFrames, samples };
        benchmarkRoot.destroy();
        await wait(40);

        const { n: clipWorkload } = mask(canvas.node, 80, 80);
        const clippedGraphics = graphics(node(clipWorkload, 'clipped-graphics-workload'));
        const graphicsSamples: number[] = [];
        await new Promise<void>(resolve => {
            let frame = 0;
            let start = 0;
            const beforeUpdate = (): void => {
                start = performance.now();
                clippedGraphics.clear();
                for (let i = 0; i < 64; ++i) {
                    clippedGraphics.rect((i % 8 - 3.5) * 12 - 4 + (frame & 1), (Math.floor(i / 8) - 3.5) * 12 - 4, 8, 8);
                }
                clippedGraphics.fill();
            };
            const afterDraw = (): void => {
                if (frame++ >= warmupFrames) graphicsSamples.push(performance.now() - start);
                if (graphicsSamples.length === 60) {
                    director.off(Director.EVENT_BEFORE_UPDATE, beforeUpdate);
                    director.off(Director.EVENT_AFTER_DRAW, afterDraw);
                    resolve();
                }
            };
            director.on(Director.EVENT_BEFORE_UPDATE, beforeUpdate);
            director.on(Director.EVENT_AFTER_DRAW, afterDraw);
        });
        const graphicsPixels = rt.readPixels()!;
        let clippedPixels = 0;
        for (let i = 0; i < graphicsPixels.length; i += 4) if (graphicsPixels[i] > 127) ++clippedPixels;
        if (clippedPixels === 0 || clippedPixels >= 64 * 8 * 8) throw new Error('Graphics benchmark did not render clipped paths');
        const graphicsMaskBenchmark = { rectangles: 64, warmupFrames, samples: graphicsSamples, visiblePixels: clippedPixels };
        clipWorkload.destroy();
        await wait(40);

        const priorityRoot = node(canvas.node, 'ui-priority');
        const priorityRed = node(priorityRoot, 'red');
        const priorityBlue = node(priorityRoot, 'blue');
        const redShape = graphics(priorityRed);
        const blueShape = graphics(priorityBlue);
        redShape.fillColor = Color.RED;
        blueShape.fillColor = Color.BLUE;
        redShape.fillRect(-40, -40, 80, 80);
        blueShape.fillRect(-40, -40, 80, 80);
        const redTransform = priorityRed.getComponent(UITransform)!;
        const blueTransform = priorityBlue.getComponent(UITransform)!;
        const checkPriorityOrder = (first: Node, last: Node): void => {
            if (priorityRoot.children[0] !== first || priorityRoot.children[1] !== last
                || first.siblingIndex !== 0 || last.siblingIndex !== 1) {
                throw new Error('UITransform.priority did not update sibling order');
            }
        };
        await capture('ui-priority-original');
        checkPriorityOrder(priorityRed, priorityBlue);
        redTransform.priority = .25;
        await capture('ui-priority-updated');
        checkPriorityOrder(priorityBlue, priorityRed);
        blueTransform.priority = .25;
        await capture('ui-priority-equal');
        checkPriorityOrder(priorityBlue, priorityRed);
        const detachedParent = node(canvas.node, 'ui-priority-reparent');
        priorityBlue.parent = detachedParent;
        blueTransform.priority = .125;
        await wait();
        priorityBlue.parent = priorityRoot;
        await capture('ui-priority-reparented');
        checkPriorityOrder(priorityBlue, priorityRed);
        priorityRoot.destroy();
        detachedParent.destroy();
        await wait(40);
        const roots: { name: string; actual: number; expected: number }[] = [];
        const checkRootTraversal = async (name: string, expected: number): Promise<void> => {
            const actual = await countTraversedRoots();
            roots.push({ name, actual, expected });
            if (actual !== expected) throw new Error(`Root count ${name}: ${actual}, expected ${expected}`);
        };
        const makeRoot = (name: string, color: Color, useCanvas = false): { n: Node; comp: RenderRoot2D } => {
            const n = node(director.getScene()!, name); n.setWorldPosition(canvas.node.worldPosition);
            const comp = useCanvas ? n.addComponent(Canvas) : n.addComponent(RenderRoot2D);
            const g = graphics(n); g.fillColor = color; g.fillRect(-40, -40, 80, 80);
            return { n, comp };
        };
        await checkRootTraversal('base-canvas', 1);
        const rootB = makeRoot('root-blue', new Color(0, 0, 255, 128));
        const rootA = makeRoot('root-red', new Color(255, 0, 0, 128));
        rootA.n.setSiblingIndex(1); director.root!.batcher2D.sortScreens();
        await capture('root-order-registration'); await checkRootTraversal('two-roots-added', 3);
        rootA.n.setSiblingIndex(2); director.root!.batcher2D.sortScreens();
        await capture('root-order-reordered'); await checkRootTraversal('two-roots-reordered', 3);
        rootA.comp.enabled = false;
        await capture('root-first-disabled'); await checkRootTraversal('root-disabled', 2);
        rootA.comp.enabled = true; rootA.comp.onEnable();
        await capture('root-first-enabled'); await checkRootTraversal('root-duplicate-enable', 3);
        rootA.n.destroy();
        await capture('root-first-destroyed'); await checkRootTraversal('root-destroyed', 2);
        rootB.comp.enabled = false;
        await capture('root-both-disabled'); await checkRootTraversal('both-roots-disabled', 1);
        rootB.n.destroy(); await wait(40);
        const canvasA = makeRoot('canvas-green', new Color(0, 255, 0, 128), true);
        const canvasB = makeRoot('canvas-red', new Color(255, 0, 0, 128), true);
        await capture('root-canvas-pair'); await checkRootTraversal('two-canvases-added', 3);
        canvasA.comp.enabled = false;
        await capture('root-canvas-disabled'); await checkRootTraversal('canvas-disabled', 2);
        canvasA.comp.enabled = true;
        await capture('root-canvas-reenabled'); await checkRootTraversal('canvas-reenabled', 3);
        canvasA.n.destroy(); canvasB.n.destroy();
        await capture('root-canvas-destroyed'); await checkRootTraversal('canvases-destroyed', 1);
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
        const result = { backend: sys.isNative ? 'native' : 'web', snapshot, spriteImplementation, spriteBenchmark, labelImplementation, labelBenchmark,
            graphicsMaskImplementation, graphicsMaskBenchmark, captures,
            scenes, roots, hits, batchDrawCalls, labelLayout, shrinkSizes, legacyLabelEffects, width: 256, height: 256,
            environment: { os: sys.os, renderer: device.renderer, vendor: device.vendor } };
        if (sys.isNative) native.fileUtils.writeStringToFile(JSON.stringify(result), `${outputRoot}/manifest.json`);
        else await fetch('/m6-result', { method: 'POST', body: JSON.stringify(result) });
        console.log(`M6_GPU_DONE ${JSON.stringify(result)}`);
        (globalThis as any).__M6_GPU_DONE__ = result;
    }
}
