import {
    Color, Component, director, DirectorEvent, Graphics, js, Label, Node,
    RenderTexture, Sprite, SpriteFrame, UIRenderer, UITransform,
} from 'cc';

async function capture (target: RenderTexture): Promise<Uint8Array> {
    // Native submission follows the JS draw event. Read after two complete frames.
    for (let i = 0; i < 2; ++i) {
        await new Promise<void>(resolve => director.once(DirectorEvent.END_FRAME, () => resolve()));
    }
    const data = target.readPixels();
    if (!data) throw new Error('Priority probe could not read the render target');
    return data;
}

function rectangle (node: Node, color: Color, size: number): Graphics {
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = color;
    graphics.rect(-size / 2, -size / 2, size, size);
    graphics.fill();
    return graphics;
}

export async function verifyPriorityOrder (parent: Node, layer: number, target: RenderTexture, redFrame: SpriteFrame): Promise<void> {
    const group = new Node('PriorityOrderProbe');
    group.layer = layer;
    parent.addChild(group);
    const sorting = js.getClassByName('cc.Sorting2D') as typeof Component | undefined;
    // The minimal native test project strips the optional Sorting2D component.
    // In that build, activate the same native queue used by Sorting2D.onEnable.
    if (sorting) {
        group.addComponent(Sprite);
        group.addComponent(sorting);
    } else {
        (globalThis as any).n2d.Batcher2d.setSorting2DCount(1);
    }
    const createNode = (name: string): Node => {
        const node = new Node(name);
        node.active = false;
        node.layer = layer;
        group.addChild(node);
        node.addComponent(UITransform).setContentSize(64, 64);
        return node;
    };
    try {
        for (const kind of ['Sprite', 'Label', 'Graphics']) {
            const subject = createNode(kind);
            let renderer: UIRenderer;
            if (kind === 'Sprite') {
                const sprite = subject.addComponent(Sprite);
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                sprite.spriteFrame = redFrame;
                renderer = sprite;
            } else if (kind === 'Label') {
                const label = subject.addComponent(Label);
                label.fontSize = 48;
                label.lineHeight = 52;
                label.color = new Color(255, 0, 0, 255);
                label.string = 'H';
                renderer = label;
            } else {
                renderer = rectangle(subject, new Color(255, 0, 0, 255), 64);
            }
            renderer.priority = 10;
            subject.active = true;
            const solo = await capture(target);
            const samples: number[] = [];
            for (let i = 0; i < solo.length; i += 4) {
                if (solo[i] > 200 && solo[i + 1] < 20 && solo[i + 2] < 20) samples.push(i);
            }
            // Capture the expected foreground over blue, including antialiased glyph edges.
            const control = createNode('BlueBehind');
            rectangle(control, new Color(0, 0, 255, 255), 160).priority = 1;
            control.active = true;
            const foreground = await capture(target);
            control.active = false;
            control.destroy();

            // Keep the same two active siblings, geometry and materials for all three reads.
            const cover = createNode('BlueCover');
            rectangle(cover, new Color(0, 0, 255, 255), 160).priority = 20;
            cover.active = true;
            const blueSamples = async (): Promise<number> => {
                const data = await capture(target);
                return samples.filter(i => data[i + 2] > 200 && data[i] < 20).length;
            };
            const below = await blueSamples();
            renderer.priority = 30;
            const raised = await capture(target);
            const above = samples.filter(i => foreground[i] > 200
                && raised[i] === foreground[i] && raised[i + 1] === foreground[i + 1]
                && raised[i + 2] === foreground[i + 2] && raised[i + 3] === foreground[i + 3]).length;
            renderer.priority = 10;
            const restored = await blueSamples();
            console.log('NATIVE_PRIORITY_PIXELS ' + JSON.stringify({ kind, samples: samples.length, below, above, restored }));
            subject.active = cover.active = false;
            subject.destroy();
            cover.destroy();
        }
    } finally {
        group.active = false;
        group.destroy();
        if (!sorting) (globalThis as any).n2d.Batcher2d.setSorting2DCount(0);
    }
}
