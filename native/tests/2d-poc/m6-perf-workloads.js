// Installed in the generated app entry before application.init, on both backends.
function installM6Perf (cc, output, textWidthProbe = false) {
    const { director, DirectorEvent: E, Node, UITransform, Texture2D, SpriteFrame, Sprite, Mask, RichText, Label } = cc;
    const native = cc.sys.isNative;
    const nextFrame = () => new Promise(resolve => director.once(E.END_FRAME, resolve));
    director.once(E.BEFORE_SCENE_LAUNCH, scene => {
        const probe = scene.getComponentInChildren(cc.js.getClassByName('M6GraphicsGpuProbe'));
        if (!probe) throw new Error('Missing benchmark scene');
        probe.enabled = false;
        director.once(E.AFTER_SCENE_LAUNCH, () => run(probe.node).catch(error => console.error('M6_GPU_FAIL ' + error.stack)));
    });

    async function run (canvas) {
        const texture = new Texture2D();
        texture.reset({ width: 8, height: 8, format: Texture2D.PixelFormat.RGBA8888 });
        const white = new Uint8Array(256); white.fill(255); texture.uploadData(white);
        const frame = new SpriteFrame(); frame.texture = texture; frame.packable = false;
        const make = (parent, index) => {
            const node = new Node(); node.layer = canvas.layer; parent.addChild(node);
            node.addComponent(UITransform).setContentSize(8, 8);
            node.setPosition((index % 40 - 20) * 8, (Math.floor(index / 40) % 30 - 15) * 8);
            return node;
        };
        const sprite = node => {
            const item = node.addComponent(Sprite); item.sizeMode = Sprite.SizeMode.CUSTOM; item.spriteFrame = frame;
            return item;
        };
        const gray = new cc.Color(144, 144, 144, 255);
        const counts = { empty: [0,0,0,0], sprites: [1000,0,0,0], labels: [0,200,0,0],
            masks: [0,0,50,0], rich: [0,0,0,40], mixed: [1000,200,50,40] };
        const cases = [];
        for (const [name, count] of Object.entries(counts)) {
            const root = make(canvas, 0); root.setPosition(0, 0);
            const mutate = [];
            for (let i = 0; i < count[0]; i++) {
                const item = sprite(make(root, i));
                mutate.push(on => { item.color = on ? gray : cc.Color.WHITE; });
            }
            for (let i = 0; i < count[1]; i++) {
                const item = make(root, i).addComponent(Label); item.fontSize = 14; item.lineHeight = 16; item.string = 'AB';
                mutate.push(on => { item.string = on ? 'CD' : 'AB'; });
            }
            for (let i = 0; i < count[2]; i++) {
                const node = make(root, i); const mask = node.addComponent(Mask);
                sprite(make(node, 0)).node.setPosition(0, 0);
                mutate.push(on => { mask.inverted = on; });
            }
            for (let i = 0; i < count[3]; i++) {
                const item = make(root, i).addComponent(RichText); item.fontSize = 14; item.lineHeight = 16;
                item.string = '<b>AB</b>';
                mutate.push(on => { item.string = on ? '<i>CD</i>' : '<b>AB</b>'; });
            }
            for (let i = 0; i < 30; i++) await nextFrame();
            const gc = native ? () => cc.sys.garbageCollect() : () => globalThis.gc();
            gc();
            for (const phase of ['steady', 'dirty']) {
                const samples = [];
                const stages = [];
                const ttfStages = [];
                let setterMs = 0, index = 0;
                const change = () => {
                    const start = performance.now();
                    if (phase === 'dirty') {
                        const on = (Math.floor(index / 10) & 1) === 0;
                        for (let i = index % 10; i < mutate.length; i += 10) mutate[i](on);
                    }
                    setterMs = performance.now() - start;
                    index++;
                };
                director.on(E.BEFORE_DRAW, change);
                if (native) jsb.readM6Perf();
                for (let i = 0; i < 120; i++) {
                    await nextFrame();
                    const counters = native ? jsb.readM6Perf().split(',').map(Number)
                        : [globalThis.__m6BatchMs * 1e6, 0, performance.memory.usedJSHeapSize];
                    const [ns, bindings, heap] = counters;
                    if (counters.length > 3) ttfStages.push(counters.slice(3));
                    if (![ns, bindings, heap, globalThis.__m6PrepareMs].every(Number.isFinite) || !heap) throw new Error('Invalid timing or heap sample');
                    samples.push([setterMs + globalThis.__m6PrepareMs + ns / 1e6, bindings, heap]);
                    stages.push([setterMs, globalThis.__m6PrepareMs, ns / 1e6]);
                }
                director.off(E.BEFORE_DRAW, change);
                const gcTrace = native && typeof jsb.traceM6Gc === 'function' ? JSON.parse(jsb.traceM6Gc()) : null;
                const start = performance.now();
                if (!gcTrace) gc();
                const forcedGcMs = gcTrace ? gcTrace.wallMs : performance.now() - start;
                cases.push({ name, phase, count, samples, stages, forcedGcMs, ...(gcTrace ? { gcTrace } : {}),
                    ...(ttfStages.length ? { ttfStages } : {}) });
                console.log('M6_PERF_PHASE ' + name + '/' + phase);
            }
            root.destroy(); await nextFrame(); await nextFrame(); gc();
        }
        const result = { backend: native ? 'native' : 'web', captures: [], cases, os: cc.sys.os,
            renderer: director.root.device.renderer, vendor: director.root.device.vendor };
        if (textWidthProbe) {
            const node = make(canvas, 0);
            const label = node.addComponent(Label);
            label.fontFamily = 'Arial';
            label.fontSize = 20;
            label.lineHeight = 25;
            result.textWidth = [];
            for (const alignment of [0, 1, 2]) {
                label.horizontalAlign = alignment;
                label.verticalAlign = alignment;
                for (const text of ['AB', 'Wide line\ni', 'Café 文']) {
                    label.overflow = Label.Overflow.CLAMP;
                    node.getComponent(UITransform).setContentSize(160, 80);
                    label.string = text;
                    label.updateRenderData(true);
                    const tex = label.ttfSpriteFrame.texture;
                    const region = new cc.gfx.BufferTextureCopy();
                    region.texExtent.width = tex.width;
                    region.texExtent.height = tex.height;
                    const bytes = new Uint8Array(tex.width * tex.height * 4);
                    director.root.device.copyTextureToBuffers(tex.getGFXTexture(), [bytes], [region]);
                    if (!bytes.some((value, i) => i % 4 === 3 && value > 128)) throw new Error('Empty system-font raster');
                    const index = result.textWidth.length;
                    if (!cc.native.fileUtils.writeDataToFile(bytes.buffer, output + '-' + index + '.rgba')) throw new Error('Could not save system-font raster');
                    result.textWidth.push({ alignment, text, width: tex.width, height: tex.height });
                }
            }
            node.destroy();
        }
        if (native) {
            if (!cc.native.fileUtils.writeStringToFile(JSON.stringify(result), output)) throw new Error('Could not save benchmark');
        } else {
            const response = await fetch('/m6-result', { method: 'POST', body: JSON.stringify(result) });
            if (!response.ok) throw new Error('Could not post benchmark');
        }
        console.log('M6_PERF_DONE');
    }
}
