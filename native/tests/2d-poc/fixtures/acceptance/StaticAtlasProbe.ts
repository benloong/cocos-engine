import {
    Asset, assetManager, director, DirectorEvent, instantiate, isValid, js, Node, Prefab, RenderTexture, resources, Sprite, SpriteAtlas, SpriteFrame, sys, Texture2D,
} from 'cc';

const BASE = 'M6StaticAtlas/';
const waitForRender = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 100));
const nextFrame = (): Promise<void> => new Promise(resolve => director.once(DirectorEvent.END_FRAME, () => resolve()));

async function waitForFrames (): Promise<void> {
    // JS END_FRAME may precede the native render for that frame.
    await nextFrame();
    await nextFrame();
}

function load<T extends Asset> (name: string, type: new () => T): Promise<T> {
    return new Promise((resolve, reject) => {
        resources.load(BASE + name, type, (error, asset) => error ? reject(error) : resolve(asset));
    });
}

function checkCenter (target: RenderTexture, channel: number): void {
    const pixels = target.readPixels();
    const center = (Math.floor(target.height / 2) * target.width + Math.floor(target.width / 2)) * 4;
    if (!pixels || pixels[center + channel] < 250 || pixels[center + (1 - channel)] > 5 || pixels[center + 2] > 5) {
        throw new Error('Static atlas sprite sampled the wrong frame at the viewport center');
    }
}

function verifyNativeAssetPrototypes (texture: Texture2D): void {
    const bindings = (globalThis as any).jsb;
    const atlases = [new SpriteAtlas(), new SpriteAtlas()];
    const frames = [new SpriteFrame(), new SpriteFrame()];
    try {
        for (const [type, name, assets] of [
            [SpriteAtlas, 'SpriteAtlas', atlases], [SpriteFrame, 'SpriteFrame', frames],
        ] as const) {
            if (type !== bindings[name] || js.getClassByName('cc.' + name) !== type
                || assets.some(asset => !(asset instanceof Asset) || Object.getPrototypeOf(asset) !== type.prototype
                    || !asset.loaded || asset.refCount !== 0 || !(asset as any)._callbackTable)
                || (assets[0] as any)._callbackTable === (assets[1] as any)._callbackTable) {
                throw new Error('Invalid native Asset constructor or registration for ' + name);
            }
        }
        if (!(SpriteAtlas as any).__values__?.includes('spriteFrames')) {
            throw new Error('SpriteAtlas frame map is missing from serialized properties');
        }
        const [frame, otherFrame] = frames;
        const [atlas, otherAtlas] = atlases;
        frame.texture = texture;
        let updates = 0;
        frame.on(SpriteFrame.EVENT_UV_UPDATED, (sender: SpriteFrame) => {
            if (sender !== frame) throw new Error('Unexpected UV event sender');
            updates++;
        });
        otherFrame.on(SpriteFrame.EVENT_UV_UPDATED, () => { throw new Error('UV event reached a sibling asset'); });
        frame.setRotated(true);
        atlas.spriteFrames.icon = frame;
        if (updates !== 1 || !frame.rotated || otherFrame.rotated || atlas.getTexture() !== texture
            || otherAtlas.getTexture() !== null || atlas.getSpriteFrame('icon') !== frame
            || otherAtlas.getSpriteFrame('icon') !== null) {
            throw new Error('Native prototype methods or callbacks lost per-instance state');
        }
    } finally {
        for (const asset of [...atlases, ...frames]) asset.destroy();
    }
}

export async function verifyStaticAtlas (parent: Node, layer: number, target: RenderTexture, stress = false): Promise<void> {
    const cycles = stress ? 1000 : 3;
    const render = stress ? waitForFrames : waitForRender;
    const Weak = (globalThis as any).WeakRef as new (asset: Asset) => { deref(): Asset | undefined };
    const wrappers: { deref(): Asset | undefined }[] = [];
    let pixelChecks = 0;
    let checkedAssets = 0;
    async function sample (cycle: number): Promise<void> {
        await nextFrame();
        if (sys.isNative) sys.garbageCollect();
        else (globalThis as any).gc();
        await waitForFrames();
        const memory = (globalThis as any).performance?.memory;
        console.log('M6_STATIC_ATLAS_STRESS_SAMPLE ' + JSON.stringify({
            cycle,
            wrappers: wrappers.length,
            liveWrappers: wrappers.reduce((total, ref) => total + Number(ref.deref() !== undefined), 0),
            jsHeapBytes: memory?.usedJSHeapSize ?? null,
        }));
        wrappers.length = 0;
    }
    if (stress) {
        if (!Weak || (!sys.isNative && typeof (globalThis as any).gc !== 'function')) {
            throw new Error('Static atlas stress needs WeakRef and explicit GC');
        }
        await sample(0);
    }
    for (let cycle = 1; cycle <= cycles; cycle++) {
        if (stress && cycle > 1 && (cycle - 1) % 100 === 0) await sample(cycle - 1);
        const prefab = await load('AtlasSprite', Prefab);
        let atlas: SpriteAtlas | null = null;
        let first: Node | null = null;
        let second: Node | null = null;
        const keys = [prefab.uuid];
        const ownedAssets: Asset[] = [prefab];
        const capture = !stress || cycle === 1 || cycle % 100 === 0;
        let previousMap: SpriteAtlas['spriteFrames'] | null = null;
        try {
            // The prefab loads both the atlas and a frame before the explicit atlas load.
            atlas = (await load('colors', SpriteAtlas)).addRef();
            const left = atlas.getSpriteFrame('left');
            const right = atlas.getSpriteFrame('right');
            const texture = atlas.getTexture();
            if (!(left instanceof SpriteFrame) || !(right instanceof SpriteFrame) || !texture
                || atlas.getSpriteFrames().length !== 2 || atlas.getSpriteFrame('missing') !== null
                || left.texture !== texture || right.texture !== texture
                || texture.width !== 32 || texture.height !== 16
                || left.rotated || !right.rotated || right.rect.x !== 17 || right.rect.y !== 2
                || right.rect.width !== 10 || right.rect.height !== 12
                || right.originalSize.width !== 16 || right.originalSize.height !== 16
                || right.offset.x !== 1 || right.offset.y !== -1) {
                throw new Error('Static atlas frame dependencies or packed metadata were not restored');
            }
            if (sys.isNative && (atlas as SpriteAtlas & { getSpriteFrameCount(): number }).getSpriteFrameCount() !== 2) {
                throw new Error('Native atlas table missed deserialized frames');
            }
            if (sys.isNative && !stress && cycle === 1) verifyNativeAssetPrototypes(texture as Texture2D);
            keys.push(atlas.uuid, left.uuid, right.uuid, texture.uuid);
            if (stress) {
                ownedAssets.push(atlas, left, right, texture);
                if (new Set(keys).size !== ownedAssets.length || ownedAssets.some(asset => assetManager.assets.get(asset.uuid) !== asset)) {
                    throw new Error('Static atlas dependencies were not present under distinct cache keys');
                }
            }
            previousMap = atlas.spriteFrames;
            first = instantiate(prefab);
            second = instantiate(prefab);
            const sprite = first.getComponent(Sprite);
            const sibling = second.getComponent(Sprite);
            if (!sprite || !sibling || sprite === sibling || sprite.spriteAtlas !== atlas || sibling.spriteAtlas !== atlas
                || sprite.spriteFrame !== left || sibling.spriteFrame !== left) {
                throw new Error('Prefab did not restore shared atlas assets and independent Sprite components');
            }
            first.layer = layer;
            parent.addChild(first);
            await render();
            if (capture) { checkCenter(target, 0); pixelChecks++; }
            sprite.changeSpriteFrameFromAtlas('right');
            await render();
            if (sprite.spriteFrame !== right || sibling.spriteFrame !== left || left.original || right.original) {
                throw new Error('Changing one prefab instance did not preserve the other instance and static frames');
            }
            if (capture) { checkCenter(target, 1); pixelChecks++; }
            first.destroy();
            second.destroy();
            first = second = null;
            await render();

            assetManager.releaseAsset(prefab);
            if (assetManager.assets.get(atlas.uuid) !== atlas || atlas.getSpriteFrame('left') !== left) {
                throw new Error('Prefab release invalidated an independently retained atlas');
            }
        } finally {
            first?.destroy();
            second?.destroy();
            assetManager.releaseAsset(prefab);
            atlas?.decRef();
        }
        await render();
        if (stress) {
            for (let frame = 0; frame < 12 && ownedAssets.some(asset => asset.isValid); frame++) await nextFrame();
            if (parent.children.some(node => node.name === 'AtlasSprite') || ownedAssets.some(asset => asset.isValid || asset.refCount !== 0)) {
                throw new Error('Static atlas asset retained a reference or missed frame-end destruction');
            }
            for (const asset of ownedAssets) {
                if (sys.isNative && (asset as Asset & { getAssetRefCount(): number }).getAssetRefCount() !== 0) {
                    throw new Error('Native static atlas asset reference count did not return to zero');
                }
                wrappers.push(new Weak(asset));
            }
            checkedAssets += ownedAssets.length;
        }
        if (keys.some(uuid => assetManager.assets.has(uuid))) throw new Error('Static atlas dependencies remained in the asset cache after release');
        if (sys.isNative && atlas && previousMap) {
            previousMap.late = null;
            const nativeAtlas = atlas as SpriteAtlas & { getSpriteFrameCount(): number };
            if (isValid(atlas) || nativeAtlas.getSpriteFrameCount() !== 0
                || atlas.getSpriteFrames().length !== 0 || atlas.getTexture() !== null) {
                throw new Error('Released static atlas still owns frames with its wrapper retained');
            }
            const lateTexture = new Texture2D();
            try {
                for (const frame of [previousMap.left, previousMap.right]) {
                    if (!frame || frame.isValid || frame.texture || frame.original || frame.uv.length !== 0) {
                        throw new Error('Released SpriteFrame still owns a texture with its wrapper retained');
                    }
                    frame.texture = lateTexture;
                    Object.assign(frame, { _textureSource: lateTexture });
                    if (frame.texture) throw new Error('Late SpriteFrame texture dependency was accepted');
                }
            } finally {
                lateTexture.destroy();
            }
        }
    }
    if (stress) {
        await sample(cycles);
        console.log('M6_STATIC_ATLAS_STRESS_PASS ' + JSON.stringify({ cycles, checkedAssets, pixelChecks }));
    } else {
        console.log('M6_STATIC_ATLAS_PASS');
    }
}
