import { assetManager, Director, director, gfx, isValid, Label, native, Node, resources, RichText, Sprite, SpriteAtlas, sys, TTFFont, UITransform } from 'cc';

const nextFrame = (): Promise<void> => new Promise(resolve => director.once(Director.EVENT_AFTER_DRAW, resolve));
const atlasPath = 'M6StaticAtlas/colors';
const loadAtlas = (): Promise<SpriteAtlas> => new Promise((resolve, reject) => {
    resources.load(atlasPath, SpriteAtlas, (error, asset) => error ? reject(error) : resolve(asset!));
});

export async function checkRichTextCollectedWrappers (parent: Node, font: TTFFont): Promise<object | null> {
    if (!sys.isNative) return null;
    const WeakNode = (globalThis as unknown as { WeakRef: new (node: Node) => { deref(): Node | undefined } }).WeakRef;
    const host = new Node('richtext-collected-wrappers');
    host.layer = parent.layer;
    const rich = host.addComponent(RichText);
    rich.string = '';
    rich.font = font;
    parent.addChild(host);
    const content = 'I<b>II</b>';
    const preparePool = (): Array<{ id: string; weak: { deref(): Node | undefined } }> => {
        rich.string = content;
        if (host.children.length !== 2) throw new Error('Missing RichText children before wrapper collection');
        const wrappers = host.children.map(node => {
            node.on(Node.EventType.LAYER_CHANGED, () => { throw new Error('Collected wrapper received a layer change'); });
            return { id: node.uuid, weak: new WeakNode(node) };
        });
        rich.string = '';
        return wrappers;
    };
    const verifyRecreatedWrappers = async (ids: string[]): Promise<void> => {
        rich.string = content;
        const [first, second] = host.children;
        if (host.children.length !== 2 || host.children.some(node => node.parent !== host || node.scene !== host.scene
            || !node.activeInHierarchy || !ids.includes(node.uuid)) || first.position.x >= second.position.x) {
            throw new Error('A recreated RichText Node wrapper has stale hierarchy, transform or identity');
        }
        let layerEvents = 0;
        second.on(Node.EventType.LAYER_CHANGED, () => ++layerEvents);
        const layer = host.layer;
        host.layer = 1;
        await nextFrame();
        host.layer = layer;
        await nextFrame();
        if (layerEvents !== 2) throw new Error(`Recreated RichText wrapper received ${layerEvents} layer events`);
    };
    try {
        const cycles = 4;
        for (let cycle = 0; cycle < cycles; ++cycle) {
            const wrappers = preparePool();
            let collected = false;
            for (let attempt = 0; attempt < 4 && !collected; ++attempt) {
                await nextFrame();
                await nextFrame();
                native.garbageCollect();
                collected = wrappers.every(({ weak }) => !weak.deref());
            }
            if (!collected) throw new Error(`RichText pool kept a detached JS wrapper alive in cycle ${cycle}`);
            await verifyRecreatedWrappers(wrappers.map(({ id }) => id));
        }
        return { cycles, collected: cycles * 2, reusedNativeNodes: cycles * 2, layerEvents: cycles * 2 };
    } finally {
        host.destroy();
        await nextFrame();
    }
}

export async function checkRichTextRetiredNodes (parent: Node, font: TTFFont): Promise<object | null> {
    if (!sys.isNative) return null;
    console.log('M6_RICHTEXT_RETIRED_NODES_START');
    const atlas = (await loadAtlas()).addRef();
    const atlasId = atlas.uuid;
    const tracked = new Map<Node, { destroyed: number; listener: () => void }>();
    const owners = 4;
    const cyclesPerOwner = 16;
    const segments = 96;
    let reused = 0;
    let destroyedWhilePooled = 0;
    let reusedAcrossOwners = 0;
    let previousOwner = new Set<Node>();
    try {
        for (let owner = 0; owner < owners; ++owner) {
            const host = new Node('richtext-retired-nodes');
            host.layer = parent.layer;
            const rich = host.addComponent(RichText);
            rich.string = '';
            rich.font = font;
            rich.fontSize = 16;
            rich.imageAtlas = atlas;
            parent.addChild(host);
            const ownerNodes = new Set<Node>();
            try {
                let pooled = new Set<Node>();
                for (let cycle = 0; cycle < cyclesPerOwner; ++cycle) {
                    const image = cycle % 2 ? 'left' : 'right';
                    rich.string = Array(6).fill(`<b>I</b><img src="${image}" width=8 height=8/>`.repeat(8)).join('<br/>');
                    const children = host.children.slice();
                    if (children.length !== segments || new Set(children).size !== segments
                        || children.some(node => !isValid(node, true) || node.parent !== host || !node.activeInHierarchy)) {
                        throw new Error('RichText attached a retired, duplicate or inactive segment');
                    }
                    for (const child of children) {
                        if (pooled.has(child)) ++reused;
                        if (cycle === 0 && previousOwner.has(child)) ++reusedAcrossOwners;
                        ownerNodes.add(child);
                        if (!tracked.has(child)) {
                            const state = { destroyed: 0, listener: () => { ++state.destroyed; } };
                            tracked.set(child, state);
                            child.on(Node.EventType.NODE_DESTROYED, state.listener);
                        }
                    }
                    rich.string = '';
                    pooled = new Set(children.filter(node => isValid(node, true)));
                    if ([...pooled].some(node => (node as unknown as { _parentRef: Node | null })._parentRef)) {
                        throw new Error('A pooled RichText Node wrapper still referenced its former host');
                    }
                    if (host.children.length || pooled.size > 30 || [...pooled].some(node => node.parent || node.active
                        || node.activeInHierarchy || node.getComponent(Label)?.font || node.getComponent(Sprite)?.spriteFrame)) {
                        throw new Error('A retired RichText segment still held an owner, live render state or source asset');
                    }
                    if (cycle === 0) {
                        const retired = pooled.values().next().value;
                        if (!retired || !retired.destroy()) throw new Error('RichText did not provide a live pooled node');
                        ++destroyedWhilePooled;
                    }
                    if (cycle % 4 === 3) await nextFrame();
                }
                rich.string = '<b>Last</b><img src="left" width=8 height=8/>';
                for (const child of host.children) {
                    if (!tracked.has(child)) throw new Error('Final RichText layout did not reuse the warmed pool');
                }
            } finally {
                host.destroy();
                await nextFrame();
                await nextFrame();
            }
            if (isValid(host) || isValid(rich)) throw new Error('RichText kept its destroyed host alive');
            previousOwner = ownerNodes;
        }
    } finally {
        atlas.decRef();
        for (let frame = 0; frame < 8 && isValid(atlas); ++frame) await nextFrame();
        for (const [node, state] of tracked) {
            if (isValid(node)) node.off(Node.EventType.NODE_DESTROYED, state.listener);
        }
    }
    const retained = [...tracked].filter(([node]) => isValid(node));
    if (isValid(atlas) || assetManager.assets.has(atlasId) || !reused || retained.length !== 0 || reusedAcrossOwners !== 0
        || [...tracked].some(([node, { destroyed }]) => isValid(node)
            ? destroyed !== 0 || node.parent || node.active || node.getComponent(Label)?.font || node.getComponent(Sprite)?.spriteFrame
            : destroyed !== 1)) {
        throw new Error('RichText left unexpected live nodes, source assets or destruction callbacks across owners');
    }
    console.log('M6_RICHTEXT_RETIRED_NODES_PASS');
    return { owners, cycles: owners * cyclesPerOwner, segments, reused, reusedAcrossOwners,
        destroyedWhilePooled, tracked: tracked.size, retained: retained.length, atlasReleased: true };
}

export async function checkRichTextAnchorDuringAttach (parent: Node, font: TTFFont): Promise<object> {
    const host = new Node('richtext-anchor-during-attach');
    host.layer = parent.layer;
    const ui = host.addComponent(UITransform);
    ui.setAnchorPoint(0, .5);
    const rich = host.addComponent(RichText);
    rich.font = font;
    rich.fontSize = 24;
    rich.string = '';
    parent.addChild(host);
    try {
        let attached: Node | undefined;
        host.once(Node.EventType.CHILD_ADDED, (child: Node) => {
            attached = child;
            ui.setAnchorPoint(1, .5);
        });
        rich.string = 'I<b>I</b>';
        await nextFrame();
        const children = host.children.slice();
        if (children.length !== 2 || attached !== children[0] || !children.every(child => child.parent === host && child.activeInHierarchy)
            || ui.width <= 0 || Math.abs(children[0].position.x + ui.width) > .001) {
            throw new Error('RichText published stale child positions after changing the anchor in CHILD_ADDED');
        }
        const anchored = children.map(child => child.position.x);
        ui.setAnchorPoint(0, .5);
        await nextFrame();
        if (host.children.length !== children.length || children.some((child, i) => host.children[i] !== child
            || Math.abs(child.position.x - anchored[i] - ui.width) > .001)) {
            throw new Error('RichText changed child identities or lost the anchor offset on subsequent layout');
        }
        return { segments: children.length, childIdentity: true, anchorDuringAttach: true, laterAnchor: true };
    } finally {
        host.destroy();
        await nextFrame();
    }
}

export async function checkRichTextActivation (
    parent: Node, font: TTFFont, readPixels: () => Uint8Array,
): Promise<object> {
    const host = new Node('richtext-reactivation');
    host.layer = parent.layer;
    parent.addChild(host);
    const inactiveParent = new Node('richtext-inactive-parent');
    const rich = host.addComponent(RichText);
    const hasColor = (rgba: Uint8Array): boolean => rgba.some((value, i) => i % 4 < 3 && value !== 0);
    try {
        rich.font = font;
        rich.fontSize = 24;
        rich.lineHeight = 30;
        rich.string = 'I<b>I</b><i>I</i>';
        const initial = host.children.slice();
        if (initial.length !== 3 || initial.some(child => !child.activeInHierarchy)) throw new Error('Missing active RichText children');
        rich.enabled = false;
        if (initial.some(child => child.active || child.activeInHierarchy)) throw new Error('RichText retained active children when disabled');
        let callbacks = 0;
        initial[0].once(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, (child: Node) => {
            if (!child.activeInHierarchy || child.parent !== host) throw new Error('RichText activation event published stale hierarchy');
            callbacks++;
            console.log('M6_RICH_TEXT_REACTIVATE_REBUILD');
            rich.string = '';
        });
        rich.enabled = true;
        await nextFrame();
        if (callbacks !== 1 || host.children.length !== 0 || initial.some(child => child.parent || child.activeInHierarchy)
            || hasColor(readPixels())) {
            throw new Error('RichText activation listener left a retired segment attached, active or rendered');
        }
        rich.string = '<color=#ff0000>I</color>';
        await nextFrame();
        const replacement = host.children[0];
        const restored = new Uint8Array(readPixels());
        if (host.children.length !== 1 || replacement.parent !== host || !replacement.activeInHierarchy
            || !restored.some((value, i) => i % 4 === 0 && value > restored[i + 1])) {
            throw new Error('RichText did not recover after rebuilding during activation');
        }
        inactiveParent.active = false;
        parent.addChild(inactiveParent);
        host.parent = inactiveParent;
        await nextFrame();
        if (replacement.activeInHierarchy || hasColor(readPixels())) throw new Error('RichText drew under an inactive ancestor');
        host.parent = parent;
        await nextFrame();
        const reattached = readPixels();
        if (host.children[0] !== replacement || !replacement.activeInHierarchy || !restored.every((byte, i) => byte === reattached[i])) {
            throw new Error('RichText lost its child or rendering after reparenting');
        }
        host.destroy();
        await nextFrame();
        if (isValid(host) || isValid(rich) || (isValid(replacement) && (replacement.parent || replacement.activeInHierarchy))
            || hasColor(readPixels())) {
            throw new Error('RichText host destruction left an active segment');
        }
        return { initial: initial.length, callbacks, cleared: true, replacement: 1, reparented: true, destroyed: true };
    } finally {
        if (isValid(host)) host.destroy();
        inactiveParent.destroy();
        await nextFrame();
    }
}

export async function checkRichTextLifecycle (
    parent: Node, font: TTFFont, capture: (name: string) => Promise<void>,
): Promise<object> {
    const host = new Node('richtext-lifecycle');
    host.layer = parent.layer;
    parent.addChild(host);
    const manual = new Node('application-child');
    host.addChild(manual);
    host.addComponent(UITransform);
    const rich = host.addComponent(RichText);
    rich.string = '';
    rich.font = font;
    rich.fontSize = 24;
    rich.lineHeight = 28;
    const native = sys.isNative;
    const textName = 'RICHTEXT_CHILD';
    const imageName = 'RICHTEXT_Image_CHILD';
    let added = 0;
    let removed = 0;
    host.on(Node.EventType.CHILD_ADDED, () => ++added);
    host.on(Node.EventType.CHILD_REMOVED, () => ++removed);

    const atlas = (await loadAtlas()).addRef();
    const atlasId = atlas.uuid;
    const rows = 8;
    const pairsPerRow = 8;
    const expected = rows * pairsPerRow * 2;
    const grid = (image: string): string => Array(rows).fill(
        '<color=#ff0000>I</color>'.concat(`<img src="${image}" width=10 height=10/>`).repeat(pairsPerRow),
    ).join('<br/>');
    const first = grid('left');
    const alternate = grid('right');
    const checkpoints: object[] = [];

    const verify = (count: number, enabled: boolean): Node[] => {
        const children = host.children.slice(0, -1);
        if (host.children.length !== count + 1 || host.children[count] !== manual || manual.parent !== host
            || new Set(children).size !== count) {
            throw new Error(`RichText hierarchy has ${host.children.length - 1} of ${count} segments or lost the application child`);
        }
        for (const [index, node] of children.entries()) {
            const image = index % 2 === 1;
            const component = image ? node.getComponent(Sprite) : node.getComponent(Label);
            if (node.name !== (image ? imageName : textName) || node.parent !== host || node.getSiblingIndex() !== index
                || node.active !== enabled || node.activeInHierarchy !== enabled || node.layer !== host.layer
                || Boolean(component) === native || !Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) {
                throw new Error(`RichText segment ${index} wrapper mismatch (${JSON.stringify({
                    name: node.name, parent: node.parent?.name, sibling: node.getSiblingIndex(), active: node.active,
                    activeInHierarchy: node.activeInHierarchy, layer: node.layer, queryable: Boolean(component), enabled,
                })})`);
            }
        }
        return children;
    };
    const sample = async (name: string, count: number, enabled: boolean): Promise<void> => {
        await nextFrame();
        verify(count, enabled);
        await capture(name);
        checkpoints.push({ name, segments: count, visible: enabled && count > 0 });
    };

    try {
        const texture = atlas.getSpriteFrame('left')?.texture;
        if (!atlasId || !texture || atlas.getSpriteFrame('right')?.texture !== texture || assetManager.assets.get(atlasId) !== atlas) {
            throw new Error('RichText did not load the serialized TexturePacker atlas');
        }
        // The two source frames share an unpadded edge. Point sampling provides the same source pixels on both backends.
        texture.setFilters(gfx.Filter.POINT, gfx.Filter.POINT);
        rich.imageAtlas = atlas;
        rich.string = first;
        await sample('richtext-lifecycle-grid', expected, true);
        const prior = verify(expected, true);
        rich.enabled = false;
        await sample('richtext-lifecycle-disabled', expected, false);
        rich.enabled = true;
        await nextFrame();
        if (verify(expected, true).some((node, index) => node !== prior[index])) throw new Error('Re-enabling replaced the RichText children');

        const originalLayer = host.layer;
        const layerChanges: number[] = [];
        host.once(Node.EventType.LAYER_CHANGED, (layer: number) => layerChanges.push(layer));
        host.layer = 1;
        host.layer = 1;
        await nextFrame();
        verify(expected, true);
        host.on(Node.EventType.LAYER_CHANGED, (layer: number) => layerChanges.push(layer));
        host.layer = originalLayer;
        host.layer = originalLayer;
        await nextFrame();
        verify(expected, true);
        if (layerChanges.length !== 2 || layerChanges[0] !== 1 || layerChanges[1] !== originalLayer) {
            throw new Error(`Unexpected RichText host layer events: ${layerChanges}`);
        }
        const cycles = 32;
        for (let i = 0; i < cycles; ++i) {
            rich.string = '';
            verify(0, true);
            rich.string = i % 2 ? alternate : first;
            verify(expected, true);
            if (i % 8 === 7) await nextFrame();
        }
        if (prior.some(node => node.parent && node.parent !== host)) throw new Error('RichText reparented a retired segment outside the host');
        await sample('richtext-lifecycle-rebuilt', expected, true);

        const current = verify(expected, true);
        rich.destroy();
        await nextFrame();
        if (isValid(rich) || current.some(node => node.parent) || added !== removed || added < expected * (cycles + 1)) {
            throw new Error(`RichText teardown retained a segment or lost events (${added} added, ${removed} removed)`);
        }
        await sample('richtext-lifecycle-destroyed', 0, false);
        return { rows, pairsPerRow, cycles, checkpoints, layerChanges, ownerReleased: true, eventPairs: added, atlasId };
    } finally {
        host.destroy();
        atlas.decRef();
        for (let frame = 0; frame < 8 && isValid(atlas); ++frame) await nextFrame();
        if (isValid(atlas) || assetManager.assets.has(atlasId)) throw new Error('RichText atlas stayed cached after its final owner was released');
    }
}
