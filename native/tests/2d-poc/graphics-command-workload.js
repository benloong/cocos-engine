function installGraphicsMetrics(cc, output) {
    const {director, DirectorEvent, Graphics, RenderTexture, Canvas} = cc;
    const native = cc.sys.isNative;
    const frame = () => new Promise(resolve => director.once(DirectorEvent.END_FRAME, resolve));
    director.once(DirectorEvent.BEFORE_SCENE_LAUNCH, scene => {
        const fixture = scene.getComponentInChildren(cc.js.getClassByName('M6GraphicsGpuProbe'));
        fixture.enabled = false;
        director.once(DirectorEvent.AFTER_SCENE_LAUNCH, () => run(fixture.node).catch(e => console.error('M6_GPU_FAIL ' + e.stack)));
    });
    async function run(root) {
        const rt = new RenderTexture();
        rt.reset({width:256, height:256});
        const camera = root.getComponent(Canvas).cameraComponent;
        camera.targetTexture = rt;
        camera.orthoHeight = 128;
        camera.clearFlags = 7;
        camera.clearColor = new cc.Color(0,0,0,255);
        const node = new cc.Node();
        node.layer = root.layer;
        root.addChild(node);
        const g = node.addComponent(Graphics);
        g.fillColor = cc.Color.RED;
        const groups = [], captures = [];
        for (const shape of ['rect','path']) for (const count of [1,32,256]) {
            // path encodes one moveTo, three lineTo and one close per rectangle.
            const words = count * (shape === 'rect' ? 5 : 13);
            const commands = count * (shape === 'rect' ? 1 : 5);
            const reusable = native ? new Float64Array(words) : null;
            const results = new Map();
            function draw(mode, shift) {
                g.clear();
                const buffer = mode === 'new-buffer' ? new Float64Array(words) : mode === 'reused-buffer' ? reusable : null;
                let p = 0;
                for (let i = 0; i < count; i++) {
                    const x = (i % 16 - 8) * 12 + shift, y = (Math.floor(i / 16) - 8) * 12;
                    if (shape === 'rect') {
                        if (buffer) {
                            buffer[p++] = 0; buffer[p++] = x; buffer[p++] = y; buffer[p++] = 8; buffer[p++] = 8;
                        } else g.rect(x,y,8,8);
                    } else if (buffer) {
                        buffer[p++] = 1; buffer[p++] = x; buffer[p++] = y;
                        buffer[p++] = 2; buffer[p++] = x+8; buffer[p++] = y;
                        buffer[p++] = 2; buffer[p++] = x+8; buffer[p++] = y+8;
                        buffer[p++] = 2; buffer[p++] = x; buffer[p++] = y+8;
                        buffer[p++] = 3;
                    } else {
                        g.moveTo(x,y); g.lineTo(x+8,y); g.lineTo(x+8,y+8); g.lineTo(x,y+8); g.close();
                    }
                }
                if (buffer) jsb.submitGraphicsCommands(g._native, buffer);
                g.fill();
            }
            const modes = native ? ['direct','new-buffer','reused-buffer'] : ['direct'];
            for (let trial = 0; trial < (native ? 3 : 1); trial++) {
                for (let j = 0; j < modes.length; j++) {
                    const mode = modes[(trial + j) % modes.length];
                    for (let i = 0; i < 4; i++) { draw(mode, i % 2); await frame(); }
                    rt.readPixels();
                    if (native) jsb.readGraphicsMetrics();
                    let cpuNs = 0, allocs = 0, bytes = 0, trackAllocs = false;
                    const frames = native ? 24 : 2;
                    for (let i = 0; i < frames; i++) {
                        if (native) jsb.beginGraphicsCommands();
                        draw(mode, i % 2);
                        if (native) {
                            const sample = jsb.endGraphicsCommands().split(',').map(Number);
                            cpuNs += sample[0];
                            if (sample.length === 3) { trackAllocs = true; allocs += sample[1]; bytes += sample[2]; }
                        }
                        await frame();
                    }
                    const pixels = rt.readPixels();
                    const name = shape + '-' + count;
                    const metrics = native ? jsb.readGraphicsMetrics().split(',').map(Number) : null;
                    if (metrics && (metrics[0] !== frames || metrics[1] !== frames || metrics[4] !== frames || metrics[5] !== 2*count*frames)) throw Error('Unexpected draws: ' + metrics);
                    if (results.has(name)) {
                        const reference = results.get(name);
                        if (pixels.length !== reference.length || pixels.some((v,i) => v !== reference[i])) throw Error('Pixels changed for ' + mode + '/' + name);
                    } else {
                        let colored = 0;
                        for (let i = 0; i < pixels.length; i += 4) if (pixels[i] === 255) colored++;
                        if (colored !== count * 64) throw Error('Incorrect area for ' + name + ': ' + colored);
                        results.set(name, Uint8Array.from(pixels));
                        if (native) {
                            if (!cc.native.fileUtils.writeDataToFile(Uint8Array.from(pixels).buffer, output + '-' + name + '.rgba')) throw Error('Capture write failed');
                        } else {
                            const reply = await fetch('/m6-capture?name=' + name, {method:'POST',body:pixels});
                            if (!reply.ok) throw Error('Capture failed');
                        }
                        captures.push(name);
                    }
                    groups.push({shape,count,mode,trial,frames,cpuNs,metrics,commandCalls:mode === 'direct' ? commands+2 : 3,
                        allocs:trackAllocs ? allocs : null, bytes:trackAllocs ? bytes : null, newBufferBytesPerFrame:mode === 'new-buffer' ? words*8 : 0});
                }
            }
        }
        const result = {backend:native?'native':'web',groups,captures};
        if (native) {
            if (!cc.native.fileUtils.writeStringToFile(JSON.stringify(result),output)) throw Error('Result write failed');
        } else if (!(await fetch('/m6-result',{method:'POST',body:JSON.stringify(result)})).ok) throw Error('Result upload failed');
    }
}
