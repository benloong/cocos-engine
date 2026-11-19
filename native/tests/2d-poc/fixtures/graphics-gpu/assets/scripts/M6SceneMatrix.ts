import { Camera, Color, Director, director, Graphics, instantiate, isValid, Layers, native, Node, Prefab, resources, assetManager, Rect, RenderRoot2D, RenderTexture, Scene, Size, Sprite, SpriteFrame, sys, Texture2D, UITransform } from 'cc';

type Check = { name: string; actual: boolean | number; expected: boolean | number };
const nextFrame = (): Promise<void> => new Promise(resolve => director.once(Director.EVENT_AFTER_DRAW, resolve));

// All render roots in this fixture are direct Scene children. A walk overwrites
// final opacity even when a root has no drawable components or visible pixels.
export async function countTraversedRoots (): Promise<number> {
    const nodes = director.getScene()!.children.slice();
    const previous = nodes.map(node => node._uiProps.opacity);
    function setFinalOpacity (node: Node, value: number): void {
        if (sys.isNative) (node as any)._setFinalOpacity(value);
        else node._uiProps.setOpacity(value);
    }
    for (const node of nodes) setFinalOpacity(node, -1);
    await nextFrame();
    let count = 0;
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!isValid(node)) continue;
        if (node._uiProps.opacity !== -1) count++;
        else setFinalOpacity(node, previous[i]);
    }
    return count;
}

/** Real director transitions; no retained list of old Scenes or their assets. */
export async function runSceneMatrix (rt: RenderTexture, capture: (name: string, source?: RenderTexture) => Promise<void>): Promise<object> {
    const checks: Check[] = [];
    const check = (name: string, actual: boolean | number, expected: boolean | number): void => {
        checks.push({ name, actual, expected });
        if (actual !== expected) throw new Error(`Scene check ${name}: ${actual}, expected ${expected}`);
    };
    const node = (parent: Node, name: string, layer: number): Node => {
        const n = new Node(name); n.layer = layer; parent.addChild(n); n.addComponent(UITransform); return n;
    };
    const root = (scene: Scene, name: string, layer: number): Node => {
        const n = node(scene, name, layer); n.addComponent(RenderRoot2D); return n;
    };
    const camera = (scene: Scene, name: string, layer: number, priority: number, clear: number, target: RenderTexture): Camera => {
        const n = new Node(name); scene.addChild(n); n.setPosition(0, 0, 1000);
        const c = n.addComponent(Camera); c.projection = Camera.ProjectionType.ORTHO; c.orthoHeight = 128;
        c.visibility = layer; c.priority = priority; c.clearFlags = clear; c.clearColor = new Color(0, 0, 0, 255); c.targetTexture = target; return c;
    };
    const graphics = (n: Node, color: Color, x = -40, y = -40, w = 80, h = 80): void => {
        const g = n.addComponent(Graphics); g.fillColor = color; g.fillRect(x, y, w, h);
    };

    const original = director.getScene()!;
    const multi = new Scene('m6-camera-matrix');
    const a = root(multi, 'camera-red-root', 1), b = root(multi, 'camera-blue-root', 2);
    graphics(a, new Color(255, 0, 0, 128)); graphics(b, new Color(0, 0, 255, 128));
    const ca = camera(multi, 'camera-a', 1, 0, 7, rt), cb = camera(multi, 'camera-b', 2, 1, 6, rt);
    director.runSceneImmediate(multi); await nextFrame();
    check('initial-scene-destroyed', isValid(original), false);
    check('camera-scene-roots', await countTraversedRoots(), 2);
    await capture('scene-camera-overlay');
    ca.priority = 2; await capture('scene-camera-priority');
    ca.priority = 0; cb.visibility = 0; await capture('scene-camera-layer');
    cb.visibility = 2; cb.enabled = false; await capture('scene-camera-disabled');
    check('second-camera-disabled', cb.enabledInHierarchy, false);
    cb.enabled = true; cb.clearFlags = 7; await capture('scene-camera-clear');
    ca.visibility = 2; cb.visibility = 1; cb.clearFlags = 6; await capture('scene-camera-swapped');
    cb.node.setPosition(50, 0, 1000); await capture('scene-camera-moved');
    const secondary = new RenderTexture(); secondary.reset({ width: 256, height: 256 });
    cb.node.setPosition(0, 0, 1000); cb.clearFlags = 7; cb.targetTexture = secondary;
    await capture('scene-camera-target-main'); await capture('scene-camera-target-secondary', secondary);
    check('camera-target-replaced', cb.targetTexture === secondary, true);
    ca.visibility = 1; cb.visibility = 2; cb.clearFlags = 6; cb.targetTexture = rt;
    await capture('scene-camera-restored'); secondary.destroy();

    const layer = Layers.Enum.UI_2D;
    const persistent = root(multi, 'persistent-render-root', layer);
    graphics(persistent, new Color(0, 255, 0, 255), 80, -10, 20, 20);
    director.addPersistRootNode(persistent);
    check('persistent-root-registered', await countTraversedRoots(), 3);
    type State = { scene: Scene; root: Node; texture: Texture2D; frame: SpriteFrame };
    const build = (index: number): State => {
        const scene = new Scene(`m6-cycle-${index + 1}`);
        const n = root(scene, 'transient-render-root', layer);
        n.getComponent(UITransform)!.setContentSize(80, 80);
        const texture = new Texture2D(); texture.reset({ width: 2, height: 2, format: Texture2D.PixelFormat.RGBA8888 });
        const pixels = new Uint8Array(16); pixels.fill(255); texture.uploadData(pixels);
        const frame = new SpriteFrame(); frame.texture = texture; frame.rect = new Rect(0, 0, 2, 2); frame.originalSize = new Size(2, 2); frame.packable = false;
        const sprite = n.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.spriteFrame = frame;
        sprite.color = index % 2 === 0 ? new Color(255, 0, 0, 255) : new Color(0, 0, 255, 255);
        camera(scene, 'cycle-camera', layer, 0, 7, rt);
        return { scene, root: n, texture, frame };
    };
    let previous: State | null = null, cycles = 0, texturesCreated = 0, texturesDestroyed = 0, assertions = 0, collections = 0;
    const samples: { cycle: number; roots: number; persistent: boolean }[] = [];
    const require = (value: boolean, name: string): void => { assertions++; if (!value) throw new Error(`Cycle ${cycles}: ${name}`); };
    for (let i = 0; i < 1000; ++i) {
        const current = build(i); texturesCreated++;
        director.runSceneImmediate(current.scene);
        if (previous) { previous.frame.destroy(); previous.texture.destroy(); texturesDestroyed++; }
        const traversed = await countTraversedRoots(); cycles++;
        require(traversed === 2, 'persistent and transient roots traversed');
        require(persistent.scene === current.scene, 'persistent root Scene updated');
        require(isValid(current.texture) && isValid(current.frame), 'current assets alive');
        if (previous) {
            require(!isValid(previous.scene) && !isValid(previous.root), 'previous Scene/Node destroyed');
            require(!isValid(previous.texture) && !isValid(previous.frame), 'previous assets destroyed');
        }
        previous = current;
        if (cycles % 100 === 0) {
            if (sys.isNative) native.garbageCollect();
            else { const gc = (globalThis as any).gc; if (typeof gc !== 'function') throw new Error('Run Chrome with --js-flags=--expose-gc'); gc(); }
            collections++;
            console.log(`M6_SCENE_PROGRESS ${JSON.stringify({ cycle: cycles, roots: traversed })}`);
        }
        if (cycles === 1 || cycles % 250 === 0) {
            samples.push({ cycle: cycles, roots: traversed, persistent: persistent.scene === current.scene });
            await capture(`scene-cycle-${cycles}`);
        }
    }
    director.removePersistRootNode(persistent); persistent.destroy();
    const empty = new Scene('m6-empty-final-scene'); camera(empty, 'empty-camera', layer, 0, 7, rt);
    director.runSceneImmediate(empty);
    previous!.frame.destroy(); previous!.texture.destroy(); texturesDestroyed++;
    await nextFrame();
    check('final-no-traversed-roots', await countTraversedRoots(), 0);
    check('persistent-root-destroyed', isValid(persistent), false);
    check('final-previous-scene-destroyed', isValid(previous!.scene), false);
    check('final-frame-destroyed', isValid(previous!.frame), false);
    check('final-texture-destroyed', isValid(previous!.texture), false);
    await capture('scene-final-empty');
    const prefab = await new Promise<Prefab>((resolve, reject) =>
        resources.load('M6StaticAtlas/AtlasSprite', Prefab, (err, asset) => err ? reject(err) : resolve(asset)));
    prefab.addRef();
    const openPrefabScene = (name: string): Sprite => {
        const scene = new Scene(name);
        const instance = instantiate(prefab);
        instance.layer = layer;
        root(scene, 'atlas-root', layer).addChild(instance);
        camera(scene, 'atlas-camera', layer, 0, 7, rt);
        director.runSceneImmediate(scene);
        return instance.getComponent(Sprite)!;
    };
    const first = openPrefabScene('m6-atlas-first');
    const firstNode = first.node;
    const atlas = first.spriteAtlas!;
    const left = first.spriteFrame!;
    const right = atlas.getSpriteFrame('right')!;
    const texture = left.texture;
    const assets = [prefab, atlas, left, right, texture];
    const ids = assets.map(asset => asset.uuid);
    await capture('scene-atlas-first');
    const second = openPrefabScene('m6-atlas-second');
    await nextFrame();
    check('atlas-first-node-destroyed', isValid(firstNode), false);
    check('atlas-first-sprite-destroyed', isValid(first), false);
    check('atlas-assets-retained', assets.every((asset, i) => isValid(asset) && assetManager.assets.get(ids[i]) === asset), true);
    check('atlas-frame-rebound', second.spriteAtlas === atlas && second.spriteFrame === left, true);
    second.changeSpriteFrameFromAtlas('right');
    check('atlas-rotated-frame-selected', second.spriteFrame === right && right.rotated && right.texture === texture, true);
    await capture('scene-atlas-second');
    const last = new Scene('m6-atlas-unloaded');
    camera(last, 'unloaded-camera', layer, 0, 7, rt);
    director.runSceneImmediate(last);
    await nextFrame();
    check('atlas-second-sprite-destroyed', isValid(second), false);
    prefab.decRef();
    await nextFrame(); await nextFrame();
    check('atlas-all-assets-released', assets.every(asset => !isValid(asset)), true);
    check('atlas-all-cache-keys-released', ids.every(id => !assetManager.assets.has(id)), true);
    check('atlas-final-root-count', await countTraversedRoots(), 0);
    await capture('scene-atlas-unloaded');
    return { cycles, texturesCreated, texturesDestroyed, assertions, collections, samples, checks };
}
