// Install after application.start; run after the existing core matrix has finished.
globalThis.installM6CandidateLifecycle = function (cc, manifestPath, resultPath) {
    let started = false;
    const nextFrame = () => new Promise(resolve => cc.director.once(cc.Director.EVENT_AFTER_DRAW, resolve));
    const checks = [];
    function check(name, value) { checks.push({name, passed:!!value}); if (!value) throw new Error(name); }
    async function run() {
        const scene = cc.director.getScene();
        check('live-scene', !!scene);
        for (const loaded of [false,true]) {
            const host = new cc.Node('candidate-mask-'+loaded); host.active = false; scene.addChild(host);
            host.addComponent(cc.UITransform);
            const mask = host.addComponent(cc.Mask); mask.type = cc.Mask.Type.GRAPHICS_STENCIL;
            const helper = mask.subComp, helperNode = helper.node;
            helper.moveTo(0,0); helper.lineTo(8,8); helper.stroke();
            const frame = new cc.SpriteFrame(); mask.spriteFrame = frame;
            if (loaded) { host.active = true; await nextFrame(); }
            check('mask-'+loaded+'-backend-created', !!helper._native);
            check('mask-'+loaded+'-load-state', !!mask._native === loaded);
            check('mask-'+loaded+'-destroy-queued', mask.destroy());
            check('mask-'+loaded+'-pending-read-empty', mask.subComp === null);
            await nextFrame(); await nextFrame();
            check('mask-'+loaded+'-helper-retired', !cc.isValid(helperNode) && !cc.isValid(helper) && helper._native === null);
            check('mask-'+loaded+'-owner-empty', host.children.length === 0 && mask.spriteFrame === null);
            mask.type = cc.Mask.Type.SPRITE_STENCIL; mask.spriteFrame = frame; mask.onRestore(); mask.onLoad();
            check('mask-'+loaded+'-no-resurrection', mask.subComp === null && mask._native === null
                && host.children.length === 0 && host.getComponent(cc.Sprite) === null && mask.spriteFrame === null);
            host.destroy(); frame.destroy(); await nextFrame(); await nextFrame();
        }
        const controlHost = new cc.Node('candidate-control'); scene.addChild(controlHost);
        controlHost.addComponent(cc.UITransform);
        const control = controlHost.addComponent(cc.Graphics);
        const material = control.getSharedMaterial(0);
        check('graphics-builtin-available', !!material);
        const host = new cc.Node('candidate-preload-graphics'); host.active=false; scene.addChild(host);
        host.addComponent(cc.UITransform);
        const graphics = host.addComponent(cc.Graphics);
        graphics.sharedMaterials = [material,material]; graphics.fillRect(0,0,20,10);
        check('graphics-staged-slots', graphics.getSharedMaterial(0) === material && graphics.getSharedMaterial(1) === material);
        const instance = graphics.getMaterialInstance(0), backend = graphics._native;
        check('graphics-preload-owner', !!instance && instance.parent === material && instance.owner === graphics);
        host.active = true; await nextFrame();
        check('graphics-load-retains-instance', graphics._native === backend && graphics.getMaterialInstance(0) === instance && instance.owner === graphics);
        host.destroy(); controlHost.destroy(); await nextFrame(); await nextFrame();
        check('graphics-destroy-releases-owner', !cc.isValid(graphics) && graphics._native === null && instance.owner === null);
        return checks;
    }
    const poll = () => {
        if (started || !jsb.fileUtils.isFileExist(manifestPath)) return;
        started=true; cc.director.off(cc.Director.EVENT_AFTER_DRAW,poll);
        run().then(() => {
            jsb.fileUtils.writeStringToFile(JSON.stringify({passed:true,checks},null,2),resultPath);
            console.log('M6_CANDIDATE_LIFECYCLE_PASS '+checks.length);
        }).catch(error => {
            jsb.fileUtils.writeStringToFile(JSON.stringify({passed:false,error:String(error.stack||error),checks},null,2),resultPath);
            console.error('M6_CANDIDATE_LIFECYCLE_FAIL '+error.stack);
        });
    };
    cc.director.on(cc.Director.EVENT_AFTER_DRAW,poll);
};
