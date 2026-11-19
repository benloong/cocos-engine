// Installed in the generated application entry before application.init().
function installGraphicsMetrics(cc, output) {
    const {director, DirectorEvent, Node, UITransform, Sprite, Mask, Graphics, Texture2D, SpriteFrame} = cc;
    const isNative = cc.sys.isNative;
    const nextFrame = () => new Promise(resolve => director.once(DirectorEvent.END_FRAME, resolve));
    director.once(DirectorEvent.BEFORE_SCENE_LAUNCH, scene => {
        const probe = scene.getComponentInChildren(cc.js.getClassByName('M6GraphicsGpuProbe'));
        probe.enabled = false;
        director.once(DirectorEvent.AFTER_SCENE_LAUNCH, () => run(probe.node).catch(e => console.error('M6_GPU_FAIL ' + e.stack)));
    });

    async function run(canvas) {
        const device = director.root.device;
        let read;
        if (isNative) {
            read = () => jsb.readGraphicsMetrics().split(',').map(Number);
        } else {
            let frames = 0, batches = 0, ns = 0, bytes = 0;
            const batcher = director.root.batcher2D;
            const update = batcher.update;
            batcher.update = function () {
                const start = performance.now();
                update.call(this);
                ns += (performance.now() - start) * 1e6;
                batches += this.batches.length;
                frames++;
            };
            for (const method of ['copyBuffersToTexture', 'copyTexImagesToTexture']) {
                const upload = device[method];
                device[method] = function (sources, texture, regions) {
                    const result = upload.call(this, sources, texture, regions);
                    for (const r of regions) {
                        const {width, height, depth} = r.texExtent;
                        bytes += cc.gfx.FormatSize(texture.format, width, height, depth) * r.texSubres.layerCount;
                    }
                    return result;
                };
            }
            read = () => {
                const values = [frames, batches, ns, bytes];
                frames = batches = ns = bytes = 0;
                return values;
            };
        }
        const rt = new cc.RenderTexture();
        rt.reset({width:256, height:256});
        const camera = canvas.getComponent(cc.Canvas).cameraComponent;
        camera.targetTexture = rt;
        camera.orthoHeight = 128;
        camera.clearColor = new cc.Color(0, 0, 0, 255);
        camera.clearFlags = 7;
        const texture = new Texture2D();
        texture.reset({width:32, height:32, format:Texture2D.PixelFormat.RGBA8888});
        const pixels = new Uint8Array(32 * 32 * 4).fill(255);
        texture.uploadData(pixels);
        const frame = new SpriteFrame();
        frame.texture = texture;
        frame.packable = false;
        for (let i = 0; i < 8; ++i) await nextFrame();
        rt.readPixels();
        read();
        texture.uploadData(pixels);
        await nextFrame();
        rt.readPixels();
        const controlBytes = read()[3];
        if (controlBytes !== pixels.length) throw Error('Unexpected RGBA8 control upload: ' + controlBytes);
        function node(parent) {
            const child = new Node();
            child.layer = canvas.layer;
            parent.addChild(child);
            child.addComponent(UITransform).setContentSize(80, 80);
            return child;
        }
        function makeCase(root, name) {
            if (name === 'empty') return () => {};
            if (name.startsWith('graphics-')) {
                const split = name === 'graphics-32-components';
                const groups = split ? Array.from({length:32}, () => node(root).addComponent(Graphics)) : [root.addComponent(Graphics)];
                return on => {
                    for (const g of groups) { g.clear(); g.fillColor = on ? cc.Color.GREEN : cc.Color.RED; }
                    for (let i = 0; i < 32; ++i) groups[split ? i : 0].rect((i % 8 - 4) * 12, (Math.floor(i / 8) - 2) * 12, 8, 8);
                    for (const g of groups) g.fill();
                };
            }
            const mask = root.addComponent(Mask);
            if (name === 'sprite-mask') {
                mask.type = Mask.Type.SPRITE_STENCIL;
                if (isNative) mask.spriteFrame = frame;
                else { mask.subComp.sizeMode = Sprite.SizeMode.CUSTOM; mask.subComp.spriteFrame = frame; }
            } else if (name === 'ellipse-mask') mask.type = Mask.Type.GRAPHICS_ELLIPSE;
            let parent = root;
            if (name === 'nested-mask') {
                parent = node(root);
                parent.getComponent(UITransform).setContentSize(60, 60);
                parent.addComponent(Mask);
            }
            const child = node(parent);
            child.getComponent(UITransform).setContentSize(120, 120);
            const sprite = child.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = frame;
            return on => { mask.inverted = on; };
        }
        const groups = [];
        const names = ['empty','graphics-one-component','graphics-32-components','rect-mask','ellipse-mask','sprite-mask','nested-mask'];
        for (let trial = 0; trial < 3; trial++) {
            for (const name of trial % 2 ? names.slice().reverse() : names) {
                let root, change;
                for (const phase of ['setup','steady','dirty']) {
                    if (phase === 'steady') for (let i = 0; i < 8; i++) await nextFrame();
                    rt.readPixels();
                    read();
                    let draws = 0, triangles = 0, editMs = 0;
                    const windowFrames = phase === 'setup' ? 1 : 48;
                    for (let i = 0; i < windowFrames; i++) {
                        if (phase === 'setup') {
                            const start = performance.now();
                            root = node(canvas);
                            change = makeCase(root, name);
                            change(false);
                            editMs += performance.now() - start;
                        } else if (phase === 'dirty') {
                            const start = performance.now();
                            change(i % 2 === 0);
                            editMs += performance.now() - start;
                        }
                        await nextFrame();
                        if (!isNative && i + 1 < windowFrames) {
                            draws += device.numDrawCalls;
                            triangles += device.numTris;
                        }
                    }
                    const image = rt.readPixels();
                    const [frames, batches, batchNs, uploadBytes, submittedDraws, submittedTriangles] = read();
                    if (isNative) {
                        draws = submittedDraws;
                        triangles = submittedTriangles;
                    } else {
                        draws += device.numDrawCalls;
                        triangles += device.numTris;
                    }
                    if (!image || frames !== windowFrames || batchNs < 0) throw Error(name + ' invalid frame window: ' + frames);
                    let colored = 0;
                    for (let p = 0; p < image.length; p += 4) if (image[p] || image[p+1] || image[p+2]) colored++;
                    if (name === 'empty' ? colored !== 0 : colored === 0) throw Error(name + ' unexpected image area: ' + colored);
                    groups.push({trial, name, phase, frames, batches, draws, triangles, editMs, batchNs, uploadBytes, colored});
                }
                root.destroy();
                await nextFrame(); await nextFrame();
            }
        }
        const result = {backend:isNative ? 'native' : 'web', captures:[], renderer:device.renderer, controlBytes, groups};
        if (isNative) {
            if (!cc.native.fileUtils.writeStringToFile(JSON.stringify(result), output)) throw Error('Could not save metrics');
        } else {
            const response = await fetch('/m6-result', {method:'POST', body:JSON.stringify(result)});
            if (!response.ok) throw Error('Metrics collector failed');
        }
    }
}
