// Runs in the cocos-cli player. Each case owns its hosts until its assertions finish.
globalThis.installM6Behavior = function install(cc, output) {
    const declared = JSON.parse(jsb.fileUtils.getStringFromFile('m1-m5-public-members.json'));
    const report = { complete: false, passed: false, cases: [], missing: [], unexpected: [] };
    const save = () => jsb.fileUtils.writeStringToFile(JSON.stringify(report, null, 2), output);
    const tests = [];
    const frame = () => new Promise(resolve => cc.director.once(cc.Director.EVENT_AFTER_DRAW, resolve));
    const load = (url, type) => new Promise((resolve, reject) => {
        cc.resources.load(url, type, (err, asset) => err ? reject(err) : resolve(asset));
    });
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const hosts = [];
    function host(type) {
        const node = new cc.Node(type.name);
        cc.director.getScene().addChild(node);
        hosts.push(node);
        if (type !== cc.UITransform) node.addComponent(cc.UITransform);
        return node.addComponent(type);
    }
    const suite = { cc, check, frame, load, host, directory: output.slice(0, output.lastIndexOf('/')), test(owner, members, name, run) {
        tests.push({ owner, members: members.split(' ').filter(Boolean), name, run });
    } };
    require('m6-behavior/public.js'); globalThis.m6PublicContracts(suite);
    require('m6-behavior/resources.js'); globalThis.m6Resources(suite);
    require('m6-behavior/scenes.js'); globalThis.m6SceneLifetimes(suite);
    async function execute() {
        const remaining = new Set(Object.entries(declared).flatMap(([owner, members]) =>
            members.map(m => owner + '.' + (m.isStatic ? '@' : '') + m.key)));
        for (const { owner, members, name, run } of tests) {
            const entry = { owner, members, name, passed: false };
            report.cases.push(entry);
            for (const key of members) {
                if (!remaining.delete(owner + '.' + key)) report.unexpected.push(owner + '.' + key);
            }
            try {
                entry.observed = await run();
                entry.passed = true;
            } catch (error) { entry.error = String(error.stack || error); }
            finally {
                for (const node of hosts.splice(0)) if (cc.isValid(node, true)) node.destroy();
            }
            save();
            await frame();
        }
        report.missing = Array.from(remaining);
        report.complete = true;
        report.passed = !remaining.size && !report.unexpected.length && report.cases.every(c => c.passed);
        save();
        cc.game.end();
    }
    function begin() {
        if (!cc.director.getScene()?.getComponentInChildren('M1Test')) return;
        cc.director.off(cc.Director.EVENT_AFTER_DRAW, begin);
        execute().catch(error => { report.error = String(error.stack || error); save(); cc.game.end(); });
    }
    cc.director.on(cc.Director.EVENT_AFTER_DRAW, begin);
};
