import { assetManager, Director, director, gfx, isValid, Label, Node, resources, RichText, Sprite, SpriteAtlas, sys, TTFFont, UITransform } from 'cc';

const nextFrame = (): Promise<void> => new Promise(resolve => director.once(Director.EVENT_AFTER_DRAW, resolve));
const atlasPath = 'M6StaticAtlas/colors';
const loadAtlas = (): Promise<SpriteAtlas> => new Promise((resolve, reject) => {
    resources.load(atlasPath, SpriteAtlas, (error, asset) => error ? reject(error) : resolve(asset!));
});

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
    const native = sys.isNative && !(globalThis as { __m6JsRichText?: boolean }).__m6JsRichText;
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
