globalThis.m6Resources = function ({ cc, check, test, host, load, frame, directory }) {
    const file = jsb.fileUtils;
    const fontPath = directory + '/Resources/Thonburi.ttf';
    const loadFont = () => new Promise((resolve, reject) => cc.assetManager.loadRemote(fontPath, { ext: '.ttf' },
        (err, font) => err ? reject(err) : resolve(font)));
    test('TTFFont', '', 'complex text shaping and bidi in uploaded glyph pixels', async () => {
        const font = await loadFont();
        const label = host(cc.Label);
        label.font = font;
        label.fontSize = 32;
        label.lineHeight = 48;
        label.overflow = cc.Label.Overflow.NONE;
        const ui = label.node.getComponent(cc.UITransform);
        function sample(value, masks) {
            label.string = value;
            label.updateRenderData(true);
            const texture = label.ttfSpriteFrame.getGFXTexture();
            const region = new cc.gfx.BufferTextureCopy();
            region.texExtent.width = texture.width;
            region.texExtent.height = texture.height;
            const bytes = new Uint8Array(texture.width * texture.height * 4);
            cc.director.root.device.copyTextureToBuffers(texture, [bytes], [region]);
            let hash = 2166136261, ink = 0;
            for (let i = 3; i < bytes.length; i += 4) {
                hash = Math.imul(hash ^ bytes[i], 16777619) >>> 0;
                if (bytes[i] > 8) ink++;
            }
            check(ink > 0, 'empty glyph run: ' + value);
            if (masks) masks.push(bytes.filter((_, i) => i % 4 === 3));
            return { width: ui.width, height: ui.height, hash, ink };
        }
        try {
            check(font instanceof cc.Font && font instanceof cc.TTFFont && font.getFontDataSize() === 223404, 'imported TTF');
            const thai = sample('กิ'), base = sample('ก');
            check(Math.abs(thai.width - base.width) < .05 && thai.hash !== base.hash, 'Thai mark must add ink without advance ' + JSON.stringify([thai,base]));
            label.useSystemFont = true;
            label.fontFamily = 'Segoe UI';
            const masks = [];
            const joined = sample('لا', masks), separate = sample('ل‌ا'), presentation = sample('ﻻ', masks);
            let intersection = 0, union = 0;
            for (let i = 0; i < masks[0].length; i++) {
                intersection += Math.max(0, Math.min(masks[0][i], masks[1][i]) - 1);
                union += Math.max(0, Math.max(masks[0][i], masks[1][i]) - 1);
            }
            const overlap = intersection / union;
            check(masks[0].length === masks[1].length && overlap > .95 && joined.width === presentation.width && joined.width < separate.width,
                'Arabic contextual form / non-joiner ' + JSON.stringify([joined,separate,presentation]));
            const mixed = sample('A אבג Z'), isolated = sample('A \u202bאבג\u202c Z'), reversed = sample('A גבא Z');
            const visual = sample('A \u202dגבא\u202c Z');
            check(mixed.hash === visual.hash && mixed.hash === isolated.hash && mixed.width === isolated.width && mixed.hash !== reversed.hash,
                'bidi embedding / reversed letters ' + JSON.stringify([mixed,isolated,reversed]));
            label.font = font;
            const restored = sample('กิ');
            check(thai.hash === restored.hash && thai.width === restored.width, 'asset switch lost shaped run');
            return { thai, base, joined, separate, presentation, overlap, mixed, isolated, visual, reversed, restored };
        } finally {
            label.font = null;
            cc.assetManager.releaseAsset(font);
            check(!cc.assetManager.assets.has(fontPath) && !font.getFontDataSize(), 'font data or cache retained');
        }
    });
    test('LabelAtlas', '', 'bitmap font metadata reload across rotation and UV flips', async () => {
        const source = await load('M3BitmapFont/OpenSans-Bold', cc.BitmapFont);
        const label = host(cc.Label), ui = label.node.getComponent(cc.UITransform);
        label.string = 'AAAA';
        let combinations = 0;
        for (const Type of [cc.BitmapFont, cc.LabelAtlas]) {
            const font = new Type(), glyphs = source.spriteFrame.clone();
            try {
                font.spriteFrame = glyphs;
                font.fontSize = source.fontSize;
                font.fntConfig = JSON.parse(JSON.stringify(source.fntConfig));
                const glyph = font.fntConfig.fontDefDictionary[65], advance = glyph.xAdvance;
                label.font = font;
                for (const rotated of [false,true]) for (const flipX of [false,true]) for (const flipY of [false,true]) {
                    glyphs.rotated = rotated; glyphs.flipUVX = flipX; glyphs.flipUVY = flipY;
                    glyph.xAdvance = advance;
                    font.onLoaded(); label.updateRenderData(true);
                    const width = ui.width;
                    glyph.xAdvance += 5;
                    font.onLoaded(); label.updateRenderData(true);
                    check(width > 0 && ui.width > width && glyphs.uv.every(Number.isFinite), 'glyph advance after reload');
                    const modified = ui.width;
                    font.fontSize += 1;
                    label.updateRenderData(true);
                    check(ui.width === modified && font.spriteFrame === glyphs, 'public font size replaced config source size');
                    combinations++;
                }
            } finally { label.font = null; font.destroy(); glyphs.destroy(); }
        }
        return { combinations };
    });
    test('SpriteAtlas', '', 'out-of-order imported dependencies and retired atlas owners', async () => {
        const source = await load('M6StaticAtlas/colors', cc.SpriteAtlas);
        const serialized = source._serialize();
        const owners = [];
        function pending() {
            const owner = new cc.SpriteAtlas(), slots = [];
            owners.push(owner);
            // Capture the actual dependency targets registered by the current-format deserializer.
            owner._deserialize(serialized, { result: { push(map, key, uuid, type) { slots.push({ map, key, uuid, type }); } } });
            check(slots.length === 2 && slots.every(s => s.type === 'cc.SpriteFrame' && !owner.getSpriteFrame(s.key)), 'unresolved placeholders');
            return { owner, slots };
        }
        async function complete(slot) {
            const asset = await new Promise((resolve, reject) => cc.assetManager.loadAny({uuid:slot.uuid},
                (err, value) => err ? reject(err) : resolve(value)));
            await frame();
            slot.map[slot.key] = asset;
            return asset;
        }
        try {
            const live = pending(), replaced = pending(), dead = pending();
            replaced.owner.spriteFrames = { replacement: source.getSpriteFrame('right') };
            dead.owner.destroy();
            await frame();
            const [first,second] = live.slots;
            const later = await complete(second);
            check(live.owner.getSpriteFrame(second.key) === later && !live.owner.getSpriteFrame(first.key), 'partial completion');
            const earlier = await complete(first);
            await Promise.all([...replaced.slots,...dead.slots].map(complete));
            check(live.owner.getSpriteFrames()[0] === earlier && live.owner.getSpriteFrames()[1] === later
                && live.owner.getTexture() === earlier.texture, 'serialized order changed');
            check(replaced.owner.getSpriteFrameNames().join() === 'replacement' && !cc.isValid(dead.owner)
                && dead.owner.getSpriteFrameNames().length === 0 && cc.isValid(earlier) && cc.isValid(later), 'retired map or owner mutated');
            return { published: [second.key, first.key], serialized: [first.key,second.key], staleWrites: 4 };
        } finally { for (const owner of owners) if (cc.isValid(owner,true)) owner.destroy(); }
    });
    test('TTFFont', '', 'cancel pending local native transfer and retry font import', async () => {
        const downloader = new jsb.Downloader({ countOfMaxProcessingTasks: 1, timeoutInSeconds: 5, tempFileNameSuffix: '.part' });
        const dest = directory + '/cancel-target.ttf';
        const marker = 'unmodified font destination';
        file.writeStringToFile(marker,dest);
        try {
            const code = await new Promise((resolve, reject) => {
                downloader.onSuccess = () => reject(new Error('cancelled transfer completed'));
                downloader.onError = (task, value) => resolve(value);
                const url = 'file:///' + fontPath.replace(/^\/+/, '');
                const task = downloader.createDownloadTask(encodeURI(url), dest, 'cancel-font');
                downloader.abort(task);
            });
            check(code === -4 && file.getStringFromFile(dest) === marker && !file.isFileExist(dest + '.part'),
                'abort result or partial destination: ' + code);
            const font = await loadFont();
            try { check(font.getFontDataSize() === 223404 && font.getSourcePath() === fontPath, 'retry data'); }
            finally { cc.assetManager.releaseAsset(font); }
            return { code, preservedDestination: true, retriedBytes: 223404 };
        } finally { file.removeFile(dest); }
    });
};
