// Loaded only by the isolated acceptance launcher, before application.start().
globalThis.installM1M5PublicApi = function (cc, output) {
    const checks = [];
    function check(name, test) {
        try {
            checks.push({ name, ...test() });
        } catch (error) {
            checks.push({ name, passed: false, error: String(error.stack || error) });
        }
    }

    // Observe the original M1Test call while its node and camera are still in the fixture state.
    const transform = cc.UITransform.prototype;
    const hitTest = transform.hitTest;
    function observeHit(point, ...args) {
        const result = hitTest.call(this, point, ...args);
        const size = cc.screen.windowSize;
        if (/^M1TestNode(?:-001)?$/.test(this.node.name) && point.x === size.width / 2 && point.y === size.height / 2) {
            transform.hitTest = hitTest;
            check('M1.cameraCenter', () => {
                const world = this.node.worldPosition;
                const camera = cc.director.getScene().getComponentInChildren(cc.Canvas).cameraComponent;
                const savedTarget = camera.targetTexture;
                const savedHeight = camera.orthoHeight;
                // M2 temporarily uses the canvas camera to read a 256x256 RenderTexture.
                // Exercise the M1 screen point against the window, then restore M2's state.
                try {
                    if (savedTarget) camera.targetTexture = null;
                    camera.camera.update(true);
                    const projected = camera.worldToScreen(world);
                    const center = hitTest.call(this, point, ...args);
                    const outside = hitTest.call(this, new cc.Vec2(10, 10), ...args);
                    check('M1.activeWindow', () => {
                        const windowId = camera.camera.systemWindowId;
                        const center = hitTest.call(this, point, windowId);
                        const outside = hitTest.call(this, new cc.Vec2(10, 10), windowId);
                        const otherWindow = hitTest.call(this, point, windowId === 0 ? 1 : 0);
                        return { passed: center && !outside && !otherWindow, windowId, center, outside, otherWindow };
                    });
                    return { passed: center && !outside && (!savedTarget || !result), center, outside,
                        before: { offscreen: !!savedTarget, hit: result }, point: [point.x, point.y],
                        projected: [projected.x, projected.y], windowId: camera.camera.systemWindowId,
                        world: [world.x, world.y] };
                } finally {
                    if (savedTarget) {
                        camera.targetTexture = savedTarget;
                        camera.orthoHeight = savedHeight;
                        camera.camera.update(true);
                    }
                }
            });
        }
        return result;
    }
    transform.hitTest = observeHit;

    let frames = 0;
    function inspectScene() {
        const scene = cc.director.getScene();
        if (!scene || (!checks.length && ++frames < 120)) return;
        cc.director.off(cc.Director.EVENT_AFTER_DRAW, inspectScene);
        transform.hitTest = hitTest;
        if (!checks.length) checks.push({ name: 'M1.cameraCenter', passed: false, error: 'Missing M1Test center call' });

        check('publicMembers', () => {
            const declared = JSON.parse(jsb.fileUtils.getStringFromFile('m1-m5-public-members.json'));
            const assets = new Set(['Font', 'TTFFont', 'BitmapFont', 'LabelAtlas', 'SpriteAtlas', 'SpriteFrame']);
            const missing = [];
            let count = 0;
            for (const [name, members] of Object.entries(declared)) {
                const host = assets.has(name) ? null : new cc.Node(name);
                let instance;
                try {
                    if (host) {
                        scene.addChild(host);
                        const transform = host.addComponent(cc.UITransform);
                        instance = name === 'UITransform' ? transform : host.addComponent(name === 'UIRenderer' ? cc.Sprite : cc[name]);
                    } else {
                        instance = new cc[name]();
                    }
                    for (const member of members) {
                        count++;
                        if (!(member.key in (member.isStatic ? cc[name] : instance))) missing.push(name + '.' + member.key);
                    }
                } finally {
                    if (host) host.destroy();
                    else if (instance) instance.destroy();
                }
            }
            return { passed: !missing.length, classes: Object.keys(declared).length, count, missing };
        });

        for (const name of ['Sprite', 'Label', 'Graphics']) {
            check(name + '.priority', () => {
                const host = new cc.Node(name);
                host.active = false;
                scene.addChild(host);
                host.addComponent(cc.UITransform);
                const component = host.addComponent(cc[name]);
                const proto = n2d[name].prototype;
                const descriptor = Object.getOwnPropertyDescriptor(proto, 'setPriority');
                const original = proto.setPriority;
                const calls = [];
                Object.defineProperty(proto, 'setPriority', { configurable: true, writable: true, value(value) {
                    calls.push({ receiver: this, value });
                    return original.call(this, value);
                } });
                try {
                    component.priority = 3;
                    host.active = true;
                    const values = () => calls.filter(call => call.receiver === component._native).map(call => call.value);
                    const initial = values();
                    calls.length = 0;
                    component.priority = 100;
                    const updated = values();
                    return { passed: initial.includes(3) && component.priority === 100 && updated.includes(100),
                        initial, updated, publicValue: component.priority };
                } finally {
                    if (descriptor) Object.defineProperty(proto, 'setPriority', descriptor);
                    else delete proto.setPriority;
                    host.destroy();
                }
            });
        }

        for (const withTransform of [false, true]) {
            check('Mask.isHit.' + (withTransform ? 'control' : 'bare'), () => {
                const host = new cc.Node('mask');
                scene.addChild(host);
                try {
                    if (withTransform) host.addComponent(cc.UITransform).setContentSize(100, 100);
                    const mask = host.addComponent(cc.Mask);
                    const world = host.worldPosition;
                    const center = mask.isHit(new cc.Vec2(world.x, world.y));
                    const outside = mask.isHit(new cc.Vec2(world.x + 1024, world.y + 1024));
                    return { passed: center && !outside, center, outside, hostTransform: !!host.getComponent(cc.UITransform) };
                } finally { host.destroy(); }
            });
        }

        check('Graphics.impl', () => {
            const host = new cc.Node('graphics');
            scene.addChild(host);
            try {
                const graphics = host.addComponent(cc.Graphics);
                return { passed: 'impl' in graphics && (graphics.impl === null || typeof graphics.impl === 'object'),
                    valueType: typeof graphics.impl };
            } finally { host.destroy(); }
        });
        jsb.fileUtils.writeStringToFile(JSON.stringify(checks, null, 2), output);
        cc.game.end();
    }
    cc.director.on(cc.Director.EVENT_AFTER_DRAW, inspectScene);
};
