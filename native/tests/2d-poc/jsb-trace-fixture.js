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
        // Setup returns one synchronous edit. Resolve component references outside the setter window.
        const cases = [
            ['Canvas', () => () => {}],
            ['UITransform', node => {
                const transform = node.getComponent(UITransform);
                transform.setContentSize(64, 64);
                return () => transform.setContentSize(96, 64);
            }],
            ['RenderRoot2D', node => {
                node.addComponent(cc.RenderRoot2D);
                sprite(child(node));
                return () => node.setPosition(3, 0, 0);
            }],
            ['UIOpacity', node => {
                const opacity = node.addComponent(cc.UIOpacity);
                opacity.opacity = 192;
                sprite(child(node));
                return () => { opacity.opacity = 96; };
            }],
            ['UIRenderer-Sprite-SpriteFrame', node => {
                const item = sprite(node);
                const tint = new cc.Color(80, 160, 240, 255);
                return () => { item.color = tint; };
            }],
            ['Label', node => {
                const item = label(node);
                return () => { item.string = 'AA'; };
            }],
            ['LabelOutline', node => {
                label(node);
                const outline = node.addComponent(cc.LabelOutline);
                return () => { outline.width = 4; };
            }],
            ['LabelShadow', node => {
                label(node);
                const shadow = node.addComponent(cc.LabelShadow);
                return () => { shadow.blur = 3; };
            }],
            ['Font-TTFFont', node => {
                const item = label(node, ttf);
                return () => { item.font = null; };
            }],
            ['BitmapFont', node => {
                label(node, bm);
                return () => { bm.fontSize = 20; };
            }],
            ['LabelAtlas', node => {
                label(node, labelAtlas);
                return () => { labelAtlas.fontSize = 20; };
            }],
            ['Graphics', node => {
                const graphics = node.addComponent(Graphics);
                graphics.fillRect(-16, -16, 32, 32);
                return () => graphics.fillRect(0, 0, 4, 4);
            }],
            ['Mask', node => {
                const mask = node.addComponent(Mask);
                sprite(child(node));
                return () => { mask.inverted = true; };
            }],
            ['RichText-SpriteAtlas', node => {
                const rich = node.addComponent(cc.RichText);
                rich.imageAtlas = atlas;
                rich.string = "<b>Text</b><img src='icon'/>";
                return () => { rich.string = "<i>Edited</i><img src='icon'/>"; };
            }],
        ];
        for (const [name, setup] of cases) {
            const node = child(canvas);
            const begin = phase => {
                console.log('M6_TRACE_BEGIN ' + phase + ' ' + name);
                jsb.clearInvocationRecords();
            };
            begin('setup');
            const edit = setup(node);
            jsb.printInvocationRecords();
            await frames(12);
            begin('steady');
            await frames(60);
            jsb.printInvocationRecords();
            begin('explicit');
            frame.getRectWidth();
            jsb.printInvocationRecords();
            begin('mutation');
            edit();
            jsb.printInvocationRecords();
            begin('flush');
            await frames(1);
            jsb.printInvocationRecords();
            begin('disable');
            node.active = false;
            jsb.printInvocationRecords();
            begin('enable');
            node.active = true;
            jsb.printInvocationRecords();
            begin('destroy');
            node.destroy();
            await frames(3);
            jsb.printInvocationRecords();
            if (cc.isValid(node)) throw new Error('Deferred destruction incomplete: ' + name);
        }
        const replacement = new Texture2D();
        replacement.reset({ width: 16, height: 16, format: Texture2D.PixelFormat.RGBA8888 });
        const otherFrame = new SpriteFrame();
        otherFrame.texture = replacement;
        const bitmapCase = Type => [
            () => bitmap(Type), asset => { asset.spriteFrame = otherFrame; },
            asset => asset.spriteFrame === otherFrame,
            asset => asset.isReleased() && !asset.spriteFrame,
        ];
        const assetCases = [
            ['Font', () => new cc.Font(), asset => { asset.name = 'Trace Font'; },
                asset => asset.name === 'Trace Font', asset => asset.isReleased()],
            ['TTFFont', () => new cc.TTFFont(), asset => {
                asset._fontFamily = 'Trace TTF';
                asset.loadFontData(fontPath);
            }, asset => asset.getFontDataSize() === 223404 && asset.getSourcePath() === fontPath,
            asset => asset.isReleased() && asset.getFontDataSize() === 0 && !asset.getSourcePath()],
            ['BitmapFont', ...bitmapCase(cc.BitmapFont)],
            ['LabelAtlas', ...bitmapCase(cc.LabelAtlas)],
            ['SpriteFrame', () => {
                const asset = new SpriteFrame();
                asset.texture = texture;
                return asset;
            }, asset => { asset.texture = replacement; }, asset => asset.texture === replacement,
            () => cc.isValid(replacement, true)],
            ['SpriteAtlas', () => {
                const asset = new cc.SpriteAtlas();
                asset.spriteFrames.icon = frame;
                return asset;
            }, asset => { asset.spriteFrames.icon = otherFrame; }, asset => asset.getSpriteFrame('icon') === otherFrame,
            asset => asset.getSpriteFrameCount() === 0 && cc.isValid(otherFrame, true)],
        ];
        for (const [name, create, edit, verifyEdit, verifyRelease] of assetCases) {
            const begin = phase => {
                console.log('M6_TRACE_BEGIN ' + phase + ' Asset-' + name);
                jsb.clearInvocationRecords();
            };
            begin('create');
            const asset = create();
            jsb.printInvocationRecords();
            begin('edit');
            edit(asset);
            jsb.printInvocationRecords();
            if (!verifyEdit(asset)) throw new Error('Asset mutation failed: ' + name);
            begin('release');
            asset.destroy();
            jsb.printInvocationRecords();
            if (cc.isValid(asset, true)) throw new Error('Asset still live after destroy: ' + name);
            begin('drain');
            await frames(3);
            jsb.printInvocationRecords();
            if (cc.isValid(asset) || !verifyRelease(asset)) throw new Error('Asset cleanup failed: ' + name);
        }
        otherFrame.destroy();
        replacement.destroy();
        for (const asset of [bm, labelAtlas, atlas, frame, texture]) asset.destroy();
        cc.assetManager.releaseAsset(ttf);
        console.log('M6_TRACE_DONE ' + (cases.length + assetCases.length));
    }
}
