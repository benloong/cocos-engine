import { assetManager, deserialize, director, gfx, Color, instantiate, isValid, Label, Node, Prefab, RichText, sys, TTFFont, UITransform, Vec2 } from 'cc';

const wait = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 80));

async function checkRichTextResizeListener (parent: Node, font: TTFFont): Promise<void> {
    const node = new Node('rich-text-size-listener');
    parent.addChild(node);
    try {
        const rich = node.addComponent(RichText);
        rich.font = font;
        rich.string = 'Initial';
        await wait();
        let notified = false;
        node.once(Node.EventType.SIZE_CHANGED, () => {
            notified = true;
            rich.string = 'Callback replacement';
        });
        rich.string = 'A wider line';
        await wait();
        const backend = (rich as any)._native;
        const text = backend ? backend.getSegmentLabel(0)?.getString() : node.children[0]?.getComponent(Label)?.string;
        if (!notified || text !== 'Callback replacement' || node.children.length !== 1) {
            throw new Error('RichText resize listener did not replace the rendered text');
        }
        console.log('M6_RICHTEXT_RESIZE_LISTENER_PASS');
    } finally {
        node.destroy();
        await wait();
    }
}

async function checkRichTextChildAddedListener (parent: Node, font: TTFFont): Promise<void> {
    const node = new Node('rich-text-child-added-listener');
    parent.addChild(node);
    try {
        const rich = node.addComponent(RichText);
        rich.font = font;
        rich.string = 'Initial';
        await wait();
        let notified = false;
        node.once(Node.EventType.CHILD_ADDED, () => {
            notified = true;
            rich.string = 'Replacement during child attach';
        });
        rich.string = '<b>First</b><i>Second</i>';
        await wait();
        const backend = (rich as any)._native;
        const text = backend ? backend.getSegmentLabel(0)?.getString() : node.children[0]?.getComponent(Label)?.string;
        if (!notified || text !== 'Replacement during child attach' || node.children.length !== 1) {
            throw new Error('RichText child-added listener did not replace the rendered text');
        }
        console.log('M6_RICHTEXT_CHILD_ADDED_LISTENER_PASS');
    } finally {
        node.destroy();
        await wait();
    }
}

async function checkRichTextPrefab (parent: Node, font: TTFFont): Promise<object> {
    const source = '<b>Atlas</b> 123';
    const prefab = deserialize([
        { __type__: 'cc.Prefab', data: { __id__: 1 } },
        { __type__: 'cc.Node', _name: 'RichTextRollback', _components: [{ __id__: 2 }, { __id__: 3 }] },
        { __type__: 'cc.UITransform', node: { __id__: 1 } },
        { __type__: 'cc.RichText', node: { __id__: 1 }, _string: source, _fontSize: 24, _lineHeight: 30 },
    ]) as Prefab;
    const node = instantiate(prefab);
    node.layer = parent.layer;
    parent.addChild(node);
    const rich = node.getComponent(RichText)!;
    rich.font = font;
    await wait();
    const backend = (rich as any)._native;
    const segments = (): string[] => node.children.map((child, i) => backend
        ? backend.getSegmentLabel(i).getString() : child.getComponent(Label)!.string);
    if (rich.string !== source || rich.font !== font || segments().join('|') !== 'Atlas| 123') throw new Error('RichText prefab restoration failed');
    const samples: number[] = [];
    for (let batch = 0; batch < 41; ++batch) {
        const start = performance.now();
        for (let i = 0; i < 8; ++i) rich.string = i % 2 ? source : '<b>World</b> 456';
        const elapsed = performance.now() - start;
        if (batch >= 10) samples.push(elapsed);
    }
    if (segments().join('|') !== 'Atlas| 123') throw new Error('RichText update lost prefab segments');
    const result = { implementation: backend ? 'native' : 'js', segments: segments(), updatesPerBatch: 8, samples };
    node.destroy(); prefab.destroy(); await wait();
    if (isValid(node) || isValid(prefab)) throw new Error('RichText prefab was retained');
    return result;
}

function submittedTextTexture (label: any): gfx.Texture | null {
    const entity = label.getRenderEntity();
    return entity.staticDrawInfoSize ? entity.getStaticRenderDrawInfo(0).texture : null;
}

function submittedTextCoverage (texture: gfx.Texture | null): number {
    if (!texture) return 0;
    const pixels = new Uint8Array(texture.width * texture.height * 4);
    const region = new gfx.BufferTextureCopy();
    region.texExtent.width = texture.width;
    region.texExtent.height = texture.height;
    director.root!.device.copyTextureToBuffers(texture, [pixels], [region]);
    let covered = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 1) ++covered;
    return covered;
}

async function checkCancelledFont (origin: string, reference: string): Promise<void> {
    const { Downloader, fileUtils: files } = (globalThis as any).jsb;
    const downloader = new Downloader({ countOfMaxProcessingTasks: 1, timeoutInSeconds: 10, tempFileNameSuffix: '.tmp' });
    const url = origin + '/m6-cancel.ttf';
    const dest = files.getWritablePath() + '/m6-replacement-' + origin.split(':').pop() + '.ttf';
    const old = 'previous-font';
    if (!files.writeStringToFile(old, dest)) throw new Error('Cannot seed previous font');
    await new Promise<void>((resolve, reject) => {
        downloader.onSuccess = () => reject(new Error('Missing replacement unexpectedly succeeded'));
        downloader.onError = () => resolve();
        downloader.createDownloadTask(origin + '/missing.ttf', dest);
    });
    if (files.getStringFromFile(dest) !== old || files.isFileExist(dest + '.tmp')) {
        throw new Error('Failed replacement modified the destination or left an incomplete file');
    }
    let task: any;
    let cancelled = false;
    let queuedAborted = false;
    const result = await new Promise<number>((resolve, reject) => {
        downloader.onProgress = (_task: any, _delta: number, received: number) => {
            if (!cancelled && received === 4096) {
                cancelled = true;
                const queued = downloader.createDownloadTask(origin + '/never-requested.ttf', dest + '.queued', 'queued');
                downloader.abort(queued);
            }
        };
        downloader.onError = (failed: any, code: number) => {
            if (failed.identifier === 'queued') {
                queuedAborted = code === -4 && !files.isFileExist(dest + '.queued') && !files.isFileExist(dest + '.queued.tmp');
                if (!queuedAborted) reject(new Error('Queued cancellation retained a download or returned ' + code));
                downloader.abort(task);
            } else resolve(code);
        };
        downloader.onSuccess = () => resolve(0);
        task = downloader.createDownloadTask(url, dest);
    });
    if (!cancelled || !queuedAborted || result !== -4 || files.getStringFromFile(dest) !== old || files.getFileSize(dest + '.tmp') !== 4096) {
        throw new Error('Cancelled font did not preserve the old file and resumable prefix: ' + result);
    }
    await new Promise<void>((resolve, reject) => {
        downloader.onSuccess = () => resolve();
        downloader.onError = (_task: any, code: number) => reject(new Error('Font resume failed: ' + code));
        downloader.createDownloadTask(url, dest);
    });
    const bytes = new Uint8Array(files.getDataFromFile(dest));
    const expected = new Uint8Array(files.getDataFromFile(reference));
    if (bytes.length !== 223404 || bytes.length !== expected.length || !bytes.every((v, i) => v === expected[i])
        || files.isFileExist(dest + '.tmp') || !files.removeFile(dest)) throw new Error('Invalid resumed font');
}

async function checkNativeFontLifecycle (url: string, parent: Node): Promise<object | null> {
    if (!sys.isNative) return null;
    if ('getFontAliasStats' in (globalThis as any).jsb) throw new Error('Test-only font diagnostics exposed by JSB');
    const released = (asset: any): boolean => asset.isReleased() && !asset.getFontDataSize()
        && !asset.getSourcePath() && !asset.getFontFamily();
    const cacheBefore = assetManager.assets.count;
    let lastReleased: TTFFont | null = null;
    const load = (source = url, options: { maxRetryCount?: number } = {}): Promise<TTFFont> => new Promise((resolve, reject) => {
        assetManager.loadRemote<TTFFont>(source, { ext: '.ttf', ...options }, (error, asset) => error ? reject(error) : resolve(asset));
    });
    const release = (asset: TTFFont, source = url): void => {
        assetManager.releaseAsset(asset);
        lastReleased = asset;
        if (isValid(asset, true) || !released(asset)
            || assetManager.assets.has(source) || assetManager.assets.count !== cacheBefore) {
            throw new Error('loadRemote/releaseAsset retained font data, cache or source records');
        }
    };
    for (let iteration = 0; iteration < 1000; iteration++) {
        const asset = await load();
        if ((asset as any).getFontDataSize() !== 223404) throw new Error('Reloaded font bytes missing');
        if (await load() !== asset) throw new Error('Cached remote font identity changed');
        release(asset);
        if (iteration % 100 === 0) console.log(`M6_FONT_REMOTE_CYCLE ${iteration + 1}`);
    }
    const prototype = TTFFont.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, '_nativeAsset')!;
    let partial: any;
    Object.defineProperty(prototype, '_nativeAsset', { ...descriptor, set (value) {
        descriptor.set!.call(this, value); partial = this;
        throw new Error('M6 injected remote font assignment failure');
    } });
    try {
        let rejected = false;
        try { await load(); } catch { rejected = true; }
        if (!rejected || !partial || !released(partial)
            || assetManager.assets.has(url)) throw new Error('Remote font failure did not roll back');
    } finally { Object.defineProperty(prototype, '_nativeAsset', descriptor); }
    release(await load());
    let missingRejected = false;
    try { await load(`${url}.missing.ttf`); } catch { missingRejected = true; }
    if (!missingRejected || assetManager.assets.count !== cacheBefore) {
        throw new Error('Missing remote font was accepted or retained cache records');
    }
    await wait();
    if (isValid(lastReleased)) throw new Error('Font deferred destruction did not finish');
    const files = (globalThis as any).jsb.fileUtils;
    const origin = files.getStringFromFile('m6-font-http-origin.txt').trim();
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error('HTTP font fixture origin missing');
    const httpUrl = `${origin}/m6-http-font.ttf`, cache = assetManager.cacheManager!;
    if (cache.getCache(httpUrl)) cache.removeCache(httpUrl);
    const diskEntries = (): string => JSON.stringify(files.listFiles((cache as any).cacheDir).sort());
    const entriesBefore = diskEntries();
    let interrupted = false;
    try { await load(httpUrl, { maxRetryCount: 0 }); } catch { interrupted = true; }
    if (!interrupted || diskEntries() !== entriesBefore || cache.getCache(httpUrl) || assetManager.assets.has(httpUrl)
        || assetManager.assets.count !== cacheBefore) {
        throw new Error('Partial font transfer was accepted or left a cache or alias entry');
    }
    const httpFont = await load(httpUrl, { maxRetryCount: 0 });
    const cachedSource = (httpFont as any).getSourcePath();
    if (httpFont.nativeUrl !== httpUrl || cachedSource !== cache.getCache(httpUrl) || !files.isFileExist(cachedSource)
        || (httpFont as any).getFontDataSize() !== 223404) throw new Error('HTTP font did not resolve its downloaded cache path');
    const node = new Node('http-font'); node.layer = parent.layer; parent.addChild(node);
    const ui = node.addComponent(UITransform), label = node.addComponent(Label);
    label.useSystemFont = false; label.font = httpFont; label.fontSize = 24; label.string = 'Atlas 123';
    await wait();
    const width = ui.width;
    if (Math.abs(width - 95.9765625) > 0.001 || !submittedTextCoverage(submittedTextTexture((label as any)._native))) throw new Error('HTTP font fallback or empty rendering');
    node.destroy(); await wait();
    release(httpFont, httpUrl);
    cache.removeCache(httpUrl); await wait();
    if (cache.getCache(httpUrl) || files.isFileExist(cachedSource)) throw new Error('Released HTTP font cache file was retained');
    let httpMissingRejected = false;
    try { await load(`${origin}/missing.ttf`); } catch { httpMissingRejected = true; }
    if (!httpMissingRejected || diskEntries() !== entriesBefore || assetManager.assets.count !== cacheBefore) throw new Error('HTTP 404 retained font state');
    await checkCancelledFont(origin, url);
    const http = { interrupted, loaded: true, bytes: 223404, cachePathResolved: true, width, released: true, cacheRemoved: true,
        missingRejected: true, failedFilesRemoved: true, cancelledAndResumed: true };
    return { cycles: 1000, cacheHits: 1000, bytesPerLoad: 223404, assignmentFailureRolledBack: true,
        retrySucceeded: true, missingRejected, deferredDestroyFinished: true,
        cacheBefore, cacheAfter: assetManager.assets.count, http };
}

async function checkShadowOffsets (parent: Node, font: TTFFont, readPixels: () => Uint8Array): Promise<{
    hardShadowCoverage: number[]; blurredShadowCenters: { sign: number; dx: number; dy: number }[];
}> {
    const node = new Node('hard-shadow');
    parent.addChild(node);
    node.layer = parent.layer;
    const ui = node.addComponent(UITransform);
    const label = node.addComponent(Label);
    label.font = font;
    label.fontSize = 24;
    label.lineHeight = 30;
    label.overflow = Label.Overflow.CLAMP;
    ui.setContentSize(96, 96);
    label.horizontalAlign = 1;
    label.verticalAlign = 1;
    label.string = 'I';
    label.shadowColor = new Color(0, 255, 0, 255);
    label.shadowBlur = 0;
    label.enableShadow = false;
    await wait();
    const noShadow = readPixels();
    if (!noShadow.some((value, index) => index % 4 === 0 && value > 127)) throw new Error('Missing shadow reference glyph');
    label.enableShadow = true;
    for (const offset of [new Vec2(0, 0), new Vec2(0.000001, -0.000001)]) {
        label.shadowOffset = offset;
        await wait();
        const image = readPixels();
        let changed = 0;
        for (let i = 0; i < image.length; i += 4) {
            if (image[i] !== noShadow[i] || image[i + 1] !== noShadow[i + 1]
                || image[i + 2] !== noShadow[i + 2] || image[i + 3] !== noShadow[i + 3]) ++changed;
        }
        if (changed) throw new Error(`Inactive shadow at (${offset.x}, ${offset.y}) changed ${changed} pixels`);
    }
    const coverage: number[] = [];
    const blurredShadowCenters: { sign: number; dx: number; dy: number }[] = [];
    for (const sign of [1, -1]) {
        const offset = new Vec2(16 * sign, 14 * sign);
        label.shadowOffset = offset;
        node.setPosition(0, 0, 0);
        await wait();
        const original = readPixels();
        node.setPosition(offset.x, offset.y, 0);
        await wait();
        const moved = readPixels();
        let covered = 0;
        let mismatches = 0;
        for (let i = 0; i < original.length; i += 4) {
            const shadow = original[i + 1] - original[i] > 127;
            const glyph = moved[i] > 127;
            if (glyph) ++covered;
            if (glyph !== shadow) ++mismatches;
        }
        if (!covered || mismatches) throw new Error(`Hard shadow ${sign}: ${mismatches} differing pixels for ${covered} glyph pixels`);
        coverage.push(covered);
        // With blur, compare centers instead of the sharp glyph boundary.
        label.shadowBlur = 2;
        node.setPosition(0, 0, 0);
        await wait();
        const blurred = readPixels();
        node.setPosition(offset.x, offset.y, 0);
        await wait();
        const translated = readPixels();
        const width = Math.sqrt(blurred.length / 4);
        let mass = 0, shadowX = 0, shadowY = 0;
        let ink = 0, glyphX = 0, glyphY = 0;
        for (let i = 0; i < blurred.length; i += 4) {
            const x = (i / 4) % width, y = Math.floor(i / 4 / width);
            const green = Math.max(0, blurred[i + 1] - blurred[i]);
            const white = Math.max(0, translated[i] - 1); // Label textures carry a 1/255 background.
            mass += green; shadowX += green * x; shadowY += green * y;
            ink += white; glyphX += white * x; glyphY += white * y;
        }
        const dx = shadowX / mass - glyphX / ink, dy = shadowY / mass - glyphY / ink;
        if (!mass || !ink || Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            throw new Error(`Blurred shadow ${sign}: center differs from translated glyph by (${dx}, ${dy}) pixels`);
        }
        blurredShadowCenters.push({ sign, dx, dy });
        label.shadowBlur = 0;
    }
    node.destroy();
    await wait();
    return { hardShadowCoverage: coverage, blurredShadowCenters };
}

async function captureShadowLayout (parent: Node, font: TTFFont, capture: (name: string) => Promise<void>): Promise<object[]> {
    const node = new Node('shadow-layout');
    parent.addChild(node);
    node.layer = parent.layer;
    const ui = node.addComponent(UITransform);
    const label = node.addComponent(Label);
    label.font = font;
    label.fontSize = 24;
    label.lineHeight = 30;
    label.enableShadow = true;
    label.shadowBlur = 0;
    label.shadowColor = new Color(255, 255, 255, 255);
    label.string = 'Atlas';
    const metrics: object[] = [];
    const captureLabel = async (name: string): Promise<void> => {
        await capture(name);
        const texture = label.ttfSpriteFrame!.texture!;
        metrics.push({ name, width: ui.width, height: ui.height, textureWidth: texture.width, textureHeight: texture.height });
    };
    for (const overflow of [Label.Overflow.NONE, Label.Overflow.CLAMP, Label.Overflow.SHRINK, Label.Overflow.RESIZE_HEIGHT]) {
        label.overflow = overflow;
        if (overflow !== Label.Overflow.NONE) ui.setContentSize(96, 72);
        for (const align of [0, 1, 2]) {
            label.horizontalAlign = align;
            label.verticalAlign = align;
            for (const sign of [1, -1]) {
                label.shadowOffset = new Vec2(16 * sign, 14 * sign);
                const name = `label-shadow-${overflow}-${align}-${sign > 0 ? 'positive' : 'negative'}`;
                await captureLabel(name);
            }
        }
    }
    label.overflow = Label.Overflow.CLAMP;
    ui.setContentSize(128, 128);
    label.horizontalAlign = 1;
    label.verticalAlign = 1;
    label.string = 'Atlas\nAtlas';
    for (const sign of [1, -1]) {
        label.shadowOffset = new Vec2(0, sign * label.lineHeight);
        await captureLabel('label-shadow-multiline-' + (sign > 0 ? 'positive' : 'negative'));
    }
    node.destroy();
    await wait();
    return metrics;
}

/** The real asset factory loads the same TTF bytes in both applications. */
export async function runRichTextMatrix (parent: Node, capture: (name: string) => Promise<void>, readPixels: () => Uint8Array): Promise<object> {
    const url = sys.isNative ? '__M6_GPU_FONT__' : '/m6-font.ttf';
    const loadFont = (): Promise<TTFFont> => new Promise((resolve, reject) => {
        assetManager.loadRemote<TTFFont>(url, { ext: '.ttf' }, (error, asset) => error ? reject(error) : resolve(asset!));
    });
    if (!sys.isNative) {
        const controller = new AbortController();
        const partial = await fetch('/m6-cancel.ttf', { signal: controller.signal, cache: 'no-store' });
        const reader = partial.body!.getReader();
        const bytes = new Uint8Array(223404);
        let offset = 0;
        while (offset < 4096) {
            const part = await reader.read();
            if (part.done) throw new Error('Font ended before cancellation');
            bytes.set(part.value, offset);
            offset += part.value.length;
        }
        controller.abort();
        let aborted = false;
        try { await reader.read(); } catch (error) { aborted = (error as Error).name === 'AbortError'; }
        const tail = await fetch('/m6-cancel.ttf', { headers: { Range: 'bytes=4096-' }, cache: 'no-store' });
        if (!aborted || offset !== 4096 || tail.status !== 206) throw new Error('Web font cancellation or resume failed');
        bytes.set(new Uint8Array(await tail.arrayBuffer()), offset);
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
        if (Array.from(digest, value => value.toString(16).padStart(2, '0')).join('') !== '2d403c658025f377d943e401785927d8b58c5d26cf89d82b2a6cdef9949efc16') {
            throw new Error('Resumed Web font differs from the fixture');
        }
        const fallback = await loadFont();
        const family = fallback._nativeAsset;
        if (!family || !assetManager.assets.has(url)) throw new Error('Web did not cache the fallback font asset');
        const context = document.createElement('canvas').getContext('2d')!;
        context.font = '24px monospace';
        const fallbackWidth = context.measureText('Atlas 123').width;
        context.font = '24px "' + family + '", monospace';
        if (context.measureText('Atlas 123').width !== fallbackWidth) throw new Error('Truncated Web font did not use the fallback');
        assetManager.releaseAsset(fallback); await wait();
        if (isValid(fallback) || assetManager.assets.has(url)) throw new Error('Web fallback font asset was retained');
    }
    const font = await loadFont();
    if (!font || !isValid(font) || !font._nativeAsset) throw new Error('TTF factory did not load an alias');
    if (!sys.isNative) {
        const context = document.createElement('canvas').getContext('2d')!;
        context.font = '24px "' + font._nativeAsset + '", monospace';
        const width = context.measureText('Atlas 123').width;
        if (Math.abs(width - 95.9765625) > .001) throw new Error('Web retry still uses the fallback: ' + width);
    }
    const bytes = sys.isNative ? (font as any).getFontDataSize() : null;
    if (sys.isNative && bytes !== 223404) throw new Error(`TTF native byte count: ${bytes}`);
    const { hardShadowCoverage, blurredShadowCenters } = await checkShadowOffsets(parent, font, readPixels);
    const prefab = await checkRichTextPrefab(parent, font);
    await checkRichTextResizeListener(parent, font);
    await checkRichTextChildAddedListener(parent, font);
    const cases = [
        { name: 'text-basic', value: 'Atlas 123' },
        { name: 'text-bold', value: '<b>Atlas 123</b>' },
        { name: 'text-italic', value: '<i>Atlas 123</i>' },
        { name: 'text-underline', value: '<u>Atlas 123</u>' },
        { name: 'text-outline', value: '<outline color=#00ff00 width=2>Atlas</outline>' },
        { name: 'text-nested', value: '<b>Atlas <i><color=#ff0000>123</color></i></b>' },
        { name: 'text-colors', value: '<color=#ff0000>Red</color><color=#00ff00>Green</color>' },
        { name: 'text-wrap-left', value: 'Atlas 123 Atlas 456', width: 120, align: 0 },
        { name: 'text-wrap-center', value: 'Atlas 123 Atlas 456', width: 120, align: 1 },
        { name: 'text-wrap-right', value: 'Atlas 123 Atlas 456', width: 120, align: 2 },
        { name: 'text-multiline', value: 'Atlas<br/><size=18>123</size>' },
        { name: 'text-unicode', value: 'ไทย Á 123' },
        { name: 'text-shadow-tag', value: '<shadow color=#0000ff blur=4><color=#ff0000>Red</color></shadow><color=#00ff00>Green</color>',
            initial: '<size=36>Before<br/>edit</size>' },
        { name: 'text-bidi-override', value: 'A\u202E123\u202CB' },
        { name: 'text-bidi-visual', value: 'A321B' },
        { name: 'text-thai-marks', value: '\u0E01\u0E34\u0E49 \u0E19\u0E49\u0E33' },
    ];
    const metrics: object[] = [];
    const raster: object[] = [];
    for (const item of cases) {
        const node = new Node(item.name); node.layer = parent.layer; parent.addChild(node);
        const ui = node.addComponent(UITransform); ui.setAnchorPoint(0.5, 0.5);
        const rich = node.addComponent(RichText); rich.font = font; rich.fontSize = 24; rich.lineHeight = 30;
        rich.fontColor = new Color(255, 255, 255, 255); rich.maxWidth = item.width ?? 0;
        rich.horizontalAlign = item.align ?? 0;
        if (item.initial) {
            rich.string = item.initial;
            await wait();
            if (node.children.length !== 2 || node.children[0].position.y === node.children[1].position.y) {
                throw new Error('Expected two visible lines before the RichText edit');
            }
        }
        rich.string = item.value;
        const backend = (rich as any)._native;
        const expectNative = sys.isNative && !(globalThis as any).__m6JsRichText;
        if (!!backend !== expectNative) throw new Error('Unexpected RichText implementation');
        await capture(item.name);
        if (sys.isNative) {
            const labels = [];
            if (backend && (backend.getSegmentLabel(node.children.length) || backend.getSegmentSprite(node.children.length))) {
                throw new Error('Native RichText has a segment without a child node');
            }
            for (let i = 0; i < node.children.length; ++i) {
                const label = backend ? backend.getSegmentLabel(i) : (node.children[i].getComponent(Label) as any)?._native;
                if (!label) throw new Error(`Missing native Label in ${item.name}/${i}`);
                const texture = submittedTextTexture(label);
                const opaque = submittedTextCoverage(texture);
                if (!texture || !opaque) throw new Error(`Batcher did not prepare visible text: ${item.name}/${i}`);
                labels.push({ opaque, width: texture.width, height: texture.height });
            }
            raster.push({ name: item.name, labels });
        } else {
            raster.push({ name: item.name, labels: node.children.map(child => {
                const label: any = child.getComponent(Label);
                const canvas = label.assemblerData.canvas;
                return { width: canvas.width, height: canvas.height, font: label.assemblerData.context.font,
                    actualFontSize: label.textStyle.actualFontSize, fontScale: label.textStyle.fontScale,
                    canvasSize: { width: label.textLayoutData.canvasSize.width, height: label.textLayoutData.canvasSize.height },
                    start: { x: label.textLayoutData.startPosition.x, y: label.textLayoutData.startPosition.y } };
            }) });
        }
        metrics.push({ name: item.name, width: ui.width, height: ui.height,
            segments: node.children.map(child => ({ name: child.name, x: child.position.x, y: child.position.y })) });
        node.destroy(); await wait();
    }
    const shadowLayout = await captureShadowLayout(parent, font, capture);
    assetManager.releaseAsset(font); await wait();
    const released = !isValid(font);
    if (!released) throw new Error('TTF release did not destroy asset');
    if (sys.isNative && (!(font as any).isReleased() || (font as any).getFontDataSize() !== 0)) throw new Error('TTF native release retained bytes');
    const lifecycle = await checkNativeFontLifecycle(url, parent);
    return { loaded: true, released, nativeBytes: bytes, metrics, raster, lifecycle, prefab, hardShadowCoverage, blurredShadowCenters, shadowLayout };
}
