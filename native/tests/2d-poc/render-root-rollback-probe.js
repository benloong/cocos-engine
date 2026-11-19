// Installed before application.init by the Windows graphics harness.
function installRootRollbackProbe (cc, implementation) {
    cc.director.once(cc.DirectorEvent.AFTER_SCENE_LAUNCH, scene => {
        try {
            const batcher = cc.director.root.batcher2D._nativeObj;
            const initial = batcher.getRootNodeCount();
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
            if (actual !== implementation || batcher.getRootNodeCount() !== initial + 1) throw new Error('Root registration failed: ' + actual);
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
            if (batcher.getRootNodeCount() !== initial + 1) throw new Error('Repeated root registration');
            root.enabled = false;
            if (batcher.getRootNodeCount() !== initial) throw new Error('Disabled root still registered');
            node.destroy();
            prefab.destroy();
            console.log('M6_ROOT_RESULT ' + JSON.stringify({ implementation, initial, pairs, samples }));
        } catch (error) {
            console.error('M6_GPU_FAIL ' + error.stack);
        }
    });
}
