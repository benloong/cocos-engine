import { assetManager, director, gfx, Color, isValid, Label, Node, RichText, sys, TTFFont, UITransform } from 'cc';

const wait = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 80));

function submittedTextCoverage (label: any): number {
    const entity = label.getRenderEntity();
    if (!entity.staticDrawInfoSize) return 0;
    const texture = entity.getStaticRenderDrawInfo(0).texture;
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
    let interrupted = false;
    try { await load(httpUrl, { maxRetryCount: 0 }); } catch { interrupted = true; }
    if (!interrupted || cache.getCache(httpUrl) || assetManager.assets.has(httpUrl)
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
    if (Math.abs(width - 95.9765625) > 0.001 || !submittedTextCoverage((label as any)._native)) throw new Error('HTTP font fallback or empty rendering');
    node.destroy(); await wait();
    release(httpFont, httpUrl);
    cache.removeCache(httpUrl); await wait();
    if (cache.getCache(httpUrl) || files.isFileExist(cachedSource)) throw new Error('Released HTTP font cache file was retained');
    let httpMissingRejected = false;
    try { await load(`${origin}/missing.ttf`); } catch { httpMissingRejected = true; }
    if (!httpMissingRejected || assetManager.assets.count !== cacheBefore) throw new Error('HTTP 404 retained font state');
    const http = { interrupted, loaded: true, bytes: 223404, cachePathResolved: true, width, released: true, cacheRemoved: true, missingRejected: true };
    return { cycles: 1000, cacheHits: 1000, bytesPerLoad: 223404, assignmentFailureRolledBack: true,
        retrySucceeded: true, missingRejected, deferredDestroyFinished: true,
        cacheBefore, cacheAfter: assetManager.assets.count, http };
}

/** The real asset factory loads the same TTF bytes in both applications. */
export async function runRichTextMatrix (parent: Node, capture: (name: string) => Promise<void>): Promise<object> {
    const url = sys.isNative ? '__M6_GPU_FONT__' : '/m6-font.ttf';
    if (!sys.isNative) {
        // Read the entire response: fetch resolves the headers before a truncated body rejects.
        const response = await fetch(url, { cache: 'no-store' });
        let truncated = false;
        try { await response.arrayBuffer(); } catch { truncated = true; }
        if (response.status !== 200 || !truncated || assetManager.assets.has(url)) {
            throw new Error('Expected a truncated Web font response before loading the TTF');
        }
    }
    const font = await new Promise<TTFFont>((resolve, reject) => {
        assetManager.loadRemote<TTFFont>(url, { ext: '.ttf' }, (error, asset) => error ? reject(error) : resolve(asset!));
    });
    if (!font || !isValid(font) || !font._nativeAsset) throw new Error('TTF factory did not load an alias');
    const bytes = sys.isNative ? (font as any).getFontDataSize() : null;
    if (sys.isNative && bytes !== 223404) throw new Error(`TTF native byte count: ${bytes}`);
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
    ];
    const metrics: object[] = [];
    const raster: object[] = [];
    for (const item of cases) {
        const node = new Node(item.name); node.layer = parent.layer; parent.addChild(node);
        const ui = node.addComponent(UITransform); ui.setAnchorPoint(0.5, 0.5);
        const rich = node.addComponent(RichText); rich.font = font; rich.fontSize = 24; rich.lineHeight = 30;
        rich.fontColor = new Color(255, 255, 255, 255); rich.maxWidth = item.width ?? 0;
        rich.horizontalAlign = item.align ?? 0; rich.string = item.value;
        if (sys.isNative && !(rich as any)._native) throw new Error('RichText native override not active');
        await capture(item.name);
        if (sys.isNative) {
            const backend = (rich as any)._native;
            const labels = [];
            for (let i = 0; i < backend.getSegmentCount(); ++i) {
                const label = backend.getSegmentLabel(i);
                const opaque = submittedTextCoverage(label);
                if (!opaque) throw new Error(`Batcher did not prepare visible text: ${item.name}/${i}`);
                labels.push({ opaque, width: label.getTextureWidth(), height: label.getTextureHeight() });
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
    assetManager.releaseAsset(font); await wait();
    const released = !isValid(font);
    if (!released) throw new Error('TTF release did not destroy asset');
    if (sys.isNative && (!(font as any).isReleased() || (font as any).getFontDataSize() !== 0)) throw new Error('TTF native release retained bytes');
    const lifecycle = await checkNativeFontLifecycle(url, parent);
    return { loaded: true, released, nativeBytes: bytes, metrics, raster, lifecycle };
}
