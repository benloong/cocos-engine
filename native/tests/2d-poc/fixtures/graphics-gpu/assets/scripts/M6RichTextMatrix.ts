import { assetManager, Color, isValid, Node, RichText, sys, TTFFont, UITransform } from 'cc';

const wait = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 80));

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
        }
        metrics.push({ name: item.name, width: ui.width, height: ui.height,
            segments: node.children.map(child => ({ name: child.name, x: child.position.x, y: child.position.y })) });
        node.destroy(); await wait();
    }
    assetManager.releaseAsset(font); await wait();
    const released = !isValid(font);
    if (!released) throw new Error('TTF release did not destroy asset');
    if (sys.isNative && (!(font as any).isReleased() || (font as any).getFontDataSize() !== 0)) throw new Error('TTF native release retained bytes');
    return { loaded: true, released, nativeBytes: bytes, metrics, raster };
}
