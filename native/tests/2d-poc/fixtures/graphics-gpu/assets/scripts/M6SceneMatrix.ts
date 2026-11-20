import { Asset, AssetManager, BitmapFont, Camera, Color, Director, director, Graphics, instantiate, isValid, Label, LabelAtlas, Layers, native, Node, Prefab, resources, assetManager, Rect, RenderRoot2D, RenderTexture, Scene, Size, Sprite, SpriteFrame, sys, Texture2D, TTFFont, UITransform } from 'cc';

type Check = { name: string; actual: boolean | number; expected: boolean | number };
const nextFrame = (): Promise<void> => new Promise(resolve => director.once(Director.EVENT_AFTER_DRAW, resolve));

async function runBundledTTFScenes (openScene: (name: string) => Node, capture: (name: string) => Promise<void>): Promise<object> {
    const bundleName = 'm6-ttf';
    const prefabPath = 'BundledTTFLabel';
    const fontPath = 'M6BundledThonburi';
    const ids = ['fa1ba389-cd23-4275-90c4-6863fdcf15f3', '748bb085-20ec-4ee9-8792-c41c97d006ee'];
    const loadBundle = (): Promise<AssetManager.Bundle> => new Promise((resolve, reject) => assetManager.loadBundle(bundleName,
        (error, bundle) => error ? reject(error) : resolve(bundle)));
    const loadPrefab = (bundle: AssetManager.Bundle): Promise<Prefab> => new Promise((resolve, reject) => bundle.load(prefabPath,
        Prefab, (error, prefab) => error ? reject(error) : resolve(prefab.addRef())));
    const loadFont = (bundle: AssetManager.Bundle): Promise<TTFFont> => new Promise((resolve, reject) => bundle.load(fontPath,
        TTFFont, (error, font) => error ? reject(error) : resolve(font.addRef())));
    const show = async (name: string, prefab: Prefab) => {
        const parent = openScene(name);
        const node = instantiate(prefab);
        node.layer = parent.layer;
        parent.addChild(node);
        const label = node.getComponent(Label);
        const font = label?.font;
        if (!label || !(font instanceof TTFFont) || label.useSystemFont || label.string !== 'Atlas 123' || label.fontSize !== 24
            || prefab.uuid !== ids[0] || font.uuid !== ids[1] || assetManager.assets.get(ids[0]) !== prefab
            || assetManager.assets.get(ids[1]) !== font || !font._nativeAsset) {
            throw new Error(`${name} did not bind its serialized bundled TTF`);
        }
        if (sys.isNative) {
            const nativeFont = font as TTFFont & { getFontDataSize(): number; getSourcePath(): string };
            if (nativeFont.getFontDataSize() !== 223404 || !nativeFont.getSourcePath().replaceAll('\\', '/').includes('/m6-ttf/native/')) {
                throw new Error(`${name} did not read its bundled font bytes`);
            }
        }
        await capture(name);
        const { width, height } = node.getComponent(UITransform)!.contentSize;
        if (Math.abs(width - 95.9765625) > 0.001 || Math.abs(height - 37.8) > 0.001) {
            throw new Error(`${name} used fallback metrics: ${width}x${height}`);
        }
        return { node, label, font };
    };
    const verifyAlias = (family: string, owned: boolean): void => {
        if (!sys.isNative) {
            const faces = Array.from(document.fonts).filter(face => face.family === family);
            if (faces.length !== Number(owned)) throw new Error(`Bundled TTF registered ${faces.length} faces after owner state ${owned}`);
        }
        const borrowed = Label._canvasPool.get();
        const context = borrowed.context!;
        const previous = context.font;
        try {
            context.font = `24px ${JSON.stringify(family)}`;
            const width = context.measureText('Atlas 123').width;
            if ((Math.abs(width - 95.9765625) <= 0.001) !== owned) throw new Error(`Bundled TTF alias ${family} width ${width} after owner state ${owned}`);
        } finally {
            context.font = previous;
            Label._canvasPool.put(borrowed);
        }
    };
    const checkReleased = async (prefab: Prefab, font: TTFFont, family: string): Promise<void> => {
        for (let frame = 0; frame < 12 && (isValid(prefab) || isValid(font)); ++frame) await nextFrame();
        if (isValid(prefab) || isValid(font) || prefab.refCount || font.refCount || ids.some(id => assetManager.assets.has(id))) {
            throw new Error('Bundled TTF resources survived through final owner release');
        }
        if (sys.isNative && (font as TTFFont & { getFontDataSize(): number }).getFontDataSize()) {
            throw new Error('Bundled TTF retained native font bytes');
        }
        verifyAlias(family, false);
    };
    const bundle = await loadBundle();
    const preload = (): Promise<{ id: string; file: unknown; family?: string }> => new Promise((resolve, reject) => {
        bundle.preload(prefabPath, Prefab, (error, items) => {
            if (error) { reject(error); return; }
            const item = items.find(entry => entry.uuid === ids[1] && entry.isNative && entry.file);
            if (!item || assetManager.files.get(item.id) !== item.file || ids.some(id => assetManager.assets.has(id))) {
                reject(new Error('TTF preload did not cache only the bundled font data'));
                return;
            }
            const family = sys.isNative ? undefined : (item.file as { family?: string }).family;
            if (!sys.isNative && !family) { reject(new Error('TTF preload did not yield a browser descriptor')); return; }
            resolve({ id: item.id, file: item.file, family });
        });
    });
    const abandoned = await preload();
    if (abandoned.family) verifyAlias(abandoned.family, false);
    assetManager.files.remove(abandoned.id);
    if (assetManager.files.has(abandoned.id)) throw new Error('Discarded TTF stayed in the file cache');
    if (abandoned.family) verifyAlias(abandoned.family, false);
    const prepared = await preload();
    if (prepared.id !== abandoned.id || (!sys.isNative && prepared.file === abandoned.file)) {
        throw new Error('TTF preload reused a discarded browser descriptor');
    }
    if (prepared.family) verifyAlias(prepared.family, false);
    const prefab = await loadPrefab(bundle);
    const first = await show('scene-ttf-bundle-first', prefab);
    const family = first.font._nativeAsset!;
    if (assetManager.files.has(prepared.id) || (prepared.family && prepared.family !== family)) {
        throw new Error('Bundled TTF did not consume its preloaded data');
    }
    verifyAlias(family, true);
    const second = await show('scene-ttf-bundle-next', prefab);
    const held = await loadFont(bundle);
    if (isValid(first.node) || isValid(first.label) || first.font !== second.font || held !== second.font) {
        throw new Error('Bundled TTF did not preserve the shared font across scenes and callers');
    }
    openScene('scene-ttf-bundle-unloaded');
    await nextFrame();
    prefab.decRef();
    for (let frame = 0; frame < 12 && isValid(prefab); ++frame) await nextFrame();
    if (isValid(prefab) || isValid(second.label) || assetManager.assets.has(ids[0]) || assetManager.assets.get(ids[1]) !== held) {
        throw new Error('Bundled TTF unload affected the explicit font owner');
    }
    verifyAlias(family, true);
    held.decRef();
    await checkReleased(prefab, held, family);
    assetManager.removeBundle(bundle);
    if (assetManager.getBundle(bundleName)) throw new Error('Bundled TTF bundle remained cached');
    await capture('scene-ttf-bundle-unloaded');

    const coldBundle = await loadBundle();
    const coldPrefab = await loadPrefab(coldBundle);
    const cold = await show('scene-ttf-bundle-cold', coldPrefab);
    if (coldBundle === bundle || coldPrefab === prefab || cold.font === held) throw new Error('Bundled TTF reused released owners');
    const coldFamily = cold.font._nativeAsset!;
    verifyAlias(coldFamily, true);
    openScene('scene-ttf-bundle-final');
    await nextFrame();
    coldPrefab.decRef();
    await checkReleased(coldPrefab, cold.font, coldFamily);
    assetManager.removeBundle(coldBundle);
    if (assetManager.getBundle(bundleName)) throw new Error('Cold TTF bundle remained cached');
    await capture('scene-ttf-bundle-final');
    return { preload: true, discardedPreload: true, consumedPreload: true, shared: true, retainedAlias: true,
        aliasesReleased: true, cacheCleared: true, coldReloaded: true, ids };
}

interface ImportedFontCase {
    path: string;
    prefix: string;
    prefabUuid: string;
    fontUuid: string;
    imageUuid: string;
    fontType: typeof BitmapFont;
    fontSize: number;
    text: string;
    textureSize: number;
    width: number;
    height: number;
}

async function runImportedFontScenes (fixture: ImportedFontCase, openScene: (name: string) => Node,
    capture: (name: string) => Promise<void>): Promise<object> {
    const { path, prefix, prefabUuid, fontUuid, imageUuid, fontType, fontSize, text, textureSize } = fixture;
    const labelAtlas = fontType === LabelAtlas;
    const ids = [prefabUuid, fontUuid, `${imageUuid}@f9941`, `${imageUuid}@6c48a`, imageUuid];
    const published = (): boolean => ids.some(id => assetManager.assets.has(id));
    const cached = (asset: Asset): boolean => isValid(asset) && assetManager.assets.get(asset.uuid) === asset;
    const finishRelease = async (assets: Asset[], keys: string[]): Promise<void> => {
        for (let frame = 0; frame < 12 && assets.some(asset => isValid(asset)); ++frame) await nextFrame();
        if (assets.some(asset => isValid(asset) || asset.refCount !== 0) || keys.some(id => assetManager.assets.has(id))) {
            throw new Error(`${path} dependencies survived release: ${keys.filter(id => assetManager.assets.has(id)).join(',')}`);
        }
    };
    await new Promise<void>((resolve, reject) => resources.preload(path, Prefab, (error, requests) => {
        if (error) reject(error);
        else if (![prefabUuid, fontUuid].every(uuid => requests.some(request => request.uuid === uuid && request.file))) {
            reject(new Error(`${path} preload missed Prefab or font`));
        } else resolve();
    }));
    if (published()) throw new Error(`${path} preload published assets`);

    const load = (): Promise<Prefab> => new Promise((resolve, reject) => resources.load(path, Prefab, (error, prefab) => {
        if (error) reject(error);
        else resolve(prefab.addRef());
    }));
    const show = async (name: string, prefab: Prefab) => {
        const parent = openScene(name);
        const instance = instantiate(prefab);
        instance.layer = parent.layer;
        parent.addChild(instance);
        const label = instance.getComponent(Label);
        const font = label?.font;
        if (!label || !(font instanceof fontType) || (font instanceof LabelAtlas) !== labelAtlas
            || label.useSystemFont || label.string !== text || label.fontSize !== fontSize) {
            throw new Error(`${path} did not bind its serialized Label and font type`);
        }
        const frame = font.spriteFrame;
        const texture = frame?.original?._texture ?? frame?.texture;
        if (!(frame instanceof SpriteFrame) || !(texture instanceof Texture2D) || !texture.image
            || !font.fontDefDictionary || font.fontSize !== fontSize || texture.width !== textureSize || texture.height !== textureSize) {
            throw new Error(`${path} did not restore its imported atlas and glyph configuration`);
        }
        if (labelAtlas && (Object.keys(font.fontDefDictionary.letterDefinitions).length !== 8
            || font.fontDefDictionary.getLetter('48')?.xAdvance !== 16)) {
            throw new Error(`${path} did not import the digit cells from LabelAtlas metadata`);
        }
        if (sys.isNative ? !!frame.original || frame.texture !== texture : !frame.original || frame.texture === texture) {
            throw new Error(`${path} did not follow the backend dynamic atlas policy`);
        }
        const assets = [prefab, font, frame, texture, texture.image];
        if (assets.some((asset, index) => asset.uuid !== ids[index] || !cached(asset))) {
            throw new Error(`${path} dependency UUID or cache identity changed`);
        }
        await capture(name);
        const { width, height } = instance.getComponent(UITransform)!;
        if (label.spriteFrame !== frame || width !== fixture.width || height !== fixture.height || label.actualFontSize !== fontSize) {
            throw new Error(`${path} Label did not use the loaded frame and metrics: ${width}x${height}, size ${label.actualFontSize}`);
        }
        return { label, instance, assets, texture, width };
    };

    const pipeline = assetManager.pipeline;
    const cancelled = new Error(`${path} atlas image dependency cancelled by fixture`);
    let pausedRequests = 0;
    let pausedFrames = 0;
    pipeline.insert((task, done) => {
        task.output = task.input;
        if (!task.input.some((item: { uuid: string; isNative: boolean }) => item.uuid === imageUuid && item.isNative)) {
            done();
            return;
        }
        const attempt = ++pausedRequests;
        void (async () => {
            for (let frame = 0; frame < 2; ++frame) {
                await nextFrame();
                ++pausedFrames;
                if (published()) throw new Error(`${path} published assets before its atlas image arrived`);
            }
        })().then(() => done(attempt === 1 ? cancelled : null), done);
    }, 1);
    let prefab: Prefab;
    try {
        let rejected = false;
        try {
            const unexpected = await load();
            unexpected.decRef();
        } catch (error) {
            if (error !== cancelled) throw error;
            rejected = true;
        }
        if (!rejected || pausedRequests !== 1 || published()) {
            throw new Error(`${path} cancelled load published an asset or resolved successfully`);
        }
        prefab = await load();
    } finally {
        pipeline.remove(1);
    }
    if (Number(pausedRequests) !== 2 || pausedFrames !== 4 || prefab.uuid !== prefabUuid) {
        throw new Error(`${path} retry missed the image dependency: ${pausedRequests}/${pausedFrames}`);
    }
    const first = await show(`${prefix}-initial`, prefab);
    const second = await show(`${prefix}-next`, prefab);
    if (isValid(first.instance) || isValid(first.label) || first.assets.some((asset, i) => asset !== second.assets[i])) {
        throw new Error(`${path} did not preserve shared assets across the scene switch`);
    }
    const texture = second.texture.addRef();
    openScene(`${prefix}-retained-empty`);
    await nextFrame();
    if (isValid(second.label)) throw new Error(`${path} Label survived its scene`);
    prefab.decRef();
    await finishRelease(second.assets.slice(0, 3), ids.slice(0, 3));
    if (!cached(texture) || !cached(second.assets[4])) throw new Error(`${path} released an explicitly retained texture`);
    await capture(`${prefix}-retained-empty`);

    const replacement = await load();
    const reused = await show(`${prefix}-reloaded`, replacement);
    if (reused.texture !== texture || reused.assets.slice(0, 3).some((asset, i) => asset === second.assets[i])) {
        throw new Error(`${path} reload failed to create new owners and reuse the retained texture`);
    }
    openScene(`${prefix}-unloaded`);
    await nextFrame();
    replacement.decRef();
    texture.decRef();
    await finishRelease(reused.assets, ids);

    const freshPrefab = await load();
    const fresh = await show(`${prefix}-cold-reload`, freshPrefab);
    if (fresh.assets.some((asset, i) => asset === reused.assets[i])) {
        throw new Error(`${path} cold reload recovered stale wrappers`);
    }
    openScene(`${prefix}-final-empty`);
    await nextFrame();
    freshPrefab.decRef();
    await finishRelease(fresh.assets, ids);
    await capture(`${prefix}-final-empty`);
    return { preload: true, cancelledAndRetried: true, pausedRequests, pausedFrames, sharedAcrossScenes: true,
        keptTexture: true, coldReload: true, released: true, atlasPolicy: true, width: first.width, ids };
}

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
    const openFontScene = (name: string): Node => {
        const scene = new Scene(name);
        const content = root(scene, 'font-root', layer);
        camera(scene, 'font-camera', layer, 0, 7, rt);
        director.runSceneImmediate(scene);
        return content;
    };
    const legacyBitmap = await runImportedFontScenes({
        path: 'M3BitmapFont/LegacyBitmapLabel', prefix: 'scene-bmfont', prefabUuid: '8d32029d-5446-4c2d-abce-fad14b94bc07',
        fontUuid: '14697d7f-eddd-40c2-bb46-5cd9c361aa1c', imageUuid: 'edf8a297-6e03-4a36-ace0-66403b851123',
        fontType: BitmapFont, fontSize: 20, text: 'AV 20', textureSize: 128, width: 40, height: 20,
    }, openFontScene, capture);
    const labelAtlas = await runImportedFontScenes({
        path: 'M6LabelAtlas/LabelAtlasDigits', prefix: 'scene-label-atlas', prefabUuid: '995b7635-2a62-4455-a479-64ea52fa3adb',
        fontUuid: '10882616-f51c-4257-a7c0-d651e05a62ef', imageUuid: 'a7d03c29-5d28-4f9f-b45b-3cc8c525e549',
        fontType: LabelAtlas, fontSize: 22, text: '1076', textureSize: 64, width: 64, height: 25,
    }, openFontScene, capture);
    const bundledTTF = await runBundledTTFScenes(openFontScene, capture);
    return { cycles, texturesCreated, texturesDestroyed, assertions, collections, samples, checks, legacyBitmap, labelAtlas, bundledTTF };
}
