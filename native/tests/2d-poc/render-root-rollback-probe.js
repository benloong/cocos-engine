// Installed before application.init by the Windows graphics harness.
function installRootRollbackProbe (cc, implementation) {
    cc.director.once(cc.DirectorEvent.AFTER_SCENE_LAUNCH, async scene => {
        try {
            const prefab = cc.deserialize([
                { __type__: 'cc.Prefab', data: { __id__: 1 } },
                { __type__: 'cc.Node', _name: 'RenderRootRollback', _components: [{ __id__: 2 }, { __id__: 3 }] },
                { __type__: 'cc.UITransform', node: { __id__: 1 } },
                { __type__: 'cc.RenderRoot2D', node: { __id__: 1 } },
            ]);
            const node = cc.instantiate(prefab);
            scene.addChild(node);
            const root = node.getComponent(cc.RenderRoot2D);
            const actual = root._nativeRoot instanceof n2d.RenderRoot2D ? 'native' : 'js';
            if (actual !== implementation) throw new Error('Unexpected RenderRoot2D implementation: ' + actual);
            // Only a registered root can propagate opacity to this child during a frame.
            const child = new cc.Node('root-traversal-marker');
            node.addChild(child);
            const traversals = [];
            async function checkTraversal(enabled) {
                child._setFinalOpacity(-1);
                await new Promise(resolve => cc.director.once(cc.DirectorEvent.AFTER_DRAW, resolve));
                const opacity = child._getFinalOpacity();
                if (opacity !== (enabled ? 1 : -1)) throw new Error('Unexpected descendant opacity: ' + opacity);
                traversals.push(opacity);
            }
            await checkTraversal(true);
            const samples = [];
            const pairs = 256;
            for (let batch = 0; batch < 71; ++batch) {
                const start = performance.now();
                for (let i = 0; i < pairs; ++i) {
                    root.enabled = false;
                    root.enabled = true;
                }
                const elapsed = performance.now() - start;
                if (batch >= 10) samples.push(elapsed);
            }
            await checkTraversal(true);
            root.enabled = false;
            await checkTraversal(false);
            node.destroy();
            prefab.destroy();
            console.log('M6_ROOT_RESULT ' + JSON.stringify({ implementation, traversals, pairs, samples }));
        } catch (error) {
            console.error('M6_GPU_FAIL ' + error.stack);
        }
    });
}
