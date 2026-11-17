import { assetManager, Color, isValid, Label, Node, RichText, sys, TTFFont, UITransform } from 'cc';

const wait = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 80));

async function checkNativeFontLifecycle (url: string): Promise<object | null> {
    if (!sys.isNative) return null;
    const stats = (): string => JSON.stringify((globalThis as any).jsb.getFontAliasStats());
    const before = stats();
    const cacheBefore = assetManager.assets.count;
    let lastReleased: TTFFont | null = null;
    const load = (source = url): Promise<TTFFont> => new Promise((resolve, reject) => {
        assetManager.loadRemote<TTFFont>(source, { ext: '.ttf' }, (error, asset) => error ? reject(error) : resolve(asset));
    });
    const release = (asset: TTFFont): void => {
        assetManager.releaseAsset(asset);
        lastReleased = asset;
        if (isValid(asset, true) || !(asset as any).isReleased() || (asset as any).getFontDataSize() !== 0
            || assetManager.assets.has(url) || assetManager.assets.count !== cacheBefore || stats() !== before) {
            throw new Error('loadRemote/releaseAsset retained font data, cache or alias records');
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
        if (!rejected || !partial?.isReleased() || partial.getFontDataSize() !== 0 || stats() !== before
            || assetManager.assets.has(url)) throw new Error('Remote font failure did not roll back');
    } finally { Object.defineProperty(prototype, '_nativeAsset', descriptor); }
    release(await load());
    let missingRejected = false;
    try { await load(`${url}.missing.ttf`); } catch { missingRejected = true; }
    if (!missingRejected || stats() !== before || assetManager.assets.count !== cacheBefore) {
        throw new Error('Missing remote font was accepted or retained alias/cache records');
    }
    await wait();
    if (isValid(lastReleased)) throw new Error('Font deferred destruction did not finish');
    return { cycles: 1000, cacheHits: 1000, bytesPerLoad: 223404, assignmentFailureRolledBack: true,
        retrySucceeded: true, missingRejected, deferredDestroyFinished: true,
        before: JSON.parse(before), after: JSON.parse(stats()), cacheBefore, cacheAfter: assetManager.assets.count };
}

/** The real asset factory loads the same TTF bytes in both applications. */
export async function runRichTextMatrix (parent: Node, capture: (name: string) => Promise<void>): Promise<object> {
    const url = sys.isNative ? '__M6_GPU_FONT__' : '/m6-font.ttf';
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
                const opaque = label.getOpaquePixels();
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
    const lifecycle = await checkNativeFontLifecycle(url);
    return { loaded: true, released, nativeBytes: bytes, metrics, raster, lifecycle };
}
