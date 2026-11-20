import { _decorator, assetManager, builtinResMgr, Canvas, Color, Component, Director, director, instantiate, isValid,
    Material, Node, Prefab, RenderTexture, resources, Sprite, UITransform, UIOpacity } from 'cc';

const prefabId = '68eb84a9-bd0f-479b-b6ab-b82a8927d235';
const spriteFrameId = 'b730527c-3233-41c2-aaf7-7cdab58f9749@f9941';
const size = 256;
const nextFrame = (): Promise<void> => new Promise(resolve => director.once(Director.EVENT_AFTER_DRAW, resolve));

// Retain the script identity used by the original m1-test.scene.
@_decorator.ccclass('M1Test')
export class OldUIOpacityProbe extends Component {
    public start (): void {
        this.run().catch(error => console.error(`M6_OLD_OPACITY_FAIL ${error.stack ?? error}`));
    }

    private async run (): Promise<void> {
        const oldNode = this.node.getChildByName('M1TestNode-001');
        const sceneOpacity = oldNode?.getComponent(UIOpacity);
        const sceneSprite = oldNode?.getComponent(Sprite);
        const frame = sceneSprite?.spriteFrame;
        const camera = this.getComponent(Canvas)?.cameraComponent;
        if (director.getScene()?.name !== 'm1-test' || !oldNode || !sceneOpacity || sceneOpacity.opacity !== 128
            || !sceneSprite || frame?.uuid !== spriteFrameId || !camera) {
            throw new Error('Expected the original scene, Canvas, UIOpacity and serialized SpriteFrame');
        }
        const nativeImplementation = (component: UIOpacity): boolean => Boolean((component as UIOpacity & { _native?: unknown })._native);
        const implementation = nativeImplementation(sceneOpacity) ? 'native' : 'js';
        const material = builtinResMgr.get<Material>('ui-sprite-material');
        if (!material) throw new Error('Built-in Sprite material was not loaded');
        const placeSprite = (sprite: Sprite, color: Color): void => {
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.color = color;
            sprite.node.getComponent(UITransform)!.setContentSize(48, 48);
        };
        placeSprite(sceneSprite, new Color(255, 0, 0));
        oldNode.setPosition(-40, 0, 0);

        const renderTexture = new RenderTexture();
        renderTexture.reset({ width: size, height: size });
        camera.clearFlags = 7;
        camera.clearColor = new Color(0, 0, 0, 255);
        camera.targetTexture = renderTexture;
        camera.orthoHeight = size / 2;

        const loadPrefab = (): Promise<Prefab> => new Promise((resolve, reject) => {
            resources.load('M1Prefab', Prefab, (error, asset) => {
                if (error) reject(error);
                else resolve(asset);
            });
        });
        const preparePrefab = (prefab: Prefab, enabled = true): { node: Node; opacity: UIOpacity } => {
            const node = instantiate(prefab);
            const opacity = node.getComponent(UIOpacity);
            const layout = node.getComponent(UITransform)?.contentSize;
            if (prefab.uuid !== prefabId || assetManager.assets.get(prefabId) !== prefab || !opacity
                || opacity.opacity !== 128 || layout?.width !== 100 || layout.height !== 50) {
                throw new Error('Original M1Prefab opacity, size or cache identity changed');
            }
            opacity.enabled = enabled;
            node.setPosition(40, 0, 0);
            const child = new Node('Opacity probe Sprite');
            child.layer = oldNode.layer;
            node.addChild(child);
            const sprite = child.addComponent(Sprite);
            sprite.spriteFrame = frame;
            sprite.customMaterial = material;
            placeSprite(sprite, new Color(0, 255, 0));
            this.node.addChild(node);
            const instance = sprite.getMaterialInstance(0);
            if (!instance || instance === material) throw new Error('Expected an independent instance of the Sprite material');
            if (nativeImplementation(opacity) !== (implementation === 'native')) throw new Error('Prefab used a different UIOpacity implementation');
            return { node, opacity };
        };

        const readRegion = (pixels: Uint8Array, node: Node): string => {
            const center = camera.worldToScreen(node.worldPosition);
            const x = Math.round(center.x);
            const y = Math.round(center.y);
            if (x < 4 || x > size - 4 || y < 4 || y > size - 4) throw new Error('Sample is outside the render texture');
            let bytes = '';
            for (let row = y - 4; row < y + 4; ++row) {
                const start = (row * size + x - 4) * 4;
                for (let i = start; i < start + 32; ++i) bytes += pixels[i].toString(16).padStart(2, '0');
            }
            return bytes;
        };
        const captures: Record<string, string[]> = {};
        const capture = async (name: string, node: Node): Promise<void> => {
            await nextFrame();
            const pixels = renderTexture.readPixels();
            if (!pixels || pixels.length !== size * size * 4) throw new Error('Missing old-scene GPU readback');
            captures[name] = [readRegion(pixels, oldNode), readRegion(pixels, node)];
        };

        const prefab = (await loadPrefab()).addRef();
        const first = preparePrefab(prefab);
        await capture('serialized', first.node);
        sceneOpacity.opacity = 64;
        first.opacity.opacity = 192;
        await capture('independent', first.node);
        sceneOpacity.enabled = false;
        first.opacity.enabled = false;
        await capture('disabled', first.node);
        sceneOpacity.enabled = true;
        first.opacity.enabled = true;
        await capture('re-enabled', first.node);
        sceneOpacity.opacity = -10;
        first.opacity.opacity = 300;
        if (sceneOpacity.opacity !== 0 || first.opacity.opacity !== 255) throw new Error('Opacity clamp changed');
        await capture('clamped', first.node);
        sceneOpacity.opacity = 128;
        first.node.destroy();
        await nextFrame();

        const inactive = preparePrefab(prefab, false);
        await capture('disabled-on-attach', inactive.node);
        inactive.opacity.enabled = true;
        await capture('enabled-after-attach', inactive.node);
        inactive.opacity.destroy();
        await nextFrame();
        if (isValid(inactive.opacity) || inactive.node.getComponent(UIOpacity)) throw new Error('Destroyed opacity remained attached');
        await capture('component-removed', inactive.node);
        inactive.node.destroy();
        await nextFrame();
        prefab.decRef();
        for (let frame = 0; frame < 8 && isValid(prefab); ++frame) await nextFrame();
        if (isValid(prefab) || assetManager.assets.has(prefabId)) throw new Error('Original prefab remained in the asset cache');

        const reloadedPrefab = (await loadPrefab()).addRef();
        if (reloadedPrefab === prefab) throw new Error('Reload reused a destroyed prefab');
        const reloaded = preparePrefab(reloadedPrefab);
        await capture('cold-reload', reloaded.node);

        const samples: number[] = [];
        for (let batch = 0; batch < 41; ++batch) {
            const start = performance.now();
            for (let i = 0; i < 8192; ++i) reloaded.opacity.opacity = 127 + (i & 1);
            if (batch >= 10) samples.push(performance.now() - start);
        }
        for (const [name, regions] of Object.entries(captures)) {
            console.log(`M6_OLD_OPACITY_CAPTURE ${JSON.stringify({ name, regions })}`);
        }
        console.log(`M6_OLD_OPACITY_DONE ${JSON.stringify({ implementation, prefabId, spriteFrameId, samples })}`);
        reloaded.node.destroy();
        reloadedPrefab.decRef();
        camera.targetTexture = null;
        renderTexture.destroy();
    }
}
