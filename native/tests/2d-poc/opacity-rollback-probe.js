// Installed in the generated Windows entry before application.init.
function installOpacityRollbackProbe (cc, implementation) {
    cc.director.once(cc.DirectorEvent.AFTER_SCENE_LAUNCH, scene => {
        try {
            const prefab = cc.deserialize([
                { __type__: 'cc.Prefab', data: { __id__: 1 } },
                { __type__: 'cc.Node', _name: 'OpacityRollback', _components: [{ __id__: 2 }] },
                { __type__: 'cc.UIOpacity', node: { __id__: 1 }, _opacity: 128 },
            ]);
            const node = cc.instantiate(prefab);
            scene.addChild(node);
            const component = node.getComponent(cc.UIOpacity);
            const actual = component._native instanceof n2d.UIOpacity ? 'native' : 'js';
            if (actual !== implementation) throw new Error('Unexpected UIOpacity implementation: ' + actual);
            function check (value, local) {
                if (component.opacity !== value || Math.abs(node._getLocalOpacity() - local / 255) > 1e-6) {
                    throw new Error('UIOpacity state mismatch: ' + component.opacity + '/' + node._getLocalOpacity());
                }
            }
            check(128, 128);
            component.enabled = false;
            check(128, 255);
            component.enabled = true;
            check(128, 128);
            component.opacity = -10;
            check(0, 0);
            component.opacity = 300;
            check(255, 255);

            const samples = [];
            const assignments = 8192;
            for (let batch = 0; batch < 71; ++batch) {
                const start = performance.now();
                for (let i = 0; i < assignments; ++i) component.opacity = i % 256;
                const elapsed = performance.now() - start;
                if (batch >= 10) samples.push(elapsed);
            }
            check(255, 255);
            node.destroy();
            prefab.destroy();
            console.log('M6_OPACITY_RESULT ' + JSON.stringify({ implementation, assignments, samples }));
        } catch (error) {
            console.error('M6_GPU_FAIL ' + error.stack);
        }
    });
}
