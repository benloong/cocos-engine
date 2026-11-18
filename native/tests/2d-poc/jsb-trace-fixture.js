/* Installed by the trace runner before application.init(), in the instrumented app only. */
function installM6JsbTrace (cc, fontPath) {
    const { director, DirectorEvent, Node, UITransform, SpriteFrame, Sprite, Texture2D, Label, Graphics, Mask } = cc;
    director.once(DirectorEvent.BEFORE_SCENE_LAUNCH, scene => {
        const fixture = scene.getComponentInChildren(cc.js.getClassByName('M6GraphicsGpuProbe'));
        if (!fixture) throw new Error('Expected the graphics GPU fixture scene');
        fixture.enabled = false;
        director.once(DirectorEvent.AFTER_SCENE_LAUNCH, () => {
            run(fixture.node).catch(error => console.error('M6_TRACE_FAIL ' + (error.stack || error)));
        });
    });

    function frames (count) {
        return new Promise(resolve => {
            function tick () {
                if (--count === 0) resolve();
                else director.once(DirectorEvent.END_FRAME, tick);
            }
            director.once(DirectorEvent.END_FRAME, tick);
        });
    }

    async function run (canvas) {
        if (typeof jsb.clearInvocationRecords !== 'function') throw new Error('Build with RECORD_JSB_INVOKING');
        const texture = new Texture2D();
        texture.reset({ width: 16, height: 16, format: Texture2D.PixelFormat.RGBA8888 });
        texture.uploadData(new Uint8Array(16 * 16 * 4).fill(255));
        const frame = new SpriteFrame();
        frame.texture = texture;
        frame.packable = false;
        const atlas = new cc.SpriteAtlas();
        atlas.spriteFrames.icon = frame;
        const ttf = await new Promise((resolve, reject) => cc.assetManager.loadRemote(fontPath, { ext: '.ttf' },
            (err, asset) => err ? reject(err) : resolve(asset)));
        function bitmap (Type) {
            const font = new Type();
            font.spriteFrame = frame;
            font.fontSize = 16;
            font.fntConfig = { fontSize: 16, commonHeight: 16, atlasName: 'trace', kerningDict: {},
                fontDefDictionary: { 65: { rect: { x: 0, y: 0, width: 16, height: 16 }, xOffset: 0, yOffset: 0, xAdvance: 16 } } };
            font.onLoaded();
            return font;
        }
        const bm = bitmap(cc.BitmapFont);
        const labelAtlas = bitmap(cc.LabelAtlas);
        function sprite (node) {
            const component = node.addComponent(Sprite);
            component.spriteFrame = frame;
            return component;
        }
        function label (node, font) {
            const component = node.addComponent(Label);
            if (font) component.font = font;
            component.string = 'AAA';
            return component;
        }
        function child (node) {
            const item = new Node();
            item.layer = canvas.layer;
            node.addChild(item);
            item.addComponent(UITransform);
            return item;
        }
        const cases = [
            ['Canvas', () => {}],
            ['UITransform', node => node.getComponent(UITransform).setContentSize(64, 64)],
            ['RenderRoot2D', node => { node.addComponent(cc.RenderRoot2D); sprite(child(node)); }],
            ['UIOpacity', node => { node.addComponent(cc.UIOpacity).opacity = 192; sprite(child(node)); }],
            ['UIRenderer-Sprite-SpriteFrame', node => sprite(node)],
            ['Label', node => label(node)],
            ['LabelOutline', node => { label(node); node.addComponent(cc.LabelOutline); }],
            ['LabelShadow', node => { label(node); node.addComponent(cc.LabelShadow); }],
            ['Font-TTFFont', node => label(node, ttf)],
            ['BitmapFont', node => label(node, bm)],
            ['LabelAtlas', node => label(node, labelAtlas)],
            ['Graphics', node => node.addComponent(Graphics).fillRect(-16, -16, 32, 32)],
            ['Mask', node => { node.addComponent(Mask); sprite(child(node)); }],
            ['RichText-SpriteAtlas', node => {
                const rich = node.addComponent(cc.RichText);
                rich.imageAtlas = atlas;
                rich.string = "<b>Text</b><img src='icon'/>";
            }],
        ];
        for (const [name, setup] of cases) {
            const node = child(canvas);
            console.log('M6_TRACE_BEGIN setup ' + name);
            jsb.clearInvocationRecords();
            setup(node);
            jsb.printInvocationRecords();
            await frames(12);
            console.log('M6_TRACE_BEGIN steady ' + name);
            jsb.clearInvocationRecords();
            await frames(60);
            jsb.printInvocationRecords();
            console.log('M6_TRACE_BEGIN explicit ' + name);
            jsb.clearInvocationRecords();
            frame.getRectWidth();
            jsb.printInvocationRecords();
            node.destroy();
            await frames(3);
        }
        for (const asset of [bm, labelAtlas, atlas, frame, texture]) asset.destroy();
        cc.assetManager.releaseAsset(ttf);
        console.log('M6_TRACE_DONE ' + cases.length);
    }
}
