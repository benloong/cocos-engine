globalThis.m6SceneLifetimes = function ({ cc, test, check, load, frame }) {
    async function switchScene(name) {
        const next = new cc.Scene(name);
        const root = new cc.Node('RenderRoot');
        next.addChild(root);
        root.addComponent(cc.RenderRoot2D);
        const launched = new Promise(resolve => cc.director.once(cc.Director.EVENT_AFTER_SCENE_LAUNCH, resolve));
        cc.director.runSceneImmediate(next);
        check(await launched === next && cc.director.getScene() === next, 'scene launch ' + name);
        await frame();
        return next;
    }
    test('SpriteAtlas', '', 'balance persistent node and dynamic scene asset references', async () => {
        await switchScene('M6 baseline');
        const atlas = (await load('M6StaticAtlas/colors', cc.SpriteAtlas)).addRef();
        const baseline = atlas.refCount;
        const host = new cc.Node('persistently referenced atlas');
        cc.director.getScene().addChild(host);
        host.addComponent(cc.Sprite).spriteAtlas = atlas;
        const counts = [];
        try {
            cc.director.addPersistRootNode(host);
            counts.push(atlas.refCount - baseline);
            await switchScene('M6 first owner');
            counts.push(atlas.refCount - baseline);
            await switchScene('M6 second owner');
            counts.push(atlas.refCount - baseline);
            cc.director.removePersistRootNode(host);
            counts.push(atlas.refCount - baseline);
            await switchScene('M6 released');
            counts.push(atlas.refCount - baseline);
            check(counts.join() === '1,2,2,1,0', 'scene refCount deltas ' + counts);
            return { counts };
        } finally {
            if (cc.isValid(host,true)) { cc.director.removePersistRootNode(host); host.destroy(); }
            atlas.decRef();
        }
    });
    test('RichText', '', 'retained, pooled and collected segment wrappers across scene launches', async () => {
        const atlas = (await load('M6StaticAtlas/colors', cc.SpriteAtlas)).addRef();
        const content = '<b>one</b><img src="left" width=8 height=8/>';
        function create(parent) {
            const n = new cc.Node('rich owner');
            parent.addChild(n);
            const r = n.addComponent(cc.RichText);
            r.imageAtlas = atlas;
            r.string = content;
            check(n.children.length === 2, 'expected label and image wrappers');
            return r;
        }
        function retire(r) {
            const refs = r.node.children.map(n => ({ id: n.uuid, weak: new WeakRef(n) }));
            r.string = '';
            return refs;
        }
        const persistent = create(cc.director.getScene());
        const root = persistent.node;
        cc.director.addPersistRootNode(root);
        const retained = root.children.slice();
        const ids = retained.map(n => n.uuid);
        const collected = [];
        let transitions = 0, destroyed = 0, layerChanges = 0;
        try {
            for (let round = 0; round < 3; round++) {
                const old = cc.director.getScene();
                const temporary = create(old), oldHost = temporary.node;
                const retiring = oldHost.children.slice();
                for (const n of retiring) n.once(cc.Node.EventType.NODE_DESTROYED, () => ++destroyed);
                // Keep both attached and pooled strong wrappers from an owner which will be destroyed.
                if (round % 2 === 0) temporary.string = '';
                const scene = await switchScene('M6 wrappers ' + round);
                await frame();
                check(!cc.isValid(old) && !cc.isValid(oldHost) && retiring.every(n => !cc.isValid(n))
                    && destroyed === 2 * (round + 1), 'retired owner/wrapper destruction: ' + destroyed);
                check(root.scene === scene && root.children.length === 2 && root.children.every((n,i) => n === retained[i] && n.uuid === ids[i]
                    && n.parent === root && n.scene === scene && n.activeInHierarchy), 'persistent wrapper hierarchy');
                const layer = root.layer;
                retained[0].once(cc.Node.EventType.LAYER_CHANGED, () => ++layerChanges);
                let control = 0;
                const observed = () => ++control;
                retained[1].on(cc.Node.EventType.LAYER_CHANGED, observed);
                root.layer = layer === 1 ? 2 : 1;
                await frame();
                retained[1].off(cc.Node.EventType.LAYER_CHANGED, observed);
                check(layerChanges === round + 1 && control === 1, 'layer listeners ' + JSON.stringify([layerChanges,control,root.layer,retained[0].layer,retained[1].layer]));
                const peer = create(scene);
                cc.director.addPersistRootNode(peer.node);
                const refs = retire(peer);
                await switchScene('M6 pooled ' + round);
                for (let i = 0; i < 5; i++) {
                    await frame(); await frame();
                    cc.native.garbageCollect();
                    if (refs.every(r => !r.weak.deref())) break;
                }
                check(refs.every(r => !r.weak.deref()), 'detached wrappers survived JS collection');
                peer.string = content;
                const children = peer.node.children;
                check(children.length === 2 && new Set(children.map(n => n.uuid)).size === 2
                    && children.every(n => refs.some(ref => ref.id === n.uuid) && n.scene === cc.director.getScene()
                        && n.parent === peer.node && n.activeInHierarchy), 'recreated wrapper identity/parent/scene');
                collected.push(...refs.map(r => r.id));
                cc.director.removePersistRootNode(peer.node);
                peer.node.destroy();
                await frame();
                transitions += 2;
            }
            return { transitions, destroyed, collected: collected.length, layerChanges, retained: ids.length };
        } finally {
            cc.director.removePersistRootNode(root);
            root.destroy();
            await frame(); await frame();
            atlas.decRef();
        }
    });
    test('SpriteFrame', '', 'reload imported prefab and cloned frame across three scene changes', async () => {
        let previous = null;
        const uuids = [];
        for (let i = 0; i < 3; i++) {
            const prefab = await load('M6StaticAtlas/AtlasSprite', cc.Prefab);
            const sprite = cc.instantiate(prefab).getComponent(cc.Sprite);
            cc.director.getScene().addChild(sprite.node);
            const atlas = sprite.spriteAtlas, imported = atlas.getSpriteFrame('right');
            check(!previous || (prefab !== previous.prefab && imported !== previous.imported
                && prefab.uuid === previous.uuid), 'reload did not create fresh wrappers for the same asset');
            const texture = imported.texture.addRef();
            const clone = imported.clone();
            uuids.push(prefab.uuid);
            try {
                sprite.spriteAtlas = null;
                sprite.spriteFrame = clone;
                await switchScene('M6 assets ' + i);
                cc.assetManager.releaseAsset(prefab);
                await frame(); await frame();
                check(!cc.isValid(sprite) && !cc.isValid(prefab) && !cc.isValid(imported) && !cc.isValid(atlas)
                    && clone.texture === texture && cc.isValid(texture) && cc.isValid(clone), 'old scene assets or retained clone: ' +
                    JSON.stringify([i, ...[sprite,prefab,imported,atlas,texture,clone].map(a => [cc.isValid(a),a.refCount])]));
                previous = { prefab, imported, uuid: uuids[i] };
            } finally { clone.destroy(); texture.decRef(); }
            await frame(); await frame();
            check(!cc.isValid(clone) && !cc.isValid(texture), 'clone or texture survived final release');
        }
        return { loads: uuids.length, prefab: uuids[0] };
    });
};
