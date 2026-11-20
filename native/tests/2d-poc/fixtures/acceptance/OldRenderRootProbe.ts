import { _decorator, assetManager, builtinResMgr, Canvas, Color, Component, Director, director, instantiate, isValid,
    Material, Node, Prefab, RenderRoot2D, RenderTexture, resources, Sprite, sys, UITransform, Vec3 } from 'cc';

const prefabId = '68eb84a9-bd0f-479b-b6ab-b82a8927d235';
const spriteFrameId = 'b730527c-3233-41c2-aaf7-7cdab58f9749@f9941';
const size = 256;
const nextFrame = (): Promise<void> => new Promise(resolve => director.once(Director.EVENT_AFTER_DRAW, resolve));

// The original scene references M1Test by the UUID of its script asset.
@_decorator.ccclass('M1Test')
export class OldRenderRootProbe extends Component {
    public start (): void {
        this.run().catch(error => console.error(`M6_OLD_ROOT_FAIL ${error.stack ?? error}`));
    }

    private async run (): Promise<void> {
        const scene = director.getScene();
        const canvas = this.getComponent(Canvas);
        const camera = canvas?.cameraComponent;
        const oldSprite = this.node.getChildByName('M1TestNode-001')?.getComponent(Sprite);
        const frame = oldSprite?.spriteFrame;
        if (scene?.name !== 'm1-test' || !(canvas instanceof RenderRoot2D) || !camera || !oldSprite || frame?.uuid !== spriteFrameId) {
            throw new Error('Expected the original Canvas, camera and SpriteFrame');
        }
        const nativeRoot = (root: RenderRoot2D): boolean => Boolean((root as RenderRoot2D & { _nativeRoot?: unknown })._nativeRoot);
        const implementation = nativeRoot(canvas) ? 'native' : 'js';
        const material = builtinResMgr.get<Material>('ui-sprite-material');
        if (!material) throw new Error('Missing original project Sprite material');

        const configureSprite = (sprite: Sprite, color: Color): void => {
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.color = color;
            sprite.node.getComponent(UITransform)!.setContentSize(48, 48);
        };
        configureSprite(oldSprite, new Color(255, 0, 0));
        oldSprite.node.setPosition(-40, 0, 0);

        const rt = new RenderTexture();
        rt.reset({ width: size, height: size });
        camera.clearFlags = 7;
        camera.clearColor = new Color(0, 0, 0, 255);
        camera.targetTexture = rt;
        camera.orthoHeight = size / 2;
        await nextFrame();
        const prefabPosition = Vec3.add(new Vec3(), this.node.worldPosition, new Vec3(40, 0, 0));

        const loadPrefab = (): Promise<Prefab> => new Promise((resolve, reject) => {
            resources.load('M1Prefab', Prefab, (error, asset) => {
                if (error) reject(error);
                else resolve(asset);
            });
        });
        const spawnRoot = (prefab: Prefab, enabled: boolean): { root: RenderRoot2D; child: Node } => {
            if (prefab.uuid !== prefabId || assetManager.assets.get(prefabId) !== prefab) throw new Error('Unexpected old Prefab cache identity');
            const node = instantiate(prefab);
            const root = node.addComponent(RenderRoot2D);
            root.enabled = enabled;
            const child = new Node('Old Prefab Sprite');
            child.layer = oldSprite.node.layer;
            node.addChild(child);
            const sprite = child.addComponent(Sprite);
            sprite.spriteFrame = frame;
            sprite.customMaterial = material;
            configureSprite(sprite, new Color(0, 255, 0));
            scene.addChild(node);
            node.setWorldPosition(prefabPosition);
            const instance = sprite.getMaterialInstance(0);
            if (nativeRoot(root) !== (implementation === 'native') || !instance || instance === material) {
                throw new Error('Expected the selected root implementation and an instance of the original Sprite material');
            }
            return { root, child };
        };

        const readRegion = (pixels: Uint8Array, position: Vec3): string => {
            const x = Math.round(position.x);
            const y = Math.round(position.y);
            if (x < 4 || x > size - 4 || y < 4 || y > size - 4) throw new Error('Sample lies outside the render texture');
            let bytes = '';
            for (let row = y - 4; row < y + 4; ++row) {
                const start = (row * size + x - 4) * 4;
                for (let i = start; i < start + 32; ++i) bytes += pixels[i].toString(16).padStart(2, '0');
            }
            return bytes;
        };
        const mark = (node: Node): void => {
            if (sys.isNative) (node as Node & { _setFinalOpacity(value: number): void })._setFinalOpacity(-1);
            else node._uiProps.setOpacity(-1);
        };
        const capture = async (name: string, child: Node | null): Promise<void> => {
            mark(oldSprite.node);
            if (child) mark(child);
            await nextFrame();
            const pixels = rt.readPixels();
            if (!pixels || pixels.length !== size * size * 4) throw new Error('Missing old-project GPU readback');
            const regions = [oldSprite.node.worldPosition, prefabPosition].map(position => readRegion(pixels, camera.worldToScreen(position)));
            const visited = [oldSprite.node._uiProps.opacity >= 0, child ? child._uiProps.opacity >= 0 : false];
            console.log(`M6_OLD_ROOT_CAPTURE ${JSON.stringify({ name, regions, visited })}`);
        };

        const prefab = (await loadPrefab()).addRef();
        const first = spawnRoot(prefab, false);
        await capture('initially-disabled', first.child);
        first.root.enabled = true;
        await capture('both', first.child);
        canvas.enabled = false;
        await capture('prefab-only', first.child);
        first.root.enabled = false;
        await capture('both-disabled', first.child);
        canvas.enabled = true;
        first.root.enabled = true;
        await capture('re-enabled', first.child);

        const firstNode = first.root.node;
        firstNode.active = false;
        await capture('prefab-node-inactive', first.child);
        firstNode.active = true;
        await capture('prefab-node-active', first.child);
        first.root.destroy();
        await nextFrame();
        if (isValid(first.root) || firstNode.getComponent(RenderRoot2D)) throw new Error('Destroyed root remained attached');
        await capture('root-removed', first.child);
        firstNode.destroy();
        await nextFrame();
        prefab.decRef();
        for (let frame = 0; frame < 8 && isValid(prefab); ++frame) await nextFrame();
        if (isValid(prefab) || assetManager.assets.has(prefabId)) throw new Error('Old Prefab remained in the asset cache');

        const reloaded = (await loadPrefab()).addRef();
        if (reloaded === prefab) throw new Error('Reload reused the destroyed Prefab');
        const cold = spawnRoot(reloaded, true);
        await capture('cold-reload', cold.child);
        const samples: number[] = [];
        for (let batch = 0; batch < 41; ++batch) {
            const start = performance.now();
            for (let i = 0; i < 256; ++i) {
                cold.root.enabled = false;
                cold.root.enabled = true;
            }
            if (batch >= 10) samples.push(performance.now() - start);
        }
        cold.root.node.destroy();
        await nextFrame();
        reloaded.decRef();
        for (let frame = 0; frame < 8 && isValid(reloaded); ++frame) await nextFrame();
        if (isValid(reloaded) || assetManager.assets.has(prefabId)) throw new Error('Reloaded Prefab remained in the asset cache');
        await capture('final-release', null);
        camera.targetTexture = null;
        rt.destroy();
        console.log(`M6_OLD_ROOT_DONE ${JSON.stringify({ implementation, prefabId, spriteFrameId, samples })}`);
    }
}
