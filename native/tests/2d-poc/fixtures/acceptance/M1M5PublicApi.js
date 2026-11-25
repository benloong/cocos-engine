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

    function inspectScene() {
        const scene = cc.director.getScene();
        if (!scene?.getComponentInChildren('M1Test')) return;
        cc.director.off(cc.Director.EVENT_AFTER_DRAW, inspectScene);

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
                    host.setPosition(73, -41, 0);
                    const existing = withTransform ? host.addComponent(cc.UITransform) : null;
                    if (existing) existing.setContentSize(120, 60);
                    const mask = host.addComponent(cc.Mask);
                    const transforms = host.getComponents(cc.UITransform);
                    const world = host.worldPosition;
                    const center = mask.isHit(new cc.Vec2(world.x, world.y));
                    const outside = mask.isHit(new cc.Vec2(world.x + 1024, world.y + 1024));
                    const hostTransform = transforms.length === 1 && (!existing || (transforms[0] === existing
                        && existing.width === 120 && existing.height === 60));
                    return { passed: center && !outside && hostTransform, center, outside, hostTransform };
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
