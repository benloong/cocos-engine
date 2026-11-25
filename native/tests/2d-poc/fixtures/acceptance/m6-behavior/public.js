globalThis.m6PublicContracts = function publicContracts({ cc, test, check, host, load, frame }) {
    const atlas = () => load('M6StaticAtlas/colors', cc.SpriteAtlas);
    const bitmap = () => load('M3BitmapFont/OpenSans-Bold', cc.BitmapFont);
    const color = new cc.Color(41, 83, 127, 233);
    const point = new cc.Vec2(.25, .75);
    const same = (a, b) => a === b || !!a?.equals?.(b);

    // Observe the arguments crossing the JSB boundary and forward every call to the native implementation.
    function calls(receiver, method, action) {
        const proto = Object.getPrototypeOf(receiver);
        const descriptor = Object.getOwnPropertyDescriptor(proto, method);
        const original = proto[method];
        check(typeof original === 'function', 'Missing native method ' + method);
        const values = [];
        Object.defineProperty(proto, method, { configurable: true, value(...args) {
            if (this === receiver) values.push(args);
            return original.apply(this, args);
        } });
        try { action(); } finally {
            if (descriptor) Object.defineProperty(proto, method, descriptor);
            else delete proto[method];
        }
        return values;
    }
    function forwarded(owner, rows) {
        for (const [key, value, method, expected, enums = ''] of rows) {
            test(owner, (key + ' ' + enums).trim(), key + ' reaches native state', () => {
                const component = host(cc[owner]);
                const args = expected || [value];
                const seen = calls(component._native, method, () => { component[key] = value; });
                check(same(component[key], value), key + ' readback: ' + component[key]);
                check(seen.some(entry => entry.length === args.length && entry.every((v, i) => same(v, args[i]))),
                    method + ' received ' + JSON.stringify(seen));
            });
        }
    }
    forwarded('Sprite', [
        ['type', cc.Sprite.Type.FILLED, 'setType', [3], '@Type'],
        ['fillType', cc.Sprite.FillType.RADIAL, 'setFillType', [2], '@FillType'],
        ['sizeMode', cc.Sprite.SizeMode.CUSTOM, 'setSizeMode', [0], '@SizeMode'],
        ['fillStart', .25, 'setFillStart'], ['fillRange', .75, 'setFillRange'],
        ['fillCenter', point, 'setFillCenter', [.25, .75]], ['trim', false, 'setTrim'], ['grayscale', true, 'setGrayscale'],
    ]);
    forwarded('Label', [
        ['string', 'Native label', 'setString'], ['fontFamily', 'Consolas', 'setFont', ['40px Consolas']],
        ['fontSize', 29, 'setFontSize'], ['actualFontSize', 20.5, 'setActualFontSize'],
        ['lineHeight', 34, 'setLineHeight'], ['spacingX', 3, 'setSpacingX'],
        ['overflow', cc.Label.Overflow.SHRINK, 'setOverflow', [2], '@Overflow'],
        ['enableWrapText', false, 'setEnableWrapText'],
        ['horizontalAlign', cc.Label.HorizontalAlign.RIGHT, 'setHorizontalAlign', [2], '@HorizontalAlign'],
        ['verticalAlign', cc.Label.VerticalAlign.BOTTOM, 'setVerticalAlign', [2], '@VerticalAlign'],
        ['cacheMode', cc.Label.CacheMode.BITMAP, 'setCacheMode', [1], '@CacheMode'],
        ['isBold', true, 'setIsBold'], ['isItalic', true, 'setIsItalic'], ['isUnderline', true, 'setIsUnderline'],
        ['underlineHeight', 4, 'setUnderlineHeight'], ['enableOutline', true, 'setEnableOutline'],
        ['outlineColor', color, 'setOutlineColor'], ['outlineWidth', 3, 'setOutlineWidth'],
        ['enableShadow', true, 'setEnableShadow'], ['shadowColor', color, 'setShadowColor'],
        ['shadowOffset', point, 'setShadowOffset', [.25, .75]], ['shadowBlur', 3, 'setShadowBlur'],
    ]);
    forwarded('Graphics', [
        ['lineWidth', 7, 'setLineWidth'], ['lineJoin', cc.Graphics.LineJoin.ROUND, 'setLineJoin', [1], '@LineJoin'],
        ['lineCap', cc.Graphics.LineCap.SQUARE, 'setLineCap', [2], '@LineCap'], ['strokeColor', color, 'setStrokeColor'],
        ['fillColor', color, 'setFillColor'], ['miterLimit', 17, 'setMiterLimit'],
        ['color', color, 'setColorRGBA', [41, 83, 127, 233]],
    ]);
    forwarded('RichText', [
        ['string', '<b>M6</b>', 'setString'], ['fontSize', 21, 'setFontSize'], ['fontColor', color, 'setFontColorRGBA', [41, 83, 127, 233]],
        ['fontFamily', 'Consolas', 'setFontFamily'], ['cacheMode', cc.Label.CacheMode.BITMAP, 'setCacheMode'],
        ['horizontalAlign', cc.RichText.HorizontalAlign.RIGHT, 'setHorizontalAlign', [2], '@HorizontalAlign'],
        ['verticalAlign', cc.RichText.VerticalAlign.BOTTOM, 'setVerticalAlign', [2], '@VerticalAlign'],
        ['lineHeight', 31, 'setLineHeight'], ['maxWidth', 90, 'setMaxWidth'],
    ]);
    forwarded('Mask', [
        ['type', cc.Mask.Type.GRAPHICS_ELLIPSE, 'setType', [cc.Mask.Type.GRAPHICS_ELLIPSE], '@Type'],
        ['inverted', true, 'setInverted'], ['radius', 11, 'setRadius'], ['segments', 41, 'setSegments'],
        ['alphaThreshold', .375, 'setAlphaThreshold'],
    ]);
    test('SpriteAtlas', 'spriteFrames getTexture getSpriteFrame getSpriteFrames', 'named frame map and shared texture', async () => {
        const a = await atlas();
        const left = a.getSpriteFrame('left'), right = a.getSpriteFrame('right');
        check(left && right && left !== right && a.spriteFrames.left === left && a.spriteFrames.right === right, 'atlas map');
        check(a.getSpriteFrames().includes(right) && a.getTexture() === left.texture && !a.getSpriteFrame('absent'), 'atlas lookup');
    });
    test('Sprite', 'spriteAtlas spriteFrame changeSpriteFrameFromAtlas @EventType', 'switch imported frames by key', async () => {
        const s = host(cc.Sprite);
        s.spriteAtlas = await atlas();
        s.spriteFrame = s.spriteAtlas.getSpriteFrame('left');
        s.changeSpriteFrameFromAtlas('right');
        check(s.spriteFrame === s.spriteAtlas.spriteFrames.right && cc.Sprite.EventType.SPRITE_FRAME_CHANGED === 'spriteframe-changed', 'atlas switch or event name');
    });
    test('BitmapFont', 'spriteFrame fontSize fntConfig onLoaded', 'rebuild native glyph table from edited config', async () => {
        const source = await bitmap();
        const clone = new cc.LabelAtlas();
        try {
            clone.spriteFrame = source.spriteFrame;
            clone.fontSize = 23;
            clone.fntConfig = JSON.parse(JSON.stringify(source.fntConfig));
            const cfg = clone.fntConfig;
            const key = Object.keys(cfg.fontDefDictionary)[0];
            cfg.fontDefDictionary[key].xAdvance = 57;
            clone.onLoaded();
            check(clone.fontDefDictionary.getLetter(key).xAdvance === 57 && clone.fontSize === 23
                && clone.spriteFrame === source.spriteFrame && clone instanceof cc.BitmapFont && source instanceof cc.Font, 'glyph config or inherited assets');
        } finally { clone.destroy(); }
    });
    test('SpriteFrame', '@createWithImage texture width height getGFXTexture getGFXSampler getHash getSamplerInfo', 'image creates frame backed by the same GPU texture', async () => {
        const src = (await atlas()).getTexture().image;
        const f = cc.SpriteFrame.createWithImage(src);
        const t = f.texture;
        try {
            check(t.image === src && f.width === src.width && f.height === src.height && f.width > 0, 'image dimensions');
            check(f.getGFXTexture() && f.getGFXTexture() === t.getGFXTexture() && f.getGFXSampler() === t.getGFXSampler()
                && f.getHash() === t.getHash() && f.getSamplerInfo().minFilter === t.getSamplerInfo().minFilter, 'GPU handles or sampler');
        } finally { f.destroy(); t.destroy(); }
    });
    test('SpriteFrame', '@EVENT_UV_UPDATED rect originalSize offset rotated insetLeft insetRight insetTop insetBottom flipUVX flipUVY uv uvSliced reset checkRect', 'rect reset and sliced UV mutation', async () => {
        const f = (await atlas()).getSpriteFrame('left').clone();
        try {
            let events = 0;
            f.on(cc.SpriteFrame.EVENT_UV_UPDATED, () => ++events);
            f.reset({rect: new cc.Rect(0,0,4,4), originalSize: new cc.Size(8,9), offset: new cc.Vec2(1,2), isRotate: true});
            check(f.rect.width === 4 && f.originalSize.height === 9 && f.offset.y === 2 && f.rotated && f.checkRect(f.texture), 'reset state');
            const initial = JSON.stringify(f.uv);
            const sliced = JSON.stringify(f.uvSliced);
            for (const key of ['insetLeft','insetRight','insetTop','insetBottom']) { f[key] = 1; check(f[key] === 1, key); }
            f.flipUVX = !f.flipUVX;
            check(initial !== JSON.stringify(f.uv), 'horizontal flip');
            const horizontal = JSON.stringify(f.uv);
            f.flipUVY = !f.flipUVY;
            check(horizontal !== JSON.stringify(f.uv) && sliced !== JSON.stringify(f.uvSliced) && events >= 7, 'vertical flip / sliced UVs / events');
        } finally { f.destroy(); }
    });
    test('SpriteFrame', '@MeshType atlasUuid packable original pixelsToUnit pivot vertices mesh ensureMeshData clone destroy', 'native frame clone owns independent mesh data', async () => {
        const f = (await atlas()).getSpriteFrame('left').clone();
        f.atlasUuid = 'test-atlas'; f.packable = false; f.pixelsToUnit = 30; f.pivot = point;
        f.meshType = cc.SpriteFrame.MeshType.RECT;
        f.ensureMeshData();
        const copy = f.clone();
        try {
            check(!copy.original && copy.atlasUuid === 'test-atlas' && !copy.packable && copy.pixelsToUnit === 30 && copy.pivot.equals(point), 'clone metadata');
            check(f.mesh && copy.mesh && copy.mesh !== f.mesh && copy.vertices !== f.vertices && copy.vertices.indexes.length === 6, 'clone mesh');
            copy.vertices.indexes[0] = 99;
            check(f.vertices.indexes[0] !== 99 && copy.destroy() && !cc.isValid(copy,true) && cc.isValid(f,true), 'clone lifetime');
        } finally { f.destroy(); if (cc.isValid(copy,true)) copy.destroy(); }
    });
    test('UITransform', '@EventType width height contentSize anchorPoint anchorX anchorY setContentSize setAnchorPoint convertToNodeSpaceAR convertToWorldSpaceAR getBoundingBox getBoundingBoxToWorld getBoundingBoxTo getComputeAABB', 'events, anchored bounds and invertible coordinates', () => {
        const t = host(cc.UITransform);
        let resized = 0, anchored = 0;
        t.node.on(cc.UITransform.EventType.SIZE_CHANGED, () => ++resized);
        t.node.on(cc.UITransform.EventType.ANCHOR_CHANGED, () => ++anchored);
        t.node.setPosition(20,30,0);
        t.setContentSize(19,9); t.width = 20; t.height = 10;
        t.setAnchorPoint(0,0); t.anchorX = .5; t.anchorY = 1;
        check(t.contentSize.equals(new cc.Size(20,10)) && t.anchorPoint.equals(new cc.Vec2(.5,1)) && resized === 3 && anchored === 3, 'size or anchor events');
        const v = new cc.Vec3(3,4,0), world = t.convertToWorldSpaceAR(v);
        check(world.equals(new cc.Vec3(23,34,0)) && t.convertToNodeSpaceAR(world).equals(v), 'space conversion');
        for (const box of [t.getBoundingBox(),t.getBoundingBoxToWorld(),t.getBoundingBoxTo(new cc.Mat4())])
            check(box.equals(new cc.Rect(10,20,20,10)), 'bounds ' + box);
        const aabb = t.getComputeAABB();
        check(aabb.center.x === 20 && aabb.center.y === 25 && aabb.halfExtents.x === 10 && aabb.halfExtents.y === 5, 'AABB');
    });
    test('UITransform', 'cameraPriority hitTest', 'active window screen center and outside', async () => {
        const canvas = cc.director.getScene().getComponentInChildren(cc.Canvas);
        const component = canvas.cameraComponent;
        // The pixel probes temporarily render this camera into a RenderTexture.
        const onScreen = () => component.targetTexture === null && !!component.camera.window?.swapchain;
        for (let i = 0; i < 120 && !onScreen(); ++i) await frame();
        check(onScreen(), 'canvas camera did not return to the screen within 120 frames');
        const t = canvas.node.getComponent(cc.UITransform), camera = component.camera;
        camera.update(true);
        const center = camera.worldToScreen(new cc.Vec3(), canvas.node.worldPosition);
        const p = new cc.Vec2(center.x,center.y), windowId = camera.systemWindowId;
        check(windowId > 0 && t.cameraPriority === component.priority, 'active window or camera priority');
        check(t.hitTest(p,windowId), 'screen center missed with active window ID');
        check(!t.hitTest(new cc.Vec2(-100000,-100000),windowId), 'outside point hit');
        check(!t.hitTest(p) && !t.hitTest(p,0) && !t.hitTest(p,windowId+123), 'center hit with missing, zero or wrong window ID');
    });
    test('UITransform', 'onLoad onEnable onDisable onDestroy', 'register and detach transform from host', () => {
        const t = host(cc.UITransform), n = t.node;
        check(t._native && n._uiProps.uiTransformComp === t, 'transform attachment');
        const parentEvent = cc.Node.EventType.PARENT_CHANGED;
        const listening = () => n.hasEventListener(parentEvent);
        check(listening(), 'parent-change listener missing');
        t.enabled = false; check(!listening(), 'parent-change listener remained active');
        t.enabled = true; check(listening(), 'parent-change listener was not restored');
        t._destroyImmediate();
        check(!t._native && !n._uiProps.uiTransformComp, 'transform detachment');
    });
    for (const [owner, field, activate, members] of [
        ['Sprite','_native','setEnabled','onEnable onDisable onDestroy'],
        ['Label','_native','setEnabled','onEnable onDestroy'],
        ['Mask','_native','setEnabled','onLoad onEnable onDisable onDestroy'],
        ['Graphics','_native','setEnabled','onLoad onEnable onDestroy'],
        ['RichText','_native','setEnabled','onLoad onEnable onDisable onDestroy'],
        ['RenderRoot2D','_nativeRoot','setEnabled','onEnable onDisable onDestroy'],
        ['UIOpacity','_native','setActive','onEnable onDisable'],
    ]) {
        test(owner, members, 'native activation, deactivation and detachment', () => {
            const c = host(cc[owner]), peer = c[field];
            const seen = calls(peer, activate, () => { c.enabled = false; c.enabled = true; });
            check(seen.length === 2 && seen[0][0] === false && seen[1][0] === true, 'enable sequence ' + JSON.stringify(seen));
            c._destroyImmediate();
            check(!c[field], 'native peer retained after destruction');
        });
    }
    test('UIOpacity', 'opacity', 'clamp opacity before native propagation', () => {
        const c = host(cc.UIOpacity);
        c.opacity = -5; check(c.opacity === 0 && c._native.getOpacity() === 0, 'lower bound');
        c.opacity = 300; check(c.opacity === 255 && c._native.getOpacity() === 255, 'upper bound');
    });
    test('Mask', 'isHit subComp onRestore', 'restore stencil and test world bounds', () => {
        const c = host(cc.Mask);
        c.type = cc.Mask.Type.SPRITE_STENCIL;
        check(c.subComp instanceof cc.Sprite, 'sprite stencil');
        c.type = cc.Mask.Type.GRAPHICS_RECT;
        const seen = calls(c._native,'setType', () => c.onRestore());
        check(c.subComp instanceof cc.Graphics && seen.some(args => args[0] === c.type)
            && c.isHit(new cc.Vec2(0,0)) && !c.isHit(new cc.Vec2(5000,0)), 'rect stencil restore / hit');
    });
    test('Graphics', 'impl onRestore moveTo lineTo bezierCurveTo quadraticCurveTo arc ellipse circle rect roundRect fillRect clear close stroke fill', 'submit path primitives and restore stroke style', () => {
        const g = host(cc.Graphics);
        g.lineWidth = 7;
        check(calls(g._native,'setLineWidth',() => g.onRestore()).some(args => args[0] === 7), 'restore width');
        check(g.impl === g._native, 'default path');
        for (const [method, args] of Object.entries({
            moveTo:[1,2],lineTo:[3,4],bezierCurveTo:[1,2,3,4,5,6],quadraticCurveTo:[1,2,3,4],
            arc:[1,2,3,0,2,false],ellipse:[1,2,3,4],circle:[2,3,4],rect:[1,2,8,9],roundRect:[1,2,8,9,2],
            close:[],stroke:[],fill:[],fillRect:[1,2,8,9],clear:[],
        })) {
            const seen = calls(g._native,method,() => g[method](...args));
            check(seen.some(a => JSON.stringify(a) === JSON.stringify(args)), method + ' ' + JSON.stringify(seen));
        }
    });
    test('RichText', 'imageAtlas handleTouchEvent onRestore', 'image segment and touch listener toggle', async () => {
        const rich = host(cc.RichText);
        rich.imageAtlas = await atlas();
        rich.string = '<b>I</b><img src="left" width=8 height=8/>';
        check(rich.node.children.length === 2, 'image segment');
        rich.handleTouchEvent = false; rich.onRestore();
        check(!rich._listening, 'touch disabled');
        rich.handleTouchEvent = true; rich.onRestore();
        check(rich._listening && rich.node.children.length === 2, 'touch restored');
    });
    for (const owner of ['Label','RichText']) {
        test(owner, owner === 'Label' ? 'font useSystemFont updateRenderData' : 'font useSystemFont', 'switch font asset to system font', async () => {
            const c = host(cc[owner]);
            const font = owner === 'Label' ? await bitmap() : new cc.TTFFont();
            try {
                c.font = font;
                check(c.font === font && !c.useSystemFont, 'font assignment');
                const seen = calls(c._native,'setFontAsset',() => { c.useSystemFont = true; });
                check(c.useSystemFont && seen.some(a => a[0] === null), 'release font binding');
                if (owner === 'Label') {
                    c.string = 'M6 measure';
                    c.updateRenderData(true);
                    check(c.actualFontSize > 0 && c.node.getComponent(cc.UITransform).width > 0, 'text layout');
                }
            } finally { if (owner === 'RichText') { c.font = null; font.destroy(); } }
        });
    }
    test('UIRenderer', 'sharedMaterials customMaterial color priority', 'material slots and dynamic native renderer state', () => {
        const c = host(cc.Sprite), mat = cc.builtinResMgr.get('ui-sprite-material');
        c.customMaterial = mat;
        c.sharedMaterials = [mat];
        c.color = color;
        check(mat && c.customMaterial === mat && c.sharedMaterials[0] === mat && c.color.equals(color), 'material or tint');
        check(calls(c._native,'setPriority',() => { c.priority = 97; }).some(a => a[0] === 97) && c.priority === 97, 'priority update');
    });
    test('UIRenderer', 'onLoad onEnable onRestore onDisable onDestroy markForUpdateRenderData requestRenderData destroyRenderData postUpdateAssembler', 'base renderer render-data ownership and submission', () => {
        const c = host(cc.UIRenderer), n = c.node;
        check(n._uiProps.uiComp === c, 'base attachment');
        let data = c.requestRenderData();
        check(data && data === c.renderData, 'request data');
        data.vertDirty = false; c.markForUpdateRenderData(false); check(!data.vertDirty,'false dirtied data');
        c.markForUpdateRenderData(); check(data.vertDirty,'dirty data');
        data.vertDirty = false; c.onRestore(); check(data.vertDirty,'restore');
        let submitted = 0;
        c._postAssembler = {}; c._postRender = () => ++submitted;
        c._renderFlag = false; c.postUpdateAssembler(c.batcher);
        c._renderFlag = true; c.postUpdateAssembler(c.batcher);
        check(submitted === 1,'post submission');
        c.destroyRenderData(); check(!c.renderData,'explicit release');
        data = c.requestRenderData(); c.enabled = false;
        check(data && !c.renderData,'release on disable');
        c.enabled = true; c._destroyImmediate();
        check(!n._uiProps.uiComp,'base detachment');
    });
};
