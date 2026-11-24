module.exports = async function checkLabelInheritedMethods(cc) {
    const node = new cc.Node('blend-owner');
    const sibling = new cc.Node('blend-observer');
    const scene = cc.director.getScene();
    scene.addChild(node);
    scene.addChild(sibling);
    try {
        const label = node.addComponent(cc.Label);
        const observer = sibling.addComponent(cc.Label);
        const shared = label.getSharedMaterial(0);
        if (!shared || observer.getSharedMaterial(0) !== shared) throw new Error('Expected shared Label material');
        const proto = cc.Label.prototype;
        for (const name of ['_onPreDestroy', '_updateBlendFunc']) {
            if (Object.hasOwnProperty.call(proto, name) || typeof label[name] !== 'function') {
                throw new Error('Expected inherited Label method ' + name);
            }
        }
        const target = shared.passes[0].blendState.targets[0];
        const original = target.blendSrc;
        const changed = original === cc.gfx.BlendFactor.ONE ? cc.gfx.BlendFactor.SRC_ALPHA : cc.gfx.BlendFactor.ONE;
        label.srcBlendFactor = changed;
        label._updateBlendFunc();
        const instance = label.getRenderMaterial(0);
        if (instance === shared || instance.passes[0].blendState.targets[0].blendSrc !== changed) {
            throw new Error('Label blend change did not isolate the material');
        }
        label._updateBlendFunc();
        if (label.getRenderMaterial(0) !== instance) throw new Error('Repeated update replaced the material');
        let destroyed = 0;
        label._onPreDestroy = function () {
            ++destroyed;
            return proto._onPreDestroy.call(this);
        };
        node.destroy();
        await new Promise(resolve => cc.director.once(cc.Director.EVENT_AFTER_DRAW, resolve));
        if (destroyed !== 1 || cc.isValid(label) || label.ttfSpriteFrame || !cc.isValid(observer)
            || observer.getSharedMaterial(0) !== shared || target.blendSrc !== original) {
            throw new Error('Label destruction or sibling material isolation failed');
        }
        return { inheritedMethods: 2, preDestroyCalls: destroyed, sharedSource: original, instanceSource: changed };
    } finally {
        if (cc.isValid(node, true)) node.destroy();
        sibling.destroy();
    }
};
