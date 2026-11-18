import {
    Asset, assetManager, instantiate, isValid, Node, Prefab, RenderTexture, resources, Sprite, SpriteAtlas, SpriteFrame, sys, Texture2D,
} from 'cc';

const BASE = 'M6StaticAtlas/';
const waitForRender = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 100));

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

export async function verifyStaticAtlas (parent: Node, layer: number, target: RenderTexture): Promise<void> {
    for (let cycle = 0; cycle < 3; cycle++) {
        const prefab = await load('AtlasSprite', Prefab);
        let atlas: SpriteAtlas | null = null;
        let first: Node | null = null;
        let second: Node | null = null;
        const keys = [prefab.uuid];
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
            keys.push(atlas.uuid, left.uuid, right.uuid, texture.uuid);
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
            await waitForRender();
            checkCenter(target, 0);
            sprite.changeSpriteFrameFromAtlas('right');
            await waitForRender();
            if (sprite.spriteFrame !== right || sibling.spriteFrame !== left || left.original || right.original) {
                throw new Error('Changing one prefab instance did not preserve the other instance and static frames');
            }
            checkCenter(target, 1);
            first.destroy();
            second.destroy();
            first = second = null;
            await waitForRender();

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
        await waitForRender();
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
    console.log('M6_STATIC_ATLAS_PASS');
}
